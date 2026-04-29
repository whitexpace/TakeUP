import { setCookie, createError } from "h3"
import { prisma } from "../../utils/prisma"
import {
  createSessionToken,
  sessionCookieMaxAgeSeconds,
  sessionCookieName,
} from "../../utils/auth-session"

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const supabaseUrl = runtimeConfig.public.supabase?.url
  const supabaseAnonKey = runtimeConfig.public.supabase?.key

  if (!supabaseUrl || !supabaseAnonKey) {
    throw createError({ statusCode: 500, statusMessage: "Supabase not configured." })
  }

  const authHeader = event.headers.get("authorization") ?? ""
  if (!authHeader.startsWith("Bearer ")) {
    throw createError({ statusCode: 401, statusMessage: "Missing Supabase access token." })
  }

  const accessToken = authHeader.slice("Bearer ".length).trim()

  let supabaseUser: Record<string, unknown>
  try {
    supabaseUser = await $fetch<Record<string, unknown>>(`${supabaseUrl}/auth/v1/user`, {
      headers: { authorization: `Bearer ${accessToken}`, apikey: supabaseAnonKey },
    })
  } catch {
    throw createError({ statusCode: 401, statusMessage: "Invalid Supabase token." })
  }

  const email = (typeof supabaseUser.email === "string" ? supabaseUser.email : "").toLowerCase()
  if (!email.endsWith("@up.edu.ph")) {
    throw createError({ statusCode: 403, statusMessage: "Only @up.edu.ph accounts are allowed." })
  }

  const identities = Array.isArray(supabaseUser.identities) ? supabaseUser.identities : []
  let googleSub: string | null = null
  for (const entry of identities) {
    if (entry && typeof entry === "object") {
      const identity = entry as Record<string, unknown>
      if (identity.provider === "google") {
        googleSub =
          (identity.provider_id as string | undefined) ??
          (identity.id as string | undefined) ??
          null
      }
    }
  }
  if (!googleSub && typeof supabaseUser.sub === "string") googleSub = supabaseUser.sub

  let user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, username: true, status: true },
  })

  let isNewUser = false
  if (!user && googleSub) {
    const username = email.split("@")[0] ?? "user"
    user = await prisma.user.create({
      data: {
        email,
        username,
        firstName: username,
        lastName: "User",
        googleSub,
        accountType: "LENDER",
        status: "ACTIVE",
        lender: { create: { lenderRating: 0 } },
        borrower: { create: { borrowStatus: "ACTIVE", borrowerRating: 0 } },
      },
      select: { id: true, email: true, username: true, status: true },
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
      select: { id: true, email: true, username: true, status: true },
    })
  }

  if (user.status !== "ACTIVE") {
    throw createError({ statusCode: 403, statusMessage: "Your account is not active." })
  }

  // Ensure both Lender and Borrower profiles exist (in parallel) - skip for new users
  if (!isNewUser) {
    await Promise.all([
      prisma.lender.upsert({
        where: { userId: user.id },
        create: { userId: user.id, lenderRating: 0 },
        update: {},
      }),
      prisma.borrower.upsert({
        where: { userId: user.id },
        create: { userId: user.id, borrowStatus: "ACTIVE", borrowerRating: 0 },
        update: {},
      }),
    ])
  }

  const { token, expiresAt } = createSessionToken(
    { id: user.id, email: user.email, name: user.username },
    runtimeConfig.jwtSecret,
  )

  setCookie(event, sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionCookieMaxAgeSeconds,
  })

  return { ok: true, expiresAt: expiresAt.toISOString() }
})
