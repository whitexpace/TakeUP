import { readBody } from "h3"
import { reportConversationSchema } from "#shared/schemas/chat"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"
import { handleChatApiError } from "./handle-chat-api-error"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const input = reportConversationSchema.parse(body)
  const caller = appRouter.createCaller(await createContext(event))

  try {
    return await caller.chat.reportConversation(input)
  } catch (error) {
    handleChatApiError(error, "submit chat report")
  }
})
