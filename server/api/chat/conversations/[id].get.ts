import { createError, getRouterParam } from "h3"
import { conversationIdSchema } from "#shared/schemas/chat"
import { appRouter } from "../../../trpc/routers"
import { createContext } from "../../../trpc/context"
import { handleChatApiError } from "../../chat/handle-chat-api-error"

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, "id")
  const parsed = conversationIdSchema.safeParse({ conversationId: rawId })

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid conversation id.",
    })
  }

  const caller = appRouter.createCaller(await createContext(event))

  try {
    return await caller.chat.byConversation(parsed.data)
  } catch (error) {
    handleChatApiError(error, "load conversation")
  }
})
