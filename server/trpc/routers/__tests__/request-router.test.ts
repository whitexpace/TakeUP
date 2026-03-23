import { describe, expect, it, vi } from "vitest"
import { requestRouter } from "../request"

const makeRequestPost = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  itemNeeded: "Portable projector",
  description: "Need this for a classroom screening.",
  requestedFrom: new Date("2026-03-25T00:00:00.000Z"),
  requestedTo: new Date("2026-03-27T00:00:00.000Z"),
  minTargetPrice: 200,
  maxTargetPrice: 450,
  createdAt: new Date("2026-03-20T00:00:00.000Z"),
  requesterId: "user-1",
  requesterUsername: "borrower1",
  ...overrides,
})

describe("requestRouter", () => {
  it("lists active request posts ordered by recency", async () => {
    const queryRaw = vi.fn().mockResolvedValue([
      makeRequestPost("22222222-2222-2222-2222-222222222222"),
      makeRequestPost("11111111-1111-1111-1111-111111111111", {
        createdAt: new Date("2026-03-21T00:00:00.000Z"),
      }),
    ])

    const caller = requestRouter.createCaller({
      event: { context: {} } as never,
      prisma: { $queryRaw: queryRaw } as never,
      user: null,
    })

    const result = await caller.list()

    expect(queryRaw).toHaveBeenCalledTimes(1)
    expect(result.posts).toHaveLength(2)
    expect(result.posts[0]?.requester.username).toBe("borrower1")
    expect(result.posts[0]?.itemNeeded).toBe("Portable projector")
  })

  it("returns normalized requester details and request pricing", async () => {
    const queryRaw = vi.fn().mockResolvedValue([
      makeRequestPost("33333333-3333-3333-3333-333333333333", {
        requesterId: "user-9",
        requesterUsername: "kuleborrower",
        minTargetPrice: 500,
        maxTargetPrice: 900,
      }),
    ])

    const caller = requestRouter.createCaller({
      event: { context: {} } as never,
      prisma: { $queryRaw: queryRaw } as never,
      user: null,
    })

    const result = await caller.list()

    expect(result.posts[0]).toEqual(
      expect.objectContaining({
        requester: { id: "user-9", username: "kuleborrower" },
        minTargetPrice: 500,
        maxTargetPrice: 900,
      }),
    )
  })
})
