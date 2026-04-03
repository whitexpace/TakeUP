import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { MyListingItem } from "../use-my-listings"
import { useMyListings } from "../use-my-listings"
import * as paginatedItemsModule from "../use-paginated-items"
import * as filteredResultsCountModule from "../use-filtered-results-count"

let fetchMock: ReturnType<typeof vi.fn>

const ITEM_ID = "11111111-1111-1111-1111-111111111111"

const makeItem = (id = ITEM_ID) =>
  ({
    id,
    numericId: 1,
    name: "Test Item",
    status: "AVAILABLE",
    displayStatus: "ACTIVE",
    hasActiveDispute: false,
    lenderId: "owner-1",
    freeToBorrow: false,
    rateOption: "PER_DAY",
    rentalFee: 100,
    replacementCost: null,
    images: [],
    thumbnailImage: null,
    photos: [],
    categories: ["ELECTRONICS"],
    tags: [],
    availability: [],
    rating: 0,
    bookingCount: 0,
    viewCount: 0,
    likeCount: 0,
    isTrending: false,
    ownerName: "Test Lender",
    isLiked: false,
    description: null,
    condition: "GOOD",
    whatItemOffers: null,
    whatIsIncluded: null,
    knownIssues: null,
    usageLimitations: null,
    createdAt: new Date("2026-03-15"),
    updatedAt: new Date("2026-03-15"),
    borrowerId: null,
  }) as MyListingItem

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal("$fetch", fetchMock)
  vi.stubGlobal("navigateTo", vi.fn())
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useMyListings", () => {
  it("fetches listings and populates the listings ref", async () => {
    fetchMock = vi.fn().mockResolvedValue({ items: [makeItem()], nextCursor: null })
    vi.stubGlobal("$fetch", fetchMock)

    const { listings, fetchListings } = useMyListings()
    await fetchListings()

    expect(listings.value).toHaveLength(1)
    expect(listings.value[0]!.id).toBe(ITEM_ID)
  })

  it("includes active filters in the API query", async () => {
    fetchMock = vi.fn().mockResolvedValue({ items: [makeItem()], nextCursor: null })
    vi.stubGlobal("$fetch", fetchMock)

    const { setSearchQuery, toggleStatusFilter, toggleCategoryFilter, refresh } = useMyListings()

    setSearchQuery("camera")
    toggleStatusFilter("DISPUTED")
    toggleCategoryFilter("ELECTRONICS")
    await refresh()

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/my-listings",
      expect.objectContaining({
        query: expect.objectContaining({
          search: "camera",
          statuses: ["DISPUTED"],
          categories: ["ELECTRONICS"],
        }),
      }),
    )
  })

  it("sets hasMore to true when nextCursor is returned", async () => {
    fetchMock = vi.fn().mockResolvedValue({
      items: [makeItem()],
      nextCursor: { id: ITEM_ID, createdAt: new Date() },
    })
    vi.stubGlobal("$fetch", fetchMock)

    const { hasMore, fetchListings } = useMyListings()
    await fetchListings()

    expect(hasMore.value).toBe(true)
  })

  it("appends items when loading more with cursor", async () => {
    const item2Id = "22222222-2222-2222-2222-222222222222"
    fetchMock = vi.fn().mockResolvedValue({ items: [makeItem(item2Id)], nextCursor: null })
    vi.stubGlobal("$fetch", fetchMock)

    const { listings, fetchListings } = useMyListings()
    listings.value = [makeItem()]
    await fetchListings({ id: ITEM_ID, createdAt: new Date() }, true)

    expect(listings.value).toHaveLength(2)
  })

  it("sets error message when fetch fails", async () => {
    fetchMock = vi.fn().mockRejectedValue(new Error("Network error"))
    vi.stubGlobal("$fetch", fetchMock)

    const { error, fetchListings } = useMyListings()
    await fetchListings()

    expect(error.value).toBeTruthy()
  })

  it("redirects to / when server returns 401", async () => {
    const navTo = vi.fn()
    vi.stubGlobal("navigateTo", navTo)
    fetchMock = vi.fn().mockRejectedValue({ statusCode: 401 })
    vi.stubGlobal("$fetch", fetchMock)

    const { fetchListings } = useMyListings()
    await fetchListings()

    expect(navTo).toHaveBeenCalledWith("/")
  })

  it("clearFilters resets search and selected filters", () => {
    const {
      setSearchQuery,
      toggleStatusFilter,
      toggleCategoryFilter,
      clearFilters,
      hasActiveFilters,
    } = useMyListings()

    setSearchQuery("camera")
    toggleStatusFilter("INACTIVE")
    toggleCategoryFilter("BOOKS")
    clearFilters()

    expect(hasActiveFilters.value).toBe(false)
  })

  it("refreshes after filter changes once listings have been loaded", async () => {
    fetchMock = vi.fn().mockResolvedValue({ items: [makeItem()], nextCursor: null })
    vi.stubGlobal("$fetch", fetchMock)

    const { refresh, toggleStatusFilter } = useMyListings()
    await refresh()

    fetchMock.mockClear()
    toggleStatusFilter("DISPUTED")
    await vi.runAllTimersAsync()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/my-listings",
      expect.objectContaining({
        query: expect.objectContaining({
          statuses: ["DISPUTED"],
        }),
      }),
    )
  })

  it("toggleStatus invalidates item search caches and refreshes filtered listings", async () => {
    const resetPaginatedItemsCache = vi.spyOn(paginatedItemsModule, "resetPaginatedItemsCache")
    const resetFilteredResultsCountCache = vi.spyOn(
      filteredResultsCountModule,
      "resetFilteredResultsCountCache",
    )

    fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ items: [makeItem()], nextCursor: null })
      .mockResolvedValueOnce({ ...makeItem(), status: "DEACTIVATED", displayStatus: "INACTIVE" })
      .mockResolvedValueOnce({
        items: [{ ...makeItem(), status: "DEACTIVATED", displayStatus: "INACTIVE" }],
        nextCursor: null,
      })
    vi.stubGlobal("$fetch", fetchMock)

    const { toggleStatus, refresh } = useMyListings()
    await refresh()
    await toggleStatus(ITEM_ID, "DEACTIVATED")

    expect(resetPaginatedItemsCache).toHaveBeenCalledTimes(1)
    expect(resetFilteredResultsCountCache).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/items/${ITEM_ID}/status`,
      expect.objectContaining({ method: "PATCH", body: { status: "DEACTIVATED" } }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/my-listings",
      expect.objectContaining({
        query: {},
      }),
    )
  })

  it("deleteListing invalidates item search caches and refreshes filtered listings", async () => {
    const resetPaginatedItemsCache = vi.spyOn(paginatedItemsModule, "resetPaginatedItemsCache")
    const resetFilteredResultsCountCache = vi.spyOn(
      filteredResultsCountModule,
      "resetFilteredResultsCountCache",
    )

    fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ items: [makeItem()], nextCursor: null })
      .mockResolvedValueOnce({ ...makeItem(), status: "DELETED" })
      .mockResolvedValueOnce({ items: [], nextCursor: null })
    vi.stubGlobal("$fetch", fetchMock)

    const { deleteListing, refresh, listings } = useMyListings()
    await refresh()
    await deleteListing(ITEM_ID)

    expect(resetPaginatedItemsCache).toHaveBeenCalledTimes(1)
    expect(resetFilteredResultsCountCache).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/items/${ITEM_ID}`,
      expect.objectContaining({ method: "DELETE" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/my-listings",
      expect.objectContaining({
        query: {},
      }),
    )
    expect(listings.value).toEqual([])
  })

  it("refresh marks the initial fetch as loaded after completing", async () => {
    fetchMock = vi.fn().mockResolvedValue({ items: [makeItem()], nextCursor: null })
    vi.stubGlobal("$fetch", fetchMock)

    const { hasFetched, refresh } = useMyListings()

    expect(hasFetched.value).toBe(false)

    await refresh()

    expect(hasFetched.value).toBe(true)
  })
})
