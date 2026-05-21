import { ref } from "vue"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const createStateMock = () => {
  const store = new Map<string, ReturnType<typeof ref>>()

  return (key: string, init: () => unknown) => {
    if (!store.has(key)) {
      store.set(key, ref(init()))
    }

    return store.get(key)!
  }
}

describe("useViewerSession", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal("useState", createStateMock())
    vi.stubGlobal("useRequestHeaders", () => ({}))
    vi.stubGlobal("useSessionBridge", () => ({
      ensureBridged: vi.fn().mockResolvedValue(true),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("force-refreshes the Supabase session instead of trusting a stale cached session", async () => {
    const activeSession = { access_token: "token-a", expires_at: 9999999999 }
    const getSession = vi
      .fn()
      .mockResolvedValueOnce({ data: { session: activeSession } })
      .mockResolvedValueOnce({ data: { session: null } })

    vi.stubGlobal("useSupabaseClient", () => ({
      auth: { getSession },
    }))

    const { useViewerSession } = await import("../use-viewer-session")
    const viewerSession = useViewerSession()

    await expect(viewerSession.getSession()).resolves.toEqual(activeSession)
    await expect(viewerSession.getSession()).resolves.toEqual(activeSession)
    expect(getSession).toHaveBeenCalledTimes(1)

    await expect(viewerSession.getSession({ force: true })).resolves.toBeNull()
    expect(getSession).toHaveBeenCalledTimes(2)
    expect(viewerSession.session.value).toBeNull()
    expect(viewerSession.loadedSession.value).toBe(true)
  })

  it("clear removes the cached session so the next read asks Supabase again", async () => {
    const activeSession = { access_token: "token-a", expires_at: 9999999999 }
    const nextSession = { access_token: "token-b", expires_at: 9999999999 }
    const getSession = vi
      .fn()
      .mockResolvedValueOnce({ data: { session: activeSession } })
      .mockResolvedValueOnce({ data: { session: nextSession } })

    vi.stubGlobal("useSupabaseClient", () => ({
      auth: { getSession },
    }))

    const { useViewerSession } = await import("../use-viewer-session")
    const viewerSession = useViewerSession()

    await expect(viewerSession.getAccessToken()).resolves.toBe("token-a")
    viewerSession.clear()
    await expect(viewerSession.getAccessToken()).resolves.toBe("token-b")

    expect(getSession).toHaveBeenCalledTimes(2)
  })
})
