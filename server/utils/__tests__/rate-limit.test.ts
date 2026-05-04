import { describe, expect, it } from "vitest"
import { consumeRateLimit, extractClientIp, findRateLimitPolicy } from "../rate-limit"

describe("rate-limit helpers", () => {
  it("matches auth endpoints to the stricter auth policy", () => {
    const policy = findRateLimitPolicy("/api/auth/google", "POST")

    expect(policy?.bucket).toBe("auth")
    expect(policy?.limit).toBe(10)
  })

  it("extracts the first forwarded client IP", () => {
    expect(
      extractClientIp({
        "x-forwarded-for": "203.0.113.10, 198.51.100.8",
      }),
    ).toBe("203.0.113.10")
  })

  it("blocks requests after the window limit is reached", () => {
    const store = new Map<string, { count: number; resetAt: number }>()
    const key = "mutations:203.0.113.10"

    const first = consumeRateLimit(store, key, { limit: 2, windowMs: 60_000 }, 0)
    const second = consumeRateLimit(store, key, { limit: 2, windowMs: 60_000 }, 1)
    const third = consumeRateLimit(store, key, { limit: 2, windowMs: 60_000 }, 2)

    expect(first.allowed).toBe(true)
    expect(second.allowed).toBe(true)
    expect(third.allowed).toBe(false)
    expect(third.remaining).toBe(0)
  })
})
