import { createError, readBody } from "h3"
import { appRouter } from "../trpc/routers"
import { createContext } from "../trpc/context"
import { createItemRequestSchema } from "#shared/schemas/item-request"
import { handleItemRequestApiError } from "./item-requests/handle-item-request-api-error"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = createItemRequestSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid input.",
      data: result.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.community.createRequest(result.data)
  } catch (error) {
    handleItemRequestApiError(error, "create")
  }
})
