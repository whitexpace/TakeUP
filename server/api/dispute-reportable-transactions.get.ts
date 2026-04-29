import { appRouter } from "../trpc/routers"
import { createContext } from "../trpc/context"
import { handleDisputeApiError } from "./disputes/handle-dispute-api-error"

export default defineEventHandler(async (event) => {
  const caller = appRouter.createCaller(await createContext(event))

  try {
    return await caller.dispute.reportableTransactions()
  } catch (error) {
    handleDisputeApiError(error, "list")
  }
})
