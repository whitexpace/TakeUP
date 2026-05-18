import { createError, getRouterParam } from "h3"
import { appRouter } from "../../../../trpc/routers"
import { createContext } from "../../../../trpc/context"
import { listItemRequestRepliesSchema } from "#shared/schemas/item-request"
import { handleItemRequestApiError } from "../../../item-requests/handle-item-request-api-error"

export default defineEventHandler(async (event) => {
  const rawRequestId = getRouterParam(event, "id")
  const result = listItemRequestRepliesSchema.safeParse({ requestId: rawRequestId })

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid input.",
      data: result.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.community.listReplies(result.data)
  } catch (error) {
    handleItemRequestApiError(error, "fetch replies")
  }
})
