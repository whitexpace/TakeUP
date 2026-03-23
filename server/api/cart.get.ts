import { TRPCError } from "@trpc/server"
import { createError } from "h3"
import { appRouter } from "../trpc/routers"
import { createContext } from "../trpc/context"

const handleCartError = (error: unknown): never => {
  if (error instanceof TRPCError) {
    if (error.code === "UNAUTHORIZED") {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized." })
    }

    if (error.code === "FORBIDDEN") {
      throw createError({ statusCode: 403, statusMessage: error.message || "Forbidden." })
    }
  }

  throw error
}

export default defineEventHandler(async (event) => {
  const caller = appRouter.createCaller(await createContext(event))

  try {
    return await caller.cart.list()
  } catch (error) {
    handleCartError(error)
  }
})
