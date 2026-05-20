import { setCookie, createError } from "h3"
import { prisma } from "../../utils/prisma"
import {
  createSessionToken,
  sessionCookieMaxAgeSeconds,
  sessionCookieName,
} from "../../utils/auth-session"
import { verifySupabaseJwt } from "../../utils/verify-supabase-jwt"
import {
  buildAuthNameSyncData,
  extractSupabaseProviderName,
  fallbackAuthName,
  type ParsedAuthName,
} from "../../utils/auth-user-name"

const userProfileSelect = {
  id: true,
  email: true,
  username: true,
  firstName: true,
  middleName: true,
  lastName: true,
  accountType: true,
  status: true,
  suspendedUntil: true,
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
  let providerName: ParsedAuthName | null = null

  const fetchSupabaseUser = async () => {
    try {
      return await $fetch<Record<string, unknown>>(`${supabaseUrl}/auth/v1/user`, {
        headers: { authorization: `Bearer ${accessToken}`, apikey: supabaseAnonKey },
      })
    } catch {
      throw createError({ statusCode: 401, statusMessage: "Invalid Supabase token." })
    }
  }

  const getGoogleProviderSub = (supabaseUser: Record<string, unknown>, fallback: string) => {
    const identities = Array.isArray(supabaseUser.identities) ? supabaseUser.identities : []
    for (const entry of identities) {
      if (entry && typeof entry === "object") {
        const identity = entry as Record<string, unknown>
        if (identity.provider === "google") {
          return (
            (identity.provider_id as string | undefined) ??
            (identity.id as string | undefined) ??
            fallback
          )
        }
      }
    }

    return fallback
  }

  // Fast path: verify locally if SUPABASE_JWT_SECRET is configured (eliminates external HTTP call)
  const localPayload = supabaseJwtSecret ? verifySupabaseJwt(accessToken, supabaseJwtSecret) : null

  if (localPayload) {
    email = localPayload.email.toLowerCase()
    supabaseSub = localPayload.sub
    providerName = extractSupabaseProviderName(localPayload)

    if (!providerName) {
      const supabaseUser = await fetchSupabaseUser()
      providerName = extractSupabaseProviderName(supabaseUser)
      supabaseSub = getGoogleProviderSub(supabaseUser, supabaseSub)
    }
  } else {
    // Slow path: verify via Supabase API (fallback or only option)
    const supabaseUser = await fetchSupabaseUser()

    email = (typeof supabaseUser.email === "string" ? supabaseUser.email : "").toLowerCase()
    supabaseSub = typeof supabaseUser.sub === "string" ? supabaseUser.sub : ""
    providerName = extractSupabaseProviderName(supabaseUser)
    supabaseSub = getGoogleProviderSub(supabaseUser, supabaseSub)
  }

  if (!email.endsWith("@up.edu.ph") && !email.endsWith("@gmail.com")) {
    throw createError({
      statusCode: 403,
      statusMessage: "Only @up.edu.ph and @gmail.com accounts are allowed.",
    })
  }

  let user = await prisma.user.findUnique({
    where: { email },
    select: userProfileSelect,
  })

  let isNewUser = false
  if (!user && supabaseSub) {
    const username = email.split("@")[0] ?? "user"
    const nameParts = providerName ?? fallbackAuthName
    user = await prisma.user.create({
      data: {
        email,
        username,
        firstName: nameParts.firstName,
        middleName: nameParts.middleName,
        lastName: nameParts.lastName,
        googleSub: supabaseSub,
        accountType: "USER",
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

  const nameSyncData = buildAuthNameSyncData(providerName, user, email)
  if (nameSyncData) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: nameSyncData,
      select: userProfileSelect,
    })
  }

  // Auto-lift expired suspensions
  if (
    user.status === "SUSPENDED" &&
    user.suspendedUntil &&
    new Date(user.suspendedUntil) <= new Date()
  ) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE", suspendedUntil: null },
      select: userProfileSelect,
    })
  }

  if (user.status !== "ACTIVE") {
    const message =
      user.status === "SUSPENDED" && user.suspendedUntil
        ? `Your account is suspended until ${new Date(user.suspendedUntil).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`
        : user.status === "BANNED"
          ? "Your account has been banned."
          : "Your account is not active."
    throw createError({ statusCode: 403, statusMessage: message })
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
