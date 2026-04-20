import { createError, getRouterParam, readBody } from "h3"
import { appealDisputeSchema } from "../../../../shared/schemas/dispute"
import { appRouter } from "../../../trpc/routers"
import { createContext } from "../../../trpc/context"
import { handleDisputeApiError } from "../../disputes/handle-dispute-api-error"

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")
  const body = await readBody(event)

  const parsed = appealDisputeSchema.safeParse({
    ...body,
    id,
  })

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid dispute appeal request.",
      data: parsed.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))

  try {
    return await caller.dispute.appeal(parsed.data)
  } catch (error) {
    handleDisputeApiError(error, "appeal")
  }
})
