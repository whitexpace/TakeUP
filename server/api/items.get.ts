import { createError, getQuery } from "h3"
import { paginatedItemsSchema } from "../../shared/schemas/item"
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
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid cursor format.",
      })
    }
  }

  const input = paginatedItemsSchema.parse({
    limit: typeof query.limit === "string" ? Number(query.limit) : undefined,
    search: typeof query.search === "string" ? query.search : undefined,
    cursor: parsedCursor,
  })

  const caller = appRouter.createCaller(await createContext(event))
  return caller.item.paginatedList(input)
})
