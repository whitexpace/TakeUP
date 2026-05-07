import { setHeader } from "h3"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"

export default defineEventHandler(async (event) => {
  const caller = appRouter.createCaller(await createContext(event))

  const counts = await caller.dispute.counts()
  setHeader(event, "Cache-Control", "private, max-age=25, stale-while-revalidate=60")
  return counts
})
