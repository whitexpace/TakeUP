import { TRPCError } from "@trpc/server"
import { createError, getRouterParam } from "h3"
import { cartEntryIdSchema } from "../../../shared/schemas/cart"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"

const handleCartError = (error: unknown): never => {
  if (error instanceof TRPCError) {
    if (error.code === "UNAUTHORIZED") {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized." })
    }

    if (error.code === "FORBIDDEN") {
      throw createError({ statusCode: 403, statusMessage: error.message || "Forbidden." })
    }

    if (error.code === "NOT_FOUND") {
      throw createError({ statusCode: 404, statusMessage: error.message || "Not found." })
    }
  }

  throw error
}

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, "id")
  const parsed = cartEntryIdSchema.safeParse({ id: rawId })

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid bag item id.",
    })
  }

  const caller = appRouter.createCaller(await createContext(event))

  try {
    return await caller.cart.remove(parsed.data)
  } catch (error) {
    handleCartError(error)
  }
})
