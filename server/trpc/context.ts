import type { H3Event } from "h3"
import { getHeader } from "h3"
import { prisma } from "../utils/prisma"
import type { SessionUser } from "../utils/auth-session"

export type Context = {
  event: H3Event
  prisma: typeof prisma
  user: SessionUser | null
}

const ALLOWED_EMAIL_DOMAIN = "@up.edu.ph"

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key]
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function extractGoogleSub(supabaseUser: Record<string, unknown>): string | null {
  const directCandidates = [
    readString(supabaseUser, "provider_id"),
    readString(supabaseUser, "sub"),
    readString(supabaseUser, "id"),
  ].filter((value): value is string => Boolean(value))

  if (directCandidates.length > 0) {
    return directCandidates[0] ?? null
  }

  const identities = supabaseUser.identities
  if (!Array.isArray(identities)) {
    return null
  }

  for (const entry of identities) {
    if (!entry || typeof entry !== "object") continue
    const identity = entry as Record<string, unknown>
    const provider = readString(identity, "provider")
    if (provider !== "google") continue

    const providerId = readString(identity, "provider_id") ?? readString(identity, "id")
    if (providerId) return providerId

    const identityData = identity.identity_data
    if (identityData && typeof identityData === "object") {
      const sub = readString(identityData as Record<string, unknown>, "sub")
      if (sub) return sub
    }
  }

  return null
}

async function readSupabaseUserFromBearer(event: H3Event): Promise<Record<string, unknown> | null> {
  const authorizationHeader = getHeader(event, "authorization")
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null
  }

  const accessToken = authorizationHeader.slice("Bearer ".length).trim()
  if (!accessToken) {
    return null
  }

  const runtimeConfig = useRuntimeConfig(event)
  const supabaseUrl = runtimeConfig.public.supabase?.url
  const supabaseAnonKey = runtimeConfig.public.supabase?.key
  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  try {
    const user = await $fetch<Record<string, unknown>>(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
    })
    return user
  } catch {
    return null
  }
}

export async function createContext(event: H3Event): Promise<Context> {
  let user = event.context.authUser ?? null

  // If no custom JWT session, try to get user from Supabase auth.
  if (!user) {
    try {
      const rawSupabaseUser =
        event.context.user && typeof event.context.user === "object"
          ? event.context.user
          : await readSupabaseUserFromBearer(event)
      if (rawSupabaseUser && typeof rawSupabaseUser === "object") {
        const supabaseUser = rawSupabaseUser as Record<string, unknown>
        const email = readString(supabaseUser, "email")?.toLowerCase() ?? ""

        if (email.endsWith(ALLOWED_EMAIL_DOMAIN)) {
          let dbUser = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              username: true,
              googleSub: true,
            },
          })

          const googleSub = extractGoogleSub(supabaseUser)
          if (!dbUser && googleSub) {
            const username = email.split("@")[0] ?? "user"
            dbUser = await prisma.user.create({
              data: {
                email,
                username,
                firstName: username,
                lastName: "User",
                googleSub,
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
          } else if (dbUser && googleSub && dbUser.googleSub !== googleSub) {
            dbUser = await prisma.user.update({
              where: { id: dbUser.id },
              data: { googleSub },
              select: {
                id: true,
                email: true,
                username: true,
                googleSub: true,
              },
            })
          }

          if (dbUser) {
            user = {
              id: dbUser.id,
              email: dbUser.email,
              name: dbUser.username,
            }
          }
        }
      }
    } catch {
      // Silently fail if user lookup/provisioning fails.
    }
  }

  return { event, prisma, user }
}
