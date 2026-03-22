import { Prisma } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { createError } from "h3"

const createBookingApiError = (statusCode: number, statusMessage: string) =>
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
      return createBookingApiError(
        503,
        "Database unavailable while processing the booking. Check database access and try again.",
      )
    case "P2002":
      return createBookingApiError(
        409,
        "Booking failed because a conflicting record already exists for this request.",
      )
    case "P2003":
      return createBookingApiError(
        500,
        "Booking failed because a required borrower, lender, or item record is missing in the database.",
      )
    case "P2021": {
      const table = typeof error.meta?.table === "string" ? error.meta.table : "required table"
      return createBookingApiError(
        500,
        `Booking failed because the database table "${table}" is missing. Apply the latest Prisma schema changes to this database first.`,
      )
    }
    case "P2022": {
      const column =
        typeof error.meta?.column === "string" ? error.meta.column : "a required column"
      return createBookingApiError(
        500,
        `Booking failed because the database schema is out of date. Missing column: ${column}. Apply the latest Prisma schema changes to this database first.`,
      )
    }
    default:
      return createBookingApiError(
        500,
        `Booking failed because Prisma returned ${error.code}. Check that your database schema matches the current code.`,
      )
  }
}

const toValidationError = (error: Prisma.PrismaClientValidationError) => {
  if (error.message.includes("thumbnailImage") || error.message.includes("photos")) {
    return createBookingApiError(
      500,
      "Booking failed because the server is still using legacy item image fields. Restart the server with the latest code and Prisma client.",
    )
  }

  return createBookingApiError(
    500,
    "Booking failed because the server query does not match the current Prisma schema. Restart the server and regenerate Prisma Client.",
  )
}

const toUnknownError = (error: Error, action: string) => {
  if (
    /column .*thumbnailImage.* does not exist|column .*photos.* does not exist/i.test(error.message)
  ) {
    return createBookingApiError(
      500,
      "Booking failed because the database no longer has the legacy item image columns expected by the server.",
    )
  }

  if (/relation .*Booking.* does not exist|relation .*transactions.* does not exist/i.test(error.message)) {
    return createBookingApiError(
      500,
      "Booking failed because the booking or transaction tables are missing. Apply the latest Prisma schema changes to this database first.",
    )
  }

  return createBookingApiError(
    500,
    `Unable to ${action} booking because of an unexpected server error.`,
  )
}

export const handleBookingApiError = (error: unknown, action: string): never => {
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
      throw createBookingApiError(401, "You must be signed in to manage bookings.")
    }
    if (error.code === "FORBIDDEN") {
      throw createBookingApiError(403, error.message || "You are not allowed to manage this booking.")
    }
    if (error.code === "NOT_FOUND") {
      throw createBookingApiError(404, error.message || "Booking not found.")
    }
    if (error.code === "BAD_REQUEST") {
      throw createBookingApiError(400, error.message || "Invalid booking request.")
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
      console.error(`[booking api] failed to ${action} booking`, error)
    }

    throw toUnknownError(error, action)
  }

  throw createBookingApiError(
    500,
    `Unable to ${action} booking because of an unexpected server error.`,
  )
}
