import { TRPCError } from "@trpc/server"
import { createError, getRouterParam } from "h3"
import { deleteBookingSchema } from "../../../shared/schemas/booking"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")

  const result = deleteBookingSchema.safeParse({ id })
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid booking id.",
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.booking.delete(result.data)
  } catch (err) {
    if (err instanceof TRPCError) {
      if (err.code === "UNAUTHORIZED")
        throw createError({ statusCode: 401, statusMessage: "Unauthorized." })
      if (err.code === "FORBIDDEN")
        throw createError({ statusCode: 403, statusMessage: "Forbidden." })
      if (err.code === "NOT_FOUND")
        throw createError({ statusCode: 404, statusMessage: "Booking not found." })
    }
    throw err
  }
})
