import { createError, readBody } from "h3"
import { transactionReviewDraftKeySchema } from "../../shared/schemas/review"
import { createContext } from "../trpc/context"
import { appRouter } from "../trpc/routers"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = transactionReviewDraftKeySchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid review draft delete input.",
      data: result.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  return await caller.transaction.deleteReviewDraft(result.data)
})
