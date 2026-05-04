import type { H3Event } from "h3"
import { createError, getQuery } from "h3"
import { paginatedItemsSchema } from "../../shared/schemas/item"
import {
  hasViewerCredentials,
  setPrivateNoStoreApiHeaders,
  setPublicSWRApiHeaders,
} from "../utils/request-security"
import { appRouter } from "../trpc/routers"
import { createContext } from "../trpc/context"
import { parseItemFilterQuery } from "./items/parse-item-filter-query"

async function fetchPaginatedItems(event: H3Event) {
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

  const input = paginatedItemsSchema.parse({
    ...parseItemFilterQuery(query),
    limit: typeof query.limit === "string" ? Number(query.limit) : undefined,
    cursor: parsedCursor,
  })

  const caller = appRouter.createCaller(await createContext(event))
  return caller.item.paginatedList(input)
}

const anonymousCachedItemsHandler = defineCachedEventHandler(
  async (event) => {
    setPublicSWRApiHeaders(event, 30, 300)
    return fetchPaginatedItems(event)
  },
  {
    maxAge: 30,
    swr: true,
  },
)

export default defineEventHandler(async (event) => {
  if (hasViewerCredentials(event)) {
    setPrivateNoStoreApiHeaders(event)
    return fetchPaginatedItems(event)
  }

  return anonymousCachedItemsHandler(event)
})
