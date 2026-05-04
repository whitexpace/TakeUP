import { createError, getRouterParam } from "h3"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"
import { itemRequestIdSchema } from "#shared/schemas/item-request"
import { handleItemRequestApiError } from "../item-requests/handle-item-request-api-error"

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, "id")
  const result = itemRequestIdSchema.safeParse({ id: rawId })

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid item request id.",
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.community.requestById(result.data)
  } catch (error) {
    handleItemRequestApiError(error, "fetch")
  }
})
