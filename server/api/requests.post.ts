import { createError, readBody } from "h3"
import { createRequestSchema } from "../../shared/schemas/request"
import { createContext } from "../trpc/context"
import { appRouter } from "../trpc/routers"
import { handleRequestApiError } from "./requests/handle-request-api-error"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const result = createRequestSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid input.",
      data: result.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.request.create(result.data)
  } catch (error) {
    handleRequestApiError(error)
  }
})
