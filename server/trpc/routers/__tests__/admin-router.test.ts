import { TRPCError } from "@trpc/server"
import { describe, expect, it, vi } from "vitest"
import { adminRouter } from "../admin"

const ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const LISTING_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

const makeContext = ({
  queryResults = [],
  executeRaw = vi.fn().mockResolvedValue(1),
}: {
  queryResults?: unknown[]
  executeRaw?: ReturnType<typeof vi.fn>
} = {}) => {
  const $queryRaw = vi.fn()

  for (const result of queryResults) {
    $queryRaw.mockResolvedValueOnce(result)
  }

  return {
    event: { context: {} } as never,
    prisma: {
      $queryRaw,
      $executeRaw: executeRaw,
      user: {
        findUnique: vi.fn().mockResolvedValue({ accountType: "ADMIN" }),
      },
    } as never,
    user: { id: ADMIN_ID, email: "admin@up.edu.ph", name: "Admin User" },
  }
}

describe("adminRouter", () => {
  describe("listings.list", () => {
    it("returns summary, mapped listing rows, and next cursor", async () => {
      const caller = adminRouter.createCaller(
        makeContext({
          queryResults: [
            [{ totalListings: 8n, activeListings: 5n, inactiveListings: 3n }],
            [
              {
                id: LISTING_ID,
                numericId: 42,
                name: "DSLR Camera",
                status: "DEACTIVATED",
                adminModerationState: "DEACTIVATED",
                adminModeratedAt: new Date("2026-05-03T10:00:00.000Z"),
                createdAt: new Date("2026-05-01T10:00:00.000Z"),
                rating: 4.75,
                lenderId: "owner-1",
                ownerId: "owner-1",
                ownerUsername: "owner1",
                ownerEmail: "owner1@up.edu.ph",
                ownerFirstName: "Owner",
                ownerLastName: "One",
                category: "ELECTRONICS",
                hasActiveTransactions: true,
              },
              {
                id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
                numericId: 41,
                name: "Spare row for cursor",
                status: "AVAILABLE",
                adminModerationState: null,
                adminModeratedAt: null,
                createdAt: new Date("2026-04-30T10:00:00.000Z"),
                rating: 4.2,
                lenderId: "owner-2",
                ownerId: "owner-2",
                ownerUsername: "owner2",
                ownerEmail: "owner2@up.edu.ph",
                ownerFirstName: "Owner",
                ownerLastName: "Two",
                category: "TOOLS",
                hasActiveTransactions: false,
              },
            ],
          ],
        }) as never,
      )

      const result = await caller.listings.list({ limit: 1 })

      expect(result.summary).toEqual({
        totalListings: 8,
        activeListings: 5,
        inactiveListings: 3,
      })
      expect(result.listings).toHaveLength(1)
      expect(result.listings[0]).toMatchObject({
        id: LISTING_ID,
        numericId: 42,
        status: "DEACTIVATED_BY_ADMIN",
        statusLabel: "Deactivated by Admin",
        hasActiveTransactions: true,
        owner: {
          id: "owner-1",
          name: "Owner One",
          username: "owner1",
          email: "owner1@up.edu.ph",
        },
      })
      expect(result.nextCursor).toEqual({
        id: LISTING_ID,
        createdAt: new Date("2026-05-01T10:00:00.000Z"),
      })
    })
  })

  describe("listings.deactivate", () => {
    it("updates admin moderation fields and writes an audit log", async () => {
      const executeRaw = vi.fn().mockResolvedValue(1)
      const caller = adminRouter.createCaller(
        makeContext({
          queryResults: [
            [
              {
                id: LISTING_ID,
                numericId: 42,
                name: "DSLR Camera",
                lenderId: "owner-1",
                adminModerationState: null,
                hasActiveTransactions: true,
              },
            ],
          ],
          executeRaw,
        }) as never,
      )

      const result = await caller.listings.deactivate({ id: LISTING_ID, confirmation: true })

      expect(result).toMatchObject({
        id: LISTING_ID,
        status: "DEACTIVATED",
        adminModerationState: "DEACTIVATED",
      })
      expect(executeRaw).toHaveBeenCalledTimes(2)
    })
  })

  describe("listings.remove", () => {
    it("blocks removal when active transactions exist", async () => {
      const caller = adminRouter.createCaller(
        makeContext({
          queryResults: [
            [
              {
                id: LISTING_ID,
                numericId: 42,
                name: "DSLR Camera",
                lenderId: "owner-1",
                hasActiveTransactions: true,
              },
            ],
          ],
        }) as never,
      )

      await expect(
        caller.listings.remove({ id: LISTING_ID, confirmation: true }),
      ).rejects.toMatchObject<Partial<TRPCError>>({
        code: "BAD_REQUEST",
        message: "This listing cannot be removed because it has active or upcoming transactions.",
      })
    })
  })

  describe("logs.list", () => {
    it("returns mapped audit rows", async () => {
      const caller = adminRouter.createCaller(
        makeContext({
          queryResults: [
            [
              {
                id: "log-1",
                actionType: "DEACTIVATE_LISTING",
                targetType: "LISTING",
                targetId: LISTING_ID,
                targetLabel: "DSLR Camera",
                description: "Deactivated listing #42",
                metadata: { listingNumericId: 42 },
                createdAt: new Date("2026-05-04T08:00:00.000Z"),
                adminId: ADMIN_ID,
                adminUsername: "admin1",
                adminEmail: "admin@up.edu.ph",
                adminFirstName: "Admin",
                adminLastName: "User",
              },
            ],
          ],
        }) as never,
      )

      const result = await caller.logs.list({ targetType: "LISTING", limit: 20 })

      expect(result.logs).toEqual([
        {
          id: "log-1",
          actionType: "DEACTIVATE_LISTING",
          targetType: "LISTING",
          targetId: LISTING_ID,
          targetLabel: "DSLR Camera",
          description: "Deactivated listing #42",
          metadata: { listingNumericId: 42 },
          createdAt: new Date("2026-05-04T08:00:00.000Z"),
          admin: {
            id: ADMIN_ID,
            name: "Admin User",
            username: "admin1",
            email: "admin@up.edu.ph",
          },
        },
      ])
      expect(result.nextCursor).toBeNull()
    })
  })
})
