import { createError, getRouterParam } from "h3"
import { transactionConversationSchema } from "#shared/schemas/chat"
import { appRouter } from "../../../trpc/routers"
import { createContext } from "../../../trpc/context"
import { handleChatApiError } from "../../chat/handle-chat-api-error"

export default defineEventHandler(async (event) => {
  const rawTransactionId = getRouterParam(event, "transactionId")
  const parsed = transactionConversationSchema.safeParse({
    transactionId: rawTransactionId,
  })

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid transaction id.",
    })
  }

  const caller = appRouter.createCaller(await createContext(event))

  try {
    return await caller.chat.byTransaction(parsed.data)
  } catch (error) {
    handleChatApiError(error, "load transaction chat")
  }
})
