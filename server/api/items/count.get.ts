import type { H3Event } from "h3"
import { getQuery } from "h3"
import { listItemsSchema } from "#shared/schemas/item"
import { hasViewerCredentials, setPrivateNoStoreApiHeaders, setPublicSWRApiHeaders } from "../../utils/request-security"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"
import { parseItemFilterQuery } from "./parse-item-filter-query"

async function fetchFilteredCount(event: H3Event) {
  const query = getQuery(event)

  const input = listItemsSchema.parse(parseItemFilterQuery(query))

  const caller = appRouter.createCaller(await createContext(event))
  return caller.item.countFiltered(input)
}

const anonymousCachedCountHandler = defineCachedEventHandler(
  async (event) => {
    setPublicSWRApiHeaders(event, 30, 300)
    return fetchFilteredCount(event)
  },
  {
    maxAge: 30,
    swr: true,
  },
)

export default defineEventHandler(async (event) => {
  if (hasViewerCredentials(event)) {
    setPrivateNoStoreApiHeaders(event)
    return fetchFilteredCount(event)
  }

  return anonymousCachedCountHandler(event)
})
