import { getQuery } from "h3"
import { fetchMessagesSchema } from "../../../shared/schemas/chat"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"
import { handleChatApiError } from "./handle-chat-api-error"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const input = fetchMessagesSchema.parse({
    conversationId: query.conversationId,
    cursor: query.cursor || undefined,
    limit: query.limit ? Number(query.limit) : undefined,
  })
  const caller = appRouter.createCaller(await createContext(event))

  try {
    return await caller.chat.getMessages(input)
  } catch (error) {
    handleChatApiError(error, "load messages")
  }
})
