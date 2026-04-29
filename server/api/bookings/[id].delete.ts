import { createError, getRouterParam } from "h3"
import { deleteBookingSchema } from "#shared/schemas/booking"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"
import { handleBookingApiError } from "../bookings/handle-booking-api-error"

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
    handleBookingApiError(err, "delete")
  }
})
