import { getQuery } from "h3"
import { listItemsSchema } from "../../../shared/schemas/item"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  const categoriesRaw =
    typeof query.categories === "string" ? query.categories.split(",").filter(Boolean) : undefined
  const conditionsRaw =
    typeof query.conditions === "string" ? query.conditions.split(",").filter(Boolean) : undefined
  const tagsRaw = typeof query.tags === "string" ? query.tags.split(",").filter(Boolean) : undefined

  const input = listItemsSchema.parse({
    search: typeof query.search === "string" ? query.search : undefined,
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
  return caller.item.countFiltered(input)
})
