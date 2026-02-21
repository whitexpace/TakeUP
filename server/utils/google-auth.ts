import { AuthApiError } from "./auth-errors"

const ALLOWED_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"])
const ALLOWED_EMAIL_DOMAIN = "up.edu.ph"

type GoogleTokenInfo = {
  iss?: string
  aud?: string
  exp?: string
  sub?: string
  email?: string
  email_verified?: string
  name?: string
}

export type VerifiedGoogleIdentity = {
  googleSub: string
  email: string
  name: string
}

function assertGoogleClientId(value: string | undefined): string {
  if (!value || !value.trim()) {
    throw new AuthApiError("AUTH_PROVIDER_MISCONFIG", "GOOGLE_CLIENT_ID is not configured.")
  }
  return value
}

export async function verifyGoogleIdToken(
  idToken: string,
  googleClientId: string | undefined,
): Promise<VerifiedGoogleIdentity> {
  const expectedAudience = assertGoogleClientId(googleClientId)

  let tokenInfo: GoogleTokenInfo
  try {
    tokenInfo = await $fetch<GoogleTokenInfo>("https://oauth2.googleapis.com/tokeninfo", {
      query: { id_token: idToken },
    })
  } catch {
    throw new AuthApiError("AUTH_INVALID_TOKEN")
  }

  if (!tokenInfo.iss || !ALLOWED_ISSUERS.has(tokenInfo.iss)) {
    throw new AuthApiError("AUTH_INVALID_TOKEN")
  }

  if (!tokenInfo.aud || tokenInfo.aud !== expectedAudience) {
    throw new AuthApiError("AUTH_INVALID_TOKEN")
  }

  const expSeconds = Number(tokenInfo.exp)
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (!Number.isFinite(expSeconds) || expSeconds <= nowSeconds) {
    throw new AuthApiError("AUTH_TOKEN_EXPIRED")
  }

  if (tokenInfo.email_verified !== "true") {
    throw new AuthApiError("AUTH_INVALID_TOKEN")
  }

  const email = tokenInfo.email?.trim().toLowerCase()
  if (!email || !email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
    throw new AuthApiError("AUTH_DOMAIN_NOT_ALLOWED")
  }

  const googleSub = tokenInfo.sub?.trim()
  if (!googleSub) {
    throw new AuthApiError("AUTH_INVALID_TOKEN")
  }

  const name = tokenInfo.name?.trim() || email.split("@")[0] || "UP User"

  return { googleSub, email, name }
}
