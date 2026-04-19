import { Prisma } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { createError } from "h3"

const createChatApiError = (statusCode: number, statusMessage: string) =>
  createError({
    statusCode,
    statusMessage,
    data: {
      error: {
        message: statusMessage,
      },
    },
  })

export const handleChatApiError = (error: unknown, action: string): never => {
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
      throw createChatApiError(401, "You must be signed in to access chat.")
    }

    if (error.code === "FORBIDDEN") {
      throw createChatApiError(403, error.message || "You are not allowed to access this chat.")
    }

    if (error.code === "NOT_FOUND") {
      throw createChatApiError(404, error.message || "Chat conversation not found.")
    }

    if (error.code === "BAD_REQUEST") {
      throw createChatApiError(400, error.message || "Invalid chat request.")
    }
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021" || error.code === "P2022") {
      throw createChatApiError(
        500,
        "Chat is unavailable because the database schema is missing the latest chat tables. Apply the newest Prisma migration first.",
      )
    }

    throw createChatApiError(
      500,
      `Chat failed because Prisma returned ${error.code}. Check that the database schema matches the current code.`,
    )
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    throw createChatApiError(
      500,
      "Chat failed because the server query does not match the current Prisma schema. Regenerate Prisma Client and restart the server.",
    )
  }

  if (error instanceof Error) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[chat api] failed to ${action}`, error)
    }

    throw createChatApiError(500, `Unable to ${action} because of an unexpected server error.`)
  }

  throw createChatApiError(500, `Unable to ${action} because of an unexpected server error.`)
}
