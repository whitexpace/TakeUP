import { createError, getRouterParam } from "h3"
import { disputeIdSchema } from "#shared/schemas/dispute"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"
import { handleDisputeApiError } from "../disputes/handle-dispute-api-error"

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, "id")
  const parsed = disputeIdSchema.safeParse({ id: rawId })

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid dispute id.",
    })
  }

  const caller = appRouter.createCaller(await createContext(event))

  try {
    return await caller.dispute.byId(parsed.data)
  } catch (error) {
    handleDisputeApiError(error, "fetch")
  }
})
