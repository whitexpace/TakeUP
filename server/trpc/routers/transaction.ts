import {
  Prisma,
  type PrismaClient,
  TransactionStatus as PrismaTransactionStatus,
} from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { router } from "../init"
import { adminProcedure, protectedProcedure } from "../procedures"
import {
  listAdminTransactionsSchema,
  listReviewDraftsSchema,
  listSubmittedReviewsSchema,
  listTransactionsSchema,
  type TransactionStatus as UiTransactionStatus,
} from "#shared/schemas/transaction"
import {
  createTransactionReviewSchema,
  transactionReviewDraftKeySchema,
  upsertTransactionReviewDraftSchema,
} from "#shared/schemas/review"
import {
  buildTransactionReviewState,
  isReviewTypeAllowedForTransaction,
  mapTransactionReview,
  transactionReviewSelect,
  transactionReviewUserSelect,
} from "../review-helpers"
import { processTransactionRewards } from "../../utils/rewards"
import { syncRoleRatingForUser } from "../../utils/review-ratings"
import { toUiTransactionStatus, transactionStatusGroups } from "../../utils/transaction-status"

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

type TransactionRecord = {
  id: string
  bookingId: string | null
  itemId: string | null
  borrowerId: string | null
  lenderId: string | null
  startDate: Date | null
  endDate: Date | null
  totalAmount?: number | Prisma.Decimal | null
  platformFee?: number | Prisma.Decimal | null
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
    borrowerRating: number | null
  }
  lender: {
    user: {
      username: string
      firstName: string
      middleName: string | null
      lastName: string
    }
    lenderRating: number | null
  }
  commissionAmount: number
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
    commissionAmount: Number(record.platformFee ?? 0),
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
      borrowerRating: null,
    },
    lender: {
      user: {
        username: "",
        firstName: "",
        middleName: null,
        lastName: "",
      },
      lenderRating: null,
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

const buildCreatedAtStartOfDay = (value: Date) => {
  const date = new Date(value)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

const buildCreatedAtEndOfDay = (value: Date) => {
  const date = new Date(value)
  date.setUTCHours(23, 59, 59, 999)
  return date
}

const enrichTransactionsWithParticipants = async (
  prisma: PrismaClient,
  records: TransactionListItem[],
) => {
  const participantIds = [
    ...new Set(records.flatMap((record) => [record.borrowerId, record.lenderId]).filter(Boolean)),
  ]

  const users = participantIds.length
    ? await prisma.user.findMany({
        where: { id: { in: participantIds } },
        select: {
          id: true,
          username: true,
          firstName: true,
          middleName: true,
          lastName: true,
          borrower: {
            select: {
              borrowerRating: true,
            },
          },
          lender: {
            select: {
              lenderRating: true,
            },
          },
        },
      })
    : []

  const userMap = new Map(users.map((user) => [user.id, user]))

  return records.map((record) => {
    const borrowerUser = userMap.get(record.borrowerId)
    const lenderUser = userMap.get(record.lenderId)

    return {
      ...record,
      borrower: {
        user: borrowerUser
          ? {
              username: borrowerUser.username,
              firstName: borrowerUser.firstName,
              middleName: borrowerUser.middleName,
              lastName: borrowerUser.lastName,
            }
          : record.borrower.user,
        borrowerRating: borrowerUser?.borrower?.borrowerRating ?? null,
      },
      lender: {
        user: lenderUser
          ? {
              username: lenderUser.username,
              firstName: lenderUser.firstName,
              middleName: lenderUser.middleName,
              lastName: lenderUser.lastName,
            }
          : record.lender.user,
        lenderRating: lenderUser?.lender?.lenderRating ?? null,
      },
    }
  })
}

const mapTransactionPage = async (
  prisma: PrismaClient,
  records: TransactionRecord[],
  currentUserId: string,
  limit: number,
) => {
  const hasMore = records.length > limit
  const pageRecords = hasMore ? records.slice(0, limit) : records
  const normalizedRecords = pageRecords
    .filter(Boolean)
    .map((record) => normalizeTransaction(record, currentUserId))
    .filter((record): record is TransactionListItem => record !== null)

  const transactions = await enrichTransactionsWithParticipants(prisma, normalizedRecords)
  const lastRecord = pageRecords.at(-1)
  const nextCursor =
    hasMore && lastRecord ? { id: lastRecord.id, createdAt: lastRecord.createdAt } : null

  return {
    transactions,
    nextCursor,
  }
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
      ? { status: { in: transactionStatusGroups[status] } }
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

    return mapTransactionPage(ctx.prisma, records, userId, limit)
  }),
  adminList: adminProcedure.input(listAdminTransactionsSchema).query(async ({ ctx, input }) => {
    const { status, createdAtFrom, createdAtTo, search, limit, cursor } = input

    const statusWhere: Prisma.RentalTransactionWhereInput = status
      ? { status: { in: transactionStatusGroups[status] } }
      : {}

    const createdAtWhere: Prisma.RentalTransactionWhereInput =
      createdAtFrom || createdAtTo
        ? {
            createdAt: {
              ...(createdAtFrom ? { gte: buildCreatedAtStartOfDay(createdAtFrom) } : {}),
              ...(createdAtTo ? { lte: buildCreatedAtEndOfDay(createdAtTo) } : {}),
            },
          }
        : {}

    const trimmedSearch = search?.trim()
    const searchWhere: Prisma.RentalTransactionWhereInput = trimmedSearch
      ? {
          OR: [
            { id: { contains: trimmedSearch } },
            {
              item: {
                is: {
                  name: {
                    contains: trimmedSearch,
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
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

    const records = (await ctx.prisma.rentalTransaction.findMany({
      where: {
        AND: [statusWhere, createdAtWhere, searchWhere, cursorWhere],
      },
      include: buildTransactionInclude(ctx.user.id),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    })) as unknown as TransactionRecord[]

    return mapTransactionPage(ctx.prisma, records, ctx.user.id, limit)
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

        const rewardEventDelegate = (ctx.prisma as { rewardEvent?: { upsert?: unknown } })
          .rewardEvent
        if (rewardEventDelegate && typeof rewardEventDelegate.upsert === "function") {
          try {
            await processTransactionRewards(
              ctx.prisma as Prisma.TransactionClient,
              reviewResult.transactionId,
            )
          } catch (error) {
            console.error("Failed to process transaction rewards after review submission", error)
          }
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
  listReviewDrafts: protectedProcedure
    .input(listReviewDraftsSchema)
    .query(async ({ ctx, input }) => {
      if (!hasReviewDraftDelegate(ctx.prisma)) {
        return { items: [], nextCursor: null }
      }

      const cursorWhere = input.cursor
        ? {
            OR: [
              { updatedAt: { lt: input.cursor.updatedAt } },
              { updatedAt: input.cursor.updatedAt, id: { lt: input.cursor.id } },
            ],
          }
        : {}

      const drafts = await ctx.prisma.transactionReviewDraft.findMany({
        where: {
          reviewerUserId: ctx.user.id,
          ...cursorWhere,
        },
        select: reviewDraftSelect,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
      })

      const hasMore = drafts.length > input.limit
      const pageDrafts = hasMore ? drafts.slice(0, input.limit) : drafts
      const lastDraft = pageDrafts.at(-1)

      return {
        items: pageDrafts.map((draft) => mapReviewDraftListItem(draft, ctx.user.id)),
        nextCursor:
          hasMore && lastDraft ? { id: lastDraft.id, updatedAt: lastDraft.updatedAt } : null,
      }
    }),
  listSubmittedReviews: protectedProcedure
    .input(listSubmittedReviewsSchema)
    .query(async ({ ctx, input }) => {
      const cursorWhere = input.cursor
        ? {
            OR: [
              { createdAt: { lt: input.cursor.createdAt } },
              { createdAt: input.cursor.createdAt, id: { lt: input.cursor.id } },
            ],
          }
        : {}

      const reviews = await ctx.prisma.transactionReview.findMany({
        where: {
          reviewerUserId: ctx.user.id,
          ...cursorWhere,
        },
        select: submittedReviewSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
      })

      const hasMore = reviews.length > input.limit
      const pageReviews = hasMore ? reviews.slice(0, input.limit) : reviews
      const lastReview = pageReviews.at(-1)

      return {
        items: pageReviews.map((review) => mapSubmittedReviewListItem(review, ctx.user.id)),
        nextCursor:
          hasMore && lastReview ? { id: lastReview.id, createdAt: lastReview.createdAt } : null,
      }
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
