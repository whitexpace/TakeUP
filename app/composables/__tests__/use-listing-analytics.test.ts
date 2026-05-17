import { ref } from "vue"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  useListingAnalytics,
  type ListingAnalyticsPreviewResponse,
  type ListingAnalyticsResponse,
} from "../use-listing-analytics"

vi.mock("#app", () => ({
  useState: (key: string, init: () => unknown) =>
    (
      globalThis as unknown as {
        useState: (stateKey: string, stateInit: () => unknown) => ReturnType<typeof ref>
      }
    ).useState(key, init),
}))

vi.mock("../use-viewer-session", () => ({
  useViewerSession: () => ({
    getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer token-123" }),
  }),
}))

const createStateMock = () => {
  const store = new Map<string, ReturnType<typeof ref>>()

  return (key: string, init: () => unknown) => {
    if (!store.has(key)) {
      store.set(key, ref(init()))
    }

    return store.get(key)!
  }
}

const makeAnalyticsResponse = (): ListingAnalyticsResponse => ({
  summary: {
    totalViews: 10,
    totalBookings: 2,
    totalBookingRequests: 5,
    totalCompletedTransactions: 1,
    totalRevenue: 250,
    availabilityDays: 12,
    bookedDays: 3,
    bookingRate: 20,
    completionRate: 50,
    utilizationRate: 25,
    overallItemRating: 4.5,
  },
  listings: [
    {
      listingId: "item-1",
      itemName: "Wireless Mouse",
      status: "AVAILABLE",
      rating: 4.5,
      rentalFee: 500,
      freeToBorrow: false,
      thumbnailImage: null,
      categories: ["ELECTRONICS"],
      totalViews: 10,
      totalBookings: 2,
      totalBookingRequests: 5,
      totalCompletedTransactions: 1,
      totalRevenue: 250,
      availabilityDays: 12,
      bookedDays: 3,
      bookingRate: 20,
      completionRate: 50,
      utilizationRate: 25,
    },
  ],
  topViewedItems: [
    {
      itemId: "item-1",
      name: "Wireless Mouse",
      thumbnailImage: null,
      viewCount: 10,
      bookingCount: 2,
      rentalFee: 500,
      freeToBorrow: false,
    },
  ],
  topRequestedItems: [
    {
      itemId: "item-1",
      name: "Wireless Mouse",
      thumbnailImage: null,
      requestCount: 5,
      bookingCount: 2,
      rentalFee: 500,
      freeToBorrow: false,
    },
  ],
  topBookedItems: [
    {
      itemId: "item-1",
      name: "Wireless Mouse",
      thumbnailImage: null,
      bookingCount: 2,
      rentalFee: 500,
      freeToBorrow: false,
    },
  ],
  itemRatings: [
    {
      itemId: "item-1",
      name: "Wireless Mouse",
      thumbnailImage: null,
      rating: 4.5,
      bookingCount: 2,
      rentalFee: 500,
      freeToBorrow: false,
    },
  ],
  categoryBreakdown: [{ category: "ELECTRONICS", count: 1 }],
  range: "all",
})

const makeAnalyticsPreviewResponse = (): ListingAnalyticsPreviewResponse => ({
  summary: makeAnalyticsResponse().summary,
  listingCount: 1,
  chartItems: [
    {
      listingId: "item-1",
      itemName: "Wireless Mouse",
      thumbnailImage: null,
      totalViews: 10,
      totalBookings: 2,
      totalRevenue: 250,
    },
  ],
  topItems: [
    {
      listingId: "item-1",
      itemName: "Wireless Mouse",
      thumbnailImage: null,
      totalViews: 10,
      totalBookings: 2,
      totalRevenue: 250,
    },
  ],
  range: "all",
})

describe("useListingAnalytics", () => {
  beforeEach(() => {
    vi.stubGlobal("useState", createStateMock())
    vi.stubGlobal("navigateTo", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("fetches listing analytics and exposes derived state including ranked lists", async () => {
    const response = makeAnalyticsResponse()
    const fetchMock = vi.fn().mockResolvedValue(response)
    vi.stubGlobal("$fetch", fetchMock)

    const {
      fetchAnalytics,
      listings,
      summary,
      categoryBreakdown,
      topViewedItems,
      topRequestedItems,
      topBookedItems,
      itemRatings,
      hasListings,
      hasActivity,
    } = useListingAnalytics()
    await fetchAnalytics()

    expect(fetchMock).toHaveBeenCalledWith("/api/account/listing-analytics", {
      query: { range: "all" },
      headers: { Authorization: "Bearer token-123" },
      credentials: "same-origin",
    })
    expect(summary.value?.totalViews).toBe(10)
    expect(summary.value?.totalBookingRequests).toBe(5)
    expect(summary.value?.overallItemRating).toBe(4.5)
    expect(listings.value).toHaveLength(1)
    expect(categoryBreakdown.value).toEqual([{ category: "ELECTRONICS", count: 1 }])
    expect(topViewedItems.value).toHaveLength(1)
    expect(topRequestedItems.value).toHaveLength(1)
    expect(topBookedItems.value).toHaveLength(1)
    expect(itemRatings.value).toHaveLength(1)
    expect(hasListings.value).toBe(true)
    expect(hasActivity.value).toBe(true)
  })

  it("fetches top analytics preview before the full listing analytics payload", async () => {
    const response = makeAnalyticsPreviewResponse()
    const fetchMock = vi.fn().mockResolvedValue(response)
    vi.stubGlobal("$fetch", fetchMock)

    const {
      fetchAnalyticsTop,
      summary,
      listingCount,
      previewChartItems,
      previewTopItems,
      hasTopFetched,
    } = useListingAnalytics()

    await fetchAnalyticsTop()

    expect(fetchMock).toHaveBeenCalledWith("/api/account/listing-analytics/top", {
      query: { range: "all" },
      headers: { Authorization: "Bearer token-123" },
      credentials: "same-origin",
    })
    expect(hasTopFetched.value).toBe(true)
    expect(summary.value?.totalViews).toBe(10)
    expect(listingCount.value).toBe(1)
    expect(previewChartItems.value).toHaveLength(1)
    expect(previewTopItems.value).toHaveLength(1)
  })

  it("refetches analytics when the selected date range changes", async () => {
    const response = makeAnalyticsResponse()
    const fetchMock = vi.fn().mockResolvedValue(response)
    vi.stubGlobal("$fetch", fetchMock)

    const { selectedRange, setRange } = useListingAnalytics()
    await setRange("30d")

    expect(selectedRange.value).toBe("30d")
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/listing-analytics",
      expect.objectContaining({
        query: { range: "30d" },
      }),
    )
  })

  it("sets a friendly error when fetching fails", async () => {
    vi.stubGlobal("$fetch", vi.fn().mockRejectedValue(new Error("Network error")))

    const { fetchAnalytics, error, hasFetched } = useListingAnalytics()
    await fetchAnalytics()

    expect(error.value).toBe("Unable to load listing analytics. Please try again.")
    expect(hasFetched.value).toBe(true)
  })

  it("redirects to home when the analytics endpoint returns unauthorized", async () => {
    const navigateTo = vi.fn()
    vi.stubGlobal("navigateTo", navigateTo)
    vi.stubGlobal("$fetch", vi.fn().mockRejectedValue({ statusCode: 401 }))

    const { fetchAnalytics } = useListingAnalytics()
    await fetchAnalytics()

    expect(navigateTo).toHaveBeenCalledWith("/")
  })
})
