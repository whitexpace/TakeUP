import { ref } from "vue"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("#app", () => ({
  useState: (key: string, init: () => unknown) =>
    (
      globalThis as unknown as {
        useState: (stateKey: string, stateInit: () => unknown) => ReturnType<typeof ref>
      }
    ).useState(key, init),
}))

const createStateMock = () => {
  const store = new Map<string, ReturnType<typeof ref>>()

  return (key: string, init: () => unknown) => {
    if (!store.has(key)) {
      store.set(key, ref(init()))
    }

    return store.get(key)!
  }
}

describe("useLikes", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal("useState", createStateMock())
    vi.stubGlobal("$fetch", vi.fn().mockResolvedValue({ count: 3 }))
    vi.stubGlobal("useSupabaseClient", () => ({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "token-123" } },
        }),
      },
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("loads the likes count once and includes the auth header", async () => {
    const { useLikes } = await import("../use-likes")
    const likes = useLikes()

    await likes.loadLikesCount()
    await likes.loadLikesCount()

    expect($fetch).toHaveBeenCalledTimes(1)
    expect($fetch).toHaveBeenCalledWith("/api/items/count", {
      query: { likedOnly: "true" },
      headers: { Authorization: "Bearer token-123" },
    })
    expect(likes.likesCount.value).toBe(3)
  })

  it("supports force reloading after the initial fetch", async () => {
    vi.stubGlobal(
      "$fetch",
      vi.fn().mockResolvedValueOnce({ count: 2 }).mockResolvedValueOnce({ count: 5 }),
    )

    const { useLikes } = await import("../use-likes")
    const likes = useLikes()

    await likes.loadLikesCount()
    await likes.loadLikesCount({ force: true })

    expect($fetch).toHaveBeenCalledTimes(2)
    expect(likes.likesCount.value).toBe(5)
  })

  it("increments and decrements the count without going below zero", async () => {
    const { useLikes } = await import("../use-likes")
    const likes = useLikes()

    likes.incrementLikes()
    likes.incrementLikes()
    likes.decrementLikes()
    likes.decrementLikes()
    likes.decrementLikes()

    expect(likes.likesCount.value).toBe(0)
  })

  it("falls back to zero when loading the count fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.stubGlobal("$fetch", vi.fn().mockRejectedValue(new Error("boom")))

    const { useLikes } = await import("../use-likes")
    const likes = useLikes()

    await likes.loadLikesCount({ force: true })

    expect(likes.likesCount.value).toBe(0)
    expect(consoleError).toHaveBeenCalled()
  })
})
