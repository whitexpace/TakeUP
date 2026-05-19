import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const readLayout = (name: "account" | "admin") =>
  readFileSync(new URL(`../${name}.vue`, import.meta.url), "utf8")

const expectCompleteLogoutFlow = (source: string) => {
  expect(source).toContain("supabase.auth.signOut()")
  expect(source).toContain('$fetch("/api/auth/logout", { method: "POST" })')
  expect(source).toContain("clearAuthCaches()")
  expect(source).toContain("clearAuthUser()")
  expect(source).toContain("clearBridge()")
  expect(source).toContain("clearViewerSession()")
  expect(source).toContain('navigateTo("/", { replace: true })')
}

describe("layout logout flows", () => {
  it("account logout clears Supabase, app session cookie, and client auth caches", () => {
    expectCompleteLogoutFlow(readLayout("account"))
  })

  it("admin logout clears Supabase, app session cookie, and client auth caches", () => {
    expectCompleteLogoutFlow(readLayout("admin"))
  })
})
