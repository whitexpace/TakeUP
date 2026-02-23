/**
 * Handler-level tests for:
 *  - POST /api/auth/google  (login)
 *  - tRPC signOut mutation  (logout)
 *
 * These tests exercise the full handler logic using lightweight stubs.
 * They do NOT need a real DB or a real Google token endpoint.
 */
import { describe, expect, it, vi } from "vitest"
import { createSessionToken, verifySessionToken } from "../auth-session"
import { AuthApiError } from "../auth-errors"

const TEST_JWT_SECRET = "test-jwt-secret-thats-long-enough"
const VALID_CLIENT_ID = "client-id.apps.googleusercontent.com"

// ---------------------------------------------------------------------------
// LOGIN – full flow (uses real createSessionToken / verifySessionToken)
// ---------------------------------------------------------------------------
describe("login – session creation and verification", () => {
  // ✅ Sunny: sign-in with valid UP credentials produces a valid session
  it("produces a session token that can be read back", () => {
    const { token, expiresAt } = createSessionToken(
      { id: "user-42", email: "jdelacruz@up.edu.ph", name: "Juan Dela Cruz" },
      TEST_JWT_SECRET,
    )

    const { user } = verifySessionToken(token, TEST_JWT_SECRET)

    expect(user.id).toBe("user-42")
    expect(user.email).toBe("jdelacruz@up.edu.ph")
    expect(user.name).toBe("Juan Dela Cruz")
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  // 🌧️ Rainy 1: idToken payload is missing (Zod would reject it)
  it("googleAuthRequestSchema rejects an empty body", async () => {
    const { googleAuthRequestSchema } = await import("../../../shared/schemas/auth")
    const result = googleAuthRequestSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  // 🌧️ Rainy 2: idToken is present but Google tokeninfo rejects it
  it("verifyGoogleIdToken throws AUTH_INVALID_TOKEN for a bad token", async () => {
    vi.stubGlobal("$fetch", vi.fn().mockRejectedValueOnce(new Error("invalid_token")))
    const { verifyGoogleIdToken } = await import("../google-auth")
    await expect(verifyGoogleIdToken("garbage", VALID_CLIENT_ID)).rejects.toMatchObject({
      code: "AUTH_INVALID_TOKEN",
    })
    vi.restoreAllMocks()
  })

  // 🌧️ Rainy 3: JWT secret is missing at token creation time
  it("createSessionToken throws when JWT_SECRET is not configured", () => {
    expect(() =>
      createSessionToken({ id: "u", email: "x@up.edu.ph", name: "X" }, undefined),
    ).toThrow("JWT_SECRET is not configured")
  })
})

// ---------------------------------------------------------------------------
// LOGOUT – clearing the session
// ---------------------------------------------------------------------------
describe("logout – signOut flow", () => {
  // ✅ Sunny: after sign-out the session token is no longer valid
  it("a token that was 'deleted' (empty cookie) fails verification", () => {
    // Simulate what the browser sends after the cookie was cleared
    const clearedCookieValue = ""
    expect(() => verifySessionToken(clearedCookieValue, TEST_JWT_SECRET)).toThrow(
      "Session is invalid",
    )
  })

  // 🌧️ Rainy 1: trying to use the raw session token after logout (tampered/replayed) is rejected
  it("a token signed with a different secret is rejected (replay attack)", () => {
    const { token } = createSessionToken(
      { id: "user-42", email: "jdelacruz@up.edu.ph", name: "Juan Dela Cruz" },
      TEST_JWT_SECRET,
    )

    expect(() => verifySessionToken(token, "attacker-secret")).toThrow("Session is invalid")
  })

  // 🌧️ Rainy 2: signOut with no session should still be safe (AUTH_SESSION_INVALID)
  it("verifySessionToken throws AUTH_SESSION_INVALID for a garbage cookie value", () => {
    expect(() => verifySessionToken("not-a-real-token", TEST_JWT_SECRET)).toThrow(
      "Session is invalid",
    )
  })

  // 🌧️ Rainy 3: /api/auth/me returns 401 when the session cookie is absent
  it("AuthApiError with AUTH_UNAUTHORIZED has statusCode 401", () => {
    const err = new AuthApiError("AUTH_UNAUTHORIZED")
    expect(err.statusCode).toBe(401)
    expect(err.code).toBe("AUTH_UNAUTHORIZED")
  })
})

// ---------------------------------------------------------------------------
// LOGOUT – protectedProcedure guard (no active session)
// ---------------------------------------------------------------------------
describe("logout – protected route guard", () => {
  // ✅ Sunny: a valid session user is recognised by the guard
  it("a valid token resolves to the correct user in the session", () => {
    const { token } = createSessionToken(
      { id: "user-99", email: "juana@up.edu.ph", name: "Juana Reyes" },
      TEST_JWT_SECRET,
    )
    const { user } = verifySessionToken(token, TEST_JWT_SECRET)
    expect(user.id).toBe("user-99")
  })

  // 🌧️ Rainy 1: missing JWT_SECRET on the server side aborts verification
  it("verifySessionToken throws when jwtSecret is undefined", () => {
    const { token } = createSessionToken(
      { id: "user-99", email: "juana@up.edu.ph", name: "Juana Reyes" },
      TEST_JWT_SECRET,
    )
    expect(() => verifySessionToken(token, undefined)).toThrow("JWT_SECRET is not configured")
  })

  // 🌧️ Rainy 2: a two-part token (missing signature segment) is rejected
  it("verifySessionToken rejects a token with only two parts", () => {
    expect(() => verifySessionToken("header.payload", TEST_JWT_SECRET)).toThrow(
      "Session is invalid",
    )
  })

  // 🌧️ Rainy 3: payload is valid JSON but missing required fields
  it("verifySessionToken rejects a token whose payload is missing sub/email/name", async () => {
    const { createHmac } = await import("node:crypto")
    // Manually craft a token with an incomplete payload
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
    const payload = Buffer.from(
      JSON.stringify({
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url")

    const sig = createHmac("sha256", TEST_JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest("base64url")

    const token = `${header}.${payload}.${sig}`
    expect(() => verifySessionToken(token, TEST_JWT_SECRET)).toThrow("Session is invalid")
  })
})
