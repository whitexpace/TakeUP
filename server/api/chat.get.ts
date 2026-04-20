import { appRouter } from "../trpc/routers"
import { createContext } from "../trpc/context"
import { handleChatApiError } from "./chat/handle-chat-api-error"

export default defineEventHandler(async (event) => {
  const caller = appRouter.createCaller(await createContext(event))

  try {
    return await caller.chat.list()
  } catch (error) {
    handleChatApiError(error, "load chat inbox")
  }
})
