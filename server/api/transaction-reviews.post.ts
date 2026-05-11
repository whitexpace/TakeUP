import { createError, readBody } from "h3"
import { createTransactionReviewSchema } from "#shared/schemas/review"
import { appRouter } from "../trpc/routers"
import { createContext } from "../trpc/context"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = createTransactionReviewSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid review input.",
      data: result.error.flatten(),
    })
  }

  const prisma = event.context.prisma
  const transaction = await prisma.rentalTransaction.findUnique({
    where: { id: result.data.transactionId },
    select: { bookingId: true },
  })

  if (!transaction) {
    throw createError({
      statusCode: 404,
      statusMessage: "Transaction not found.",
    })
  }

  const caller = appRouter.createCaller(await createContext(event))

  return await caller.transaction.createReview({
    bookingId: transaction.bookingId,
    rating: result.data.rating,
    reviewText: result.data.reviewText,
    isAnonymous: result.data.isAnonymous,
    reviewType: result.data.reviewType,
  } as Parameters<typeof caller.transaction.createReview>[0])
})
