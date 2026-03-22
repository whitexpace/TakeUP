import { TRPCError } from "@trpc/server"
import { createError, getQuery } from "h3"
import { listBookingsSchema } from "../../shared/schemas/booking"
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

  const input = listBookingsSchema.parse({
    role: typeof query.role === "string" ? query.role : undefined,
    status: typeof query.status === "string" ? query.status : undefined,
    itemId: typeof query.itemId === "string" ? query.itemId : undefined,
    startDateFrom: typeof query.startDateFrom === "string" ? query.startDateFrom : undefined,
    startDateTo: typeof query.startDateTo === "string" ? query.startDateTo : undefined,
    limit: typeof query.limit === "string" ? Number(query.limit) : undefined,
    cursor: parsedCursor,
  })

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.booking.list(input)
  } catch (err) {
    if (err instanceof TRPCError && err.code === "UNAUTHORIZED") {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized." })
    }
    throw err
  }
})
