import { setCookie, createError } from "h3"
import { prisma } from "../../utils/prisma"
import {
  createSessionToken,
  sessionCookieMaxAgeSeconds,
  sessionCookieName,
} from "../../utils/auth-session"
import { verifySupabaseJwt } from "../../utils/verify-supabase-jwt"

const userProfileSelect = {
  id: true,
  email: true,
  username: true,
  firstName: true,
  middleName: true,
  lastName: true,
  accountType: true,
  status: true,
  createdAt: true,
  location: true,
  avatarUrl: true,
  bio: true,
  pronouns: true,
  lender: { select: { userId: true } },
  borrower: { select: { userId: true } },
}

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const supabaseUrl = runtimeConfig.public.supabase?.url
  const supabaseAnonKey = runtimeConfig.public.supabase?.key
  const supabaseJwtSecret = runtimeConfig.supabaseJwtSecret

  if (!supabaseUrl || !supabaseAnonKey) {
    throw createError({ statusCode: 500, statusMessage: "Supabase not configured." })
  }

  const authHeader = event.headers.get("authorization") ?? ""
  if (!authHeader.startsWith("Bearer ")) {
    throw createError({ statusCode: 401, statusMessage: "Missing Supabase access token." })
  }

  const accessToken = authHeader.slice("Bearer ".length).trim()

  // --- Verify the Supabase access token ---
  let email: string
  let supabaseSub: string

  // Fast path: verify locally if SUPABASE_JWT_SECRET is configured (eliminates external HTTP call)
  const localPayload = supabaseJwtSecret ? verifySupabaseJwt(accessToken, supabaseJwtSecret) : null

  if (localPayload) {
    email = localPayload.email.toLowerCase()
    supabaseSub = localPayload.sub
  } else {
    // Slow path: verify via Supabase API (fallback or only option)
    let supabaseUser: Record<string, unknown>
    try {
      supabaseUser = await $fetch<Record<string, unknown>>(`${supabaseUrl}/auth/v1/user`, {
        headers: { authorization: `Bearer ${accessToken}`, apikey: supabaseAnonKey },
      })
    } catch {
      throw createError({ statusCode: 401, statusMessage: "Invalid Supabase token." })
    }

    email = (typeof supabaseUser.email === "string" ? supabaseUser.email : "").toLowerCase()
    supabaseSub = typeof supabaseUser.sub === "string" ? supabaseUser.sub : ""

    const identities = Array.isArray(supabaseUser.identities) ? supabaseUser.identities : []
    for (const entry of identities) {
      if (entry && typeof entry === "object") {
        const identity = entry as Record<string, unknown>
        if (identity.provider === "google") {
          supabaseSub =
            (identity.provider_id as string | undefined) ??
            (identity.id as string | undefined) ??
            supabaseSub
        }
      }
    }
  }

  if (!email.endsWith("@up.edu.ph")) {
    throw createError({ statusCode: 403, statusMessage: "Only @up.edu.ph accounts are allowed." })
  }

  let user = await prisma.user.findUnique({
    where: { email },
    select: userProfileSelect,
  })

  let isNewUser = false
  if (!user && supabaseSub) {
    const username = email.split("@")[0] ?? "user"
    user = await prisma.user.create({
      data: {
        email,
        username,
        firstName: username,
        lastName: "User",
        googleSub: supabaseSub,
        accountType: "LENDER",
        status: "ACTIVE",
        lender: { create: { lenderRating: 0 } },
        borrower: { create: { borrowStatus: "ACTIVE", borrowerRating: 0 } },
      },
      select: userProfileSelect,
    })
    isNewUser = true
  }

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "User not found." })
  }

  if (user.status === "DEACTIVATED") {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE" },
      select: userProfileSelect,
    })
  }

  if (user.status !== "ACTIVE") {
    throw createError({ statusCode: 403, statusMessage: "Your account is not active." })
  }

  // Repair legacy users only when a role profile is actually missing.
  if (!isNewUser) {
    const missingRoleProfileWrites = []

    if (!user.lender) {
      missingRoleProfileWrites.push(
        prisma.lender.upsert({
          where: { userId: user.id },
          create: { userId: user.id, lenderRating: 0 },
          update: {},
        }),
      )
    }

    if (!user.borrower) {
      missingRoleProfileWrites.push(
        prisma.borrower.upsert({
          where: { userId: user.id },
          create: { userId: user.id, borrowStatus: "ACTIVE", borrowerRating: 0 },
          update: {},
        }),
      )
    }

    if (missingRoleProfileWrites.length > 0) {
      await Promise.all(missingRoleProfileWrites)
    }
  }

  const { token, expiresAt } = createSessionToken(
    { id: user.id, email: user.email, name: user.username, accountType: user.accountType },
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
    ok: true,
    expiresAt: expiresAt.toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: user.username,
      username: user.username,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      accountType: user.accountType,
      createdAt: user.createdAt,
      location: user.location,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      pronouns: user.pronouns,
    },
  }
})
