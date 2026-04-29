import { createError, readBody } from "h3"
import { createBookingSchema } from "#shared/schemas/booking"
import { appRouter } from "../trpc/routers"
import { createContext } from "../trpc/context"
import { handleBookingApiError } from "./bookings/handle-booking-api-error"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const result = createBookingSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid input.",
      data: result.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.booking.create(result.data)
  } catch (err) {
    handleBookingApiError(err, "create")
  }
})
