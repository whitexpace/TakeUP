import { TRPCError } from "@trpc/server"
import { createError, getQuery } from "h3"
import { myListingsSchema } from "../../shared/schemas/item"
import { appRouter } from "../trpc/routers"
import { createContext } from "../trpc/context"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  const parseArrayParam = (value: unknown) => {
    if (Array.isArray(value)) {
      return value.filter((entry): entry is string => typeof entry === "string")
    }

    return typeof value === "string" ? [value] : undefined
  }

  const cursorRaw = typeof query.cursor === "string" ? query.cursor : undefined
  let parsedCursor: unknown
  if (cursorRaw) {
    try {
      parsedCursor = JSON.parse(cursorRaw)
    } catch {
      throw createError({ statusCode: 400, statusMessage: "Invalid cursor format." })
    }
  }

  const result = myListingsSchema.safeParse({
    search: typeof query.search === "string" ? query.search : undefined,
    statuses: parseArrayParam(query.statuses),
    categories: parseArrayParam(query.categories),
    limit: typeof query.limit === "string" ? Number(query.limit) : undefined,
    cursor: parsedCursor,
  })

  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid query parameters." })
  }

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.item.myListings(result.data)
  } catch (err) {
    if (err instanceof TRPCError && err.code === "UNAUTHORIZED") {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized." })
    }
    throw err
  }
})
