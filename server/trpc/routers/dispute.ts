import { Prisma } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import type { Context } from "../context"
import { router } from "../init"
import { adminProcedure, protectedProcedure } from "../procedures"
import {
  appealDisputeSchema,
  disputeIdSchema,
  listDisputesSchema,
  reviewDisputeSchema,
  submitRebuttalSchema,
  submitDisputeSchema,
} from "../../../shared/schemas/dispute"
import {
  ACTIVE_DISPUTE_STATUSES,
  OPEN_DISPUTE_STATUS,
  REJECTED_DISPUTE_STATUS,
  SUBMITTED_DISPUTE_STATUS,
  fromApiDisputeStatus,
  toApiDisputeStatus,
} from "../../utils/dispute-status"

const disputeItemImageOrderBy: Prisma.ItemImageOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { createdAt: "asc" },
]
const DISPUTE_REPORT_WINDOW_DAYS = 15
const DISPUTE_APPEAL_WINDOW_DAYS = 15
const DAY_IN_MS = 24 * 60 * 60 * 1000

const participantUserSelect = {
  id: true,
  username: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true,
}

const disputeRecordSelect = {
  id: true,
  transactionId: true,
  raisedById: true,
  reason: true,
  description: true,
  resolution: true,
  status: true,
  reviewedAt: true,
  rebuttalById: true,
  rebuttalText: true,
  rebuttalNotes: true,
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
}

type DisputeParticipant = {
  id: string
  username: string
  firstName: string
  middleName: string | null
  lastName: string
  email: string
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
  rebuttalById: string | null
  rebuttalText: string | null
  rebuttalNotes: string | null
  rebuttalSubmittedAt: Date | null
  createdAt: Date
  raisedBy: DisputeParticipant | null
  rebuttalBy: DisputeParticipant | null
  reviewedBy: DisputeParticipant | null
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

type DisputeStatusRecord = {
  id: string
  status: string
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
  transaction: {
    borrowerId: string | null
    lenderId: string | null
  }
}

type DisputeTransactionClient = {
  rentalTransaction: {
    findUnique(args: Record<string, unknown>): Promise<DisputeAccessTransaction | null>
    findMany(args: Record<string, unknown>): Promise<ReportableTransactionRecord[]>
  }
  booking: {
    findUnique(args: Record<string, unknown>): Promise<DisputeBookingRecord | null>
    findMany(args: Record<string, unknown>): Promise<ReportableBookingRecord[]>
  }
  transactionDispute: {
    findFirst(args: Record<string, unknown>): Promise<{ id: string } | null>
    create(args: Record<string, unknown>): Promise<DisputeRecord>
    findMany(args: Record<string, unknown>): Promise<DisputeRecord[]>
    findUnique(args: Record<string, unknown>): Promise<DisputeRecord | DisputeStatusRecord | null>
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>
  }
  appNotification: {
    create(args: Record<string, unknown>): Promise<unknown>
  }
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

const mapParticipant = (
  user:
    | {
        id: string
        username: string
        firstName: string
        middleName: string | null
        lastName: string
        email: string
      }
    | null
    | undefined,
) =>
  user
    ? {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        displayName: formatDisplayName(user),
      }
    : null

const mapDisputeRecord = (record: DisputeRecord, currentUserId?: string | null) => {
  const status = toApiDisputeStatus(record.status)
  const viewerRole =
    currentUserId === record.transaction.borrowerId
      ? "BORROWER"
      : currentUserId === record.transaction.lenderId
        ? "LENDER"
        : null
  const borrower = mapParticipant(record.transaction.borrower)
  const lender = mapParticipant(record.transaction.lender)
  const counterpart = viewerRole === "BORROWER" ? lender : viewerRole === "LENDER" ? borrower : null
  const canAppeal =
    status === "REJECTED" && isDateWithinWindow(record.reviewedAt, DISPUTE_APPEAL_WINDOW_DAYS)
  const hasRebuttal = Boolean(record.rebuttalSubmittedAt && record.rebuttalText)
  const canSubmitRebuttal =
    status === "OPEN" &&
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
    canReview: status === "SUBMITTED",
    canAppeal,
    canSubmitRebuttal,
    hasRebuttal,
    rebuttalText: record.rebuttalText,
    rebuttalNotes: record.rebuttalNotes,
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

const getSubmittedConflictMessage = () => "An active dispute already exists for this transaction."

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
    `${input.raisedByName} opened a dispute for transaction ${input.transactionReference}.`,
    `Reason: ${input.reason}`,
    input.description ? `Details: ${input.description}` : null,
    "Admin review is in progress. You may submit one rebuttal.",
  ]
    .filter(Boolean)
    .join(" "),
  actionPath: input.bookingId
    ? `/account/transactions/${input.bookingId}`
    : "/account/disputes?tab=disputes",
})

export const disputeRouter = router({
  submit: protectedProcedure.input(submitDisputeSchema).mutation(async ({ ctx, input }) => {
    const disputePrisma = getDisputePrisma(ctx)

    try {
      const createdDispute = await disputePrisma.$transaction(async (tx) => {
        const transaction = await tx.rentalTransaction.findUnique({
          where: { id: input.transactionId },
          select: {
            id: true,
            bookingId: true,
            borrowerId: true,
            lenderId: true,
            itemId: true,
          },
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
          select: {
            id: true,
            status: true,
            completedAt: true,
          },
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

        const existingActiveDispute = await tx.transactionDispute.findFirst({
          where: {
            transactionId: input.transactionId,
            status: {
              in: [...ACTIVE_DISPUTE_STATUSES],
            },
          },
          select: { id: true },
        })

        if (existingActiveDispute) {
          throw new TRPCError({
            code: "CONFLICT",
            message: getSubmittedConflictMessage(),
          })
        }

        return await tx.transactionDispute.create({
          data: {
            transactionId: input.transactionId,
            raisedById: ctx.user.id,
            reason: input.reason.trim(),
            description: normalizeOptionalText(input.description),
            status: SUBMITTED_DISPUTE_STATUS,
          },
          select: disputeRecordSelect,
        })
      }, DISPUTE_TRANSACTION_OPTIONS)

      return mapDisputeRecord(createdDispute)
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
    const disputes = await disputePrisma.transactionDispute.findMany({
      where: {
        OR: [
          { raisedById: ctx.user.id },
          { transaction: { borrowerId: ctx.user.id } },
          { transaction: { lenderId: ctx.user.id } },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: disputeRecordSelect,
    })

    return {
      disputes: disputes.map((record) => mapDisputeRecord(record, ctx.user.id)),
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
      select: {
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
      },
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
      select: {
        id: true,
        bookingId: true,
        disputes: {
          where: {
            status: {
              in: [...ACTIVE_DISPUTE_STATUSES],
            },
          },
          select: {
            id: true,
          },
        },
      },
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

  list: adminProcedure.input(listDisputesSchema).query(async ({ ctx, input }) => {
    const disputePrisma = getDisputePrisma(ctx)
    const disputes = await disputePrisma.transactionDispute.findMany({
      where: {
        status: fromApiDisputeStatus(input.status),
      },
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
    const appealedStatus = fromApiDisputeStatus("APPEALED")

    const appealedDispute = await disputePrisma.$transaction(async (tx) => {
      const dispute = (await tx.transactionDispute.findUnique({
        where: { id: input.id },
        select: {
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
        },
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
          status: appealedStatus,
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

    return mapDisputeRecord(appealedDispute, ctx.user.id)
  }),

  submitRebuttal: protectedProcedure
    .input(submitRebuttalSchema)
    .mutation(async ({ ctx, input }) => {
      const disputePrisma = getDisputePrisma(ctx)

      const rebuttedDispute = await disputePrisma.$transaction(async (tx) => {
        const dispute = (await tx.transactionDispute.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            status: true,
            raisedById: true,
            rebuttalSubmittedAt: true,
            transaction: {
              select: {
                borrowerId: true,
                lenderId: true,
              },
            },
          },
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

        if (toApiDisputeStatus(dispute.status) !== "OPEN") {
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
            status: OPEN_DISPUTE_STATUS,
            rebuttalSubmittedAt: null,
          },
          data: {
            rebuttalById: ctx.user.id,
            rebuttalText: input.rebuttalText.trim(),
            rebuttalNotes: normalizeOptionalText(input.rebuttalNotes),
            rebuttalSubmittedAt: new Date(),
          },
        })

        if (updateResult.count === 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This dispute can no longer accept a rebuttal.",
          })
        }

        return (await tx.transactionDispute.findUnique({
          where: { id: input.id },
          select: disputeRecordSelect,
        })) as DisputeRecord | null
      }, DISPUTE_TRANSACTION_OPTIONS)

      if (!rebuttedDispute) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Dispute not found.",
        })
      }

      return mapDisputeRecord(rebuttedDispute, ctx.user.id)
    }),

  review: adminProcedure.input(reviewDisputeSchema).mutation(async ({ ctx, input }) => {
    const disputePrisma = getDisputePrisma(ctx)
    const nextStatus = input.decision === "APPROVE" ? OPEN_DISPUTE_STATUS : REJECTED_DISPUTE_STATUS
    const reviewedAt = new Date()

    const reviewedDispute = await disputePrisma.$transaction(async (tx) => {
      const updateResult = await tx.transactionDispute.updateMany({
        where: {
          id: input.id,
          status: SUBMITTED_DISPUTE_STATUS,
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
          select: { id: true, status: true },
        })) as DisputeStatusRecord | null

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Dispute not found.",
          })
        }

        throw new TRPCError({
          code: "CONFLICT",
          message: "Only disputes that are under review can be approved or rejected.",
        })
      }

      const dispute = (await tx.transactionDispute.findUnique({
        where: { id: input.id },
        select: disputeRecordSelect,
      })) as DisputeRecord | null

      if (input.decision === "APPROVE" && dispute) {
        const counterpartyUserId =
          dispute.transaction.borrowerId === dispute.raisedById
            ? dispute.transaction.lenderId
            : dispute.transaction.borrowerId

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
