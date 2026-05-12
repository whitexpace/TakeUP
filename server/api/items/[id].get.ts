import { createError, getQuery, getRouterParam } from "h3"
import { itemDetailSchema } from "#shared/schemas/item"
import { createContext } from "../../trpc/context"
import { appRouter } from "../../trpc/routers"

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, "id")
  const query = getQuery(event)
  const parsed = itemDetailSchema.safeParse({
    id: rawId,
    reviewsLimit: typeof query.reviewsLimit === "string" ? Number(query.reviewsLimit) : undefined,
  })

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
