import { getCookie, setCookie, type H3Event } from "h3"
import { serverSupabaseUser } from "#supabase/server"
import { prisma } from "../utils/prisma"
import {
  createSessionToken,
  sessionCookieName,
  sessionCookieMaxAgeSeconds,
  verifySessionToken,
  type SessionUser,
} from "../utils/auth-session"
import { AuthApiError } from "../utils/auth-errors"

const getStringClaim = (claims: unknown, key: string) => {
  if (typeof claims !== "object" || claims === null) return null
  const value = (claims as Record<string, unknown>)[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

const hydrateAuthUserFromSupabase = async (event: H3Event) => {
  try {
    const claims = await serverSupabaseUser(event)
    const email = getStringClaim(claims, "email")?.toLowerCase()
    if (!email) return

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        accountType: true,
        status: true,
      },
    })

    if (!user || user.status !== "ACTIVE") return

    const authUser: SessionUser = {
      id: user.id,
      email: user.email,
      name: user.username,
      accountType: user.accountType,
    }
    const runtimeConfig = useRuntimeConfig(event)
    const { token } = createSessionToken(authUser, runtimeConfig.jwtSecret)

    setCookie(event, sessionCookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionCookieMaxAgeSeconds,
    })
    event.context.authUser = authUser
  } catch {
    return
  }
}

export default defineEventHandler(async (event) => {
  const token = getCookie(event, sessionCookieName)
  if (!token) {
    await hydrateAuthUserFromSupabase(event)
    return
  }

  try {
    const runtimeConfig = useRuntimeConfig(event)
    const session = verifySessionToken(token, runtimeConfig.jwtSecret)
    event.context.authUser = session.user
  } catch (error) {
    if (error instanceof AuthApiError) {
      await hydrateAuthUserFromSupabase(event)
      return
    }
    await hydrateAuthUserFromSupabase(event)
    return
  }
})

declare module "h3" {
  interface H3EventContext {
    authUser?: SessionUser
  }
}
