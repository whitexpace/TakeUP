import { createError, getRouterParam, readBody } from "h3"
import { reactToMessageSchema } from "#shared/schemas/chat"
import { appRouter } from "../../../../../../trpc/routers"
import { createContext } from "../../../../../../trpc/context"
import { handleChatApiError } from "../../../../handle-chat-api-error"
import { broadcastChatReaction } from "../../../../../../utils/chat-realtime"

export default defineEventHandler(async (event) => {
  const conversationId = getRouterParam(event, "id")
  const messageId = getRouterParam(event, "messageId")
  const body = await readBody(event).catch(() => ({}))
  const parsed = reactToMessageSchema.safeParse({
    conversationId,
    messageId,
    emoji: body?.emoji,
  })

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid chat reaction payload.",
      data: parsed.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))

  try {
    const reaction = await caller.chat.reactToMessage(parsed.data)
    await broadcastChatReaction(event, reaction).catch(() => undefined)
    return reaction
  } catch (error) {
    handleChatApiError(error, "react to chat message")
  }
})
