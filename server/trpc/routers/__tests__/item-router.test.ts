import { TRPCError } from "@trpc/server"
import { describe, expect, it, vi } from "vitest"
import { itemRouter } from "../item"

const VALID_UUID = "11111111-1111-1111-1111-111111111111"

describe("itemRouter", () => {
  it("list queries by title/description search and returns prisma items", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: VALID_UUID,
        title: "Camera",
        description: "Mirrorless",
        ownerId: "owner-1",
        createdAt: new Date("2026-03-10T00:00:00.000Z"),
        updatedAt: new Date("2026-03-10T00:00:00.000Z"),
      },
    ])

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: { item: { findMany } } as never,
      user: null,
    })

    const result = await caller.list({ search: "camera" })

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
      }),
    )
    expect(result[0]?.title).toBe("Camera")
  })

  it("update throws NOT_FOUND when item does not exist", async () => {
    const findUnique = vi.fn().mockResolvedValue(null)
    const update = vi.fn()

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: { item: { findUnique, update } } as never,
      user: { id: "owner-1", email: "owner@up.edu.ph", name: "Owner" },
    })

    await expect(
      caller.update({
        id: VALID_UUID,
        name: "Updated name",
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    })
    expect(update).not.toHaveBeenCalled()
  })

  it("update throws FORBIDDEN when user does not own the item", async () => {
    const findUnique = vi.fn().mockResolvedValue({ ownerId: "owner-2" })

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: { item: { findUnique, update: vi.fn() } } as never,
      user: { id: "owner-1", email: "owner@up.edu.ph", name: "Owner" },
    })

    try {
      await caller.update({
        id: VALID_UUID,
        name: "Updated name",
      })
      throw new Error("Expected update to throw")
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError)
      expect((error as TRPCError).code).toBe("FORBIDDEN")
    }
  })

  it("delete removes the item for its owner", async () => {
    const findUnique = vi.fn().mockResolvedValue({ ownerId: "owner-1" })
    const deleteFn = vi.fn().mockResolvedValue({
      id: VALID_UUID,
      title: "Camera",
      description: "Mirrorless",
      ownerId: "owner-1",
      createdAt: new Date("2026-03-10T00:00:00.000Z"),
      updatedAt: new Date("2026-03-10T00:00:00.000Z"),
    })

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: { item: { findUnique, delete: deleteFn } } as never,
      user: { id: "owner-1", email: "owner@up.edu.ph", name: "Owner" },
    })

    const result = await caller.delete({ id: VALID_UUID })

    expect(deleteFn).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VALID_UUID },
      }),
    )
    expect(result.title).toBe("Camera")
  })
})
