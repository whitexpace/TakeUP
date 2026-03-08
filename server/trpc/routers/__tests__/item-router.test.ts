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
        availability: [
          {
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
            select: {
              startDate: true,
              endDate: true,
              status: true,
            },
          }),
        }),
        where: expect.objectContaining({
          status: { not: "DELETED" },
        }),
      }),
    )
    const findManyArgs = findMany.mock.calls[0]?.[0]
    expect(findManyArgs?.include?.availability?.select).not.toHaveProperty("id")
    expect(result[0]?.categories).toEqual(["ELECTRONICS"])
    expect(result[0]?.tags).toEqual(["photo"])
    expect(result[0]?.availability).toHaveLength(1)
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
    expect(result.categories).toEqual(["ELECTRONICS"])
    expect(result.tags).toEqual(["photo"])
  })
})
