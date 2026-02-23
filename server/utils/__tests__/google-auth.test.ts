import { describe, expect, it, vi, afterEach } from "vitest"
import { verifyGoogleIdToken } from "../google-auth"

// ---------------------------------------------------------------------------
// We mock $fetch (used inside verifyGoogleIdToken to call Google tokeninfo)
// ---------------------------------------------------------------------------

const VALID_GOOGLE_CLIENT_ID = "123456789-abc.apps.googleusercontent.com"

/** Factory for a tokeninfo payload that passes all checks */
function makeTokenInfo(overrides: Record<string, string> = {}) {
  const nowSeconds = Math.floor(Date.now() / 1000)
  return {
    iss: "https://accounts.google.com",
    aud: VALID_GOOGLE_CLIENT_ID,
    exp: String(nowSeconds + 3600), // expires in 1 hour
    sub: "google-sub-abc123",
    email: "student@up.edu.ph",
    email_verified: "true",
    name: "Student User",
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Login – verifyGoogleIdToken (sunny + rainy paths)
// ---------------------------------------------------------------------------
describe("login – verifyGoogleIdToken", () => {
  // ✅ Sunny: a valid token from a UP student resolves to the correct identity
  it("resolves a verified identity for a valid UP student token", async () => {
    vi.stubGlobal("$fetch", vi.fn().mockResolvedValueOnce(makeTokenInfo()))

    const identity = await verifyGoogleIdToken("valid-id-token", VALID_GOOGLE_CLIENT_ID)

    expect(identity.googleSub).toBe("google-sub-abc123")
    expect(identity.email).toBe("student@up.edu.ph")
    expect(identity.name).toBe("Student User")
  })

  // 🌧️ Rainy 1: Google's tokeninfo endpoint rejects the token (network/invalid token)
  it("throws AUTH_INVALID_TOKEN when Google tokeninfo call fails", async () => {
    vi.stubGlobal("$fetch", vi.fn().mockRejectedValueOnce(new Error("401 Unauthorized")))

    await expect(verifyGoogleIdToken("bad-token", VALID_GOOGLE_CLIENT_ID)).rejects.toThrow(
      "The Google ID token is invalid",
    )
  })

  // 🌧️ Rainy 2: token audience does not match our client ID (wrong app)
  it("throws AUTH_INVALID_TOKEN when the token audience mismatches the client ID", async () => {
    vi.stubGlobal(
      "$fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          makeTokenInfo({ aud: "different-client-id.apps.googleusercontent.com" }),
        ),
    )

    await expect(verifyGoogleIdToken("foreign-app-token", VALID_GOOGLE_CLIENT_ID)).rejects.toThrow(
      "The Google ID token is invalid",
    )
  })

  // 🌧️ Rainy 3: email is not from the UP domain
  it("throws AUTH_DOMAIN_NOT_ALLOWED for a non-UP email address", async () => {
    vi.stubGlobal(
      "$fetch",
      vi.fn().mockResolvedValueOnce(makeTokenInfo({ email: "student@gmail.com" })),
    )

    await expect(verifyGoogleIdToken("gmail-token", VALID_GOOGLE_CLIENT_ID)).rejects.toThrow(
      "Only up.edu.ph email addresses are allowed",
    )
  })
})

// ---------------------------------------------------------------------------
// Login – additional edge cases for verifyGoogleIdToken
// ---------------------------------------------------------------------------
describe("login – verifyGoogleIdToken edge cases", () => {
  // ✅ Sunny: token with no display name falls back to the email prefix
  it("uses the email prefix as name when Google name is absent", async () => {
    vi.stubGlobal("$fetch", vi.fn().mockResolvedValueOnce(makeTokenInfo({ name: "" })))

    const identity = await verifyGoogleIdToken("no-name-token", VALID_GOOGLE_CLIENT_ID)
    expect(identity.name).toBe("student") // prefix of student@up.edu.ph
  })

  // 🌧️ Rainy 1: GOOGLE_CLIENT_ID is not configured (empty)
  it("throws AUTH_PROVIDER_MISCONFIG when googleClientId is empty", async () => {
    await expect(verifyGoogleIdToken("any-token", "")).rejects.toThrow(
      "GOOGLE_CLIENT_ID is not configured",
    )
  })

  // 🌧️ Rainy 2: token is expired (exp is in the past)
  it("throws AUTH_TOKEN_EXPIRED when the token exp is in the past", async () => {
    const pastExp = String(Math.floor(Date.now() / 1000) - 60) // 1 minute ago
    vi.stubGlobal("$fetch", vi.fn().mockResolvedValueOnce(makeTokenInfo({ exp: pastExp })))

    await expect(verifyGoogleIdToken("expired-token", VALID_GOOGLE_CLIENT_ID)).rejects.toThrow(
      "The Google ID token has expired",
    )
  })

  // 🌧️ Rainy 3: email is not verified by Google
  it("throws AUTH_INVALID_TOKEN when email_verified is false", async () => {
    vi.stubGlobal(
      "$fetch",
      vi.fn().mockResolvedValueOnce(makeTokenInfo({ email_verified: "false" })),
    )

    await expect(verifyGoogleIdToken("unverified-token", VALID_GOOGLE_CLIENT_ID)).rejects.toThrow(
      "The Google ID token is invalid",
    )
  })
})
