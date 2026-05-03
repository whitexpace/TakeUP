import { createError, getQuery } from "h3"
import { listAdminTransactionsSchema } from "../../../shared/schemas/transaction"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"

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

  const parsed = listAdminTransactionsSchema.safeParse({
    status: typeof query.status === "string" ? query.status : undefined,
    createdAtFrom: typeof query.createdAtFrom === "string" ? query.createdAtFrom : undefined,
    createdAtTo: typeof query.createdAtTo === "string" ? query.createdAtTo : undefined,
    search: typeof query.search === "string" && query.search.trim() ? query.search : undefined,
    limit: typeof query.limit === "string" ? Number(query.limit) : undefined,
    cursor: parsedCursor,
  })

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid transaction filter.",
      data: parsed.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  return caller.transaction.adminList(parsed.data)
})
