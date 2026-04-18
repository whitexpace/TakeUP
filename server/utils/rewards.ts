import { TransactionStatus, type Prisma, type ReviewType } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { isActiveDisputeStatus } from "./dispute-status"

export const RewardSourceType = {
  TRANSACTION_COMPLETED: "TRANSACTION_COMPLETED",
  REVIEW_SUBMITTED: "REVIEW_SUBMITTED",
  DISPUTE_RESOLUTION_ADJUSTMENT: "DISPUTE_RESOLUTION_ADJUSTMENT",
  BOOST_REDEMPTION: "BOOST_REDEMPTION",
  MANUAL_ADJUSTMENT: "MANUAL_ADJUSTMENT",
} as const

export type RewardSourceType = (typeof RewardSourceType)[keyof typeof RewardSourceType]

export const RewardRoleCategory = {
  BORROWER: "BORROWER",
  LENDER: "LENDER",
  GENERAL: "GENERAL",
} as const

export type RewardRoleCategory = (typeof RewardRoleCategory)[keyof typeof RewardRoleCategory]

export const RewardEventStatus = {
  PENDING: "PENDING",
  APPLIED: "APPLIED",
  REVERSED: "REVERSED",
  BLOCKED: "BLOCKED",
} as const

export type RewardEventStatus = (typeof RewardEventStatus)[keyof typeof RewardEventStatus]

export const ItemBoostType = {
  STANDARD_24_HOUR: "STANDARD_24_HOUR",
} as const

export type ItemBoostType = (typeof ItemBoostType)[keyof typeof ItemBoostType]

export const ItemBoostStatus = {
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
} as const

export type ItemBoostStatus = (typeof ItemBoostStatus)[keyof typeof ItemBoostStatus]

export const DisputeOutcome = {
  BORROWER_AT_FAULT: "BORROWER_AT_FAULT",
  LENDER_AT_FAULT: "LENDER_AT_FAULT",
  SHARED_FAULT: "SHARED_FAULT",
  DISMISSED: "DISMISSED",
  NO_FAULT: "NO_FAULT",
} as const

export type DisputeOutcome = (typeof DisputeOutcome)[keyof typeof DisputeOutcome]

const DEFAULT_REWARD_CONFIG = {
  borrowerBasePoints: 10,
  lenderBasePoints: 10,
  reviewSubmissionBonus: 5,
  sharedFaultRatio: 0.5,
} as const

const ITEM_BOOST_CONFIG = {
  [ItemBoostType.STANDARD_24_HOUR]: {
    pointsCost: 50,
    durationHours: 24,
    boostScore: 1,
  },
} as const

type RewardLedgerTotals = {
  availablePoints: number
  totalPointsEarned: number
  borrowerPoints: number
  lenderPoints: number
  pendingPoints: number
}

type RewardDecision = {
  pointsDelta: number
  status: RewardEventStatus
  reason:
    | "eligible"
    | "pending_dispute"
    | "blocked_by_fault"
    | "shared_fault"
    | "transaction_ineligible"
    | "incomplete_required_reviews"
}

type RewardEventLedgerEntry = {
  pointsDelta: number
  roleCategory: RewardRoleCategory
  status: RewardEventStatus
}

const rewardProcessingDisputeSelect = {
  id: true,
  status: true,
  outcome: true,
  createdAt: true,
  reviewedAt: true,
} satisfies Prisma.TransactionDisputeSelect

type RewardProcessingDispute = Prisma.TransactionDisputeGetPayload<{
  select: typeof rewardProcessingDisputeSelect
}>

type RewardParticipantRole = "borrower" | "lender"

const rewardTransactionSelect = {
  id: true,
  status: true,
  borrowerId: true,
  lenderId: true,
  reviews: {
    select: {
      id: true,
    },
  },
  disputes: {
    select: rewardProcessingDisputeSelect,
  },
} satisfies Prisma.RentalTransactionSelect

type RewardTransactionRecord = Prisma.RentalTransactionGetPayload<{
  select: typeof rewardTransactionSelect
}>

const rewardReviewSelect = {
  id: true,
  reviewType: true,
  reviewerUserId: true,
  transactionId: true,
  transaction: {
    select: {
      id: true,
      status: true,
      itemId: true,
      borrowerId: true,
      lenderId: true,
      disputes: {
        select: rewardProcessingDisputeSelect,
      },
    },
  },
} satisfies Prisma.TransactionReviewSelect

type RewardReviewRecord = Prisma.TransactionReviewGetPayload<{
  select: typeof rewardReviewSelect
}>

type RewardClient = Prisma.TransactionClient | Prisma.DefaultPrismaClient

const hasRewardEventDelegate = (prisma: RewardClient) =>
  typeof (prisma as { rewardEvent?: { upsert?: unknown } }).rewardEvent?.upsert === "function"

const hasUserRewardDelegate = (prisma: RewardClient) =>
  typeof (prisma as { userReward?: { upsert?: unknown } }).userReward?.upsert === "function"

const roundPoints = (value: number) => Math.max(0, Math.round(value))

const getBoostConfig = (boostType: ItemBoostType) => ITEM_BOOST_CONFIG[boostType]

const getRoleCategory = (role: RewardParticipantRole) =>
  role === "borrower" ? RewardRoleCategory.BORROWER : RewardRoleCategory.LENDER

const getLatestRewardRelevantDispute = (disputes: RewardProcessingDispute[] = []) => {
  const active = disputes
    .filter((dispute) => isActiveDisputeStatus(dispute.status))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .at(0)

  if (active) {
    return active
  }

  return [...disputes]
    .sort((left, right) => {
      const rightTime = right.reviewedAt?.getTime() ?? right.createdAt.getTime()
      const leftTime = left.reviewedAt?.getTime() ?? left.createdAt.getTime()
      return rightTime - leftTime
    })
    .at(0)
}

export const getTransactionRewardDecision = ({
  role,
  dispute,
  basePoints,
  transactionStatus,
}: {
  role: RewardParticipantRole
  dispute: RewardProcessingDispute | undefined
  basePoints: number
  transactionStatus: TransactionStatus
}): RewardDecision => {
  if (transactionStatus !== TransactionStatus.COMPLETED) {
    return {
      pointsDelta: 0,
      status: RewardEventStatus.BLOCKED,
      reason: "transaction_ineligible",
    }
  }

  if (!dispute) {
    return {
      pointsDelta: basePoints,
      status: RewardEventStatus.APPLIED,
      reason: "eligible",
    }
  }

  if (isActiveDisputeStatus(dispute.status)) {
    return {
      pointsDelta: basePoints,
      status: RewardEventStatus.PENDING,
      reason: "pending_dispute",
    }
  }

  switch (dispute.outcome) {
    case DisputeOutcome.BORROWER_AT_FAULT:
      return role === "borrower"
        ? { pointsDelta: 0, status: RewardEventStatus.BLOCKED, reason: "blocked_by_fault" }
        : { pointsDelta: basePoints, status: RewardEventStatus.APPLIED, reason: "eligible" }
    case DisputeOutcome.LENDER_AT_FAULT:
      return role === "lender"
        ? { pointsDelta: 0, status: RewardEventStatus.BLOCKED, reason: "blocked_by_fault" }
        : { pointsDelta: basePoints, status: RewardEventStatus.APPLIED, reason: "eligible" }
    case DisputeOutcome.SHARED_FAULT:
      return {
        pointsDelta: roundPoints(basePoints * DEFAULT_REWARD_CONFIG.sharedFaultRatio),
        status: RewardEventStatus.APPLIED,
        reason: "shared_fault",
      }
    case DisputeOutcome.DISMISSED:
    case DisputeOutcome.NO_FAULT:
    default:
      return {
        pointsDelta: basePoints,
        status: RewardEventStatus.APPLIED,
        reason: "eligible",
      }
  }
}

export const getReviewRewardDecision = ({
  role,
  dispute,
  transactionStatus,
}: {
  role: RewardParticipantRole
  dispute: RewardProcessingDispute | undefined
  transactionStatus: TransactionStatus
}): RewardDecision => {
  if (transactionStatus !== TransactionStatus.COMPLETED) {
    return {
      pointsDelta: 0,
      status: RewardEventStatus.BLOCKED,
      reason: "transaction_ineligible",
    }
  }

  if (!dispute) {
    return {
      pointsDelta: DEFAULT_REWARD_CONFIG.reviewSubmissionBonus,
      status: RewardEventStatus.APPLIED,
      reason: "eligible",
    }
  }

  if (isActiveDisputeStatus(dispute.status)) {
    return {
      pointsDelta: DEFAULT_REWARD_CONFIG.reviewSubmissionBonus,
      status: RewardEventStatus.PENDING,
      reason: "pending_dispute",
    }
  }

  if (
    (dispute.outcome === DisputeOutcome.BORROWER_AT_FAULT && role === "borrower") ||
    (dispute.outcome === DisputeOutcome.LENDER_AT_FAULT && role === "lender")
  ) {
    return {
      pointsDelta: 0,
      status: RewardEventStatus.BLOCKED,
      reason: "blocked_by_fault",
    }
  }

  return {
    pointsDelta: DEFAULT_REWARD_CONFIG.reviewSubmissionBonus,
    status: RewardEventStatus.APPLIED,
    reason: dispute.outcome === DisputeOutcome.SHARED_FAULT ? "shared_fault" : "eligible",
  }
}

export const calculateRewardTotalsFromEvents = (
  events: RewardEventLedgerEntry[],
): RewardLedgerTotals => {
  return events.reduce<RewardLedgerTotals>(
    (totals, event) => {
      if (event.status === RewardEventStatus.APPLIED) {
        totals.availablePoints += event.pointsDelta

        if (event.pointsDelta > 0) {
          totals.totalPointsEarned += event.pointsDelta

          if (event.roleCategory === RewardRoleCategory.BORROWER) {
            totals.borrowerPoints += event.pointsDelta
          }

          if (event.roleCategory === RewardRoleCategory.LENDER) {
            totals.lenderPoints += event.pointsDelta
          }
        }
      }

      if (event.status === RewardEventStatus.PENDING && event.pointsDelta > 0) {
        totals.pendingPoints += event.pointsDelta
      }

      return totals
    },
    {
      availablePoints: 0,
      totalPointsEarned: 0,
      borrowerPoints: 0,
      lenderPoints: 0,
      pendingPoints: 0,
    },
  )
}

const ensureLegacyRewardEvent = async (prisma: RewardClient, userId: string) => {
  const legacyEventKey = `legacy:reward-balance:${userId}`
  const existingLegacyEvent = await prisma.rewardEvent.findUnique({
    where: { idempotencyKey: legacyEventKey },
    select: { id: true },
  })

  if (existingLegacyEvent) {
    return
  }

  const snapshot = await prisma.userReward.findUnique({
    where: { userId },
    select: {
      availablePoints: true,
      borrowerPoints: true,
      lenderPoints: true,
      pendingPoints: true,
    },
  })

  if (
    !snapshot ||
    snapshot.availablePoints <= 0 ||
    snapshot.borrowerPoints > 0 ||
    snapshot.lenderPoints > 0 ||
    snapshot.pendingPoints > 0
  ) {
    return
  }

  await prisma.rewardEvent.create({
    data: {
      userId,
      idempotencyKey: legacyEventKey,
      sourceType: RewardSourceType.MANUAL_ADJUSTMENT,
      roleCategory: RewardRoleCategory.GENERAL,
      pointsDelta: snapshot.availablePoints,
      status: RewardEventStatus.APPLIED,
      metadata: {
        reason: "legacy_balance_backfill",
      },
      appliedAt: new Date(),
    },
  })
}

const syncUserRewardLedger = async (prisma: RewardClient, userId: string) => {
  await ensureLegacyRewardEvent(prisma, userId)

  const events = await prisma.rewardEvent.findMany({
    where: { userId },
    select: {
      pointsDelta: true,
      roleCategory: true,
      status: true,
    },
  })

  const totals = calculateRewardTotalsFromEvents(events)

  await prisma.userReward.upsert({
    where: { userId },
    create: {
      userId,
      ...totals,
    },
    update: totals,
  })
}

const syncManyUserRewardLedgers = async (prisma: RewardClient, userIds: Array<string | null>) => {
  const uniqueUserIds = [...new Set(userIds.filter((userId): userId is string => Boolean(userId)))]
  await Promise.all(uniqueUserIds.map((userId) => syncUserRewardLedger(prisma, userId)))
}

const upsertRewardEvent = async (
  prisma: RewardClient,
  input: {
    userId: string
    transactionId?: string | null
    reviewId?: string | null
    itemBoostId?: string | null
    idempotencyKey: string
    sourceType: RewardSourceType
    roleCategory: RewardRoleCategory
    pointsDelta: number
    status: RewardEventStatus
    metadata: Prisma.InputJsonValue
  },
) => {
  return prisma.rewardEvent.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      userId: input.userId,
      transactionId: input.transactionId ?? null,
      reviewId: input.reviewId ?? null,
      itemBoostId: input.itemBoostId ?? null,
      idempotencyKey: input.idempotencyKey,
      sourceType: input.sourceType,
      roleCategory: input.roleCategory,
      pointsDelta: input.pointsDelta,
      status: input.status,
      metadata: input.metadata,
      appliedAt: input.status === RewardEventStatus.APPLIED ? new Date() : null,
    },
    update: {
      transactionId: input.transactionId ?? null,
      reviewId: input.reviewId ?? null,
      itemBoostId: input.itemBoostId ?? null,
      roleCategory: input.roleCategory,
      pointsDelta: input.pointsDelta,
      status: input.status,
      metadata: input.metadata,
      appliedAt: input.status === RewardEventStatus.APPLIED ? new Date() : null,
    },
  })
}

export const expireActiveBoosts = async (prisma: RewardClient) => {
  const now = new Date()

  const itemBoostDelegate = (prisma as { itemBoost?: { updateMany?: unknown } }).itemBoost
  if (itemBoostDelegate && typeof itemBoostDelegate.updateMany === "function") {
    await prisma.itemBoost.updateMany({
      where: {
        status: ItemBoostStatus.ACTIVE,
        expiresAt: { lte: now },
      },
      data: {
        status: ItemBoostStatus.EXPIRED,
      },
    })
  }

  const itemDelegate = (prisma as { item?: { updateMany?: unknown } }).item
  if (itemDelegate && typeof itemDelegate.updateMany === "function") {
    await prisma.item.updateMany({
      where: {
        boostExpiresAt: { lte: now },
      },
      data: {
        boostScore: 0,
        boostExpiresAt: null,
      },
    })
  }
}

const findRewardTransaction = async (
  prisma: RewardClient,
  transactionId: string,
): Promise<RewardTransactionRecord | null> => {
  return prisma.rentalTransaction.findUnique({
    where: { id: transactionId },
    select: rewardTransactionSelect,
  })
}

export const processTransactionRewards = async (prisma: RewardClient, transactionId: string) => {
  if (!hasRewardEventDelegate(prisma) || !hasUserRewardDelegate(prisma)) {
    return
  }

  const transaction = await findRewardTransaction(prisma, transactionId)

  if (!transaction || !transaction.borrowerId || !transaction.lenderId) {
    return
  }

  const dispute = getLatestRewardRelevantDispute(transaction.disputes ?? [])
  const borrowerDecision = getTransactionRewardDecision({
    role: "borrower",
    dispute,
    basePoints: DEFAULT_REWARD_CONFIG.borrowerBasePoints,
    transactionStatus: transaction.status,
  })
  const lenderDecision = getTransactionRewardDecision({
    role: "lender",
    dispute,
    basePoints: DEFAULT_REWARD_CONFIG.lenderBasePoints,
    transactionStatus: transaction.status,
  })

  await upsertRewardEvent(prisma, {
    userId: transaction.borrowerId,
    transactionId: transaction.id,
    idempotencyKey: `transaction:${transaction.id}:borrower:base`,
    sourceType: RewardSourceType.TRANSACTION_COMPLETED,
    roleCategory: RewardRoleCategory.BORROWER,
    pointsDelta: borrowerDecision.pointsDelta,
    status: borrowerDecision.status,
    metadata: {
      role: "borrower",
      reason: borrowerDecision.reason,
      disputeId: dispute?.id ?? null,
      disputeOutcome: dispute?.outcome ?? null,
    },
  })

  await upsertRewardEvent(prisma, {
    userId: transaction.lenderId,
    transactionId: transaction.id,
    idempotencyKey: `transaction:${transaction.id}:lender:base`,
    sourceType: RewardSourceType.TRANSACTION_COMPLETED,
    roleCategory: RewardRoleCategory.LENDER,
    pointsDelta: lenderDecision.pointsDelta,
    status: lenderDecision.status,
    metadata: {
      role: "lender",
      reason: lenderDecision.reason,
      disputeId: dispute?.id ?? null,
      disputeOutcome: dispute?.outcome ?? null,
    },
  })

  await syncManyUserRewardLedgers(prisma, [transaction.borrowerId, transaction.lenderId])

  for (const review of transaction.reviews) {
    await processReviewRewards(prisma, review.id)
  }
}

const findRewardReview = async (
  prisma: RewardClient,
  reviewId: string,
): Promise<RewardReviewRecord | null> => {
  return prisma.transactionReview.findUnique({
    where: { id: reviewId },
    select: rewardReviewSelect,
  })
}

const getSubmittedReviewTypesForReviewer = async (
  prisma: RewardClient,
  transactionId: string,
  reviewerUserId: string,
) => {
  const reviews = await prisma.transactionReview.findMany({
    where: {
      transactionId,
      reviewerUserId,
    },
    select: {
      reviewType: true,
    },
  })

  return new Set(reviews.map((review) => review.reviewType))
}

const getRequiredReviewTypesForRole = (
  role: RewardParticipantRole,
  hasItem: boolean,
): ReviewType[] => {
  if (role === "borrower") {
    return hasItem ? ["ITEM_REVIEW", "LENDER_REVIEW"] : ["LENDER_REVIEW"]
  }

  return ["BORROWER_REVIEW"]
}

export const processReviewRewards = async (prisma: RewardClient, reviewId: string) => {
  if (!hasRewardEventDelegate(prisma) || !hasUserRewardDelegate(prisma)) {
    return
  }

  const review = await findRewardReview(prisma, reviewId)

  if (!review || !review.transaction.borrowerId || !review.transaction.lenderId) {
    return
  }

  const role: RewardParticipantRole =
    review.reviewerUserId === review.transaction.borrowerId ? "borrower" : "lender"
  const roleCategory = getRoleCategory(role)
  const dispute = getLatestRewardRelevantDispute(review.transaction.disputes)
  const requiredReviewTypes = getRequiredReviewTypesForRole(
    role,
    Boolean(review.transaction.itemId),
  )
  const submittedReviewTypes = await getSubmittedReviewTypesForReviewer(
    prisma,
    review.transactionId,
    review.reviewerUserId,
  )
  const hasCompletedRequiredReviews = requiredReviewTypes.every((reviewType) =>
    submittedReviewTypes.has(reviewType),
  )
  const decision = hasCompletedRequiredReviews
    ? getReviewRewardDecision({
        role,
        dispute,
        transactionStatus: review.transaction.status,
      })
    : {
        pointsDelta: 0,
        status: RewardEventStatus.BLOCKED,
        reason: "incomplete_required_reviews" as const,
      }

  await upsertRewardEvent(prisma, {
    userId: review.reviewerUserId,
    transactionId: review.transactionId,
    reviewId: review.id,
    idempotencyKey: `review:${review.transactionId}:${review.reviewerUserId}:submission`,
    sourceType: RewardSourceType.REVIEW_SUBMITTED,
    roleCategory,
    pointsDelta: decision.pointsDelta,
    status: decision.status,
    metadata: {
      role,
      reason: decision.reason,
      disputeId: dispute?.id ?? null,
      disputeOutcome: dispute?.outcome ?? null,
      requiredReviewTypes,
      submittedReviewTypes: [...submittedReviewTypes],
    },
  })

  await syncUserRewardLedger(prisma, review.reviewerUserId)
}

export const listRewardLeaderboard = async (prisma: RewardClient, role: "BORROWER" | "LENDER") => {
  const categoryField = role === RewardRoleCategory.BORROWER ? "borrowerPoints" : "lenderPoints"

  const entries = await prisma.userReward.findMany({
    where: {
      [categoryField]: {
        gt: 0,
      },
      user: {
        status: "ACTIVE",
      },
    },
    orderBy: [{ [categoryField]: "desc" }, { totalPointsEarned: "desc" }, { updatedAt: "asc" }],
    take: 25,
    select: {
      totalPointsEarned: true,
      borrowerPoints: true,
      lenderPoints: true,
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    },
  })

  return entries.map((entry, index) => ({
    rank: index + 1,
    points: role === RewardRoleCategory.BORROWER ? entry.borrowerPoints : entry.lenderPoints,
    totalPointsEarned: entry.totalPointsEarned,
    user: entry.user,
  }))
}

export const redeemListingBoost = async (
  prisma: RewardClient,
  userId: string,
  input: {
    itemId: string
    boostType: ItemBoostType
  },
) => {
  await expireActiveBoosts(prisma)

  const config = getBoostConfig(input.boostType)
  const item = await prisma.item.findUnique({
    where: { id: input.itemId },
    select: {
      id: true,
      lenderId: true,
      status: true,
      boostExpiresAt: true,
    },
  })

  if (!item) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." })
  }

  if (item.lenderId !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the owner of this item can boost the listing.",
    })
  }

  if (item.status === "DELETED") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Deleted listings cannot be boosted.",
    })
  }

  const activeBoost = await prisma.itemBoost.findFirst({
    where: {
      itemId: item.id,
      status: ItemBoostStatus.ACTIVE,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
    },
  })

  if (activeBoost) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This listing already has an active boost.",
    })
  }

  const rewards = await prisma.userReward.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: {
      availablePoints: true,
    },
  })

  if (rewards.availablePoints < config.pointsCost) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Not enough available points to boost this listing.",
    })
  }

  const startsAt = new Date()
  const expiresAt = new Date(startsAt.getTime() + config.durationHours * 60 * 60 * 1000)

  const boost = await prisma.itemBoost.create({
    data: {
      itemId: item.id,
      userId,
      pointsSpent: config.pointsCost,
      boostType: input.boostType,
      boostScore: config.boostScore,
      status: ItemBoostStatus.ACTIVE,
      startsAt,
      expiresAt,
    },
  })

  await prisma.item.update({
    where: { id: item.id },
    data: {
      boostScore: config.boostScore,
      boostExpiresAt: expiresAt,
    },
  })

  await upsertRewardEvent(prisma, {
    userId,
    itemBoostId: boost.id,
    idempotencyKey: `boost:${boost.id}:redeem`,
    sourceType: RewardSourceType.BOOST_REDEMPTION,
    roleCategory: RewardRoleCategory.GENERAL,
    pointsDelta: -config.pointsCost,
    status: RewardEventStatus.APPLIED,
    metadata: {
      boostType: input.boostType,
      itemId: item.id,
      pointsSpent: config.pointsCost,
    },
  })

  await syncUserRewardLedger(prisma, userId)

  const updatedRewards = await prisma.userReward.findUnique({
    where: { userId },
    select: {
      availablePoints: true,
    },
  })

  return {
    boost,
    pointsSpent: config.pointsCost,
    remainingPoints: updatedRewards?.availablePoints ?? 0,
  }
}
