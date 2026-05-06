import { createError, getQuery } from "h3"
import { listDisputesSchema } from "#shared/schemas/dispute"
import { appRouter } from "../trpc/routers"
import { createContext } from "../trpc/context"
import { handleDisputeApiError } from "./disputes/handle-dispute-api-error"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const parsed = listDisputesSchema.safeParse({
    status:
      typeof query.status === "string" && query.status !== "ALL" ? query.status : undefined,
  })

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid dispute filter.",
      data: parsed.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))

  try {
    return await caller.dispute.list(parsed.data)
  } catch (error) {
    handleDisputeApiError(error, "list")
  }
})
