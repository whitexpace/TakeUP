import { getQuery } from "h3"
import { appRouter } from "../trpc/routers"
import { createContext } from "../trpc/context"
import { listNotificationsSchema } from "#shared/schemas/notification"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const input = listNotificationsSchema.parse({
    limit: typeof query.limit === "string" ? Number(query.limit) : undefined,
  })
  const caller = appRouter.createCaller(await createContext(event))
  return caller.notification.list(input)
})
