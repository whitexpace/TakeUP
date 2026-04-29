import { Prisma } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { createError } from "h3"

const createDisputeApiError = (statusCode: number, statusMessage: string) =>
  createError({
    statusCode,
    statusMessage,
    data: {
      error: {
        message: statusMessage,
      },
    },
  })

export const handleDisputeApiError = (error: unknown, action: string): never => {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as { statusCode?: unknown }).statusCode === "number"
  ) {
    throw error
  }

  if (error instanceof TRPCError) {
    if (error.code === "UNAUTHORIZED") {
      throw createDisputeApiError(401, "You must be signed in to manage disputes.")
    }
    if (error.code === "FORBIDDEN") {
      throw createDisputeApiError(403, error.message || "You are not allowed to manage disputes.")
    }
    if (error.code === "NOT_FOUND") {
      throw createDisputeApiError(404, error.message || "Dispute not found.")
    }
    if (error.code === "CONFLICT") {
      throw createDisputeApiError(
        409,
        error.message || "This dispute request conflicts with the current state.",
      )
    }
    if (error.code === "BAD_REQUEST") {
      throw createDisputeApiError(400, error.message || "Invalid dispute request.")
    }
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002" || error.code === "P2034") {
      throw createDisputeApiError(
        409,
        "A duplicate dispute request was detected for this transaction. Refresh and try again.",
      )
    }

    throw createDisputeApiError(
      500,
      `Unable to ${action} dispute because Prisma returned ${error.code}.`,
    )
  }

  if (error instanceof Error) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[dispute api] failed to ${action} dispute`, error)
    }

    throw createDisputeApiError(
      500,
      process.env.NODE_ENV !== "production" && error.message
        ? `Unable to ${action} dispute. Debug: ${error.message}`
        : `Unable to ${action} dispute because of an unexpected server error.`,
    )
  }

  throw createDisputeApiError(
    500,
    `Unable to ${action} dispute because of an unexpected server error.`,
  )
}
