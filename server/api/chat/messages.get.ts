import { getQuery } from "h3"
import { fetchMessagesSchema } from "../../../shared/schemas/chat"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const input = fetchMessagesSchema.parse({
    conversationId: query.conversationId,
    cursor: query.cursor || undefined,
    limit: query.limit ? Number(query.limit) : undefined,
  })
  const caller = appRouter.createCaller(await createContext(event))
  return caller.chat.getMessages(input)
})
