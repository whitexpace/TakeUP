import { createError, readBody } from "h3"
import { createItemSchema } from "../../shared/schemas/item"
import { appRouter } from "../trpc/routers"
import { createContext } from "../trpc/context"
import { handleItemApiError } from "./items/handle-item-api-error"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const result = createItemSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid input.",
      data: result.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.item.create(result.data)
  } catch (err) {
    handleItemApiError(err, "create")
  }
})
