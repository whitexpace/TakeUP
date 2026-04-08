import type { H3Event } from "h3"
import { appRouter } from "../trpc/routers"
import { createContext } from "../trpc/context"
import { hasViewerCredentials, setPrivateNoStoreApiHeaders, setPublicSWRApiHeaders } from "../utils/request-security"

async function fetchRequests(event: H3Event) {
  const caller = appRouter.createCaller(await createContext(event))
  return caller.request.list()
}

const anonymousCachedRequestsHandler = defineCachedEventHandler(
  async (event) => {
    setPublicSWRApiHeaders(event, 30, 300)
    return fetchRequests(event)
  },
  {
    maxAge: 30,
    swr: true,
  },
)

export default defineEventHandler(async (event) => {
  if (hasViewerCredentials(event)) {
    setPrivateNoStoreApiHeaders(event)
    return fetchRequests(event)
  }

  return anonymousCachedRequestsHandler(event)
})
