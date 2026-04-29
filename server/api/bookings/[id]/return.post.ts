import { createError, getRouterParam, readBody } from "h3"
import { returnProofBookingSchema } from "../../../../shared/schemas/booking"
import { createContext } from "../../../trpc/context"
import { appRouter } from "../../../trpc/routers"
import { handleBookingApiError } from "../../bookings/handle-booking-api-error"

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, "id")
  const body = await readBody(event).catch(() => ({}))
  const parsed = returnProofBookingSchema.safeParse({
    id: rawId,
    proofImageUrl: body?.proofImageUrl,
  })

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid booking id or proof image.",
      data: parsed.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))

  try {
    return await caller.booking.returnItem(parsed.data)
  } catch (error) {
    handleBookingApiError(error, "return")
  }
})
