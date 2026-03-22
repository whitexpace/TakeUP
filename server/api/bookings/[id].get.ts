import { TRPCError } from "@trpc/server"
import { createError, getRouterParam } from "h3"
import { bookingIdSchema } from "../../../shared/schemas/booking"
import { createContext } from "../../trpc/context"
import { appRouter } from "../../trpc/routers"

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, "id")
  const parsed = bookingIdSchema.safeParse({ id: rawId })

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid booking id.",
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  try {
    const booking = await caller.booking.byId(parsed.data)

    if (!booking) {
      throw createError({
        statusCode: 404,
        statusMessage: "Booking not found.",
      })
    }

    return booking
  } catch (err) {
    if (err instanceof TRPCError) {
      if (err.code === "UNAUTHORIZED")
        throw createError({ statusCode: 401, statusMessage: "Unauthorized." })
      if (err.code === "FORBIDDEN")
        throw createError({ statusCode: 403, statusMessage: "Forbidden." })
    }
    throw err
  }
})
