import { createError, getQuery } from "h3"
import { transactionReviewDraftKeySchema } from "../../shared/schemas/review"
import { createContext } from "../trpc/context"
import { appRouter } from "../trpc/routers"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const result = transactionReviewDraftKeySchema.safeParse(query)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid draft lookup input.",
      data: result.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  return await caller.transaction.getReviewDraft(result.data)
})
