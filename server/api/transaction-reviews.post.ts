import { createError, readBody } from "h3"
import { createTransactionReviewSchema } from "#shared/schemas/review"
import { appRouter } from "../trpc/routers"
import { createContext } from "../trpc/context"
import { prisma } from "../utils/prisma"

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
  const transaction = await prisma.rentalTransaction.findUnique({
    where: { id: result.data.transactionId },
    select: { id: true },
  })

  if (!transaction) {
    throw createError({
      statusCode: 404,
      statusMessage: "Transaction not found.",
    })
  }

  const caller = appRouter.createCaller(await createContext(event))

  return await caller.transaction.createReview({
    transactionId: result.data.transactionId,
    rating: result.data.rating,
    reviewText: result.data.reviewText,
    isAnonymous: result.data.isAnonymous,
    reviewType: result.data.reviewType,
  })
})
