import { Prisma } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { createError } from "h3"

const createRequestOfferApiError = (statusCode: number, statusMessage: string) =>
  createError({
    statusCode,
    statusMessage,
    data: {
      error: {
        message: statusMessage,
      },
    },
  })

export const handleRequestOfferApiError = (error: unknown, action: string): never => {
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
      throw createRequestOfferApiError(401, "You must be signed in to manage request offers.")
    }
    if (error.code === "FORBIDDEN") {
      throw createRequestOfferApiError(
        403,
        error.message || "You are not allowed to manage this request offer.",
      )
    }
    if (error.code === "NOT_FOUND") {
      throw createRequestOfferApiError(404, error.message || "Request offer not found.")
    }
    if (error.code === "BAD_REQUEST") {
      throw createRequestOfferApiError(400, error.message || "Invalid request offer payload.")
    }
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P1001":
        throw createRequestOfferApiError(
          503,
          "Database unavailable while processing the request offer. Check database access and try again.",
        )
      case "P2002":
        throw createRequestOfferApiError(
          409,
          "Request offer failed because a conflicting record already exists.",
        )
      case "P2003":
        throw createRequestOfferApiError(
          500,
          "Request offer failed because a required lender, request, or item record is missing in the database.",
        )
      case "P2021": {
        const table = typeof error.meta?.table === "string" ? error.meta.table : "required table"
        throw createRequestOfferApiError(
          500,
          `Request offer failed because the database table "${table}" is missing. Apply the latest Prisma schema changes first.`,
        )
      }
      case "P2022": {
        const column =
          typeof error.meta?.column === "string" ? error.meta.column : "a required column"
        throw createRequestOfferApiError(
          500,
          `Request offer failed because the database schema is out of date. Missing column: ${column}. Apply the latest Prisma schema changes first.`,
        )
      }
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    throw createRequestOfferApiError(
      500,
      "Request offer failed because the server query does not match the current Prisma schema. Regenerate Prisma Client and restart the server.",
    )
  }

  if (error instanceof Error) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[request offer api] failed to ${action} request offer`, error)
    }

    throw createRequestOfferApiError(
      500,
      `Unable to ${action} request offer because of an unexpected server error.`,
    )
  }

  throw createRequestOfferApiError(
    500,
    `Unable to ${action} request offer because of an unexpected server error.`,
  )
}
