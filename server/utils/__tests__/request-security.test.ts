import { describe, expect, it } from "vitest"
import {
  hasAuthorizationHeader,
  hasSessionCookie,
  mergeVaryHeader,
} from "../request-security-core"

describe("request-security helpers", () => {
  it("detects bearer authorization headers", () => {
    expect(hasAuthorizationHeader("Bearer abc123")).toBe(true)
    expect(hasAuthorizationHeader("bearer token")).toBe(true)
    expect(hasAuthorizationHeader("Basic token")).toBe(false)
    expect(hasAuthorizationHeader(undefined)).toBe(false)
  })

  it("detects the custom session cookie", () => {
    expect(hasSessionCookie("foo=bar; takeup_session=token; theme=light")).toBe(true)
    expect(hasSessionCookie("foo=bar; session=token")).toBe(false)
    expect(hasSessionCookie(undefined)).toBe(false)
  })

  it("merges vary header values without duplicates", () => {
    expect(mergeVaryHeader("Authorization", ["Cookie", "Authorization"])).toBe(
      "Authorization, Cookie",
    )
  })
})
