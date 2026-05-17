import { readBody } from "h3"
import { sendMessageSchema } from "#shared/schemas/chat"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"
import { handleChatApiError } from "./handle-chat-api-error"
import { broadcastChatMessage } from "../../utils/chat-realtime"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const input = sendMessageSchema.parse(body)
  const caller = appRouter.createCaller(await createContext(event))

  try {
    const message = await caller.chat.sendMessage(input)
    await broadcastChatMessage(event, message).catch(() => undefined)
    return message
  } catch (error) {
    handleChatApiError(error, "send message")
  }
})
