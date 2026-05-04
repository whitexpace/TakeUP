import { createError, getQuery } from "h3"
import { listAdminListingsSchema } from "../../../shared/schemas/admin"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"
import { handleAdminApiError } from "./handle-admin-api-error"

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

  const parsed = listAdminListingsSchema.safeParse({
    statuses: parseArrayParam(query.statuses),
    categories: parseArrayParam(query.categories),
    search: typeof query.search === "string" && query.search.trim() ? query.search : undefined,
    limit: typeof query.limit === "string" ? Number(query.limit) : undefined,
    cursor: parsedCursor,
  })

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid admin listings filter.",
      data: parsed.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.admin.listings.list(parsed.data)
  } catch (error) {
    handleAdminApiError(error)
  }
})
