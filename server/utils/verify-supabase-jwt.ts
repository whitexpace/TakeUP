import { createHmac, timingSafeEqual } from "node:crypto"

export type SupabaseJwtPayload = {
  sub: string
  email: string
  aud: string
  exp: number
  iat: number
  role?: string
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}

/**
 * Verify a Supabase access token locally using the project's JWT secret (HS256).
 * Returns the decoded payload if valid, or null if verification fails.
 *
 * Only supports HS256 — returns null for tokens using other algorithms,
 * allowing the caller to fall back to remote verification.
 */
export function verifySupabaseJwt(
  token: string,
  jwtSecret: string,
): SupabaseJwtPayload | null {
  const parts = token.split(".")
  if (parts.length !== 3) return null

  const [header, payload, signature] = parts
  if (!header || !payload || !signature) return null

  // Decode header and enforce HS256
  let headerObj: { alg?: string }
  try {
    headerObj = JSON.parse(Buffer.from(header, "base64url").toString("utf8"))
  } catch {
    return null
  }
  if (headerObj.alg !== "HS256") return null

  // Verify HMAC-SHA256 signature
  const expected = createHmac("sha256", jwtSecret)
    .update(`${header}.${payload}`)
    .digest("base64url")

  if (signature.length !== expected.length) return null
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null

  // Decode and validate payload claims
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    return null
  }

  const now = Math.floor(Date.now() / 1000)
  if (typeof parsed.exp !== "number" || parsed.exp <= now) return null
  if (parsed.aud !== "authenticated") return null
  if (typeof parsed.sub !== "string" || !parsed.sub) return null
  if (typeof parsed.email !== "string" || !parsed.email) return null

  return parsed as unknown as SupabaseJwtPayload
}
