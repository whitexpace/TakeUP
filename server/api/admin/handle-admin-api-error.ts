import { TRPCError } from "@trpc/server"
import { createError } from "h3"

export const handleAdminApiError = (error: unknown) => {
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

    if (error.code === "BAD_REQUEST") {
      throw createError({ statusCode: 400, statusMessage: error.message || "Bad request." })
    }
  }

  throw error
}
