import { TRPCError } from "@trpc/server"
import { TransactionStatus, UserStatus, type Prisma } from "@prisma/client"
import { router } from "../init"
import { protectedProcedure, publicProcedure } from "../procedures"
import { bookingReviewLookupSchema, createReviewSchema } from "#shared/schemas/review"
import { processTransactionRewards } from "../../utils/rewards"
import { ACTIVE_DISPUTE_STATUSES } from "../../utils/dispute-status"
import { syncRoleRatingForUser, syncRoleRatingsFromReviews } from "../../utils/review-ratings"

type ReviewLeaderboardType = "BORROWER_REVIEW" | "LENDER_REVIEW"

const listReviewLeaderboard = async (
  prisma: Prisma.DefaultPrismaClient,
  reviewType: ReviewLeaderboardType,
) => {
  const reviews = await prisma.transactionReview.findMany({
    where: {
      reviewType,
      revieweeUserId: { not: null },
    },
    select: {
      revieweeUserId: true,
      rating: true,
      createdAt: true,
    },
  })

  const grouped = new Map<
    string,
    { totalRating: number; reviewCount: number; lastActivityAt: Date | null }
  >()

  for (const review of reviews) {
    if (!review.revieweeUserId) continue

    const existing = grouped.get(review.revieweeUserId) ?? {
      totalRating: 0,
      reviewCount: 0,
      lastActivityAt: null,
    }

    existing.totalRating += review.rating
    existing.reviewCount += 1
    existing.lastActivityAt =
      !existing.lastActivityAt || review.createdAt > existing.lastActivityAt
        ? review.createdAt
        : existing.lastActivityAt

    grouped.set(review.revieweeUserId, existing)
  }

  const eligibleStats = [...grouped.entries()].map(([userId, entry]) => ({
    userId,
    reviewCount: entry.reviewCount,
    lastActivityAt: entry.lastActivityAt,
  }))

  const userIds = eligibleStats.map((entry) => entry.userId)

  if (userIds.length === 0) {
    return []
  }

  await syncRoleRatingsFromReviews(prisma, reviewType, userIds)

  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
    },
  })

  const userMap = new Map(users.map((user) => [user.id, user]))
  let ratingMap: Map<string, number>

  if (reviewType === "BORROWER_REVIEW") {
    const roleRatings = await prisma.borrower.findMany({
      where: {
        userId: { in: userIds },
      },
      select: {
        userId: true,
        borrowerRating: true,
      },
    })

    ratingMap = new Map(roleRatings.map((entry) => [entry.userId, entry.borrowerRating]))
  } else {
    const roleRatings = await prisma.lender.findMany({
      where: {
        userId: { in: userIds },
      },
      select: {
        userId: true,
        lenderRating: true,
      },
    })

    ratingMap = new Map(roleRatings.map((entry) => [entry.userId, entry.lenderRating]))
  }

  return eligibleStats
    .map((entry) => ({
      ...entry,
      averageRating: ratingMap.get(entry.userId) ?? 0,
    }))
    .sort((left, right) => {
      if (right.averageRating !== left.averageRating) {
        return right.averageRating - left.averageRating
      }

      if (right.reviewCount !== left.reviewCount) {
        return right.reviewCount - left.reviewCount
      }

      return (right.lastActivityAt?.getTime() ?? 0) - (left.lastActivityAt?.getTime() ?? 0)
    })
    .slice(0, 10)
    .map((entry, index) => {
      const user = userMap.get(entry.userId)
      if (!user) return null

      const fullName = `${user.firstName} ${user.lastName}`.trim()
      const displayName = user.username || fullName || "Community member"

      return {
        rank: index + 1,
        averageRating: Number(entry.averageRating.toFixed(1)),
        reviewCount: entry.reviewCount,
        lastActivityAt: entry.lastActivityAt,
        user: {
          id: user.id,
          name: displayName,
          avatarUrl: user.avatarUrl,
        },
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
}

export const reviewRouter = router({
  borrowerLeaderboard: publicProcedure.query(async ({ ctx }) => {
    return {
      leaderboard: await listReviewLeaderboard(ctx.prisma, "BORROWER_REVIEW"),
    }
  }),

  lenderLeaderboard: publicProcedure.query(async ({ ctx }) => {
    return {
      leaderboard: await listReviewLeaderboard(ctx.prisma, "LENDER_REVIEW"),
    }
  }),

  byBooking: protectedProcedure.input(bookingReviewLookupSchema).query(async ({ ctx, input }) => {
    const transaction = await ctx.prisma.rentalTransaction.findUnique({
      where: { bookingId: input.bookingId },
      select: {
        id: true,
        status: true,
        borrowerId: true,
        lenderId: true,
        disputes: {
          where: {
            status: {
              in: [...ACTIVE_DISPUTE_STATUSES],
            },
          },
          select: {
            id: true,
          },
          take: 1,
        },
        reviews: {
          where: { reviewerUserId: ctx.user.id },
          select: {
            id: true,
            rating: true,
            reviewText: true,
            isAnonymous: true,
            createdAt: true,
          },
          take: 1,
        },
      },
    })

    if (!transaction) {
      return {
        canSubmit: false,
        review: null,
        transactionId: null,
      }
    }

    const isParticipant =
      transaction.borrowerId === ctx.user.id || transaction.lenderId === ctx.user.id

    return {
      canSubmit:
        isParticipant &&
        transaction.status === TransactionStatus.COMPLETED &&
        transaction.disputes.length === 0 &&
        transaction.reviews.length === 0,
      review: transaction.reviews[0] ?? null,
      transactionId: transaction.id,
    }
  }),

  create: protectedProcedure.input(createReviewSchema).mutation(async ({ ctx, input }) => {
    const booking = await ctx.prisma.booking.findUnique({
      where: { id: input.bookingId },
      select: {
        id: true,
        borrowerId: true,
        lenderId: true,
        status: true,
      },
    })

    if (!booking) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." })
    }

    if (booking.borrowerId !== ctx.user.id && booking.lenderId !== ctx.user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only booking participants can submit a review.",
      })
    }

    if (booking.status !== "COMPLETED") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Reviews can only be submitted after a transaction is completed.",
      })
    }

    const result = await ctx.prisma.$transaction(async (tx) => {
      const transaction = await tx.rentalTransaction.findUnique({
        where: { bookingId: input.bookingId },
        select: {
          id: true,
          status: true,
          itemId: true,
          borrowerId: true,
          lenderId: true,
          disputes: {
            where: {
              status: {
                in: [...ACTIVE_DISPUTE_STATUSES],
              },
            },
            select: {
              id: true,
            },
            take: 1,
          },
        },
      })

      if (!transaction || transaction.status !== TransactionStatus.COMPLETED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A completed transaction is required before submitting a review.",
        })
      }

      if (transaction.disputes.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Reviews are unavailable while a dispute or concern is in progress.",
        })
      }

      const revieweeUserId =
        transaction.borrowerId === ctx.user.id ? transaction.lenderId : transaction.borrowerId
      const reviewType =
        transaction.borrowerId === ctx.user.id ? "LENDER_REVIEW" : "BORROWER_REVIEW"

      if (!revieweeUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The review target for this transaction is invalid.",
        })
      }

      const existingReview = await tx.transactionReview.findUnique({
        where: {
          transactionId_reviewerUserId_reviewType: {
            transactionId: transaction.id,
            reviewerUserId: ctx.user.id,
            reviewType,
          },
        },
        select: { id: true },
      })

      if (existingReview) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You have already submitted a review for this transaction.",
        })
      }

      const review = await tx.transactionReview.create({
        data: {
          transactionId: transaction.id,
          reviewerUserId: ctx.user.id,
          reviewType,
          revieweeUserId,
          itemId: null,
          rating: input.rating,
          reviewText: input.reviewText?.trim() || "",
          images: [],
          isAnonymous: input.isAnonymous,
        },
      })

      await syncRoleRatingForUser(tx as Prisma.TransactionClient, reviewType, revieweeUserId)

      return {
        review,
        transactionId: transaction.id,
      }
    })

    const rewardEventDelegate = (ctx.prisma as { rewardEvent?: { upsert?: unknown } }).rewardEvent
    if (rewardEventDelegate && typeof rewardEventDelegate.upsert === "function") {
      try {
        await processTransactionRewards(
          ctx.prisma as Prisma.TransactionClient,
          result.transactionId,
        )
      } catch (error) {
        console.error("Failed to process transaction rewards after review submission", error)
      }
    }

    return result.review
  }),
})
