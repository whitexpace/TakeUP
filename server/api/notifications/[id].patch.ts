import { createError, getRouterParam } from "h3"
import { notificationIdSchema } from "#shared/schemas/notification"
import { createContext } from "../../trpc/context"
import { appRouter } from "../../trpc/routers"

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, "id")
  const parsed = notificationIdSchema.safeParse({ id: rawId })

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid notification id.",
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  return caller.notification.markRead(parsed.data)
})
