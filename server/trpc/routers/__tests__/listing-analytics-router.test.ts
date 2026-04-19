import { TRPCError } from "@trpc/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { listingAnalyticsRouter } from "../listing-analytics"

const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const ITEM_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const DEACTIVATED_ITEM_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"
const ITEM_C_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd"

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
  rating: 4.5,
  rentalFee: 500,
  freeToBorrow: false,
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
        totalBookingRequests: 0,
        totalCompletedTransactions: 0,
        totalRevenue: 0,
        availabilityDays: 0,
        bookedDays: 0,
        bookingRate: 0,
        completionRate: 0,
        utilizationRate: 0,
        overallItemRating: 0,
      },
      listings: [],
      topViewedItems: [],
      topRequestedItems: [],
      topBookedItems: [],
      itemRatings: [],
      categoryBreakdown: [],
      range: "all",
    })
  })

  it("counts accepted bookings, booking requests, and completed transactions while preserving deactivated listings", async () => {
    const itemFindMany = vi.fn().mockResolvedValue([
      makeListing(),
      makeListing({
        id: DEACTIVATED_ITEM_ID,
        name: "Old Camera",
        status: "DEACTIVATED",
        viewCount: 0,
        rating: 0,
        rentalFee: 0,
        freeToBorrow: true,
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

    // booking.findMany is called twice: once for accepted bookings, once for all non-cancelled requests
    expect(bookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["CONFIRMED", "RETURNED", "COMPLETED", "IN_DISPUTE"] },
        }),
      }),
    )
    expect(bookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["PENDING", "CONFIRMED", "RETURNED", "COMPLETED", "IN_DISPUTE"] },
        }),
      }),
    )

    expect(result.listings).toHaveLength(2)
    expect(result.listings[0]).toMatchObject({
      listingId: ITEM_ID,
      itemName: "Wireless Mouse",
      totalViews: 120,
      totalBookings: 2,
      totalBookingRequests: 2,
      totalCompletedTransactions: 2,
      totalRevenue: 300.5,
      rating: 4.5,
    })
    expect(result.listings[1]).toMatchObject({
      listingId: DEACTIVATED_ITEM_ID,
      status: "DEACTIVATED",
      totalViews: 0,
      totalBookings: 0,
      totalBookingRequests: 0,
      rating: 0,
    })
    expect(result.summary).toMatchObject({
      totalViews: 120,
      totalBookings: 2,
      totalBookingRequests: 2,
      totalCompletedTransactions: 2,
      totalRevenue: 300.5,
      overallItemRating: 4.5,
    })
  })

  it("computes overallItemRating as the average of rated items only", async () => {
    const itemFindMany = vi.fn().mockResolvedValue([
      makeListing({ rating: 4.8 }),
      makeListing({
        id: DEACTIVATED_ITEM_ID,
        name: "Camera",
        rating: 3.2,
        viewCount: 10,
        images: [],
        categories: [],
      }),
      makeListing({
        id: ITEM_C_ID,
        name: "Unrated Item",
        rating: 0,
        viewCount: 5,
        images: [],
        categories: [],
      }),
    ])
    const bookingFindMany = vi.fn().mockResolvedValue([])
    const caller = listingAnalyticsRouter.createCaller(
      makeContext({ itemFindMany, bookingFindMany }),
    )

    const result = await caller.list()

    // Average of 4.8 and 3.2 = 4.0 (item with rating 0 excluded)
    expect(result.summary.overallItemRating).toBe(4)
  })

  it("returns ranked lists sorted by respective metrics", async () => {
    const itemFindMany = vi.fn().mockResolvedValue([
      makeListing({ id: ITEM_ID, viewCount: 200, rating: 4.5 }),
      makeListing({
        id: DEACTIVATED_ITEM_ID,
        name: "Camera",
        viewCount: 50,
        rating: 4.9,
        images: [],
        categories: [],
      }),
    ])
    // Return booking requests for ranking
    const bookingFindMany = vi
      .fn()
      .mockImplementation((args: { where: { status: { in: string[] } } }) => {
        if (args.where.status.in.includes("PENDING")) {
          // Non-cancelled requests query
          return Promise.resolve([
            { itemId: ITEM_ID },
            { itemId: ITEM_ID },
            { itemId: ITEM_ID },
            { itemId: DEACTIVATED_ITEM_ID },
          ])
        }
        // Accepted bookings query (with date ranges)
        return Promise.resolve([
          {
            itemId: ITEM_ID,
            startDate: new Date("2026-04-01"),
            endDate: new Date("2026-04-03"),
          },
          {
            itemId: DEACTIVATED_ITEM_ID,
            startDate: new Date("2026-04-01"),
            endDate: new Date("2026-04-02"),
          },
          {
            itemId: DEACTIVATED_ITEM_ID,
            startDate: new Date("2026-04-03"),
            endDate: new Date("2026-04-04"),
          },
        ])
      })

    const caller = listingAnalyticsRouter.createCaller(
      makeContext({ itemFindMany, bookingFindMany }),
    )

    const result = await caller.list()

    // Top viewed: ITEM_ID (200) before DEACTIVATED_ITEM_ID (50)
    expect(result.topViewedItems).toHaveLength(2)
    expect(result.topViewedItems[0]!.itemId).toBe(ITEM_ID)
    expect(result.topViewedItems[0]!.viewCount).toBe(200)

    // Top requested: ITEM_ID (3 requests) before DEACTIVATED_ITEM_ID (1)
    expect(result.topRequestedItems).toHaveLength(2)
    expect(result.topRequestedItems[0]!.itemId).toBe(ITEM_ID)
    expect(result.topRequestedItems[0]!.requestCount).toBe(3)

    // Top booked: DEACTIVATED_ITEM_ID (2 bookings) before ITEM_ID (1)
    expect(result.topBookedItems).toHaveLength(2)
    expect(result.topBookedItems[0]!.itemId).toBe(DEACTIVATED_ITEM_ID)
    expect(result.topBookedItems[0]!.bookingCount).toBe(2)

    // Item ratings: Camera (4.9) before Wireless Mouse (4.5)
    expect(result.itemRatings).toHaveLength(2)
    expect(result.itemRatings[0]!.rating).toBe(4.9)
    expect(result.itemRatings[1]!.rating).toBe(4.5)
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

  it("returns empty ranked lists when no items have activity", async () => {
    const itemFindMany = vi.fn().mockResolvedValue([makeListing({ viewCount: 0, rating: 0 })])
    const bookingFindMany = vi.fn().mockResolvedValue([])

    const caller = listingAnalyticsRouter.createCaller(
      makeContext({ itemFindMany, bookingFindMany }),
    )

    const result = await caller.list()

    expect(result.topViewedItems).toEqual([])
    expect(result.topRequestedItems).toEqual([])
    expect(result.topBookedItems).toEqual([])
    expect(result.itemRatings).toEqual([])
    expect(result.summary.overallItemRating).toBe(0)
  })
})
