import { TRPCError } from "@trpc/server"
import { createError, readBody } from "h3"
import { redeemBoostSchema } from "#shared/schemas/rewards"
import { createContext } from "../../trpc/context"
import { appRouter } from "../../trpc/routers"

const handleBoostError = (error: unknown): never => {
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

    if (error.code === "CONFLICT") {
      throw createError({ statusCode: 409, statusMessage: error.message || "Conflict." })
    }

    if (error.code === "BAD_REQUEST") {
      throw createError({ statusCode: 400, statusMessage: error.message || "Bad request." })
    }
  }

  throw error
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = redeemBoostSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid boost redemption request.",
      data: parsed.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))

  try {
    return await caller.rewards.redeemBoost(parsed.data)
  } catch (error) {
    handleBoostError(error)
  }
})
