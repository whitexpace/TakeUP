import { createError, getRouterParam, readBody } from "h3"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"
import { updateRequestOfferSchema } from "#shared/schemas/item-request"
import { handleRequestOfferApiError } from "../request-offers/handle-request-offer-api-error"

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, "id")
  const body = await readBody(event)
  const result = updateRequestOfferSchema.safeParse({ ...body, id: rawId })

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid input.",
      data: result.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.community.updateOffer(result.data)
  } catch (error) {
    handleRequestOfferApiError(error, "update")
  }
})
