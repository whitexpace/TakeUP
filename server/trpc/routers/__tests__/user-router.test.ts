import { describe, expect, it, vi } from "vitest"
import { userRouter } from "../user"

const makeContext = (prisma: Record<string, unknown>) => ({
  event: { context: {} } as never,
  prisma,
  user: null,
})

describe("userRouter", () => {
  describe("search", () => {
    it("only searches active accounts so deactivated users are hidden until reactivated", async () => {
      const findMany = vi.fn().mockResolvedValue([
        {
          id: "user-1",
          username: "reactivated_user",
          firstName: "Reactivated",
          lastName: "User",
          avatarUrl: null,
          lender: {
            lenderRating: 4.75,
            _count: { listedItem: 2 },
          },
        },
      ])

      const caller = userRouter.createCaller(
        makeContext({
          user: { findMany },
        }) as never,
      )

      const result = await caller.search({ query: "reactivated" })

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "ACTIVE",
            OR: [
              { username: { contains: "reactivated", mode: "insensitive" } },
              { firstName: { contains: "reactivated", mode: "insensitive" } },
              { lastName: { contains: "reactivated", mode: "insensitive" } },
            ],
          }),
          orderBy: [{ username: "asc" }, { id: "asc" }],
          take: 3,
        }),
      )
      expect(result).toEqual([
        {
          id: "user-1",
          username: "reactivated_user",
          name: "Reactivated",
          avatarUrl: null,
          rating: 4.75,
          activeListings: 2,
        },
      ])
    })
  })

  describe("getPublicProfile", () => {
    it("does not expose public profiles for inactive accounts", async () => {
      const findFirst = vi.fn().mockResolvedValue(null)
      const caller = userRouter.createCaller(
        makeContext({
          user: { findFirst },
        }) as never,
      )

      await expect(caller.getPublicProfile({ username: "hidden_user" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      })

      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { username: "hidden_user", status: "ACTIVE" },
        }),
      )
    })
  })
})
