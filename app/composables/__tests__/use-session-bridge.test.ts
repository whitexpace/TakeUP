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

const createDeferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, resolve, reject }
}

describe("useSessionBridge", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal("useState", createStateMock())
    vi.stubGlobal("useAuthUser", () => ({
      setCached: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("deduplicates concurrent bridge calls for the same access token", async () => {
    const bridgeResponse = createDeferred<{ ok: boolean; expiresAt: string }>()
    const fetchMock = vi.fn().mockReturnValueOnce(bridgeResponse.promise)
    vi.stubGlobal("$fetch", fetchMock)

    const { useSessionBridge } = await import("../use-session-bridge")
    const { bridgedAccessToken, ensureBridged } = useSessionBridge()

    const firstRequest = ensureBridged("token-a")
    const secondRequest = ensureBridged("token-a")

    expect(fetchMock).toHaveBeenCalledTimes(1)

    bridgeResponse.resolve({ ok: true, expiresAt: "2026-05-13T00:00:00.000Z" })

    await expect(firstRequest).resolves.toBe(true)
    await expect(secondRequest).resolves.toBe(true)
    expect(bridgedAccessToken.value).toBe("token-a")
  })

  it("prevents an older bridge request from overwriting a newer access token", async () => {
    const firstBridgeResponse = createDeferred<{ ok: boolean; expiresAt: string }>()
    const secondBridgeResponse = createDeferred<{ ok: boolean; expiresAt: string }>()
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(firstBridgeResponse.promise)
      .mockReturnValueOnce(secondBridgeResponse.promise)
    vi.stubGlobal("$fetch", fetchMock)

    const { useSessionBridge } = await import("../use-session-bridge")
    const { bridgedAccessToken, ensureBridged } = useSessionBridge()

    const firstRequest = ensureBridged("token-a")
    const secondRequest = ensureBridged("token-b")

    expect(fetchMock).toHaveBeenCalledTimes(2)

    secondBridgeResponse.resolve({ ok: true, expiresAt: "2026-05-13T00:00:00.000Z" })
    await expect(secondRequest).resolves.toBe(true)
    expect(bridgedAccessToken.value).toBe("token-b")

    firstBridgeResponse.resolve({ ok: true, expiresAt: "2026-05-13T00:00:00.000Z" })
    await expect(firstRequest).resolves.toBe(false)
    expect(bridgedAccessToken.value).toBe("token-b")
  })
})
