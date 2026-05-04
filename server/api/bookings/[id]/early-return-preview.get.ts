import { createError, getRouterParam } from "h3"
import { bookingIdSchema } from "#shared/schemas/booking"
import { createContext } from "../../../trpc/context"
import { appRouter } from "../../../trpc/routers"
import { handleBookingApiError } from "../../bookings/handle-booking-api-error"

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
    return await caller.booking.earlyReturnPreview(parsed.data)
  } catch (error) {
    handleBookingApiError(error, "early-return-preview")
  }
})
