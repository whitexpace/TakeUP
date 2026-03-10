import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"

export default defineCachedEventHandler(
  async (event) => {
    const caller = appRouter.createCaller(await createContext(event))
    return caller.item.filterMetadata()
  },
  {
    maxAge: 300,
    swr: true,
  },
)
