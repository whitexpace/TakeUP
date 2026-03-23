import { afterEach, describe, expect, it, vi } from "vitest"
import { useRequestFeed } from "../use-request-feed"

describe("useRequestFeed", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("loads request posts from the requests API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      posts: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          itemNeeded: "Camera tripod",
          description: "Need this for a shoot.",
          requestedFrom: "2026-03-25T00:00:00.000Z",
          requestedTo: "2026-03-26T00:00:00.000Z",
          minTargetPrice: 100,
          maxTargetPrice: 150,
          createdAt: "2026-03-20T00:00:00.000Z",
          requester: { id: "user-1", username: "borrower1" },
        },
      ],
    })
    vi.stubGlobal("$fetch", fetchMock)

    const requestFeed = useRequestFeed()
    await requestFeed.refresh()

    expect(fetchMock).toHaveBeenCalledWith("/api/requests")
    expect(requestFeed.posts.value).toHaveLength(1)
    expect(requestFeed.errorMessage.value).toBeNull()
  })

  it("surfaces an error when the requests API fails", async () => {
    vi.stubGlobal("$fetch", vi.fn().mockRejectedValue(new Error("boom")))

    const requestFeed = useRequestFeed()
    await requestFeed.refresh()

    expect(requestFeed.posts.value).toEqual([])
    expect(requestFeed.errorMessage.value).toBe("Unable to load active requests.")
  })
})
