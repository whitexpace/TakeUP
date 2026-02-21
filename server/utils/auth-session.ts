import { createHmac, timingSafeEqual } from "node:crypto"
import { AuthApiError } from "./auth-errors"

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7

export type SessionUser = {
  id: string
  email: string
  name: string
}

type SessionPayload = {
  sub: string
  email: string
  name: string
  iat: number
  exp: number
}

type SignedSession = {
  token: string
  expiresAt: Date
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString("base64url")
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8")
}

function assertJwtSecret(secret: string | undefined): string {
  if (!secret || !secret.trim()) {
    throw new AuthApiError("AUTH_PROVIDER_MISCONFIG", "JWT_SECRET is not configured.")
  }

  return secret
}

function sign(secret: string, content: string): string {
  return createHmac("sha256", secret).update(content).digest("base64url")
}

export function createSessionToken(
  user: SessionUser,
  jwtSecret: string | undefined,
): SignedSession {
  const secret = assertJwtSecret(jwtSecret)
  const now = Math.floor(Date.now() / 1000)
  const exp = now + SESSION_DURATION_SECONDS

  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      name: user.name,
      iat: now,
      exp,
    } satisfies SessionPayload),
  )

  const body = `${header}.${payload}`
  const signature = sign(secret, body)

  return {
    token: `${body}.${signature}`,
    expiresAt: new Date(exp * 1000),
  }
}

export function verifySessionToken(
  token: string,
  jwtSecret: string | undefined,
): { user: SessionUser; exp: number } {
  const secret = assertJwtSecret(jwtSecret)
  const parts = token.split(".")
  if (parts.length !== 3) {
    throw new AuthApiError("AUTH_SESSION_INVALID")
  }

  const [header, payload, signature] = parts
  if (!header || !payload || !signature) {
    throw new AuthApiError("AUTH_SESSION_INVALID")
  }

  const expected = sign(secret, `${header}.${payload}`)
  if (signature.length !== expected.length) {
    throw new AuthApiError("AUTH_SESSION_INVALID")
  }
  const validSignature = timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  if (!validSignature) {
    throw new AuthApiError("AUTH_SESSION_INVALID")
  }

  let parsed: SessionPayload
  try {
    parsed = JSON.parse(base64UrlDecode(payload)) as SessionPayload
  } catch {
    throw new AuthApiError("AUTH_SESSION_INVALID")
  }

  const now = Math.floor(Date.now() / 1000)
  if (parsed.exp <= now) {
    throw new AuthApiError("AUTH_SESSION_INVALID")
  }

  if (!parsed.sub || !parsed.email || !parsed.name) {
    throw new AuthApiError("AUTH_SESSION_INVALID")
  }

  return {
    user: {
      id: parsed.sub,
      email: parsed.email,
      name: parsed.name,
    },
    exp: parsed.exp,
  }
}

export const sessionCookieName = "takeup_session"
export const sessionCookieMaxAgeSeconds = SESSION_DURATION_SECONDS
