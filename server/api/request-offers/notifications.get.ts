import { getQuery } from "h3"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"
import { listRequestOfferNotificationsSchema } from "#shared/schemas/item-request"
import { handleRequestOfferApiError } from "./handle-request-offer-api-error"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const input = listRequestOfferNotificationsSchema.parse({
    limit: typeof query.limit === "string" ? Number(query.limit) : undefined,
  })
  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.community.notifications(input)
  } catch (error) {
    handleRequestOfferApiError(error, "fetch notifications")
  }
})
