import { createError, getRouterParam, readBody } from "h3"
import { finalJudgmentSchema } from "../../../../shared/schemas/dispute"
import { appRouter } from "../../../trpc/routers"
import { createContext } from "../../../trpc/context"
import { handleDisputeApiError } from "../../disputes/handle-dispute-api-error"

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")
  const body = await readBody(event)

  const parsed = finalJudgmentSchema.safeParse({
    ...body,
    id,
  })

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid final judgment request.",
      data: parsed.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))

  try {
    return await caller.dispute.finalJudgment(parsed.data)
  } catch (error) {
    handleDisputeApiError(error, "record final judgment for")
  }
})
