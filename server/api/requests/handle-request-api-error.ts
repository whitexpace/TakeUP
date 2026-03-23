import { Prisma } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { createError } from "h3"

const createRequestApiError = (statusCode: number, statusMessage: string) =>
  createError({
    statusCode,
    statusMessage,
    data: {
      error: {
        message: statusMessage,
      },
    },
  })

export const handleRequestApiError = (error: unknown): never => {
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
      throw createRequestApiError(401, "You must be signed in to post a request.")
    }
    if (error.code === "FORBIDDEN") {
      throw createRequestApiError(403, error.message || "Only borrower accounts can post requests.")
    }
    if (error.code === "BAD_REQUEST") {
      throw createRequestApiError(400, error.message || "Invalid request payload.")
    }
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P1001") {
      throw createRequestApiError(
        503,
        "Database unavailable while posting the request. Check database access and try again.",
      )
    }

    throw createRequestApiError(
      500,
      `Request submission failed because Prisma returned ${error.code}.`,
    )
  }

  if (error instanceof Error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[request api] failed to create request", error)
    }

    throw createRequestApiError(
      500,
      "Unable to post request because of an unexpected server error.",
    )
  }

  throw createRequestApiError(500, "Unable to post request because of an unexpected server error.")
}
