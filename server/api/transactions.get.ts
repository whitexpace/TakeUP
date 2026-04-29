import { createError, getQuery } from "h3"
import { listTransactionsSchema } from "#shared/schemas/transaction"
import { appRouter } from "../trpc/routers"
import { createContext } from "../trpc/context"

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

  const input = listTransactionsSchema.parse({
    role: typeof query.role === "string" ? query.role : undefined,
    status: typeof query.status === "string" ? query.status : undefined,
    startDateFrom: typeof query.startDateFrom === "string" ? query.startDateFrom : undefined,
    startDateTo: typeof query.startDateTo === "string" ? query.startDateTo : undefined,
    limit: typeof query.limit === "string" ? Number(query.limit) : undefined,
    cursor: parsedCursor,
  })

  const caller = appRouter.createCaller(await createContext(event))
  return caller.transaction.list(input)
})
