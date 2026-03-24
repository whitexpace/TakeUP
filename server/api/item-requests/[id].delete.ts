import { createError, getRouterParam } from "h3"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"
import { deleteItemRequestSchema } from "../../../shared/schemas/item-request"
import { handleItemRequestApiError } from "../item-requests/handle-item-request-api-error"

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, "id")
  const result = deleteItemRequestSchema.safeParse({ id: rawId })

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid item request id.",
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.community.deleteRequest(result.data)
  } catch (error) {
    handleItemRequestApiError(error, "delete")
  }
})
