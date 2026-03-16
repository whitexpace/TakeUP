import { setCookie, readBody, createError } from "h3"
import type { PrismaClient } from "@prisma/client"
import { ZodError } from "zod"
import { googleAuthRequestSchema } from "../../../shared/schemas/auth"
import { prisma } from "../../utils/prisma"
import {
  createSessionToken,
  sessionCookieMaxAgeSeconds,
  sessionCookieName,
} from "../../utils/auth-session"
import { AuthApiError } from "../../utils/auth-errors"
import { verifyGoogleIdToken } from "../../utils/google-auth"

type IdentityInput = {
  googleSub: string
  email: string
  name: string
}

type AuthUserRow = {
  id: string
  email: string
  name: string
}

async function upsertAuthUser(db: PrismaClient, identity: IdentityInput): Promise<AuthUserRow> {
  // Try to find existing user by googleSub
  let user = await db.user.findUnique({
    where: { googleSub: identity.googleSub },
    select: {
      id: true,
      email: true,
      username: true,
      googleSub: true,
    },
  })

  if (!user) {
    // Fallback lookup by email to avoid duplicate records when the provider subject changes.
    user = await db.user.findUnique({
      where: { email: identity.email },
      select: {
        id: true,
        email: true,
        username: true,
        googleSub: true,
      },
    })

    if (user && user.googleSub !== identity.googleSub) {
      user = await db.user.update({
        where: { id: user.id },
        data: { googleSub: identity.googleSub },
        select: {
          id: true,
          email: true,
          username: true,
          googleSub: true,
        },
      })
    }

    if (!user) {
      const emailPrefix = identity.email?.split("@")[0] ?? "user"
      user = await db.user.create({
        data: {
          googleSub: identity.googleSub,
          email: identity.email,
          username: emailPrefix,
          firstName: emailPrefix,
          lastName: "User",
          accountType: "BORROWER",
          status: "ACTIVE",
        },
        select: {
          id: true,
          email: true,
          username: true,
          googleSub: true,
        },
      })
    }
  } else if (user.email !== identity.email) {
    // Update email if it changed
    user = await db.user.update({
      where: { googleSub: identity.googleSub },
      data: { email: identity.email },
      select: {
        id: true,
        email: true,
        username: true,
        googleSub: true,
      },
    })
  }

  return {
    id: user.id,
    email: user.email,
    name: user.username,
  }
}

export default defineEventHandler(async (event) => {
  try {
    const rawBody = await readBody(event)
    const input = googleAuthRequestSchema.parse(rawBody)

    const runtimeConfig = useRuntimeConfig(event)
    const identity = await verifyGoogleIdToken(input.idToken, runtimeConfig.googleClientId)

    const user = await upsertAuthUser(prisma, identity)

    const { token, expiresAt } = createSessionToken(
      { id: user.id, email: user.email, name: user.name },
      runtimeConfig.jwtSecret,
    )

    setCookie(event, sessionCookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionCookieMaxAgeSeconds,
    })

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      session: {
        expiresAt: expiresAt.toISOString(),
        strategy: "httpOnlyCookie" as const,
      },
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[auth/google] sign-in failed", error)
    }

    const prismaErrorCode =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : ""
    const prismaErrorMessage =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message)
        : ""

    if (prismaErrorCode === "P1001" || prismaErrorMessage.includes("Can't reach database server")) {
      throw createError({
        statusCode: 503,
        statusMessage: "Database unavailable. Check DATABASE_URL and database network access.",
        data: {
          error: {
            code: "AUTH_INTERNAL",
            message: "Database unavailable. Check DATABASE_URL and database network access.",
          },
        },
      })
    }

    if (error instanceof AuthApiError) {
      throw createError({
        statusCode: error.statusCode,
        statusMessage: error.message,
        data: {
          error: {
            code: error.code,
            message: error.message,
          },
        },
      })
    }

    if (error instanceof ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid authentication request payload.",
        data: {
          error: {
            code: "AUTH_INVALID_TOKEN",
            message: "Invalid authentication request payload.",
          },
        },
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Authentication failed due to an internal error.",
      data: {
        error: {
          code: "AUTH_INTERNAL",
          message: "Authentication failed due to an internal error.",
        },
      },
    })
  }
})
