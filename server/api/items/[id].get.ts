import { createError, getRouterParam } from "h3"
import { itemIdSchema } from "../../../shared/schemas/item"
import { createContext } from "../../trpc/context"
import { appRouter } from "../../trpc/routers"

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, "id")
  const parsed = itemIdSchema.safeParse({ id: rawId })

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid item id.",
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  const item = await caller.item.byId(parsed.data)

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: "Item not found.",
    })
  }

  return item
})
