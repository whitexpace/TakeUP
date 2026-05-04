import { createError, readBody } from "h3"
import { appRouter } from "../trpc/routers"
import { createContext } from "../trpc/context"
import { createRequestOfferSchema } from "#shared/schemas/item-request"
import { handleRequestOfferApiError } from "./request-offers/handle-request-offer-api-error"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = createRequestOfferSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid input.",
      data: result.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.community.createOffer(result.data)
  } catch (error) {
    handleRequestOfferApiError(error, "create")
  }
})
