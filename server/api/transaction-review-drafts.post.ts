import { createError, readBody } from "h3"
import { upsertTransactionReviewDraftSchema } from "../../shared/schemas/review"
import { createContext } from "../trpc/context"
import { appRouter } from "../trpc/routers"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = upsertTransactionReviewDraftSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid review draft input.",
      data: result.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  return await caller.transaction.upsertReviewDraft(result.data)
})
