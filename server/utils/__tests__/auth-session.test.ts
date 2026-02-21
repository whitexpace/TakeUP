import { describe, expect, it } from "vitest"
import { createSessionToken, verifySessionToken } from "../auth-session"

const TEST_SECRET = "test-secret"

describe("auth-session", () => {
  it("creates and verifies a session token", () => {
    const { token } = createSessionToken(
      {
        id: "user-1",
        email: "sample@up.edu.ph",
        name: "Sample User",
      },
      TEST_SECRET,
    )

    const verified = verifySessionToken(token, TEST_SECRET)
    expect(verified.user.id).toBe("user-1")
    expect(verified.user.email).toBe("sample@up.edu.ph")
    expect(verified.user.name).toBe("Sample User")
  })

  it("rejects tampered session token", () => {
    const { token } = createSessionToken(
      {
        id: "user-1",
        email: "sample@up.edu.ph",
        name: "Sample User",
      },
      TEST_SECRET,
    )

    expect(() => verifySessionToken(`${token}tamper`, TEST_SECRET)).toThrow("Session is invalid")
  })
})
