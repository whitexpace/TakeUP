import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"
import { handleRequestOfferApiError } from "./handle-request-offer-api-error"

export default defineEventHandler(async (event) => {
  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.community.notifications()
  } catch (error) {
    handleRequestOfferApiError(error, "fetch notifications")
  }
})
