import { TRPCError } from "@trpc/server"
import { createError, getRouterParam, readBody } from "h3"
import { updateItemSchema } from "#shared/schemas/item"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")
  const body = await readBody(event)

  const result = updateItemSchema.safeParse({ ...body, id })
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid input.",
      data: result.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.item.update(result.data)
  } catch (err) {
    if (err instanceof TRPCError) {
      if (err.code === "UNAUTHORIZED")
        throw createError({ statusCode: 401, statusMessage: "Unauthorized." })
      if (err.code === "FORBIDDEN")
        throw createError({ statusCode: 403, statusMessage: "Forbidden." })
      if (err.code === "NOT_FOUND")
        throw createError({ statusCode: 404, statusMessage: "Item not found." })
    }
    throw err
  }
})
