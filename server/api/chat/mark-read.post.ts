import { readBody } from "h3"
import { markAsReadSchema } from "../../../shared/schemas/chat"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const input = markAsReadSchema.parse(body)
  const caller = appRouter.createCaller(await createContext(event))
  return caller.chat.markAsRead(input)
})
