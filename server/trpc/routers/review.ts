import { TRPCError } from "@trpc/server"
import { TransactionStatus, type Prisma } from "@prisma/client"
import { router } from "../init"
import { protectedProcedure } from "../procedures"
import {
  bookingReviewLookupSchema,
  createReviewSchema,
} from "../../../shared/schemas/review"
import { processReviewRewards, processTransactionRewards } from "../../utils/rewards"

export const reviewRouter = router({
  byBooking: protectedProcedure
    .input(bookingReviewLookupSchema)
    .query(async ({ ctx, input }) => {
      const transaction = await ctx.prisma.rentalTransaction.findUnique({
        where: { bookingId: input.bookingId },
        select: {
          id: true,
          status: true,
          borrowerId: true,
          lenderId: true,
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

    return ctx.prisma.$transaction(async (tx) => {
      const transaction = await tx.rentalTransaction.findUnique({
        where: { bookingId: input.bookingId },
        select: {
          id: true,
          status: true,
          itemId: true,
          borrowerId: true,
          lenderId: true,
        },
      })

      if (!transaction || transaction.status !== TransactionStatus.COMPLETED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A completed transaction is required before submitting a review.",
        })
      }

      const revieweeUserId =
        transaction.borrowerId === ctx.user.id ? transaction.lenderId : transaction.borrowerId

      if (!revieweeUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The review target for this transaction is invalid.",
        })
      }

      const existingReview = await tx.transactionReview.findUnique({
        where: {
          transactionId_reviewerUserId: {
            transactionId: transaction.id,
            reviewerUserId: ctx.user.id,
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
          revieweeUserId,
          itemId: transaction.itemId,
          rating: input.rating,
          reviewText: input.reviewText?.trim() || null,
          isAnonymous: input.isAnonymous,
        },
      })

      await processTransactionRewards(tx as Prisma.TransactionClient, transaction.id)
      await processReviewRewards(tx as Prisma.TransactionClient, review.id)

      return review
    })
  }),
})
