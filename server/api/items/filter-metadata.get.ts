import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"

export default defineEventHandler(async (event) => {
  const caller = appRouter.createCaller(await createContext(event))
  return caller.item.filterMetadata()
})
