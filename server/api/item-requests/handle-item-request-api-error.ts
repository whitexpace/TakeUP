import { Prisma } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { createError } from "h3"

const createItemRequestApiError = (statusCode: number, statusMessage: string) =>
  createError({
    statusCode,
    statusMessage,
    data: {
      error: {
        message: statusMessage,
      },
    },
  })

export const handleItemRequestApiError = (error: unknown, action: string): never => {
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
      throw createItemRequestApiError(401, "You must be signed in to manage item requests.")
    }
    if (error.code === "FORBIDDEN") {
      throw createItemRequestApiError(
        403,
        error.message || "You are not allowed to manage this item request.",
      )
    }
    if (error.code === "NOT_FOUND") {
      throw createItemRequestApiError(404, error.message || "Item request not found.")
    }
    if (error.code === "BAD_REQUEST") {
      throw createItemRequestApiError(400, error.message || "Invalid item request payload.")
    }
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P1001":
        throw createItemRequestApiError(
          503,
          "Database unavailable while processing the item request. Check database access and try again.",
        )
      case "P2002":
        throw createItemRequestApiError(
          409,
          "Item request failed because a conflicting record already exists.",
        )
      case "P2003":
        throw createItemRequestApiError(
          500,
          "Item request failed because a required borrower record is missing in the database.",
        )
      case "P2021": {
        const table = typeof error.meta?.table === "string" ? error.meta.table : "required table"
        throw createItemRequestApiError(
          500,
          `Item request failed because the database table "${table}" is missing. Apply the latest Prisma schema changes first.`,
        )
      }
      case "P2022": {
        const column =
          typeof error.meta?.column === "string" ? error.meta.column : "a required column"
        throw createItemRequestApiError(
          500,
          `Item request failed because the database schema is out of date. Missing column: ${column}. Apply the latest Prisma schema changes first.`,
        )
      }
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    throw createItemRequestApiError(
      500,
      "Item request failed because the server query does not match the current Prisma schema. Regenerate Prisma Client and restart the server.",
    )
  }

  if (error instanceof Error) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[item request api] failed to ${action} item request`, error)
    }

    throw createItemRequestApiError(
      500,
      `Unable to ${action} item request because of an unexpected server error.`,
    )
  }

  throw createItemRequestApiError(
    500,
    `Unable to ${action} item request because of an unexpected server error.`,
  )
}
