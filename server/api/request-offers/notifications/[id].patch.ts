import { createError, getRouterParam } from "h3"
import { appRouter } from "../../../trpc/routers"
import { createContext } from "../../../trpc/context"
import { markRequestOfferNotificationReadSchema } from "#shared/schemas/item-request"
import { handleRequestOfferApiError } from "../../request-offers/handle-request-offer-api-error"

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, "id")
  const result = markRequestOfferNotificationReadSchema.safeParse({ id: rawId })

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid request offer notification id.",
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.community.markNotificationRead(result.data)
  } catch (error) {
    handleRequestOfferApiError(error, "mark notification as read")
  }
})
