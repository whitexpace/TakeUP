import { createError, getRouterParam, readBody } from "h3"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"
import { updateItemRequestSchema } from "#shared/schemas/item-request"
import { handleItemRequestApiError } from "../item-requests/handle-item-request-api-error"

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, "id")
  const body = await readBody(event)
  const result = updateItemRequestSchema.safeParse({ ...body, id: rawId })

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid input.",
      data: result.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.community.updateRequest(result.data)
  } catch (error) {
    handleItemRequestApiError(error, "update")
  }
})
