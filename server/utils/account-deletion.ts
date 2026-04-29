import {
  BookingStatus,
  PaymentStatus,
  Prisma,
  TransactionStatus,
  UserStatus,
  type PrismaClient,
} from "@prisma/client"
import type {
  AccountDeletionEligibility,
  AccountDeletionReason,
  AccountDeletionReasonDetail,
} from "../../shared/schemas/account"
import { ACTIVE_DISPUTE_STATUSES } from "./dispute-status"

const BLOCKING_TRANSACTION_STATUSES = [
  TransactionStatus.PENDING,
  TransactionStatus.AWAITING_LENDER_APPROVAL,
  TransactionStatus.CONFIRMED,
  TransactionStatus.PAID,
  TransactionStatus.ONGOING,
  TransactionStatus.RETURNED,
  TransactionStatus.IN_DISPUTE,
  TransactionStatus.APPEALED,
] as const

const UNSETTLED_PAYMENT_STATUSES = [PaymentStatus.PENDING, PaymentStatus.PROCESSING] as const

type DeletionEligibilitySummary = {
  userStatus: UserStatus
  nonCompletedTransactionCount: number
  pendingOrUpcomingBookingCount: number
  activeDisputeCount: number
  remainingPayoutBalanceCount: number
  unsettledPaymentsOrFeesCount: number
  activeTransactionDetails: AccountDeletionReasonDetail[]
  pendingOrUpcomingBookingDetails: AccountDeletionReasonDetail[]
}

export type AccountDeletionResult = {
  deletedItemCount: number
  anonymizedItemCount: number
  deletedRequestPostCount: number
  deletedItemRequestCount: number
  deletedRequestOfferCount: number
  deletedReviewCount: number
  removedNotificationCount: number
}

class AccountDeletionAuditLogMissingError extends Error {
  constructor() {
    super("ACCOUNT_DELETION_AUDIT_LOG_MISSING")
  }
}

type PrismaLike = PrismaClient | Prisma.TransactionClient

const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`

const countTransactionDisputes = (
  prisma: Pick<PrismaLike, "transactionDispute">,
  args: Record<string, unknown>,
) =>
  (
    prisma.transactionDispute.count as unknown as (
      query: Record<string, unknown>,
    ) => Promise<number>
  )(args)

const formatShortDateRange = (startDate: Date, endDate: Date) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`
}

const toShortReference = (value: string) => value.slice(0, 8).toUpperCase()

const formatTransactionStatusLabel = (status: TransactionStatus) => {
  switch (status) {
    case TransactionStatus.PENDING:
    case TransactionStatus.AWAITING_LENDER_APPROVAL:
      return "Pending"
    case TransactionStatus.CONFIRMED:
    case TransactionStatus.PAID:
      return "Upcoming"
    case TransactionStatus.ONGOING:
      return "In Progress"
    case TransactionStatus.RETURNED:
      return "Awaiting Return Confirmation"
    case TransactionStatus.IN_DISPUTE:
      return "In Dispute"
    case TransactionStatus.APPEALED:
      return "Under Appeal"
    case TransactionStatus.CANCELLED:
      return "Cancelled"
    case TransactionStatus.REFUNDED:
      return "Refunded"
    case TransactionStatus.FAILED:
      return "Failed"
    case TransactionStatus.COMPLETED:
      return "Completed"
    default:
      return "Active"
  }
}

const formatBookingStatusLabel = (status: BookingStatus) => {
  switch (status) {
    case BookingStatus.PENDING:
      return "Pending"
    case BookingStatus.CONFIRMED:
      return "Upcoming"
    case BookingStatus.RETURNED:
      return "Awaiting Completion"
    case BookingStatus.IN_DISPUTE:
      return "In Dispute"
    case BookingStatus.CANCELLED:
      return "Cancelled"
    case BookingStatus.COMPLETED:
      return "Completed"
    default:
      return "Scheduled"
  }
}

const buildEligibilityReasons = (summary: DeletionEligibilitySummary): AccountDeletionReason[] => {
  const reasons: AccountDeletionReason[] = []

  if (summary.nonCompletedTransactionCount > 0) {
    reasons.push({
      code: "ACTIVE_TRANSACTIONS",
      title: "Ongoing transactions (items currently borrowed or lent)",
      message:
        "You are currently involved in active transactions that must be completed before your account can be deleted.",
      nextStep: "Please finish every active transaction before deleting your account.",
      details: summary.activeTransactionDetails,
    })
  }

  if (summary.pendingOrUpcomingBookingCount > 0) {
    reasons.push({
      code: "PENDING_OR_UPCOMING_BOOKINGS",
      title: "Pending or upcoming bookings",
      message: "You still have booking requests or scheduled bookings that have not finished yet.",
      nextStep: "Please cancel or complete all pending and upcoming bookings first.",
      details: summary.pendingOrUpcomingBookingDetails,
    })
  }

  if (summary.activeDisputeCount > 0) {
    reasons.push({
      code: "ACTIVE_DISPUTES",
      title: "Active dispute not yet resolved",
      message: `You still have ${pluralize(
        summary.activeDisputeCount,
        "active dispute",
      )} linked to your account.`,
      nextStep: "Please wait until all disputes, reviews, or appeals are resolved.",
    })
  }

  if (summary.remainingPayoutBalanceCount > 0) {
    reasons.push({
      code: "REMAINING_PAYOUT_BALANCE",
      title: "Remaining payout balance",
      message: `You still have ${pluralize(
        summary.remainingPayoutBalanceCount,
        "pending payout",
      )} associated with your account.`,
      nextStep:
        "Please wait for your remaining payout balance to reach zero before deleting your account.",
    })
  }

  if (summary.unsettledPaymentsOrFeesCount > 0) {
    reasons.push({
      code: "UNSETTLED_PAYMENTS_OR_FEES",
      title: "Unsettled payments or fees",
      message: `You still have ${pluralize(
        summary.unsettledPaymentsOrFeesCount,
        "pending payout or unsettled charge",
      )} linked to your account.`,
      nextStep:
        "Please settle all pending payments, charges, and fees before deleting your account.",
    })
  }

  if (summary.userStatus !== UserStatus.ACTIVE) {
    reasons.push({
      code: "ACCOUNT_RESTRICTION",
      title: "Account under review or restriction",
      message:
        summary.userStatus === UserStatus.SUSPENDED
          ? "Your account is currently suspended or under review."
          : "Your account is currently pending review.",
      nextStep: "Please wait until the restriction is cleared before deleting your account.",
    })
  }

  return reasons
}

const autoCancelPendingBorrowerBookingRequests = async (prisma: PrismaLike, userId: string) => {
  await prisma.booking.updateMany({
    where: {
      borrowerId: userId,
      status: BookingStatus.PENDING,
    },
    data: {
      status: BookingStatus.CANCELLED,
      cancellationReason: "Cancelled automatically during account deletion.",
      cancelledAt: new Date(),
    },
  })
}

const getAccountDeletionEligibilityFromClient = async (
  prisma: PrismaLike,
  userId: string,
): Promise<AccountDeletionEligibility> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true },
  })
  const activeTransactions = await prisma.rentalTransaction.findMany({
    where: {
      OR: [{ borrowerId: userId }, { lenderId: userId }],
      status: { in: [...BLOCKING_TRANSACTION_STATUSES] },
    },
    select: {
      id: true,
      status: true,
      item: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 5,
  })
  const nonCompletedTransactionCount = await prisma.rentalTransaction.count({
    where: {
      OR: [{ borrowerId: userId }, { lenderId: userId }],
      status: { in: [...BLOCKING_TRANSACTION_STATUSES] },
    },
  })
  const now = new Date()
  const pendingOrUpcomingBookings = await prisma.booking.findMany({
    where: {
      AND: [
        {
          OR: [{ borrowerId: userId }, { lenderId: userId }],
        },
        {
          OR: [
            {
              AND: [{ status: BookingStatus.PENDING }, { lenderId: userId }],
            },
            {
              status: BookingStatus.CONFIRMED,
              startDate: { gte: now },
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      item: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    take: 5,
  })
  const pendingOrUpcomingBookingCount = await prisma.booking.count({
    where: {
      AND: [
        {
          OR: [{ borrowerId: userId }, { lenderId: userId }],
        },
        {
          OR: [
            {
              AND: [{ status: BookingStatus.PENDING }, { lenderId: userId }],
            },
            {
              status: BookingStatus.CONFIRMED,
              startDate: { gte: now },
            },
          ],
        },
      ],
    },
  })
  const activeDisputeCount = await countTransactionDisputes(prisma, {
    where: {
      status: { in: [...ACTIVE_DISPUTE_STATUSES] },
      OR: [
        { raisedById: userId },
        { transaction: { borrowerId: userId } },
        { transaction: { lenderId: userId } },
      ],
    },
  })
  const remainingPayoutBalanceCount = await prisma.transactionPayment.count({
    where: {
      status: { in: [...UNSETTLED_PAYMENT_STATUSES] },
      payeeUserId: userId,
    },
  })
  const unsettledPaymentsOrFeesCount = await prisma.transactionPayment.count({
    where: {
      status: { in: [...UNSETTLED_PAYMENT_STATUSES] },
      OR: [{ payerUserId: userId }, { payeeUserId: userId, feeAmount: { gt: 0 } }],
    },
  })

  const summary: DeletionEligibilitySummary = {
    userStatus: user?.status ?? UserStatus.PENDING,
    nonCompletedTransactionCount,
    pendingOrUpcomingBookingCount,
    activeDisputeCount,
    remainingPayoutBalanceCount,
    unsettledPaymentsOrFeesCount,
    activeTransactionDetails: activeTransactions.map((transaction) => ({
      title: `Active transaction for "${transaction.item?.name ?? "Untitled item"}"`,
      subtitle: `${formatTransactionStatusLabel(transaction.status)} • Transaction #${toShortReference(
        transaction.id,
      )}`,
    })),
    pendingOrUpcomingBookingDetails: pendingOrUpcomingBookings.map((booking) => ({
      title: `${formatBookingStatusLabel(booking.status)} booking for "${booking.item.name}"`,
      subtitle: `${formatShortDateRange(booking.startDate, booking.endDate)} • Booking #${toShortReference(
        booking.id,
      )}`,
    })),
  }

  const reasons = buildEligibilityReasons(summary)

  return {
    eligible: reasons.length === 0,
    reasons,
  }
}

export async function getAccountDeletionEligibility(
  prisma: PrismaLike,
  userId: string,
): Promise<AccountDeletionEligibility> {
  return getAccountDeletionEligibilityFromClient(prisma, userId)
}

const buildDeletedIdentity = (userId: string) => {
  const suffix = `${userId.slice(0, 8)}-${Date.now().toString(36)}`

  return {
    username: `deleted-${suffix}`,
    email: `deleted+${suffix}@deleted.takeup.local`,
    googleSub: `deleted-google-sub-${suffix}`,
  }
}

export async function deleteAccountAndAnonymizeData(
  prisma: PrismaClient,
  userId: string,
): Promise<AccountDeletionResult> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await autoCancelPendingBorrowerBookingRequests(tx, userId)

    const eligibility = await getAccountDeletionEligibilityFromClient(tx, userId)
    if (!eligibility.eligible) {
      throw new Error("ACCOUNT_DELETION_BLOCKED")
    }

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        accountType: true,
        lender: {
          select: { id: true },
        },
        borrower: {
          select: { id: true },
        },
      },
    })

    if (!user) {
      throw new Error("ACCOUNT_NOT_FOUND")
    }

    const items = await tx.item.findMany({
      where: { lenderId: userId },
      select: {
        id: true,
        numericId: true,
        _count: {
          select: {
            bookings: true,
            transactions: true,
          },
        },
      },
    })

    const deletableItemIds = items
      .filter((item) => item._count.bookings === 0 && item._count.transactions === 0)
      .map((item) => item.id)
    const retainedItems = items.filter((item) => !deletableItemIds.includes(item.id))
    const retainedItemIds = retainedItems.map((item) => item.id)
    const allNumericItemIds = items.map((item) => item.numericId)

    const deletedRequestPosts = await tx.requestPost.deleteMany({
      where: { requesterId: userId },
    })
    const deletedReviews = await tx.transactionReview.deleteMany({
      where: { reviewerUserId: userId },
    })
    const removedNotifications = await tx.appNotification.deleteMany({
      where: {
        OR: [{ recipientUserId: userId }, { actorUserId: userId }],
      },
    })
    const deletedRequestOffersByLender = user.lender
      ? await tx.requestOffer.deleteMany({
          where: { lenderID: user.lender.id },
        })
      : { count: 0 }
    const deletedRequestOffersByItem = allNumericItemIds.length
      ? await tx.requestOffer.deleteMany({
          where: { itemID: { in: allNumericItemIds } },
        })
      : { count: 0 }
    const deletedItemRequests = user.borrower
      ? await tx.itemRequest.deleteMany({
          where: { borrowerID: user.borrower.id },
        })
      : { count: 0 }

    await tx.transactionReview.updateMany({
      where: { revieweeUserId: userId },
      data: { revieweeUserId: null },
    })
    await tx.cartEntry.deleteMany({
      where: { borrowerId: userId },
    })
    await tx.like.deleteMany({
      where: { userId },
    })

    if (retainedItemIds.length > 0) {
      await tx.itemImage.deleteMany({
        where: { itemId: { in: retainedItemIds } },
      })
      await tx.itemCategoryOnItem.deleteMany({
        where: { itemId: { in: retainedItemIds } },
      })
      await tx.itemTagOnItem.deleteMany({
        where: { itemId: { in: retainedItemIds } },
      })
      await tx.like.deleteMany({
        where: { itemId: { in: retainedItemIds } },
      })
      await tx.cartEntry.deleteMany({
        where: { itemId: { in: retainedItemIds } },
      })
      await tx.item.updateMany({
        where: { id: { in: retainedItemIds } },
        data: {
          name: "Deleted listing",
          description: null,
          status: "DELETED",
          rentalFee: 0,
          replacementCost: null,
          freeToBorrow: false,
          whatItemOffers: null,
          whatIsIncluded: null,
          knownIssues: null,
          usageLimitations: null,
          isTrending: false,
          viewCount: 0,
          likeCount: 0,
          rating: 0,
          borrowerId: null,
        },
      })
    }

    if (deletableItemIds.length > 0) {
      await tx.item.deleteMany({
        where: { id: { in: deletableItemIds } },
      })
    }

    const deletedIdentity = buildDeletedIdentity(userId)

    await tx.user.update({
      where: { id: userId },
      data: {
        username: deletedIdentity.username,
        email: deletedIdentity.email,
        googleSub: deletedIdentity.googleSub,
        firstName: "Deleted",
        middleName: null,
        lastName: "User",
        location: null,
        avatarUrl: null,
        bio: null,
        pronouns: null,
        status: UserStatus.SUSPENDED,
        points: 0,
      },
    })

    const auditDetails = {
      deletedItemCount: deletableItemIds.length,
      anonymizedItemCount: retainedItemIds.length,
      deletedRequestPostCount: deletedRequestPosts.count,
      deletedItemRequestCount: deletedItemRequests.count,
      deletedRequestOfferCount:
        deletedRequestOffersByLender.count + deletedRequestOffersByItem.count,
      deletedReviewCount: deletedReviews.count,
      removedNotificationCount: removedNotifications.count,
      retainedFinancialRecords: true,
    }

    try {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "account_deletion_audit_logs" (
          "deleted_user_id",
          "deleted_user_email",
          "deleted_username",
          "details"
        )
        VALUES (
          ${user.id},
          ${user.email},
          ${user.username},
          ${JSON.stringify(auditDetails)}::jsonb
        )
      `)
    } catch (error) {
      const maybeError = error as { message?: string; code?: string }
      const message = maybeError?.message ?? ""

      if (maybeError?.code === "P2010" && message.includes("account_deletion_audit_logs")) {
        throw new AccountDeletionAuditLogMissingError()
      }

      throw error
    }

    return auditDetails
  })
}
