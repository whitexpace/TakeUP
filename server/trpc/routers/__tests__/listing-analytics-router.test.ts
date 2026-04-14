import { TRPCError } from "@trpc/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { listingAnalyticsRouter } from "../listing-analytics"

const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const ITEM_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const DEACTIVATED_ITEM_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"

const mockUser = { id: USER_ID, email: "lender@up.edu.ph", name: "Lender" }

const makeContext = ({
  itemFindMany = vi.fn().mockResolvedValue([]),
  bookingFindMany = vi.fn().mockResolvedValue([]),
  rentalTransactionFindMany = vi.fn().mockResolvedValue([]),
  itemAvailabilityFindMany = vi.fn().mockResolvedValue([]),
  user = mockUser,
} = {}) => ({
  event: { context: {} } as never,
  prisma: {
    item: { findMany: itemFindMany },
    booking: { findMany: bookingFindMany },
    rentalTransaction: { findMany: rentalTransactionFindMany },
    itemAvailability: { findMany: itemAvailabilityFindMany },
  } as never,
  user,
})

const makeListing = (overrides: Record<string, unknown> = {}) => ({
  id: ITEM_ID,
  name: "Wireless Mouse",
  status: "AVAILABLE",
  viewCount: 120,
  images: [{ path: "https://example.com/mouse.jpg", isPrimary: true, sortOrder: 0 }],
  categories: [{ category: "ELECTRONICS" }],
  ...overrides,
})

describe("listingAnalyticsRouter", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("throws UNAUTHORIZED when the user is not authenticated", async () => {
    const caller = listingAnalyticsRouter.createCaller(makeContext({ user: null as never }))

    await expect(caller.list()).rejects.toThrow(TRPCError)
    await expect(caller.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("scopes listing analytics to current lender-owned non-deleted listings", async () => {
    const itemFindMany = vi.fn().mockResolvedValue([])
    const caller = listingAnalyticsRouter.createCaller(makeContext({ itemFindMany }))

    await caller.list()

    expect(itemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          lenderId: USER_ID,
          status: { not: "DELETED" },
        },
      }),
    )
  })

  it("returns an empty analytics response when the lender has no listings", async () => {
    const caller = listingAnalyticsRouter.createCaller(makeContext())

    const result = await caller.list()

    expect(result).toEqual({
      summary: {
        totalViews: 0,
        totalBookings: 0,
        totalCompletedTransactions: 0,
        totalRevenue: 0,
        availabilityDays: 0,
        bookedDays: 0,
        bookingRate: 0,
        completionRate: 0,
        utilizationRate: 0,
      },
      listings: [],
      categoryBreakdown: [],
      range: "all",
    })
  })

  it("counts only accepted bookings and completed transactions while preserving deactivated listings", async () => {
    const itemFindMany = vi.fn().mockResolvedValue([
      makeListing(),
      makeListing({
        id: DEACTIVATED_ITEM_ID,
        name: "Old Camera",
        status: "DEACTIVATED",
        viewCount: 0,
        images: [],
        categories: [{ category: "ELECTRONICS" }, { category: "TOOLS" }],
      }),
    ])
    const bookingFindMany = vi.fn().mockResolvedValue([
      {
        itemId: ITEM_ID,
        startDate: new Date("2026-04-01T00:00:00.000Z"),
        endDate: new Date("2026-04-04T00:00:00.000Z"),
      },
      {
        itemId: ITEM_ID,
        startDate: new Date("2026-04-03T00:00:00.000Z"),
        endDate: new Date("2026-04-06T00:00:00.000Z"),
      },
    ])
    const rentalTransactionFindMany = vi.fn().mockResolvedValue([
      { itemId: ITEM_ID, rentalFee: 100.5 },
      { itemId: ITEM_ID, rentalFee: 200 },
    ])
    const itemAvailabilityFindMany = vi.fn().mockResolvedValue([
      {
        itemId: ITEM_ID,
        startDate: new Date("2026-04-01T00:00:00.000Z"),
        endDate: new Date("2026-04-04T00:00:00.000Z"),
      },
      {
        itemId: ITEM_ID,
        startDate: new Date("2026-04-03T00:00:00.000Z"),
        endDate: new Date("2026-04-05T00:00:00.000Z"),
      },
      {
        itemId: ITEM_ID,
        startDate: new Date("2026-04-06T00:00:00.000Z"),
        endDate: new Date("2026-04-07T00:00:00.000Z"),
      },
    ])

    const caller = listingAnalyticsRouter.createCaller(
      makeContext({
        itemFindMany,
        bookingFindMany,
        rentalTransactionFindMany,
        itemAvailabilityFindMany,
      }),
    )

    const result = await caller.list()

    expect(bookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lenderId: USER_ID,
          itemId: { in: [ITEM_ID, DEACTIVATED_ITEM_ID] },
          status: { in: ["CONFIRMED", "RETURNED", "COMPLETED", "IN_DISPUTE"] },
        }),
      }),
    )
    expect(rentalTransactionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lenderId: USER_ID,
          itemId: { in: [ITEM_ID, DEACTIVATED_ITEM_ID] },
          status: "COMPLETED",
        }),
      }),
    )

    expect(result.listings).toHaveLength(2)
    expect(result.listings[0]).toMatchObject({
      listingId: ITEM_ID,
      itemName: "Wireless Mouse",
      totalViews: 120,
      totalBookings: 2,
      totalCompletedTransactions: 2,
      totalRevenue: 300.5,
      availabilityDays: 5,
      bookedDays: 5,
      bookingRate: 1.7,
      completionRate: 100,
      utilizationRate: 100,
    })
    expect(result.listings[1]).toMatchObject({
      listingId: DEACTIVATED_ITEM_ID,
      status: "DEACTIVATED",
      totalViews: 0,
      totalBookings: 0,
      totalCompletedTransactions: 0,
      totalRevenue: 0,
    })
    expect(result.summary).toMatchObject({
      totalViews: 120,
      totalBookings: 2,
      totalCompletedTransactions: 2,
      totalRevenue: 300.5,
      availabilityDays: 5,
      bookedDays: 5,
    })
    expect(result.categoryBreakdown).toEqual([
      { category: "ELECTRONICS", count: 2 },
      { category: "TOOLS", count: 1 },
    ])
  })

  it("filters booking, transaction, and availability metrics by the selected date range", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-14T12:00:00.000Z"))

    const itemFindMany = vi.fn().mockResolvedValue([makeListing()])
    const bookingFindMany = vi.fn().mockResolvedValue([])
    const rentalTransactionFindMany = vi.fn().mockResolvedValue([])
    const itemAvailabilityFindMany = vi.fn().mockResolvedValue([])

    const caller = listingAnalyticsRouter.createCaller(
      makeContext({
        itemFindMany,
        bookingFindMany,
        rentalTransactionFindMany,
        itemAvailabilityFindMany,
      }),
    )

    await caller.list({ range: "7d" })

    const expectedStart = new Date("2026-04-08T00:00:00.000Z")
    expect(bookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          requestedAt: { gte: expectedStart },
        }),
      }),
    )
    expect(rentalTransactionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          updatedAt: { gte: expectedStart },
        }),
      }),
    )
    expect(itemAvailabilityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          endDate: { gte: expectedStart },
          startDate: { lte: new Date("2026-04-14T12:00:00.000Z") },
        }),
      }),
    )
  })
})
