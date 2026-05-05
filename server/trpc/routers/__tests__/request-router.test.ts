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
  it("lists active request posts ordered by recency without exposing requester details publicly", async () => {
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
    expect(result.posts[0]?.requester.username).toBeNull()
    expect(result.posts[0]?.requester.id).toBeNull()
    expect(result.posts[0]?.itemNeeded).toBe("Portable projector")
  })

  it("returns requester details to authenticated viewers and keeps pricing normalized", async () => {
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
      user: { id: "viewer-1", email: "viewer@up.edu.ph", name: "viewer" },
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

  it("creates a request for an authenticated user", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "user-1",
      username: "borrower1",
      accountType: "USER",
      status: "ACTIVE",
    })
    const create = vi.fn().mockResolvedValue({
      id: "44444444-4444-4444-4444-444444444444",
      itemNeeded: "DSLR camera",
      description: "Need this for a campus event.",
      requestedFrom: new Date("2026-03-29T00:00:00.000Z"),
      requestedTo: new Date("2026-03-30T00:00:00.000Z"),
      minTargetPrice: 300,
      maxTargetPrice: 600,
      createdAt: new Date("2026-03-23T00:00:00.000Z"),
    })

    const caller = requestRouter.createCaller({
      event: { context: {} } as never,
      prisma: {
        user: { findUnique },
        requestPost: { create },
      } as never,
      user: { id: "user-1", email: "borrower1@up.edu.ph", name: "borrower1" },
    })

    const result = await caller.create({
      itemNeeded: "DSLR camera",
      description: "Need this for a campus event.",
      requestedFrom: new Date("2026-03-29T00:00:00.000Z"),
      requestedTo: new Date("2026-03-30T00:00:00.000Z"),
      minTargetPrice: 300,
      maxTargetPrice: 600,
    })

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { id: true, username: true, accountType: true, status: true },
    })
    expect(create).toHaveBeenCalledTimes(1)
    expect(result.requester.username).toBe("borrower1")
  })

  it("rejects request creation for non-user accounts", async () => {
    const caller = requestRouter.createCaller({
      event: { context: {} } as never,
      prisma: {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: "user-2",
            username: "admin1",
            accountType: "ADMIN",
            status: "ACTIVE",
          }),
        },
        requestPost: { create: vi.fn() },
      } as never,
      user: { id: "user-2", email: "admin1@up.edu.ph", name: "admin1" },
    })

    await expect(
      caller.create({
        itemNeeded: "DSLR camera",
        description: "Need this for a campus event.",
        requestedFrom: new Date("2026-03-29T00:00:00.000Z"),
        requestedTo: new Date("2026-03-30T00:00:00.000Z"),
        minTargetPrice: 300,
        maxTargetPrice: 600,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only borrower accounts can post requests.",
    })
  })
})
