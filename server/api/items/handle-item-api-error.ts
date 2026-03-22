import { Prisma } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { createError } from "h3"

const createItemApiError = (statusCode: number, statusMessage: string) =>
  createError({
    statusCode,
    statusMessage,
    data: {
      error: {
        message: statusMessage,
      },
    },
  })

const toPrismaErrorMessage = (error: Prisma.PrismaClientKnownRequestError) => {
  switch (error.code) {
    case "P1001":
      return createItemApiError(
        503,
        "Database unavailable while publishing the listing. Check database access and try again.",
      )
    case "P2002":
      return createItemApiError(
        409,
        "Listing creation failed because a conflicting record already exists.",
      )
    case "P2003":
      return createItemApiError(
        500,
        "Listing creation failed because the signed-in user or lender profile is missing in the database.",
      )
    case "P2021": {
      const table = typeof error.meta?.table === "string" ? error.meta.table : "required table"
      return createItemApiError(
        500,
        `Listing creation failed because the database table "${table}" is missing. Apply the latest Prisma schema changes to this database first.`,
      )
    }
    case "P2022": {
      const column =
        typeof error.meta?.column === "string" ? error.meta.column : "a required column"
      return createItemApiError(
        500,
        `Listing creation failed because the database schema is out of date. Missing column: ${column}. Apply the latest Prisma schema changes to this database first.`,
      )
    }
    default:
      return createItemApiError(
        500,
        `Listing creation failed because Prisma returned ${error.code}. Check that your database schema matches the current code.`,
      )
  }
}

const toValidationError = (error: Prisma.PrismaClientValidationError) => {
  if (error.message.includes("images")) {
    return createItemApiError(
      500,
      "Listing creation failed because the server query expects the ItemImage relation, but the Prisma client or database schema is stale.",
    )
  }

  return createItemApiError(
    500,
    "Listing creation failed because the server query does not match the current Prisma schema. Restart the server and regenerate Prisma Client.",
  )
}

const toUnknownError = (error: Error, action: string) => {
  if (/relation .*ItemImage.* does not exist/i.test(error.message)) {
    return createItemApiError(
      500,
      "Listing creation failed because the ItemImage table is missing. Apply the latest Prisma schema changes to this database first.",
    )
  }

  if (/relation .*ItemAvailability.* does not exist/i.test(error.message)) {
    return createItemApiError(
      500,
      "Listing creation failed because the ItemAvailability table is missing. Apply the latest Prisma schema changes to this database first.",
    )
  }

  if (
    /relation .*ItemTagOnItem.* does not exist|relation .*Tag.* does not exist/i.test(error.message)
  ) {
    return createItemApiError(
      500,
      "Listing creation failed because the item taxonomy tables are missing. Apply the latest Prisma schema changes to this database first.",
    )
  }

  if (
    /column .*thumbnailImage.* does not exist|column .*photos.* does not exist/i.test(error.message)
  ) {
    return createItemApiError(
      500,
      "Listing creation failed because the database no longer has the legacy item image columns expected by the server.",
    )
  }

  return createItemApiError(
    500,
    `Unable to ${action} listing because of an unexpected server error.`,
  )
}

export const handleItemApiError = (error: unknown, action: string): never => {
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
      throw createItemApiError(401, "You must be signed in to manage listings.")
    }
    if (error.code === "FORBIDDEN") {
      throw createItemApiError(403, error.message || "You are not allowed to manage this listing.")
    }
    if (error.code === "NOT_FOUND") {
      throw createItemApiError(404, error.message || "Listing not found.")
    }
    if (error.code === "BAD_REQUEST") {
      throw createItemApiError(400, error.message || "Invalid listing request.")
    }
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    throw toPrismaErrorMessage(error)
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    throw toValidationError(error)
  }

  if (error instanceof Error) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[item api] failed to ${action} listing`, error)
    }

    throw toUnknownError(error, action)
  }

  throw createItemApiError(
    500,
    `Unable to ${action} listing because of an unexpected server error.`,
  )
}
