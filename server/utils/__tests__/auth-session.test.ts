import { describe, expect, it, vi } from "vitest"
import { createSessionToken, verifySessionToken, sessionCookieName } from "../auth-session"

const TEST_SECRET = "test-secret-32-chars-minimum-length"

// ---------------------------------------------------------------------------
// Login: createSessionToken
// ---------------------------------------------------------------------------
describe("login – createSessionToken", () => {
  // ✅ Sunny: valid user produces a verifiable token
  it("creates a signed session token for a valid user", () => {
    const { token, expiresAt } = createSessionToken(
      { id: "user-1", email: "sample@up.edu.ph", name: "Sample User" },
      TEST_SECRET,
    )

    expect(typeof token).toBe("string")
    expect(token.split(".")).toHaveLength(3) // header.payload.sig
    expect(expiresAt).toBeInstanceOf(Date)
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  // 🌧️ Rainy 1: missing JWT secret throws a config error
  it("throws AUTH_PROVIDER_MISCONFIG when jwtSecret is undefined", () => {
    expect(() =>
      createSessionToken({ id: "u", email: "x@up.edu.ph", name: "X" }, undefined),
    ).toThrow("JWT_SECRET is not configured")
  })

  // 🌧️ Rainy 2: empty-string JWT secret is also rejected
  it("throws AUTH_PROVIDER_MISCONFIG when jwtSecret is an empty string", () => {
    expect(() =>
      createSessionToken({ id: "u", email: "x@up.edu.ph", name: "X" }, ""),
    ).toThrow("JWT_SECRET is not configured")
  })

  // 🌧️ Rainy 3: whitespace-only JWT secret is rejected
  it("throws AUTH_PROVIDER_MISCONFIG when jwtSecret is only whitespace", () => {
    expect(() =>
      createSessionToken({ id: "u", email: "x@up.edu.ph", name: "X" }, "   "),
    ).toThrow("JWT_SECRET is not configured")
  })
})

// ---------------------------------------------------------------------------
// Login: verifySessionToken (reading the session back)
// ---------------------------------------------------------------------------
describe("login – verifySessionToken", () => {
  // ✅ Sunny: a freshly issued token verifies correctly
  it("verifies a valid session token and returns the correct user", () => {
    const { token } = createSessionToken(
      { id: "user-1", email: "sample@up.edu.ph", name: "Sample User" },
      TEST_SECRET,
    )

    const { user } = verifySessionToken(token, TEST_SECRET)
    expect(user.id).toBe("user-1")
    expect(user.email).toBe("sample@up.edu.ph")
    expect(user.name).toBe("Sample User")
  })

  // 🌧️ Rainy 1: a tampered token (extra chars) is rejected
  it("throws AUTH_SESSION_INVALID when the signature is tampered", () => {
    const { token } = createSessionToken(
      { id: "user-1", email: "sample@up.edu.ph", name: "Sample User" },
      TEST_SECRET,
    )

    expect(() => verifySessionToken(`${token}tamper`, TEST_SECRET)).toThrow("Session is invalid")
  })

  // 🌧️ Rainy 2: a token signed with a different secret is rejected
  it("throws AUTH_SESSION_INVALID when verified with a different secret", () => {
    const { token } = createSessionToken(
      { id: "user-1", email: "sample@up.edu.ph", name: "Sample User" },
      TEST_SECRET,
    )

    expect(() => verifySessionToken(token, "wrong-secret-value")).toThrow("Session is invalid")
  })

  // 🌧️ Rainy 3: an expired token is rejected
  it("throws AUTH_SESSION_INVALID for an expired token", () => {
    // Travel time to 8 days in the future so the 7-day token is expired
    const futureMs = Date.now() + 8 * 24 * 60 * 60 * 1000
    vi.setSystemTime(futureMs)

    const { token } = createSessionToken(
      { id: "user-1", email: "sample@up.edu.ph", name: "Sample User" },
      TEST_SECRET,
    )

    // Travel further so the token issued at "future" is also expired
    vi.setSystemTime(futureMs + 8 * 24 * 60 * 60 * 1000)
    expect(() => verifySessionToken(token, TEST_SECRET)).toThrow("Session is invalid")
    vi.useRealTimers()
  })
})

// ---------------------------------------------------------------------------
// Logout: session cookie constant
// ---------------------------------------------------------------------------
describe("logout – sessionCookieName", () => {
  // ✅ Sunny: the cookie name is a stable, non-empty string
  it("exports a non-empty cookie name", () => {
    expect(typeof sessionCookieName).toBe("string")
    expect(sessionCookieName.length).toBeGreaterThan(0)
  })

  // 🌧️ Rainy 1: verifying a token after it would have been deleted (simulate by using a garbage string)
  it("throws AUTH_SESSION_INVALID when cookie value is a random garbage string", () => {
    expect(() => verifySessionToken("not.a.real.token", TEST_SECRET)).toThrow("Session is invalid")
  })

  // 🌧️ Rainy 2: verifying an empty string (cleared cookie) is rejected
  it("throws AUTH_SESSION_INVALID when cookie value is empty", () => {
    expect(() => verifySessionToken("", TEST_SECRET)).toThrow("Session is invalid")
  })

  // 🌧️ Rainy 3: verifying a two-part (non-JWT) string is rejected
  it("throws AUTH_SESSION_INVALID when cookie value has wrong number of parts", () => {
    expect(() => verifySessionToken("header.payload", TEST_SECRET)).toThrow("Session is invalid")
  })
})
