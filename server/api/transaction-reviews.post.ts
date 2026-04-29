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

  const caller = appRouter.createCaller(await createContext(event))

  return await caller.transaction.createReview(result.data)
})
