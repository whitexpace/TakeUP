import { Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  collectDistinctUserIds,
  getAdminOverview,
  summarizeNonZeroAverage,
} from "../admin-overview"
import { getSystemCommissionAudit, runSystemWalletSelfHealing } from "../wallet"

vi.mock("../wallet", () => ({
  getSystemCommissionAudit: vi.fn(),
  runSystemWalletSelfHealing: vi.fn(),
}))

const createMockPrisma = () => ({
  user: {
    count: vi.fn(),
  },
  rentalTransaction: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  item: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  borrower: {
    findMany: vi.fn(),
  },
  lender: {
    findMany: vi.fn(),
  },
  booking: {
    findMany: vi.fn(),
  },
  transactionDispute: {
    findMany: vi.fn(),
  },
  requestPost: {
    findMany: vi.fn(),
  },
  message: {
    findMany: vi.fn(),
  },
})

describe("admin overview helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("collects distinct user ids across activity sources", () => {
    expect(
      collectDistinctUserIds(
        ["user-1", "user-2", null],
        ["user-2", undefined, "user-3"],
        ["", "user-1"],
      ),
    ).toEqual(["user-1", "user-2", "user-3"])
  })

  it("summarizes ratings while ignoring zero-default values", () => {
    expect(summarizeNonZeroAverage([0, null, 4.5, 3.5, undefined])).toEqual({
      average: 4,
      count: 2,
    })

    expect(summarizeNonZeroAverage([0, null, undefined])).toEqual({
      average: null,
      count: 0,
    })
  })

  it("builds the overview payload from aggregated platform data", async () => {
    const prisma = createMockPrisma()

    prisma.user.count.mockResolvedValueOnce(25).mockResolvedValueOnce(7)

    prisma.rentalTransaction.count
      .mockResolvedValueOnce(18)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(2)

    prisma.item.count.mockResolvedValueOnce(30).mockResolvedValueOnce(11)

    prisma.borrower.findMany.mockResolvedValue([{ borrowerRating: 4.5 }, { borrowerRating: 3.5 }])
    prisma.lender.findMany.mockResolvedValue([{ lenderRating: 5 }, { lenderRating: 4 }])

    prisma.booking.findMany
      .mockResolvedValueOnce([{ borrowerId: "u1" }, { borrowerId: "u2" }])
      .mockResolvedValueOnce([{ lenderId: "u3" }])

    prisma.rentalTransaction.findMany
      .mockResolvedValueOnce([{ borrowerId: "u2" }, { borrowerId: "u4" }])
      .mockResolvedValueOnce([{ lenderId: "u1" }, { lenderId: "u5" }])
      .mockResolvedValueOnce([
        {
          id: "tx-1",
          bookingId: "booking-1",
          status: "COMPLETED",
          createdAt: new Date("2026-05-04T01:00:00.000Z"),
          totalAmount: new Prisma.Decimal(1250),
          item: { name: "Camera Kit" },
          borrower: { firstName: "Borrower", lastName: "One" },
          lender: { firstName: "Lender", lastName: "One" },
        },
      ])

    prisma.transactionDispute.findMany
      .mockResolvedValueOnce([{ raisedById: "u6" }])
      .mockResolvedValueOnce([
        {
          id: "dispute-1",
          transactionId: "tx-1",
          reason: "Missing accessory",
          status: "OPEN",
          createdAt: new Date("2026-05-03T01:00:00.000Z"),
          raisedBy: { firstName: "Borrower", lastName: "One" },
          transaction: { item: { name: "Camera Kit" } },
        },
      ])

    prisma.item.findMany
      .mockResolvedValueOnce([{ lenderId: "u7" }])
      .mockResolvedValueOnce([
        {
          id: "item-1",
          name: "Mirrorless Camera",
          rating: 4.9,
          bookingCount: 12,
          images: [{ path: "/images/camera.jpg" }],
          _count: { transactionReviews: 9 },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "item-2",
          name: "Tripod",
          status: "AVAILABLE",
          rating: 4.2,
          bookingCount: 3,
          createdAt: new Date("2026-05-02T01:00:00.000Z"),
          images: [{ path: "/images/tripod.jpg" }],
        },
      ])

    prisma.requestPost.findMany.mockResolvedValue([{ requesterId: "u8" }])
    prisma.message.findMany.mockResolvedValue([{ senderUserId: "u1" }, { senderUserId: "u9" }])

    vi.mocked(runSystemWalletSelfHealing).mockResolvedValue(undefined)
    vi.mocked(getSystemCommissionAudit).mockResolvedValue({
      summary: {
        totalCommissionCollected: 320,
        currentCommissionBalance: 85,
        commissionTransactionCount: 10,
        currency: "PHP",
      },
      records: [],
      nextCursor: null,
    })

    const overview = await getAdminOverview(prisma as never)

    expect(runSystemWalletSelfHealing).toHaveBeenCalled()
    expect(getSystemCommissionAudit).toHaveBeenCalledWith(undefined, { limit: 1 })
    expect(overview.summary).toMatchObject({
      totalUsers: 25,
      activeUsers: 7,
      totalTransactions: 18,
      activeTransactions: 6,
      completedTransactions: 8,
      disputedTransactions: 2,
      totalListings: 30,
      activeListings: 11,
      totalCommissionCollected: 320,
      currentSystemWalletBalance: 85,
      currency: "PHP",
    })
    expect(overview.summary.activeUsersDefinition).toContain("last 30 days")
    expect(overview.ratings).toEqual({
      averageBorrowerRating: 4,
      ratedBorrowerCount: 2,
      averageLenderRating: 4.5,
      ratedLenderCount: 2,
    })
    expect(overview.topItems).toEqual([
      {
        id: "item-1",
        name: "Mirrorless Camera",
        averageRating: 4.9,
        reviewCount: 9,
        bookingCount: 12,
        thumbnailImage: "/images/camera.jpg",
      },
    ])
    expect(overview.previews.recentTransactions).toEqual([
      expect.objectContaining({
        id: "tx-1",
        itemName: "Camera Kit",
        status: "COMPLETED",
        totalAmount: 1250,
      }),
    ])
    expect(overview.previews.recentDisputes).toEqual([
      expect.objectContaining({
        id: "dispute-1",
        itemName: "Camera Kit",
        status: "OPEN",
      }),
    ])
    expect(overview.previews.recentListings).toEqual([
      expect.objectContaining({
        id: "item-2",
        name: "Tripod",
        thumbnailImage: "/images/tripod.jpg",
      }),
    ])
    expect(overview.generatedAt).toBeInstanceOf(Date)
  })
})
