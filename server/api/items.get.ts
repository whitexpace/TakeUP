import { createError, getQuery } from "h3"
import { paginatedItemsSchema } from "../../shared/schemas/item"
import { appRouter } from "../trpc/routers"
import { createContext } from "../trpc/context"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  const cursorRaw = typeof query.cursor === "string" ? query.cursor : undefined
  let parsedCursor: unknown
  if (cursorRaw) {
    try {
      parsedCursor = JSON.parse(cursorRaw)
    } catch {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid cursor format.",
      })
    }
  }

  const categoriesRaw =
    typeof query.categories === "string" ? query.categories.split(",").filter(Boolean) : undefined
  const conditionsRaw =
    typeof query.conditions === "string" ? query.conditions.split(",").filter(Boolean) : undefined
  const tagsRaw = typeof query.tags === "string" ? query.tags.split(",").filter(Boolean) : undefined

  const input = paginatedItemsSchema.parse({
    limit: typeof query.limit === "string" ? Number(query.limit) : undefined,
    search: typeof query.search === "string" ? query.search : undefined,
    cursor: parsedCursor,
    categories: categoriesRaw,
    conditions: conditionsRaw,
    tags: tagsRaw,
    minPrice: typeof query.minPrice === "string" ? Number(query.minPrice) : undefined,
    maxPrice: typeof query.maxPrice === "string" ? Number(query.maxPrice) : undefined,
    freeToBorrow:
      query.freeToBorrow === "true" ? true : query.freeToBorrow === "false" ? false : undefined,
    availableFrom: typeof query.availableFrom === "string" ? query.availableFrom : undefined,
    availableTo: typeof query.availableTo === "string" ? query.availableTo : undefined,
  })

  const caller = appRouter.createCaller(await createContext(event))
  return caller.item.paginatedList(input)
})
