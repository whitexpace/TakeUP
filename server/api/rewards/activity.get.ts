import { createContext } from "../../trpc/context"
import { appRouter } from "../../trpc/routers"

export default defineEventHandler(async (event) => {
  const caller = appRouter.createCaller(await createContext(event))
  return caller.rewards.activity()
})
