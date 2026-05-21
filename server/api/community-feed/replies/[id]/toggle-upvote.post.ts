import { createError, getRouterParam } from "h3"
import { appRouter } from "../../../../trpc/routers"
import { createContext } from "../../../../trpc/context"
import { toggleItemRequestReplyUpvoteSchema } from "#shared/schemas/item-request"
import { handleItemRequestApiError } from "../../../item-requests/handle-item-request-api-error"

export default defineEventHandler(async (event) => {
  const rawReplyId = getRouterParam(event, "id")
  const result = toggleItemRequestReplyUpvoteSchema.safeParse({ id: rawReplyId })

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid input.",
      data: result.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.community.toggleReplyUpvote(result.data)
  } catch (error) {
    handleItemRequestApiError(error, "toggle reply upvote")
  }
})
