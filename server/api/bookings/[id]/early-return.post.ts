import { createError, getRouterParam, readBody } from "h3"
import { earlyReturnBookingSchema } from "../../../../shared/schemas/booking"
import { createContext } from "../../../trpc/context"
import { appRouter } from "../../../trpc/routers"
import { handleBookingApiError } from "../../bookings/handle-booking-api-error"

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, "id")
  const body = await readBody(event).catch(() => ({}))

  const parsed = earlyReturnBookingSchema.safeParse({
    id: rawId,
    returnReason: body?.returnReason,
  })

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid booking id or parameters.",
    })
  }

  const caller = appRouter.createCaller(await createContext(event))

  try {
    return await caller.booking.earlyReturn(parsed.data)
  } catch (error) {
    handleBookingApiError(error, "early-return")
  }
})
