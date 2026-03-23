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

    expect(fetchMock).toHaveBeenCalledWith("/api/requests", {
      headers: undefined,
    })
    expect(requestFeed.posts.value).toHaveLength(1)
    expect(requestFeed.errorMessage.value).toBeNull()
  })

  it("passes the access token when refreshing the feed for authenticated viewers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ posts: [] })
    vi.stubGlobal("$fetch", fetchMock)

    const requestFeed = useRequestFeed()
    await requestFeed.refresh({ accessToken: "token-123" })

    expect(fetchMock).toHaveBeenCalledWith("/api/requests", {
      headers: {
        Authorization: "Bearer token-123",
      },
    })
  })

  it("surfaces an error when the requests API fails", async () => {
    vi.stubGlobal("$fetch", vi.fn().mockRejectedValue(new Error("boom")))

    const requestFeed = useRequestFeed()
    await requestFeed.refresh()

    expect(requestFeed.posts.value).toEqual([])
    expect(requestFeed.errorMessage.value).toBe("Unable to load active requests.")
  })

  it("submits a valid request then refreshes the feed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        id: "11111111-1111-1111-1111-111111111111",
      })
      .mockResolvedValueOnce({
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
    const result = await requestFeed.createPost(
      {
        itemNeeded: "Camera tripod",
        description: "Need this for a shoot.",
        requestedFrom: "2026-03-25",
        requestedTo: "2026-03-26",
        minTargetPrice: "100",
        maxTargetPrice: "150",
      },
      { accessToken: "token-123" },
    )

    expect(result).toEqual({ success: true })
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/requests", {
      method: "POST",
      body: {
        itemNeeded: "Camera tripod",
        description: "Need this for a shoot.",
        requestedFrom: "2026-03-25",
        requestedTo: "2026-03-26",
        minTargetPrice: 100,
        maxTargetPrice: 150,
      },
      headers: {
        Authorization: "Bearer token-123",
      },
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/requests", {
      headers: {
        Authorization: "Bearer token-123",
      },
    })
    expect(requestFeed.posts.value).toHaveLength(1)
  })

  it("surfaces inline validation errors before submitting", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("$fetch", fetchMock)

    const requestFeed = useRequestFeed()
    const result = await requestFeed.createPost({
      itemNeeded: "",
      description: "",
      requestedFrom: "2026-03-27",
      requestedTo: "2026-03-25",
      minTargetPrice: "500",
      maxTargetPrice: "200",
    })

    expect(result).toEqual({ success: false, reason: "validation" })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(requestFeed.fieldErrors.value.itemNeeded).toBe("Item name is required.")
    expect(requestFeed.fieldErrors.value.maxTargetPrice).toBe(
      "Maximum target price must be greater than or equal to the minimum target price.",
    )
  })
})
