import { createError, getRouterParam } from "h3"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"
import { deleteRequestOfferSchema } from "#shared/schemas/item-request"
import { handleRequestOfferApiError } from "../request-offers/handle-request-offer-api-error"

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, "id")
  const result = deleteRequestOfferSchema.safeParse({ id: rawId })

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid request offer id.",
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.community.deleteOffer(result.data)
  } catch (error) {
    handleRequestOfferApiError(error, "delete")
  }
})
