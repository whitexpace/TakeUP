import { createError, getRouterParam, readBody } from "h3"
import { sendMessageSchema } from "#shared/schemas/chat"
import { appRouter } from "../../../../trpc/routers"
import { createContext } from "../../../../trpc/context"
import { handleChatApiError } from "../../../chat/handle-chat-api-error"
import { broadcastChatMessage } from "../../../../utils/chat-realtime"

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, "id")
  const body = await readBody(event)
  const parsed = sendMessageSchema.safeParse({
    conversationId: rawId,
    body: body?.body ?? body?.text,
    imageUrl: body?.imageUrl ?? null,
  })

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid chat message payload.",
      data: parsed.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))

  try {
    const message = await caller.chat.sendMessage(parsed.data)
    await broadcastChatMessage(event, message).catch(() => undefined)
    return message
  } catch (error) {
    handleChatApiError(error, "send chat message")
  }
})
