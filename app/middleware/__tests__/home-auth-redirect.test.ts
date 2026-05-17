import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { useViewerSessionMock } = vi.hoisted(() => ({
  useViewerSessionMock: vi.fn(),
}))

vi.mock("../../composables/use-viewer-session", () => ({
  useViewerSession: () => useViewerSessionMock(),
}))

describe("home-auth-redirect", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal(
      "defineNuxtRouteMiddleware",
      (handler: (...args: unknown[]) => unknown) => handler,
    )
    vi.stubGlobal("useViewerSession", () => useViewerSessionMock())
    vi.stubGlobal("navigateTo", vi.fn())
    useViewerSessionMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("clears stale auth caches and stays on home when no Supabase session exists", async () => {
    const clearAuthUser = vi.fn()
    const clearBridge = vi.fn()
    const clearViewerSession = vi.fn()
    const getSession = vi.fn().mockResolvedValue(null)
    const ensureBridgedSession = vi.fn()
    const refreshAuthUser = vi.fn()

    vi.stubGlobal("useAuthUser", () => ({
      authUser: { value: { id: "stale-user", accountType: "ADMIN" } },
      refresh: refreshAuthUser,
      clear: clearAuthUser,
    }))
    useViewerSessionMock.mockReturnValue({
      getSession,
      ensureBridgedSession,
      clear: clearViewerSession,
    })
    vi.stubGlobal("useSessionBridge", () => ({
      clear: clearBridge,
    }))

    const middleware = (await import("../home-auth-redirect")).default
    await middleware({ path: "/" } as never, undefined as never)

    expect(getSession).toHaveBeenCalledWith({ force: true })
    expect(refreshAuthUser).not.toHaveBeenCalled()
    expect(ensureBridgedSession).not.toHaveBeenCalled()
    expect(clearAuthUser).toHaveBeenCalledTimes(1)
    expect(clearBridge).toHaveBeenCalledTimes(1)
    expect(clearViewerSession).toHaveBeenCalledTimes(1)
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it("redirects after confirming a live session and refreshing the current auth user", async () => {
    const clearAuthUser = vi.fn()
    const clearBridge = vi.fn()
    const clearViewerSession = vi.fn()
    const getSession = vi.fn().mockResolvedValue({
      access_token: "token-a",
    })
    const ensureBridgedSession = vi.fn().mockResolvedValue(true)
    const refreshAuthUser = vi.fn().mockResolvedValue({
      id: "user-1",
      accountType: "ADMIN",
    })

    vi.stubGlobal("useAuthUser", () => ({
      authUser: { value: { id: "stale-user", accountType: "STUDENT" } },
      refresh: refreshAuthUser,
      clear: clearAuthUser,
    }))
    useViewerSessionMock.mockReturnValue({
      getSession,
      ensureBridgedSession,
      clear: clearViewerSession,
    })
    vi.stubGlobal("useSessionBridge", () => ({
      clear: clearBridge,
    }))

    const middleware = (await import("../home-auth-redirect")).default
    await middleware({ path: "/" } as never, undefined as never)

    expect(getSession).toHaveBeenCalledWith({ force: true })
    expect(ensureBridgedSession).toHaveBeenCalledTimes(1)
    expect(refreshAuthUser).toHaveBeenCalledTimes(1)
    expect(clearAuthUser).toHaveBeenCalledTimes(1)
    expect(clearBridge).toHaveBeenCalledTimes(1)
    expect(clearViewerSession).toHaveBeenCalledTimes(1)
    expect(navigateTo).toHaveBeenCalledWith("/admin/disputes", { replace: true })
  })
})
