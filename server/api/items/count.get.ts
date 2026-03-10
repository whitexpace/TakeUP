import { getQuery } from "h3"
import { listItemsSchema } from "../../../shared/schemas/item"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"
import { parseItemFilterQuery } from "./parse-item-filter-query"

export default defineCachedEventHandler(
  async (event) => {
    const query = getQuery(event)

    const input = listItemsSchema.parse(parseItemFilterQuery(query))

    const caller = appRouter.createCaller(await createContext(event))
    return caller.item.countFiltered(input)
  },
  {
    maxAge: 30,
    swr: true,
  },
)
