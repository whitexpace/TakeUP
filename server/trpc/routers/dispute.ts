import { Prisma } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import type { Context } from "../context"
import { router } from "../init"
import { adminProcedure, protectedProcedure } from "../procedures"
import {
  appealDisputeSchema,
  closeDisputeSchema,
  disputeIdSchema,
  finalJudgmentSchema,
  listDisputesSchema,
  reviewDisputeSchema,
  submitRebuttalSchema,
  submitDisputeSchema,
  type DisputeActionInput,
} from "#shared/schemas/dispute"
import {
  DISPUTE_ADMIN_REVIEW_BYPASS_ENABLED,
  CLOSED_DISPUTE_STATUS,
  OPEN_DISPUTE_STATUS,
  REBUTTABLE_DISPUTE_STATUSES,
  REJECTED_DISPUTE_STATUS,
  SUBMITTED_DISPUTE_STATUS,
  fromApiDisputeStatus,
  isRebuttalEnabledDisputeStatus,
  toApiDisputeStatus,
  toUserFacingDisputeStatus,
} from "../../utils/dispute-status"

const disputeItemImageOrderBy: Prisma.ItemImageOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { createdAt: "asc" },
]
const DISPUTE_REPORT_WINDOW_DAYS = 15
const DISPUTE_APPEAL_WINDOW_DAYS = 15
const DAY_IN_MS = 24 * 60 * 60 * 1000
const APPEALED_DISPUTE_STATUS = fromApiDisputeStatus("APPEALED")
const ACTIVE_USER_STATUS = "ACTIVE"
const PENDING_USER_STATUS = "PENDING"
const SUSPENDED_USER_STATUS = "SUSPENDED"
const BANNED_USER_STATUS = "BANNED"

const participantUserSelect = {
  id: true,
  username: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true,
  status: true,
  points: true,
} as const

const disputeActionSelect = {
  id: true,
  type: true,
  targetUserId: true,
  pointsDelta: true,
  note: true,
  appliedAt: true,
  targetUser: {
    select: participantUserSelect,
  },
  appliedBy: {
    select: participantUserSelect,
  },
} as const

const disputeRecordSelect = {
  id: true,
  transactionId: true,
  raisedById: true,
  reason: true,
  description: true,
  resolution: true,
  status: true,
  reviewedAt: true,
  finalDecision: true,
  finalDecisionNotes: true,
  finalDecisionAt: true,
  requiredActionCount: true,
  closedAt: true,
  rebuttalById: true,
  rebuttalText: true,
  rebuttalNotes: true,
  rebuttalImageUrl: true,
  rebuttalSubmittedAt: true,
  createdAt: true,
  raisedBy: {
    select: participantUserSelect,
  },
  rebuttalBy: {
    select: participantUserSelect,
  },
  reviewedBy: {
    select: participantUserSelect,
  },
  finalDecisionBy: {
    select: participantUserSelect,
  },
  actions: {
    orderBy: [{ appliedAt: "desc" }, { id: "desc" }],
    select: disputeActionSelect,
  },
  transaction: {
    select: {
      id: true,
      bookingId: true,
      borrowerId: true,
      lenderId: true,
      item: {
        select: {
          id: true,
          name: true,
          images: {
            select: {
              path: true,
              isPrimary: true,
              sortOrder: true,
            },
            orderBy: disputeItemImageOrderBy,
          },
        },
      },
      borrower: {
        select: participantUserSelect,
      },
      lender: {
        select: participantUserSelect,
      },
    },
  },
} as const

const disputeAccessTransactionSelect = {
  id: true,
  bookingId: true,
  borrowerId: true,
  lenderId: true,
  itemId: true,
} as const

const disputeBookingSelect = {
  id: true,
  status: true,
  completedAt: true,
} as const

const reportableBookingSelect = {
  id: true,
  completedAt: true,
  borrowerId: true,
  lenderId: true,
  item: {
    select: {
      id: true,
      name: true,
    },
  },
  borrower: {
    select: {
      user: {
        select: participantUserSelect,
      },
    },
  },
  lender: {
    select: {
      user: {
        select: participantUserSelect,
      },
    },
  },
} as const

const reportableTransactionSelect = {
  id: true,
  bookingId: true,
  disputes: {
    select: {
      id: true,
    },
  },
} as const

const disputeStatusRecordSelect = {
  id: true,
  status: true,
  finalDecisionAt: true,
  closedAt: true,
} as const

const appealCandidateSelect = {
  id: true,
  status: true,
  reviewedAt: true,
  resolution: true,
  transaction: {
    select: {
      borrowerId: true,
      lenderId: true,
    },
  },
} as const

const rebuttalCandidateSelect = {
  id: true,
  status: true,
  raisedById: true,
  rebuttalSubmittedAt: true,
  finalDecisionAt: true,
  closedAt: true,
  transaction: {
    select: {
      borrowerId: true,
      lenderId: true,
    },
  },
} as const

const finalJudgmentCandidateSelect = {
  id: true,
  status: true,
  transactionId: true,
  finalDecisionAt: true,
  closedAt: true,
  transaction: {
    select: {
      borrowerId: true,
      lenderId: true,
    },
  },
} as const

const closeCandidateSelect = {
  id: true,
  status: true,
  transactionId: true,
  finalDecision: true,
  finalDecisionNotes: true,
  finalDecisionAt: true,
  requiredActionCount: true,
  closedAt: true,
  transaction: {
    select: {
      id: true,
      bookingId: true,
      borrowerId: true,
      lenderId: true,
    },
  },
  actions: {
    select: {
      id: true,
    },
  },
} as const

const participantStateSelect = {
  id: true,
  status: true,
  points: true,
} as const

type DisputeParticipant = {
  id: string
  username: string
  firstName: string
  middleName: string | null
  lastName: string
  email: string
  status: string
  points: number
}

type DisputeActionRecord = {
  id: string
  type: "WARNING" | "POINT_DEDUCTION" | "SUSPENSION" | "BAN"
  targetUserId: string
  pointsDelta: number | null
  note: string | null
  appliedAt: Date
  targetUser: DisputeParticipant | null
  appliedBy: DisputeParticipant | null
}

type DisputeRecord = {
  id: string
  transactionId: string
  raisedById: string
  reason: string
  description: string | null
  resolution: string | null
  status: string
  reviewedAt: Date | null
  finalDecision: "APPROVED" | "REJECTED" | null
  finalDecisionNotes: string | null
  finalDecisionAt: Date | null
  requiredActionCount: number
  closedAt: Date | null
  rebuttalById: string | null
  rebuttalText: string | null
  rebuttalNotes: string | null
  rebuttalImageUrl: string | null
  rebuttalSubmittedAt: Date | null
  createdAt: Date
  raisedBy: DisputeParticipant | null
  rebuttalBy: DisputeParticipant | null
  reviewedBy: DisputeParticipant | null
  finalDecisionBy: DisputeParticipant | null
  actions: DisputeActionRecord[]
  transaction: {
    id: string
    bookingId: string | null
    borrowerId: string | null
    lenderId: string | null
    item: {
      id: string
      name: string
      images: Array<{
        path: string
        isPrimary: boolean
        sortOrder: number
      }>
    } | null
    borrower: DisputeParticipant | null
    lender: DisputeParticipant | null
  }
}

type DisputeAccessTransaction = {
  id: string
  bookingId: string | null
  borrowerId: string | null
  lenderId: string | null
  itemId: string | null
}

type DisputeBookingRecord = {
  id: string
  status: string
  completedAt: Date | null
}

type ReportableBookingRecord = {
  id: string
  completedAt: Date | null
  borrowerId: string
  lenderId: string
  item: {
    id: string
    name: string
  } | null
  borrower: {
    user: DisputeParticipant | null
  } | null
  lender: {
    user: DisputeParticipant | null
  } | null
}

type ReportableTransactionRecord = {
  id: string
  bookingId: string | null
  disputes: Array<{ id: string }>
}

type DisputeStatusRecord = {
  id: string
  status: string
  finalDecisionAt: Date | null
  closedAt: Date | null
}

type DisputeAppealCandidateRecord = {
  id: string
  status: string
  reviewedAt: Date | null
  resolution: string | null
  transaction: {
    borrowerId: string | null
    lenderId: string | null
  }
}

type DisputeRebuttalCandidateRecord = {
  id: string
  status: string
  raisedById: string
  rebuttalSubmittedAt: Date | null
  finalDecisionAt: Date | null
  closedAt: Date | null
  transaction: {
    borrowerId: string | null
    lenderId: string | null
  }
}

type DisputeFinalJudgmentCandidateRecord = {
  id: string
  status: string
  transactionId: string
  finalDecisionAt: Date | null
  closedAt: Date | null
  transaction: {
    borrowerId: string | null
    lenderId: string | null
  }
}

type DisputeCloseCandidateRecord = {
  id: string
  status: string
  transactionId: string
  finalDecision: "APPROVED" | "REJECTED" | null
  finalDecisionNotes: string | null
  finalDecisionAt: Date | null
  requiredActionCount: number
  closedAt: Date | null
  transaction: {
    id: string
    bookingId: string | null
    borrowerId: string | null
    lenderId: string | null
  }
  actions: Array<{ id: string }>
}

type DisputeParticipantState = {
  id: string
  status: string
  points: number
}

type DisputeTransactionClient = {
  rentalTransaction: {
    findUnique(args: Record<string, unknown>): Promise<DisputeAccessTransaction | null>
    findMany(args: Record<string, unknown>): Promise<ReportableTransactionRecord[]>
    update(args: Record<string, unknown>): Promise<unknown>
  }
  booking: {
    findUnique(args: Record<string, unknown>): Promise<DisputeBookingRecord | null>
    findMany(args: Record<string, unknown>): Promise<ReportableBookingRecord[]>
  }
  transactionDispute: {
    findFirst(args: Record<string, unknown>): Promise<{ id: string } | null>
    create(args: Record<string, unknown>): Promise<DisputeRecord>
    findMany(args: Record<string, unknown>): Promise<DisputeRecord[]>
    findUnique(
      args: Record<string, unknown>,
    ): Promise<
      | DisputeRecord
      | DisputeStatusRecord
      | DisputeAppealCandidateRecord
      | DisputeRebuttalCandidateRecord
      | DisputeFinalJudgmentCandidateRecord
      | DisputeCloseCandidateRecord
      | null
    >
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>
  }
  transactionDisputeAction: {
    create(args: Record<string, unknown>): Promise<unknown>
  }
  user: {
    findMany(args: Record<string, unknown>): Promise<DisputeParticipantState[]>
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>
  }
  appNotification: {
    create(args: Record<string, unknown>): Promise<unknown>
  }
  $executeRaw?(query: Prisma.Sql): Promise<unknown>
}

type DisputePrismaClient = DisputeTransactionClient & {
  $transaction<T>(
    callback: (tx: DisputeTransactionClient) => Promise<T>,
    options?: Record<string, unknown>,
  ): Promise<T>
}

const getDisputePrisma = (ctx: Pick<Context, "prisma">) =>
  ctx.prisma as unknown as DisputePrismaClient

const DISPUTE_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 15_000,
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const

const normalizeOptionalText = (value?: string | null) => {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

const formatReference = (transactionId: string, bookingId: string | null) =>
  bookingId ? bookingId.slice(0, 16).toUpperCase() : transactionId.slice(0, 16).toUpperCase()

const getWindowStart = (days: number) => new Date(Date.now() - days * DAY_IN_MS)

const isDateWithinWindow = (value: Date | null, days: number) =>
  Boolean(value && value.getTime() >= getWindowStart(days).getTime())

const getCounterpartyUserId = (
  transaction: { borrowerId: string | null; lenderId: string | null },
  actorUserId: string,
) => {
  if (transaction.borrowerId === actorUserId) {
    return transaction.lenderId
  }

  if (transaction.lenderId === actorUserId) {
    return transaction.borrowerId
  }

  return null
}

const getThumbnailImage = (
  item: { images?: Array<{ path: string; isPrimary?: boolean }> } | null,
) => item?.images?.find((image) => image.isPrimary)?.path ?? item?.images?.[0]?.path ?? null

const formatDisplayName = (
  user:
    | {
        firstName: string
        middleName: string | null
        lastName: string
      }
    | null
    | undefined,
) => {
  if (!user?.firstName) return "Former user"
  const lastInitial = user.lastName?.[0] ?? ""
  return lastInitial ? `${user.firstName} ${lastInitial}.` : user.firstName
}

const mapParticipant = (user: DisputeParticipant | null | undefined) =>
  user
    ? {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        status: user.status,
        points: user.points,
        displayName: formatDisplayName(user),
      }
    : null

const formatFinalDecisionLabel = (decision: "APPROVED" | "REJECTED") =>
  decision === "APPROVED" ? "approved" : "rejected"

const mapDisputeActionRecord = (action: DisputeActionRecord) => ({
  id: action.id,
  type: action.type,
  targetUserId: action.targetUserId,
  pointsDelta: action.pointsDelta,
  note: action.note,
  appliedAt: action.appliedAt,
  targetUser: mapParticipant(action.targetUser),
  appliedBy: mapParticipant(action.appliedBy),
})

const mapDisputeRecord = (
  record: DisputeRecord,
  currentUserId?: string | null,
  options?: { userFacing?: boolean },
) => {
  const rawStatus = toApiDisputeStatus(record.status)
  const status = options?.userFacing ? toUserFacingDisputeStatus(record.status) : rawStatus
  const viewerRole =
    currentUserId === record.transaction.borrowerId
      ? "BORROWER"
      : currentUserId === record.transaction.lenderId
        ? "LENDER"
        : null
  const borrower = mapParticipant(record.transaction.borrower)
  const lender = mapParticipant(record.transaction.lender)
  const counterpart = viewerRole === "BORROWER" ? lender : viewerRole === "LENDER" ? borrower : null
  const hasRebuttal = Boolean(record.rebuttalSubmittedAt && record.rebuttalText)
  const hasFinalDecision = Boolean(record.finalDecision && record.finalDecisionAt)
  const canAppeal =
    rawStatus === "REJECTED" && isDateWithinWindow(record.reviewedAt, DISPUTE_APPEAL_WINDOW_DAYS)
  const canSubmitRebuttal =
    isRebuttalEnabledDisputeStatus(record.status) &&
    !hasFinalDecision &&
    !record.closedAt &&
    Boolean(currentUserId) &&
    currentUserId !== record.raisedById &&
    (currentUserId === record.transaction.borrowerId ||
      currentUserId === record.transaction.lenderId) &&
    !hasRebuttal

  return {
    id: record.id,
    transactionId: record.transactionId,
    bookingId: record.transaction.bookingId,
    transactionReference: formatReference(record.transaction.id, record.transaction.bookingId),
    status,
    reason: record.reason,
    description: record.description,
    resolution: record.resolution,
    createdAt: record.createdAt,
    reviewedAt: record.reviewedAt,
    finalDecision: record.finalDecision,
    finalDecisionNotes: record.finalDecisionNotes,
    finalDecisionAt: record.finalDecisionAt,
    requiredActionCount: record.requiredActionCount,
    closedAt: record.closedAt,
    raisedByRole:
      record.raisedById === record.transaction.borrowerId
        ? "BORROWER"
        : record.raisedById === record.transaction.lenderId
          ? "LENDER"
          : null,
    viewerRole,
    counterpartName: counterpart?.displayName ?? "Former user",
    raisedBy: mapParticipant(record.raisedBy),
    reviewedBy: mapParticipant(record.reviewedBy),
    finalDecisionBy: mapParticipant(record.finalDecisionBy),
    item: record.transaction.item
      ? {
          id: record.transaction.item.id,
          name: record.transaction.item.name,
          thumbnailImage: getThumbnailImage(record.transaction.item),
        }
      : null,
    participants: {
      borrower,
      lender,
    },
    resolutionTargets: [borrower, lender].filter(
      (participant): participant is NonNullable<typeof participant> => participant !== null,
    ),
    actions: (record.actions ?? []).map(mapDisputeActionRecord),
    canReview: rawStatus === "SUBMITTED" || rawStatus === "APPEALED",
    canResolve: rawStatus === "OPEN" && !hasFinalDecision,
    canClose:
      rawStatus === "OPEN" &&
      hasFinalDecision &&
      !record.closedAt &&
      (record.actions ?? []).length === record.requiredActionCount,
    canAppeal,
    canSubmitRebuttal,
    hasRebuttal,
    rebuttalText: record.rebuttalText,
    rebuttalNotes: record.rebuttalNotes,
    rebuttalImageUrl: record.rebuttalImageUrl,
    rebuttalSubmittedAt: record.rebuttalSubmittedAt,
    rebuttalBy: mapParticipant(record.rebuttalBy),
    rebuttalSubmittedByRole:
      record.rebuttalById === record.transaction.borrowerId
        ? "BORROWER"
        : record.rebuttalById === record.transaction.lenderId
          ? "LENDER"
          : null,
    appealAvailableUntil: record.reviewedAt
      ? new Date(record.reviewedAt.getTime() + DISPUTE_APPEAL_WINDOW_DAYS * DAY_IN_MS)
      : null,
  }
}

const buildAppealResolution = (
  existingResolution: string | null,
  appealReason: string,
  evidenceFileNames?: string[],
) =>
  [
    existingResolution?.trim() ? existingResolution.trim() : null,
    `Appeal requested on ${new Date().toISOString()}`,
    `Appeal reason: ${appealReason.trim()}`,
    evidenceFileNames?.length ? `Evidence filenames: ${evidenceFileNames.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n")

const getSubmittedConflictMessage = () => "A dispute has already been filed for this transaction."

const buildDisputeOpenedNotification = (input: {
  transactionReference: string
  reason: string
  description: string | null
  raisedByName: string
  bookingId: string | null
}) => ({
  type: "DISPUTE_OPENED" as const,
  title: "A formal dispute has been opened",
  body: [
    `A formal dispute has been opened for transaction ${input.transactionReference}.`,
    `${input.raisedByName} raised the concern.`,
    `Reason: ${input.reason}`,
    input.description ? `Details: ${input.description}` : null,
    "You may submit one rebuttal.",
  ]
    .filter(Boolean)
    .join(" "),
  actionPath: input.bookingId
    ? `/account/transactions/${input.bookingId}?action=rebuttal`
    : "/account/disputes?tab=disputes",
})

const buildDisputeRebuttalSubmittedNotification = (input: {
  transactionReference: string
  bookingId: string | null
}) => ({
  type: "DISPUTE_REBUTTAL_SUBMITTED" as const,
  title: "A rebuttal was submitted",
  body: `A rebuttal was submitted for transaction ${input.transactionReference}.`,
  actionPath: input.bookingId
    ? `/account/transactions/${input.bookingId}`
    : "/account/disputes?tab=disputes",
})

const buildDisputeResolvedNotification = (input: {
  transactionReference: string
  decision: "APPROVED" | "REJECTED"
  decisionNotes: string | null
  bookingId: string | null
}) => ({
  type: "DISPUTE_RESOLVED" as const,
  title: "A dispute has been closed",
  body: [
    `An admin ${formatFinalDecisionLabel(input.decision)} the dispute for transaction ${input.transactionReference}.`,
    input.decisionNotes ? `Summary: ${input.decisionNotes}` : null,
    "This case is now closed and the transaction chat stays read-only.",
  ]
    .filter(Boolean)
    .join(" "),
  actionPath: input.bookingId
    ? `/account/transactions/${input.bookingId}`
    : "/account/disputes?tab=disputes",
})

const validateDisputeActions = (actions: DisputeActionInput[], allowedTargetIds: Set<string>) => {
  const seen = new Set<string>()
  const restrictionTypesByTarget = new Map<string, Set<DisputeActionInput["type"]>>()

  for (const action of actions) {
    if (!allowedTargetIds.has(action.targetUserId)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Disciplinary actions can only target the borrower or lender in this dispute.",
      })
    }

    const key = `${action.type}:${action.targetUserId}`
    if (seen.has(key)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Duplicate disciplinary actions for the same user are not allowed.",
      })
    }
    seen.add(key)

    const restrictionTypes = restrictionTypesByTarget.get(action.targetUserId) ?? new Set()
    if (
      (action.type === "BAN" && restrictionTypes.has("SUSPENSION")) ||
      (action.type === "SUSPENSION" && restrictionTypes.has("BAN"))
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Do not combine suspension and ban for the same user in one resolution.",
      })
    }

    restrictionTypes.add(action.type)
    restrictionTypesByTarget.set(action.targetUserId, restrictionTypes)
  }
}

const applyDisputeActions = async (
  tx: DisputeTransactionClient,
  input: {
    disputeId: string
    appliedById: string
    actions: DisputeActionInput[]
    participants: DisputeParticipantState[]
  },
) => {
  const participantStateById = new Map(
    input.participants.map((participant) => [
      participant.id,
      { status: participant.status, points: participant.points },
    ]),
  )

  for (const action of input.actions) {
    const targetState = participantStateById.get(action.targetUserId)

    if (!targetState) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "One of the selected disciplinary targets is no longer available.",
      })
    }

    if (action.type === "POINT_DEDUCTION") {
      const points = action.points ?? 0

      if (targetState.points < points) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Point deductions cannot reduce a user below zero points.",
        })
      }

      const pointUpdate = await tx.user.updateMany({
        where: {
          id: action.targetUserId,
          points: {
            gte: points,
          },
        },
        data: {
          points: {
            decrement: points,
          },
        },
      })

      if (pointUpdate.count === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "The target user's points changed. Refresh and try the resolution again.",
        })
      }

      targetState.points -= points
    }

    if (action.type === "SUSPENSION") {
      if (targetState.status === BANNED_USER_STATUS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot suspend an account that is already banned.",
        })
      }

      if (targetState.status === SUSPENDED_USER_STATUS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot suspend an account that is already suspended.",
        })
      }

      const suspendedUntil = action.durationDays
        ? new Date(Date.now() + action.durationDays * 24 * 60 * 60 * 1000)
        : null

      const suspendUpdate = await tx.user.updateMany({
        where: {
          id: action.targetUserId,
          status: {
            in: [ACTIVE_USER_STATUS, PENDING_USER_STATUS],
          },
        },
        data: {
          status: SUSPENDED_USER_STATUS,
          suspendedUntil,
        },
      })

      if (suspendUpdate.count === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "The target account state changed. Refresh and try again.",
        })
      }

      targetState.status = SUSPENDED_USER_STATUS
    }

    if (action.type === "BAN") {
      if (targetState.status === BANNED_USER_STATUS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot ban an account that is already banned.",
        })
      }

      const banUpdate = await tx.user.updateMany({
        where: {
          id: action.targetUserId,
          status: {
            not: BANNED_USER_STATUS,
          },
        },
        data: {
          status: BANNED_USER_STATUS,
        },
      })

      if (banUpdate.count === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "The target account state changed. Refresh and try again.",
        })
      }

      targetState.status = BANNED_USER_STATUS
    }

    await tx.transactionDisputeAction.create({
      data: {
        disputeId: input.disputeId,
        type: action.type,
        targetUserId: action.targetUserId,
        pointsDelta: action.type === "POINT_DEDUCTION" ? -(action.points ?? 0) : null,
        note: normalizeOptionalText(action.note),
        appliedById: input.appliedById,
      },
    })
  }
}

const syncClosedTransactionStatus = async (
  tx: DisputeTransactionClient,
  input: {
    transactionId: string
    adminUserId: string
    remarks: string
  },
) => {
  if (typeof tx.$executeRaw === "function") {
    await tx.$executeRaw(
      Prisma.sql`SELECT set_transaction_status(
        CAST(${input.transactionId} AS text),
        CAST(${"completed"} AS transaction_status_enum),
        CAST(${input.adminUserId} AS text),
        CAST(${"admin"} AS actor_role_enum),
        CAST(${input.remarks} AS text)
      )`,
    )
    return
  }

  await tx.rentalTransaction.update({
    where: { id: input.transactionId },
    data: { status: "COMPLETED" },
  })
}

export const disputeRouter = router({
  submit: protectedProcedure.input(submitDisputeSchema).mutation(async ({ ctx, input }) => {
    const disputePrisma = getDisputePrisma(ctx)

    try {
      const createdDispute = await disputePrisma.$transaction(async (tx) => {
        const transaction = await tx.rentalTransaction.findUnique({
          where: { id: input.transactionId },
          select: disputeAccessTransactionSelect,
        })

        if (
          !transaction ||
          !transaction.borrowerId ||
          !transaction.lenderId ||
          !transaction.itemId
        ) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Transaction not found or no longer valid.",
          })
        }

        if (transaction.borrowerId !== ctx.user.id && transaction.lenderId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only transaction participants can submit a dispute.",
          })
        }

        if (!transaction.bookingId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This transaction cannot be reported right now.",
          })
        }

        const booking = await tx.booking.findUnique({
          where: { id: transaction.bookingId },
          select: disputeBookingSelect,
        })

        if (
          !booking ||
          booking.status !== "COMPLETED" ||
          !isDateWithinWindow(booking.completedAt, DISPUTE_REPORT_WINDOW_DAYS)
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only transactions completed within the last 15 days can be reported.",
          })
        }

        const existingDispute = await tx.transactionDispute.findFirst({
          where: {
            transactionId: input.transactionId,
          },
          select: { id: true },
        })

        if (existingDispute) {
          throw new TRPCError({
            code: "CONFLICT",
            message: getSubmittedConflictMessage(),
          })
        }

        // Temporary test shortcut: open the dispute immediately instead of
        // waiting for the admin review step, so the counterparty rebuttal flow
        // can be exercised end-to-end.
        const createdDispute = await tx.transactionDispute.create({
          data: {
            transactionId: input.transactionId,
            raisedById: ctx.user.id,
            reason: input.reason.trim(),
            description: normalizeOptionalText(input.description),
            status: OPEN_DISPUTE_STATUS,
          },
          select: disputeRecordSelect,
        })

        const counterpartyUserId = getCounterpartyUserId(
          createdDispute.transaction,
          createdDispute.raisedById,
        )

        if (counterpartyUserId) {
          await tx.appNotification.create({
            data: {
              recipientUserId: counterpartyUserId,
              actorUserId: createdDispute.raisedById,
              bookingId: createdDispute.transaction.bookingId,
              ...buildDisputeOpenedNotification({
                transactionReference: formatReference(
                  createdDispute.transaction.id,
                  createdDispute.transaction.bookingId,
                ),
                reason: createdDispute.reason,
                description: createdDispute.description,
                raisedByName: formatDisplayName(createdDispute.raisedBy),
                bookingId: createdDispute.transaction.bookingId,
              }),
            },
          })
        }

        return createdDispute
      }, DISPUTE_TRANSACTION_OPTIONS)

      return mapDisputeRecord(createdDispute, ctx.user.id, { userFacing: true })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2034")
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: getSubmittedConflictMessage(),
        })
      }

      throw error
    }
  }),

  mine: protectedProcedure.query(async ({ ctx }) => {
    const disputePrisma = getDisputePrisma(ctx)
    const participantVisibilityWhere = DISPUTE_ADMIN_REVIEW_BYPASS_ENABLED
      ? {
          OR: [
            { transaction: { borrowerId: ctx.user.id } },
            { transaction: { lenderId: ctx.user.id } },
          ],
        }
      : {
          status: {
            not: SUBMITTED_DISPUTE_STATUS,
          },
          OR: [
            { transaction: { borrowerId: ctx.user.id } },
            { transaction: { lenderId: ctx.user.id } },
          ],
        }
    const disputes = await disputePrisma.transactionDispute.findMany({
      where: {
        OR: [{ raisedById: ctx.user.id }, participantVisibilityWhere],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: disputeRecordSelect,
    })

    return {
      disputes: disputes.map((record) =>
        mapDisputeRecord(record, ctx.user.id, { userFacing: true }),
      ),
    }
  }),

  reportableTransactions: protectedProcedure.query(async ({ ctx }) => {
    const disputePrisma = getDisputePrisma(ctx)
    const reportableBookings = await disputePrisma.booking.findMany({
      where: {
        status: "COMPLETED",
        completedAt: {
          gte: getWindowStart(DISPUTE_REPORT_WINDOW_DAYS),
        },
        OR: [{ borrowerId: ctx.user.id }, { lenderId: ctx.user.id }],
      },
      orderBy: [{ completedAt: "desc" }, { id: "desc" }],
      select: reportableBookingSelect,
    })

    const bookingIds = reportableBookings.map((booking) => booking.id)

    if (!bookingIds.length) {
      return {
        transactions: [],
      }
    }

    const linkedTransactions = await disputePrisma.rentalTransaction.findMany({
      where: {
        bookingId: {
          in: bookingIds,
        },
      },
      select: reportableTransactionSelect,
    })

    const transactionMap = new Map(
      linkedTransactions
        .filter((transaction) => Boolean(transaction.bookingId))
        .map((transaction) => [transaction.bookingId as string, transaction]),
    )

    return {
      transactions: reportableBookings
        .map((booking) => {
          if (!booking.item || !booking.completedAt) return null

          const transaction = transactionMap.get(booking.id)
          if (!transaction || transaction.disputes.length > 0) return null

          const viewerRole =
            booking.borrowerId === ctx.user.id
              ? "BORROWER"
              : booking.lenderId === ctx.user.id
                ? "LENDER"
                : null
          const counterpart =
            viewerRole === "BORROWER" ? booking.lender?.user : booking.borrower?.user

          return {
            transactionId: transaction.id,
            bookingId: booking.id,
            transactionReference: formatReference(transaction.id, booking.id),
            item: {
              id: booking.item.id,
              name: booking.item.name,
            },
            viewerRole,
            counterpartName: formatDisplayName(counterpart),
            completedAt: booking.completedAt,
          }
        })
        .filter((record): record is NonNullable<typeof record> => record !== null),
    }
  }),

  counts: adminProcedure.query(async ({ ctx }) => {
    const [submitted, open, appealed, rejected, closed] = await Promise.all([
      ctx.prisma.transactionDispute.count({ where: { status: SUBMITTED_DISPUTE_STATUS } }),
      ctx.prisma.transactionDispute.count({ where: { status: OPEN_DISPUTE_STATUS } }),
      ctx.prisma.transactionDispute.count({ where: { status: fromApiDisputeStatus("APPEALED") } }),
      ctx.prisma.transactionDispute.count({ where: { status: REJECTED_DISPUTE_STATUS } }),
      ctx.prisma.transactionDispute.count({ where: { status: fromApiDisputeStatus("CLOSED") } }),
    ])

    return {
      SUBMITTED: submitted,
      OPEN: open,
      APPEALED: appealed,
      REJECTED: rejected,
      CLOSED: closed,
    }
  }),

  list: adminProcedure.input(listDisputesSchema).query(async ({ ctx, input }) => {
    const disputePrisma = getDisputePrisma(ctx)
    const disputes = await disputePrisma.transactionDispute.findMany({
      where: input.status ? { status: fromApiDisputeStatus(input.status) } : undefined,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: disputeRecordSelect,
    })

    return {
      disputes: disputes.map((record) => mapDisputeRecord(record)),
    }
  }),

  byId: adminProcedure.input(disputeIdSchema).query(async ({ ctx, input }) => {
    const disputePrisma = getDisputePrisma(ctx)
    const dispute = (await disputePrisma.transactionDispute.findUnique({
      where: { id: input.id },
      select: disputeRecordSelect,
    })) as DisputeRecord | null

    if (!dispute) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Dispute not found.",
      })
    }

    return mapDisputeRecord(dispute)
  }),

  appeal: protectedProcedure.input(appealDisputeSchema).mutation(async ({ ctx, input }) => {
    const disputePrisma = getDisputePrisma(ctx)

    const appealedDispute = await disputePrisma.$transaction(async (tx) => {
      const dispute = (await tx.transactionDispute.findUnique({
        where: { id: input.id },
        select: appealCandidateSelect,
      })) as DisputeAppealCandidateRecord | null

      if (!dispute) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Dispute not found.",
        })
      }

      if (
        dispute.transaction.borrowerId !== ctx.user.id &&
        dispute.transaction.lenderId !== ctx.user.id
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only transaction participants can appeal this dispute decision.",
        })
      }

      if (
        toApiDisputeStatus(dispute.status) !== "REJECTED" ||
        !isDateWithinWindow(dispute.reviewedAt, DISPUTE_APPEAL_WINDOW_DAYS)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only recently rejected disputes can be appealed.",
        })
      }

      const updateResult = await tx.transactionDispute.updateMany({
        where: {
          id: input.id,
          status: REJECTED_DISPUTE_STATUS,
        },
        data: {
          status: APPEALED_DISPUTE_STATUS,
          resolution: buildAppealResolution(
            dispute.resolution,
            input.appealReason,
            input.evidenceFileNames,
          ),
        },
      })

      if (updateResult.count === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This dispute can no longer be appealed.",
        })
      }

      return (await tx.transactionDispute.findUnique({
        where: { id: input.id },
        select: disputeRecordSelect,
      })) as DisputeRecord | null
    }, DISPUTE_TRANSACTION_OPTIONS)

    if (!appealedDispute) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Dispute not found.",
      })
    }

    return mapDisputeRecord(appealedDispute, ctx.user.id, { userFacing: true })
  }),

  submitRebuttal: protectedProcedure
    .input(submitRebuttalSchema)
    .mutation(async ({ ctx, input }) => {
      const disputePrisma = getDisputePrisma(ctx)

      const rebuttedDispute = await disputePrisma.$transaction(async (tx) => {
        const dispute = (await tx.transactionDispute.findUnique({
          where: { id: input.id },
          select: rebuttalCandidateSelect,
        })) as DisputeRebuttalCandidateRecord | null

        if (!dispute) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Dispute not found.",
          })
        }

        if (
          dispute.transaction.borrowerId !== ctx.user.id &&
          dispute.transaction.lenderId !== ctx.user.id
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only dispute participants can submit a rebuttal.",
          })
        }

        if (dispute.raisedById === ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You cannot submit a rebuttal to your own dispute.",
          })
        }

        if (
          !isRebuttalEnabledDisputeStatus(dispute.status) ||
          Boolean(dispute.finalDecisionAt) ||
          Boolean(dispute.closedAt)
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Rebuttals can only be submitted while the dispute is open.",
          })
        }

        if (dispute.rebuttalSubmittedAt) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A rebuttal has already been submitted for this dispute.",
          })
        }

        const updateResult = await tx.transactionDispute.updateMany({
          where: {
            id: input.id,
            status: {
              in: [...REBUTTABLE_DISPUTE_STATUSES],
            },
            finalDecisionAt: null,
            closedAt: null,
            rebuttalSubmittedAt: null,
          },
          data: {
            status: OPEN_DISPUTE_STATUS,
            rebuttalById: ctx.user.id,
            rebuttalText: input.rebuttalText.trim(),
            rebuttalNotes: normalizeOptionalText(input.rebuttalNotes),
            rebuttalImageUrl: input.rebuttalImageUrl ?? null,
            rebuttalSubmittedAt: new Date(),
          },
        })

        if (updateResult.count === 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This dispute can no longer accept a rebuttal.",
          })
        }

        const rebuttedDispute = (await tx.transactionDispute.findUnique({
          where: { id: input.id },
          select: disputeRecordSelect,
        })) as DisputeRecord | null

        if (rebuttedDispute) {
          await tx.appNotification.create({
            data: {
              recipientUserId: rebuttedDispute.raisedById,
              actorUserId: ctx.user.id,
              bookingId: rebuttedDispute.transaction.bookingId,
              ...buildDisputeRebuttalSubmittedNotification({
                transactionReference: formatReference(
                  rebuttedDispute.transaction.id,
                  rebuttedDispute.transaction.bookingId,
                ),
                bookingId: rebuttedDispute.transaction.bookingId,
              }),
            },
          })
        }

        return rebuttedDispute
      }, DISPUTE_TRANSACTION_OPTIONS)

      if (!rebuttedDispute) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Dispute not found.",
        })
      }

      return mapDisputeRecord(rebuttedDispute, ctx.user.id, { userFacing: true })
    }),

  finalJudgment: adminProcedure.input(finalJudgmentSchema).mutation(async ({ ctx, input }) => {
    const disputePrisma = getDisputePrisma(ctx)

    const resolvedDispute = await disputePrisma.$transaction(async (tx) => {
      const dispute = (await tx.transactionDispute.findUnique({
        where: { id: input.id },
        select: finalJudgmentCandidateSelect,
      })) as DisputeFinalJudgmentCandidateRecord | null

      if (!dispute) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Dispute not found.",
        })
      }

      if (dispute.status !== OPEN_DISPUTE_STATUS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only open disputes can receive a final judgment.",
        })
      }

      if (dispute.finalDecisionAt || dispute.closedAt) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A final judgment has already been recorded for this dispute.",
        })
      }

      const participantIds = [dispute.transaction.borrowerId, dispute.transaction.lenderId].filter(
        (participantId): participantId is string => Boolean(participantId),
      )

      validateDisputeActions(input.actions, new Set(participantIds))

      const participants = await tx.user.findMany({
        where: {
          id: {
            in: participantIds,
          },
        },
        select: participantStateSelect,
      })

      if (participants.length !== participantIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "One or more dispute participants could not be loaded for resolution.",
        })
      }

      const judgedAt = new Date()
      const updateResult = await tx.transactionDispute.updateMany({
        where: {
          id: input.id,
          status: OPEN_DISPUTE_STATUS,
          finalDecisionAt: null,
          closedAt: null,
        },
        data: {
          finalDecision: input.decision,
          finalDecisionNotes: input.decisionNotes.trim(),
          finalDecisionById: ctx.user.id,
          finalDecisionAt: judgedAt,
          requiredActionCount: input.actions.length,
        },
      })

      if (updateResult.count === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This dispute changed while you were reviewing it. Refresh and try again.",
        })
      }

      await applyDisputeActions(tx, {
        disputeId: input.id,
        appliedById: ctx.user.id,
        actions: input.actions,
        participants,
      })

      return (await tx.transactionDispute.findUnique({
        where: { id: input.id },
        select: disputeRecordSelect,
      })) as DisputeRecord | null
    }, DISPUTE_TRANSACTION_OPTIONS)

    if (!resolvedDispute) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Dispute not found.",
      })
    }

    return mapDisputeRecord(resolvedDispute)
  }),

  close: adminProcedure.input(closeDisputeSchema).mutation(async ({ ctx, input }) => {
    const disputePrisma = getDisputePrisma(ctx)

    const closedDispute = await disputePrisma.$transaction(async (tx) => {
      const dispute = (await tx.transactionDispute.findUnique({
        where: { id: input.id },
        select: closeCandidateSelect,
      })) as DisputeCloseCandidateRecord | null

      if (!dispute) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Dispute not found.",
        })
      }

      if (dispute.closedAt || dispute.status === CLOSED_DISPUTE_STATUS) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This dispute has already been closed.",
        })
      }

      if (dispute.status !== OPEN_DISPUTE_STATUS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only open disputes can be closed.",
        })
      }

      if (!dispute.finalDecision || !dispute.finalDecisionAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Record a final judgment before closing this dispute.",
        })
      }

      if (dispute.actions.length !== dispute.requiredActionCount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "All selected disciplinary actions must complete before closure.",
        })
      }

      const closedAt = new Date()
      const updateResult = await tx.transactionDispute.updateMany({
        where: {
          id: input.id,
          status: OPEN_DISPUTE_STATUS,
          finalDecisionAt: {
            not: null,
          },
          closedAt: null,
        },
        data: {
          status: CLOSED_DISPUTE_STATUS,
          closedAt,
        },
      })

      if (updateResult.count === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This dispute changed before it could be closed. Refresh and try again.",
        })
      }

      await syncClosedTransactionStatus(tx, {
        transactionId: dispute.transactionId,
        adminUserId: ctx.user.id,
        remarks: `Dispute ${input.id} closed by admin.`,
      })

      const notification = buildDisputeResolvedNotification({
        transactionReference: formatReference(
          dispute.transaction.id,
          dispute.transaction.bookingId,
        ),
        decision: dispute.finalDecision,
        decisionNotes: dispute.finalDecisionNotes,
        bookingId: dispute.transaction.bookingId,
      })
      const recipientIds = Array.from(
        new Set(
          [dispute.transaction.borrowerId, dispute.transaction.lenderId].filter(
            (recipientId): recipientId is string => Boolean(recipientId),
          ),
        ),
      )

      for (const recipientUserId of recipientIds) {
        await tx.appNotification.create({
          data: {
            recipientUserId,
            actorUserId: ctx.user.id,
            bookingId: dispute.transaction.bookingId,
            ...notification,
          },
        })
      }

      return (await tx.transactionDispute.findUnique({
        where: { id: input.id },
        select: disputeRecordSelect,
      })) as DisputeRecord | null
    }, DISPUTE_TRANSACTION_OPTIONS)

    if (!closedDispute) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Dispute not found.",
      })
    }

    return mapDisputeRecord(closedDispute)
  }),

  review: adminProcedure.input(reviewDisputeSchema).mutation(async ({ ctx, input }) => {
    const disputePrisma = getDisputePrisma(ctx)
    const nextStatus = input.decision === "APPROVE" ? OPEN_DISPUTE_STATUS : REJECTED_DISPUTE_STATUS
    const reviewedAt = new Date()

    const reviewedDispute = await disputePrisma.$transaction(async (tx) => {
      const updateResult = await tx.transactionDispute.updateMany({
        where: {
          id: input.id,
          status: {
            in: [SUBMITTED_DISPUTE_STATUS, APPEALED_DISPUTE_STATUS],
          },
          finalDecisionAt: null,
          closedAt: null,
        },
        data: {
          status: nextStatus,
          reviewedAt,
          reviewedById: ctx.user.id,
        },
      })

      if (updateResult.count === 0) {
        const existing = (await tx.transactionDispute.findUnique({
          where: { id: input.id },
          select: disputeStatusRecordSelect,
        })) as DisputeStatusRecord | null

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Dispute not found.",
          })
        }

        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Only disputes that are under review or under appeal can be approved or rejected.",
        })
      }

      const dispute = (await tx.transactionDispute.findUnique({
        where: { id: input.id },
        select: disputeRecordSelect,
      })) as DisputeRecord | null

      if (input.decision === "APPROVE" && dispute) {
        const counterpartyUserId = getCounterpartyUserId(dispute.transaction, dispute.raisedById)

        if (counterpartyUserId) {
          await tx.appNotification.create({
            data: {
              recipientUserId: counterpartyUserId,
              actorUserId: dispute.raisedById,
              bookingId: dispute.transaction.bookingId,
              ...buildDisputeOpenedNotification({
                transactionReference: formatReference(
                  dispute.transaction.id,
                  dispute.transaction.bookingId,
                ),
                reason: dispute.reason,
                description: dispute.description,
                raisedByName: formatDisplayName(dispute.raisedBy),
                bookingId: dispute.transaction.bookingId,
              }),
            },
          })
        }
      }

      return dispute
    }, DISPUTE_TRANSACTION_OPTIONS)

    if (!reviewedDispute) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Dispute not found.",
      })
    }

    return mapDisputeRecord(reviewedDispute)
  }),
})
