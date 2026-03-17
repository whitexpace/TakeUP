import { TRPCError } from "@trpc/server"
import { createError, getRouterParam, readBody } from "h3"
import { z } from "zod"
import { updateItemSchema } from "../../../../shared/schemas/item"
import { appRouter } from "../../../trpc/routers"
import { createContext } from "../../../trpc/context"

const statusBodySchema = z.object({
  status: z.enum(["AVAILABLE", "DEACTIVATED"]),
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")
  const body = await readBody(event)

  const statusResult = statusBodySchema.safeParse(body)
  if (!statusResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "status must be AVAILABLE or DEACTIVATED.",
    })
  }

  const result = updateItemSchema.safeParse({ id, status: statusResult.data.status })
  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid item id." })
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
