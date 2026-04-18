import {
  Prisma,
  type PrismaClient,
  TransactionStatus as PrismaTransactionStatus,
} from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { router } from "../init"
import { protectedProcedure } from "../procedures"
import {
  listTransactionsSchema,
  type TransactionStatus as UiTransactionStatus,
} from "../../../shared/schemas/transaction"
import {
  createTransactionReviewSchema,
  transactionReviewDraftKeySchema,
  upsertTransactionReviewDraftSchema,
} from "../../../shared/schemas/review"
import {
  buildTransactionReviewState,
  isReviewTypeAllowedForTransaction,
  mapTransactionReview,
  transactionReviewSelect,
  transactionReviewUserSelect,
} from "../review-helpers"
import { processTransactionRewards } from "../../utils/rewards"
import { syncRoleRatingForUser } from "../../utils/review-ratings"

const itemImageOrderBy: Prisma.ItemImageOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { createdAt: "asc" },
]

const buildTransactionInclude = (currentUserId: string) =>
  ({
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
          orderBy: itemImageOrderBy,
        },
        rateOption: true,
        rentalFee: true,
        freeToBorrow: true,
      },
    },
    reviews: {
      where: {
        reviewerUserId: currentUserId,
      },
      select: {
        reviewType: true,
      },
    },
  }) satisfies Prisma.RentalTransactionInclude

const getTransactionThumbnailImage = (item: {
  images?: Array<{ path: string; isPrimary?: boolean }>
}): string | null =>
  item.images?.find((image) => image.isPrimary)?.path ?? item.images?.[0]?.path ?? null

const prismaTransactionStatuses = PrismaTransactionStatus as Record<string, PrismaTransactionStatus>
const getOptionalTransactionStatus = (name: string) => prismaTransactionStatuses[name]
const getTransactionStatusGroup = (
  names: string[],
  fallback: PrismaTransactionStatus[],
): PrismaTransactionStatus[] => {
  const resolved = names
    .map((name) => getOptionalTransactionStatus(name))
    .filter((status): status is PrismaTransactionStatus => Boolean(status))

  return resolved.length > 0 ? resolved : fallback
}

const statusGroups: Record<UiTransactionStatus, PrismaTransactionStatus[]> = {
  PENDING: getTransactionStatusGroup(
    ["PENDING", "AWAITING_LENDER_APPROVAL"],
    [PrismaTransactionStatus.PENDING],
  ),
  ACTIVE: getTransactionStatusGroup(
    ["ACTIVE", "CONFIRMED", "PAID", "ONGOING", "IN_DISPUTE", "APPEALED"],
    [PrismaTransactionStatus.PENDING],
  ),
  RETURNED: getTransactionStatusGroup(["RETURNED"], [PrismaTransactionStatus.RETURNED]),
  COMPLETED: [PrismaTransactionStatus.COMPLETED],
  CANCELLED: getTransactionStatusGroup(
    ["CANCELLED", "REFUNDED", "FAILED"],
    [PrismaTransactionStatus.CANCELLED],
  ),
  IN_DISPUTE: [PrismaTransactionStatus.IN_DISPUTE, PrismaTransactionStatus.APPEALED],
}

const toUiTransactionStatus = (status: PrismaTransactionStatus): UiTransactionStatus => {
  if (statusGroups.PENDING.includes(status)) return "PENDING"
  if (statusGroups.ACTIVE.includes(status)) return "ACTIVE"
  if (statusGroups.RETURNED.includes(status)) return "RETURNED"
  if (statusGroups.COMPLETED.includes(status)) return "COMPLETED"
  if (statusGroups.CANCELLED.includes(status)) return "CANCELLED"
  if (statusGroups.IN_DISPUTE.includes(status)) return "IN_DISPUTE"
  return "PENDING"
}

type TransactionRecord = {
  id: string
  bookingId: string | null
  itemId: string | null
  borrowerId: string | null
  lenderId: string | null
  startDate: Date | null
  endDate: Date | null
  totalAmount?: number | Prisma.Decimal | null
  status: PrismaTransactionStatus
  createdAt: Date
  updatedAt: Date
  item: {
    id: string
    name: string
    rateOption: "PER_HOUR" | "PER_DAY"
    rentalFee: number
    freeToBorrow: boolean
    images: Array<{
      path: string
      isPrimary: boolean
      sortOrder: number
    }>
  } | null
  reviews: Array<{
    reviewType: "ITEM_REVIEW" | "LENDER_REVIEW" | "BORROWER_REVIEW"
  }>
}

type TransactionListItem = {
  id: string
  bookingId: string | null
  itemId: string
  borrowerId: string
  lenderId: string
  startDate: Date
  endDate: Date
  totalAmount: number
  status: UiTransactionStatus
  createdAt: Date
  updatedAt: Date
  item: {
    id: string
    name: string
    rateOption: "PER_HOUR" | "PER_DAY"
    rentalFee: number
    freeToBorrow: boolean
    images: Array<{
      path: string
      isPrimary: boolean
      sortOrder: number
    }>
    thumbnailImage: string | null
  }
  borrower: {
    user: {
      username: string
      firstName: string
      middleName: string | null
      lastName: string
    }
  }
  lender: {
    user: {
      username: string
      firstName: string
      middleName: string | null
      lastName: string
    }
  }
  reviewState: {
    isParticipant: boolean
    isCompleted: boolean
    allowedTypes: Array<"ITEM_REVIEW" | "LENDER_REVIEW" | "BORROWER_REVIEW">
    actions: Array<{
      reviewType: "ITEM_REVIEW" | "LENDER_REVIEW" | "BORROWER_REVIEW"
      label: string
      submittedLabel: string
      hasSubmitted: boolean
      canSubmit: boolean
    }>
    canSubmitAny: boolean
  }
}

const formatReviewLabel = (reviewType: "ITEM_REVIEW" | "LENDER_REVIEW" | "BORROWER_REVIEW") => {
  switch (reviewType) {
    case "ITEM_REVIEW":
      return "Item Review"
    case "LENDER_REVIEW":
      return "Lender Review"
    case "BORROWER_REVIEW":
      return "Borrower Review"
  }
}

const formatReference = (transactionId: string, bookingId: string | null) =>
  bookingId ?? transactionId.slice(0, 16).toUpperCase()

const formatParticipantName = (
  user: { firstName: string; lastName: string } | null | undefined,
) => {
  if (!user?.firstName) return "Former user"
  const lastInitial = user.lastName?.[0] ?? ""
  return lastInitial ? `${user.firstName} ${lastInitial}.` : user.firstName
}

const reviewListItemSelect = {
  id: true,
  name: true,
  images: {
    select: {
      path: true,
      isPrimary: true,
      sortOrder: true,
    },
    orderBy: itemImageOrderBy,
  },
} satisfies Prisma.ItemSelect

const reviewDraftSelect = {
  id: true,
  transactionId: true,
  reviewType: true,
  rating: true,
  reviewText: true,
  images: true,
  isAnonymous: true,
  updatedAt: true,
  createdAt: true,
  transaction: {
    select: {
      id: true,
      bookingId: true,
      borrowerId: true,
      lenderId: true,
      item: {
        select: reviewListItemSelect,
      },
      borrower: {
        select: transactionReviewUserSelect,
      },
      lender: {
        select: transactionReviewUserSelect,
      },
    },
  },
} satisfies Prisma.TransactionReviewDraftSelect

const submittedReviewSelect = {
  id: true,
  transactionId: true,
  reviewType: true,
  rating: true,
  reviewText: true,
  images: true,
  isAnonymous: true,
  createdAt: true,
  revieweeUser: {
    select: transactionReviewUserSelect,
  },
  item: {
    select: reviewListItemSelect,
  },
  transaction: {
    select: {
      id: true,
      bookingId: true,
      borrowerId: true,
      lenderId: true,
      item: {
        select: reviewListItemSelect,
      },
      borrower: {
        select: transactionReviewUserSelect,
      },
      lender: {
        select: transactionReviewUserSelect,
      },
    },
  },
} satisfies Prisma.TransactionReviewSelect

type ReviewDraftRecord = Prisma.TransactionReviewDraftGetPayload<{
  select: typeof reviewDraftSelect
}>

type SubmittedReviewRecord = Prisma.TransactionReviewGetPayload<{
  select: typeof submittedReviewSelect
}>

const mapReviewDraftListItem = (draft: ReviewDraftRecord, currentUserId: string) => {
  const role =
    draft.transaction.borrowerId === currentUserId
      ? "BORROWER"
      : draft.transaction.lenderId === currentUserId
        ? "LENDER"
        : null
  const counterpart = role === "BORROWER" ? draft.transaction.lender : draft.transaction.borrower
  const item = draft.transaction.item

  return {
    id: draft.id,
    transactionId: draft.transactionId,
    transactionReference: formatReference(draft.transaction.id, draft.transaction.bookingId),
    reviewType: draft.reviewType,
    typeLabel: formatReviewLabel(draft.reviewType),
    role,
    counterpartName: formatParticipantName(counterpart),
    item: item
      ? {
          id: item.id,
          name: item.name,
          thumbnailImage: getTransactionThumbnailImage(item),
        }
      : null,
    rating: draft.rating,
    reviewText: draft.reviewText,
    images: draft.images,
    isAnonymous: draft.isAnonymous,
    updatedAt: draft.updatedAt,
    createdAt: draft.createdAt,
  }
}

const mapSubmittedReviewListItem = (review: SubmittedReviewRecord, currentUserId: string) => {
  const role =
    review.transaction.borrowerId === currentUserId
      ? "BORROWER"
      : review.transaction.lenderId === currentUserId
        ? "LENDER"
        : null
  const counterpart = role === "BORROWER" ? review.transaction.lender : review.transaction.borrower
  const fallbackItem = review.transaction.item
  const item = review.item ?? fallbackItem

  return {
    id: review.id,
    transactionId: review.transactionId,
    transactionReference: formatReference(review.transaction.id, review.transaction.bookingId),
    reviewType: review.reviewType,
    typeLabel: formatReviewLabel(review.reviewType),
    role,
    counterpartName: formatParticipantName(counterpart),
    revieweeName: formatParticipantName(review.revieweeUser),
    item: item
      ? {
          id: item.id,
          name: item.name,
          thumbnailImage: getTransactionThumbnailImage(item),
        }
      : null,
    rating: review.rating,
    reviewText: review.reviewText,
    images: review.images,
    isAnonymous: review.isAnonymous,
    createdAt: review.createdAt,
  }
}

const normalizeTransaction = (
  record: TransactionRecord,
  currentUserId: string,
): TransactionListItem | null => {
  if (
    !record.item ||
    !record.itemId ||
    !record.borrowerId ||
    !record.lenderId ||
    !record.startDate ||
    !record.endDate
  ) {
    return null
  }

  const totalAmountValue =
    record.totalAmount ??
    Math.max(
      0,
      record.item.rentalFee *
        Math.ceil((record.endDate.getTime() - record.startDate.getTime()) / (24 * 60 * 60 * 1000)),
    )

  return {
    id: record.id,
    bookingId: record.bookingId,
    itemId: record.itemId,
    borrowerId: record.borrowerId,
    lenderId: record.lenderId,
    startDate: record.startDate,
    endDate: record.endDate,
    totalAmount: Number(totalAmountValue),
    status: toUiTransactionStatus(record.status),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    item: {
      ...record.item,
      thumbnailImage: getTransactionThumbnailImage(record.item),
    },
    borrower: {
      user: {
        username: "",
        firstName: "",
        middleName: null,
        lastName: "",
      },
    },
    lender: {
      user: {
        username: "",
        firstName: "",
        middleName: null,
        lastName: "",
      },
    },
    reviewState: buildTransactionReviewState({
      status: toUiTransactionStatus(record.status),
      itemId: record.itemId,
      borrowerId: record.borrowerId,
      lenderId: record.lenderId,
      currentUserId,
      existingReviewTypes: record.reviews.map((review) => review.reviewType),
    }),
  }
}

type ReviewAccessPrisma = {
  rentalTransaction: PrismaClient["rentalTransaction"]
}

type ReviewDraftPrisma = {
  transactionReviewDraft: PrismaClient["transactionReviewDraft"]
}

const hasReviewDraftDelegate = (prisma: unknown): prisma is ReviewDraftPrisma =>
  Boolean(
    prisma &&
    typeof prisma === "object" &&
    "transactionReviewDraft" in prisma &&
    (prisma as { transactionReviewDraft?: unknown }).transactionReviewDraft,
  )

const getTransactionReviewAccess = async (
  prisma: ReviewAccessPrisma,
  currentUserId: string,
  input: {
    transactionId: string
    reviewType: "ITEM_REVIEW" | "LENDER_REVIEW" | "BORROWER_REVIEW"
  },
  options?: {
    forbiddenMessage?: string
  },
) => {
  const transaction = await prisma.rentalTransaction.findUnique({
    where: { id: input.transactionId },
    select: {
      id: true,
      itemId: true,
      status: true,
      borrowerId: true,
      lenderId: true,
      reviews: {
        where: {
          reviewerUserId: currentUserId,
        },
        select: {
          reviewType: true,
        },
      },
    },
  })

  if (!transaction) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Transaction not found.",
    })
  }

  const reviewState = buildTransactionReviewState({
    status: transaction.status,
    itemId: transaction.itemId,
    borrowerId: transaction.borrowerId,
    lenderId: transaction.lenderId,
    currentUserId,
    existingReviewTypes: transaction.reviews.map(
      (review: { reviewType: "ITEM_REVIEW" | "LENDER_REVIEW" | "BORROWER_REVIEW" }) =>
        review.reviewType,
    ),
  })

  if (!reviewState.isParticipant) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: options?.forbiddenMessage ?? "Only transaction participants can submit a review.",
    })
  }

  if (
    !isReviewTypeAllowedForTransaction(input.reviewType, {
      itemId: transaction.itemId,
      borrowerId: transaction.borrowerId,
      lenderId: transaction.lenderId,
      currentUserId,
    })
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This review type is not allowed for your role in the transaction.",
    })
  }

  return transaction
}

export const transactionRouter = router({
  list: protectedProcedure.input(listTransactionsSchema).query(async ({ ctx, input }) => {
    const { role, status, startDateFrom, startDateTo, limit, cursor } = input
    const userId = ctx.user.id

    const roleWhere: Prisma.RentalTransactionWhereInput =
      role === "LENDER"
        ? { lenderId: userId }
        : role === "BORROWER"
          ? { borrowerId: userId }
          : { OR: [{ lenderId: userId }, { borrowerId: userId }] }

    const statusWhere: Prisma.RentalTransactionWhereInput = status
      ? { status: { in: statusGroups[status] } }
      : {}

    const dateWhere: Prisma.RentalTransactionWhereInput =
      startDateFrom || startDateTo
        ? {
            startDate: {
              ...(startDateFrom ? { gte: startDateFrom } : {}),
              ...(startDateTo ? { lte: startDateTo } : {}),
            },
          }
        : {}

    const cursorWhere: Prisma.RentalTransactionWhereInput = cursor
      ? {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        }
      : {}

    const baseWhere: Prisma.RentalTransactionWhereInput = {
      AND: [roleWhere, statusWhere, dateWhere, cursorWhere],
    }

    const records = (await ctx.prisma.rentalTransaction.findMany({
      where: baseWhere,
      include: buildTransactionInclude(userId),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    })) as unknown as TransactionRecord[]

    const hasMore = records.length > limit
    const pageRecords = hasMore ? records.slice(0, limit) : records
    const normalizedRecords = pageRecords
      .filter(Boolean)
      .map((record) => normalizeTransaction(record, userId))
      .filter((record): record is TransactionListItem => record !== null)

    const participantIds = [
      ...new Set(
        normalizedRecords.flatMap((record) => [record.borrowerId, record.lenderId]).filter(Boolean),
      ),
    ]

    const users = participantIds.length
      ? await ctx.prisma.user.findMany({
          where: { id: { in: participantIds } },
          select: {
            id: true,
            username: true,
            firstName: true,
            middleName: true,
            lastName: true,
          },
        })
      : []

    const userMap = new Map(users.map((user) => [user.id, user]))
    const transactions = normalizedRecords.map((record) => ({
      ...record,
      borrower: { user: userMap.get(record.borrowerId) ?? record.borrower.user },
      lender: { user: userMap.get(record.lenderId) ?? record.lender.user },
    }))
    const lastRecord = pageRecords.at(-1)
    const nextCursor =
      hasMore && lastRecord ? { id: lastRecord.id, createdAt: lastRecord.createdAt } : null

    return {
      transactions,
      nextCursor,
    }
  }),
  createReview: protectedProcedure
    .input(createTransactionReviewSchema)
    .mutation(async ({ ctx, input }) => {
      const transaction = await getTransactionReviewAccess(
        ctx.prisma as ReviewAccessPrisma,
        ctx.user.id,
        input,
        {
          forbiddenMessage: "Only transaction participants can submit a review.",
        },
      )

      if (transaction.status !== PrismaTransactionStatus.COMPLETED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Reviews can only be submitted for completed transactions.",
        })
      }

      if (
        !isReviewTypeAllowedForTransaction(input.reviewType, {
          itemId: transaction.itemId,
          borrowerId: transaction.borrowerId,
          lenderId: transaction.lenderId,
          currentUserId: ctx.user.id,
        })
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This review type is not allowed for your role in the transaction.",
        })
      }

      if (
        transaction.reviews.some(
          (review: { reviewType: "ITEM_REVIEW" | "LENDER_REVIEW" | "BORROWER_REVIEW" }) =>
            review.reviewType === input.reviewType,
        )
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You have already submitted this review for the transaction.",
        })
      }

      const revieweeUserId =
        input.reviewType === "ITEM_REVIEW"
          ? null
          : input.reviewType === "LENDER_REVIEW"
            ? transaction.lenderId
            : transaction.borrowerId
      const itemId = input.reviewType === "ITEM_REVIEW" ? transaction.itemId : null

      if (input.reviewType === "ITEM_REVIEW" && !itemId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This transaction can no longer accept an item review.",
        })
      }

      try {
        const reviewResult = await ctx.prisma.$transaction(async (tx) => {
          const txWithDrafts = tx as typeof tx & ReviewDraftPrisma
          const createdReview = await tx.transactionReview.create({
            data: {
              transactionId: transaction.id,
              reviewerUserId: ctx.user.id,
              reviewType: input.reviewType,
              revieweeUserId,
              itemId,
              rating: input.rating,
              reviewText: input.reviewText,
              images: input.images,
              isAnonymous: input.isAnonymous,
            },
            select: transactionReviewSelect,
          })

          await txWithDrafts.transactionReviewDraft.deleteMany({
            where: {
              transactionId: transaction.id,
              reviewerUserId: ctx.user.id,
              reviewType: input.reviewType,
            },
          })

          if (itemId) {
            const itemReviewAggregate = await tx.transactionReview.aggregate({
              where: {
                itemId,
                reviewType: "ITEM_REVIEW",
              },
              _avg: {
                rating: true,
              },
            })

            await tx.item.update({
              where: { id: itemId },
              data: {
                rating: itemReviewAggregate._avg.rating ?? 0,
              },
            })
          }

          if (revieweeUserId && input.reviewType !== "ITEM_REVIEW") {
            await syncRoleRatingForUser(
              tx as Prisma.TransactionClient,
              input.reviewType,
              revieweeUserId,
            )
          }

          return {
            createdReview,
            transactionId: transaction.id,
          }
        })

        try {
          await processTransactionRewards(
            ctx.prisma as Prisma.TransactionClient,
            reviewResult.transactionId,
          )
        } catch (error) {
          console.error("Failed to process transaction rewards after review submission", error)
        }

        return mapTransactionReview(reviewResult.createdReview)
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "You have already submitted this review for the transaction.",
          })
        }

        throw error
      }
    }),
  listReviewDrafts: protectedProcedure.query(async ({ ctx }) => {
    if (!hasReviewDraftDelegate(ctx.prisma)) {
      return []
    }

    const drafts = await ctx.prisma.transactionReviewDraft.findMany({
      where: {
        reviewerUserId: ctx.user.id,
      },
      select: reviewDraftSelect,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    })

    return drafts.map((draft) => mapReviewDraftListItem(draft, ctx.user.id))
  }),
  listSubmittedReviews: protectedProcedure.query(async ({ ctx }) => {
    const reviews = await ctx.prisma.transactionReview.findMany({
      where: {
        reviewerUserId: ctx.user.id,
      },
      select: submittedReviewSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    })

    return reviews.map((review) => mapSubmittedReviewListItem(review, ctx.user.id))
  }),
  getReviewDraft: protectedProcedure
    .input(transactionReviewDraftKeySchema)
    .query(async ({ ctx, input }) => {
      await getTransactionReviewAccess(ctx.prisma as ReviewAccessPrisma, ctx.user.id, input, {
        forbiddenMessage: "Only transaction participants can manage review drafts.",
      })

      if (!hasReviewDraftDelegate(ctx.prisma)) {
        return null
      }

      return await ctx.prisma.transactionReviewDraft.findUnique({
        where: {
          transactionId_reviewerUserId_reviewType: {
            transactionId: input.transactionId,
            reviewerUserId: ctx.user.id,
            reviewType: input.reviewType,
          },
        },
        select: {
          transactionId: true,
          reviewType: true,
          rating: true,
          reviewText: true,
          images: true,
          isAnonymous: true,
          updatedAt: true,
        },
      })
    }),
  upsertReviewDraft: protectedProcedure
    .input(upsertTransactionReviewDraftSchema)
    .mutation(async ({ ctx, input }) => {
      const transaction = await getTransactionReviewAccess(
        ctx.prisma as ReviewAccessPrisma,
        ctx.user.id,
        input,
        {
          forbiddenMessage: "Only transaction participants can manage review drafts.",
        },
      )

      if (
        transaction.reviews.some(
          (review: { reviewType: "ITEM_REVIEW" | "LENDER_REVIEW" | "BORROWER_REVIEW" }) =>
            review.reviewType === input.reviewType,
        )
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You have already submitted this review for the transaction.",
        })
      }

      if (!hasReviewDraftDelegate(ctx.prisma)) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Review drafts are not available yet. Apply the latest Prisma migration and restart the server.",
        })
      }

      return await ctx.prisma.transactionReviewDraft.upsert({
        where: {
          transactionId_reviewerUserId_reviewType: {
            transactionId: input.transactionId,
            reviewerUserId: ctx.user.id,
            reviewType: input.reviewType,
          },
        },
        create: {
          transactionId: input.transactionId,
          reviewerUserId: ctx.user.id,
          reviewType: input.reviewType,
          rating: input.rating,
          reviewText: input.reviewText,
          images: input.images,
          isAnonymous: input.isAnonymous,
        },
        update: {
          rating: input.rating,
          reviewText: input.reviewText,
          images: input.images,
          isAnonymous: input.isAnonymous,
        },
        select: {
          transactionId: true,
          reviewType: true,
          rating: true,
          reviewText: true,
          images: true,
          isAnonymous: true,
          updatedAt: true,
        },
      })
    }),
  deleteReviewDraft: protectedProcedure
    .input(transactionReviewDraftKeySchema)
    .mutation(async ({ ctx, input }) => {
      await getTransactionReviewAccess(ctx.prisma as ReviewAccessPrisma, ctx.user.id, input, {
        forbiddenMessage: "Only transaction participants can manage review drafts.",
      })

      if (!hasReviewDraftDelegate(ctx.prisma)) {
        return { success: true }
      }

      await ctx.prisma.transactionReviewDraft.deleteMany({
        where: {
          transactionId: input.transactionId,
          reviewerUserId: ctx.user.id,
          reviewType: input.reviewType,
        },
      })

      return { success: true }
    }),
})
