import { getQuery } from "h3"
import { appRouter } from "../trpc/routers"
import { createContext } from "../trpc/context"
import { listRequestOffersSchema } from "../../shared/schemas/item-request"
import { handleRequestOfferApiError } from "./request-offers/handle-request-offer-api-error"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const input = listRequestOffersSchema.parse(query)

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.community.listOffers(input)
  } catch (error) {
    handleRequestOfferApiError(error, "fetch")
  }
})
