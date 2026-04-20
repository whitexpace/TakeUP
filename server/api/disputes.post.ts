import { createError, readBody } from "h3"
import { submitDisputeSchema } from "../../shared/schemas/dispute"
import { appRouter } from "../trpc/routers"
import { createContext } from "../trpc/context"
import { handleDisputeApiError } from "./disputes/handle-dispute-api-error"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = submitDisputeSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid dispute submission.",
      data: parsed.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))

  try {
    return await caller.dispute.submit(parsed.data)
  } catch (error) {
    handleDisputeApiError(error, "submit")
  }
})
