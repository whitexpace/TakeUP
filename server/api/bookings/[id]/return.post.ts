import { createError, getRouterParam } from "h3"
import { returnBookingSchema } from "../../../../shared/schemas/booking"
import { createContext } from "../../../trpc/context"
import { appRouter } from "../../../trpc/routers"
import { handleBookingApiError } from "../../bookings/handle-booking-api-error"

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, "id")
  const parsed = returnBookingSchema.safeParse({ id: rawId })

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid booking id.",
    })
  }

  const caller = appRouter.createCaller(await createContext(event))

  try {
    return await caller.booking.returnItem(parsed.data)
  } catch (error) {
    handleBookingApiError(error, "return")
  }
})
