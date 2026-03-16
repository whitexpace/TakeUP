import { TRPCError } from "@trpc/server"
import { describe, expect, it, vi } from "vitest"
import { itemRouter } from "../item"

const VALID_UUID = "11111111-1111-1111-1111-111111111111"

describe("itemRouter", () => {
  it("list maps taxonomy relations into plain arrays", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: VALID_UUID,
        name: "Camera",
        status: "AVAILABLE",
        lenderId: "owner-1",
        lender: {
          user: {
            username: "owner1",
            firstName: "Owner",
            middleName: null,
            lastName: "One",
            email: "owner1@up.edu.ph",
          },
        },
        availability: [
          {
            id: "22222222-2222-2222-2222-222222222222",
            startDate: new Date("2026-03-10T00:00:00.000Z"),
            endDate: new Date("2026-03-12T00:00:00.000Z"),
            status: "AVAILABLE",
          },
        ],
        categories: [{ category: "ELECTRONICS" }],
        tags: [{ tag: { name: "photo" } }],
      },
    ])

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: { item: { findMany } } as never,
      user: null,
    })

    const result = await caller.list()

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          availability: expect.objectContaining({
            select: expect.objectContaining({
              id: true,
              startDate: true,
              endDate: true,
              status: true,
            }),
            orderBy: { startDate: "asc" },
          }),
        }),
        where: expect.objectContaining({
          status: { not: "DELETED" },
        }),
      }),
    )
    expect(result[0]?.categories).toEqual(["ELECTRONICS"])
    expect(result[0]?.tags).toEqual(["photo"])
    expect(result[0]?.ownerName).toBe("owner1")
    expect(result[0]?.availability).toEqual([
      {
        id: "22222222-2222-2222-2222-222222222222",
        startDate: new Date("2026-03-10T00:00:00.000Z"),
        endDate: new Date("2026-03-12T00:00:00.000Z"),
        status: "AVAILABLE",
      },
    ])
  })

  it("update throws NOT_FOUND when item does not exist", async () => {
    const findUnique = vi.fn().mockResolvedValue(null)
    const update = vi.fn()

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: { item: { findUnique, update } } as never,
      user: { id: "owner-1", email: "owner@up.edu.ph", name: "Owner" },
    })

    await expect(caller.update({ id: VALID_UUID, name: "Updated name" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    })
    expect(update).not.toHaveBeenCalled()
  })

  it("update throws FORBIDDEN when user does not own the item", async () => {
    const findUnique = vi.fn().mockResolvedValue({ lenderId: "owner-2" })

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: { item: { findUnique, update: vi.fn() } } as never,
      user: { id: "owner-1", email: "owner@up.edu.ph", name: "Owner" },
    })

    try {
      await caller.update({ id: VALID_UUID, name: "Updated name" })
      throw new Error("Expected update to throw")
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError)
      expect((error as TRPCError).code).toBe("FORBIDDEN")
    }
  })

  it("delete performs a soft delete by setting status to DELETED", async () => {
    const findUnique = vi.fn().mockResolvedValue({ lenderId: "owner-1" })
    const update = vi.fn().mockResolvedValue({
      id: VALID_UUID,
      name: "Camera",
      status: "DELETED",
      lenderId: "owner-1",
      lender: {
        user: {
          username: "owner1",
          firstName: "Owner",
          middleName: null,
          lastName: "One",
          email: "owner1@up.edu.ph",
        },
      },
      availability: [],
      categories: [{ category: "ELECTRONICS" }],
      tags: [{ tag: { name: "photo" } }],
    })

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: { item: { findUnique, update } } as never,
      user: { id: "owner-1", email: "owner@up.edu.ph", name: "Owner" },
    })

    const result = await caller.delete({ id: VALID_UUID })

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VALID_UUID },
        data: { status: "DELETED" },
      }),
    )
    expect(result.status).toBe("DELETED")
    expect(result.ownerName).toBe("owner1")
    expect(result.categories).toEqual(["ELECTRONICS"])
    expect(result.tags).toEqual(["photo"])
  })

  it("toggleLike creates a like when it does not exist", async () => {
    const itemFindUnique = vi.fn().mockResolvedValue({ id: VALID_UUID })
    const likeFindUnique = vi
      .fn()
      .mockResolvedValueOnce(null) // check if like exists
      .mockResolvedValueOnce({ userId: "user-1", itemId: VALID_UUID }) // after create, check like exists

    const create = vi.fn().mockResolvedValue({ userId: "user-1", itemId: VALID_UUID })

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: {
        item: { findUnique: itemFindUnique },
        like: { findUnique: likeFindUnique, create, delete: vi.fn() },
      } as never,
      user: { id: "user-1", email: "user@up.edu.ph", name: "User" },
    })

    const result = await caller.toggleLike({ itemId: VALID_UUID })

    expect(create).toHaveBeenCalledWith({
      data: { userId: "user-1", itemId: VALID_UUID },
    })
    expect(result.isLiked).toBe(true)
    expect(result.itemId).toBe(VALID_UUID)
  })

  it("toggleLike deletes a like when it exists", async () => {
    const itemFindUnique = vi.fn().mockResolvedValue({ id: VALID_UUID })
    const likeFindUnique = vi
      .fn()
      .mockResolvedValueOnce({ userId: "user-1", itemId: VALID_UUID }) // check if like exists
      .mockResolvedValueOnce(null) // after delete, check like exists

    const deleteLike = vi.fn().mockResolvedValue({ userId: "user-1", itemId: VALID_UUID })

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: {
        item: { findUnique: itemFindUnique },
        like: { findUnique: likeFindUnique, delete: deleteLike, create: vi.fn() },
      } as never,
      user: { id: "user-1", email: "user@up.edu.ph", name: "User" },
    })

    const result = await caller.toggleLike({ itemId: VALID_UUID })

    expect(deleteLike).toHaveBeenCalledWith({
      where: {
        userId_itemId: {
          userId: "user-1",
          itemId: VALID_UUID,
        },
      },
    })
    expect(result.isLiked).toBe(false)
    expect(result.itemId).toBe(VALID_UUID)
  })

  it("toggleLike throws NOT_FOUND when item does not exist", async () => {
    const itemFindUnique = vi.fn().mockResolvedValue(null) // item not found

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: {
        item: { findUnique: itemFindUnique },
        like: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
      } as never,
      user: { id: "user-1", email: "user@up.edu.ph", name: "User" },
    })

    await expect(caller.toggleLike({ itemId: VALID_UUID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    })
  })
})
