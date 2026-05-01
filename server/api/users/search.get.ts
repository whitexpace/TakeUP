import { getQuery } from "h3"
import { createContext } from "../../trpc/context"
import { appRouter } from "../../trpc/routers"

export default defineEventHandler(async (event) => {
  const query = getQuery(event).q as string

  if (!query) return []

  const caller = appRouter.createCaller(await createContext(event))
  return await caller.user.search({ query })
})
