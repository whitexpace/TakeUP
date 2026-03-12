import { TRPCError } from "@trpc/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { sessionCookieName } from "../../../utils/auth-session"

vi.mock("h3", () => ({
  deleteCookie: vi.fn(),
}))

describe("appRouter auth and health routes", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("health.ping returns ok: true", async () => {
    const { appRouter } = await import("../index")

    const caller = appRouter.createCaller({
      event: { context: {} } as never,
      prisma: {} as never,
      user: null,
    })

    await expect(caller.health.ping()).resolves.toEqual({ ok: true })
  })

  it("auth.me returns the current user (or null)", async () => {
    const { appRouter } = await import("../index")

    const caller = appRouter.createCaller({
      event: { context: {} } as never,
      prisma: {} as never,
      user: { id: "u1", email: "u1@up.edu.ph", name: "User One" },
    })

    await expect(caller.auth.me()).resolves.toEqual({
      user: { id: "u1", email: "u1@up.edu.ph", name: "User One" },
    })
  })

  it("auth.signOut rejects when session user is missing", async () => {
    const { appRouter } = await import("../index")

    const caller = appRouter.createCaller({
      event: { context: {} } as never,
      prisma: {} as never,
      user: null,
    })

    try {
      await caller.auth.signOut()
      throw new Error("Expected signOut to throw")
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError)
      expect((error as TRPCError).code).toBe("UNAUTHORIZED")
    }
  })

  it("auth.signOut clears session cookie and returns ok: true for authenticated users", async () => {
    const { deleteCookie } = await import("h3")
    const { appRouter } = await import("../index")

    const event = { context: {} } as never
    const caller = appRouter.createCaller({
      event,
      prisma: {} as never,
      user: { id: "u1", email: "u1@up.edu.ph", name: "User One" },
    })

    await expect(caller.auth.signOut()).resolves.toEqual({ ok: true })
    expect(deleteCookie).toHaveBeenCalledWith(event, sessionCookieName, { path: "/" })
  })
})
