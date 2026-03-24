import { appRouter } from "../../../trpc/routers"
import { createContext } from "../../../trpc/context"
import { handleRequestOfferApiError } from "../../request-offers/handle-request-offer-api-error"

export default defineEventHandler(async (event) => {
  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.community.markAllNotificationsRead()
  } catch (error) {
    handleRequestOfferApiError(error, "mark all notifications as read")
  }
})
