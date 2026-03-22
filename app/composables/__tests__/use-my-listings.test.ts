import { describe, it, expect, vi, beforeEach } from "vitest"
import type { MyListingItem } from "../use-my-listings"
import { useMyListings } from "../use-my-listings"

let fetchMock: ReturnType<typeof vi.fn>

const ITEM_ID = "11111111-1111-1111-1111-111111111111"

const makeItem = (id = ITEM_ID) =>
  ({
    id,
    name: "Test Item",
    status: "AVAILABLE",
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

  it("updateListing replaces item in listings array", async () => {
    const updated = { ...makeItem(), name: "Updated Name" }
    fetchMock = vi.fn().mockResolvedValue(updated)
    vi.stubGlobal("$fetch", fetchMock)

    const { listings, updateListing } = useMyListings()
    listings.value = [makeItem()]

    await updateListing(ITEM_ID, { name: "Updated Name" })

    expect(listings.value[0]!.name).toBe("Updated Name")
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/items/${ITEM_ID}`,
      expect.objectContaining({ method: "PATCH" }),
    )
  })

  it("toggleStatus calls status endpoint and updates listing in place", async () => {
    const deactivated = { ...makeItem(), status: "DEACTIVATED" }
    fetchMock = vi.fn().mockResolvedValue(deactivated)
    vi.stubGlobal("$fetch", fetchMock)

    const { listings, toggleStatus } = useMyListings()
    listings.value = [makeItem()]

    await toggleStatus(ITEM_ID, "DEACTIVATED")

    expect(listings.value[0]!.status).toBe("DEACTIVATED")
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/items/${ITEM_ID}/status`,
      expect.objectContaining({ method: "PATCH", body: { status: "DEACTIVATED" } }),
    )
  })
})
