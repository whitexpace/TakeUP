import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"
import { setPublicSWRApiHeaders } from "../../utils/request-security"

export default defineCachedEventHandler(
  async (event) => {
    setPublicSWRApiHeaders(event, 300, 600)
    const caller = appRouter.createCaller(await createContext(event))
    return caller.item.filterMetadata()
  },
  {
    maxAge: 30,
    swr: true,
  },
)
