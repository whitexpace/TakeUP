import { createError, getQuery } from "h3"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"
import { listReviewDraftsSchema } from "#shared/schemas/transaction"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const cursorRaw = typeof query.cursor === "string" ? query.cursor : undefined
  let parsedCursor: unknown
  if (cursorRaw) {
    try {
      parsedCursor = JSON.parse(cursorRaw)
    } catch {
      throw createError({ statusCode: 400, statusMessage: "Invalid cursor format." })
    }
  }
  const input = listReviewDraftsSchema.parse({
    limit: typeof query.limit === "string" ? Number(query.limit) : undefined,
    cursor: parsedCursor,
  })
  const caller = appRouter.createCaller(await createContext(event))
  return await caller.transaction.listReviewDrafts(input)
})
