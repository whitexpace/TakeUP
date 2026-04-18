import { createError, getRouterParam } from "h3"
import { bookingReviewLookupSchema } from "../../../../shared/schemas/review"
import { createContext } from "../../../trpc/context"
import { appRouter } from "../../../trpc/routers"

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, "id")
  const parsed = bookingReviewLookupSchema.safeParse({ bookingId: rawId })

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid booking id.",
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  return caller.review.byBooking(parsed.data)
})
