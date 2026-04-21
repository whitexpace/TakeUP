import { createError, getRouterParam } from "h3"
import { closeDisputeSchema } from "../../../../shared/schemas/dispute"
import { appRouter } from "../../../trpc/routers"
import { createContext } from "../../../trpc/context"
import { handleDisputeApiError } from "../../disputes/handle-dispute-api-error"

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")

  const parsed = closeDisputeSchema.safeParse({
    id,
  })

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid close dispute request.",
      data: parsed.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))

  try {
    return await caller.dispute.close(parsed.data)
  } catch (error) {
    handleDisputeApiError(error, "close")
  }
})
