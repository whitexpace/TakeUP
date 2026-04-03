import { describe, expect, it } from "vitest"
import type { ListedItem } from "../types/item-listing"
import { filterListedItemsBySearch } from "./item-search"

const makeItem = (id: string, overrides: Partial<ListedItem> = {}): ListedItem => ({
  id,
  name: `Item ${id}`,
  description: null,
  condition: "GOOD",
  status: "AVAILABLE",
  rateOption: "PER_DAY",
  createdAt: "2026-03-01T00:00:00.000Z",
  rentalFee: 100,
  replacementCost: null,
  freeToBorrow: false,
  availability: [],
  whatItemOffers: null,
  whatIsIncluded: null,
  knownIssues: null,
  usageLimitations: null,
  images: [],
  thumbnailImage: null,
  photos: [],
  isTrending: false,
  viewCount: 0,
  bookingCount: 0,
  likeCount: 0,
  rating: 4,
  lenderId: "lender-1",
  ownerName: "Alice",
  borrowerId: null,
  categories: ["ELECTRONICS"],
  tags: [],
  ...overrides,
})

describe("item-search utils", () => {
  it("returns all items when query is empty", () => {
    const items = [makeItem("1"), makeItem("2")]

    expect(filterListedItemsBySearch(items, "")).toEqual(items)
  })

  it("matches name, category, owner, and tags", () => {
    const camera = makeItem("1", {
      name: "Canon Camera",
      categories: ["ELECTRONICS"],
      tags: ["dslr"],
      ownerName: "Mia",
    })
    const guitar = makeItem("2", {
      name: "Acoustic Guitar",
      categories: ["MUSIC_AUDIO"],
      tags: ["strings"],
      ownerName: "Noah",
    })

    expect(filterListedItemsBySearch([camera, guitar], "camera")).toEqual([camera])
    expect(filterListedItemsBySearch([camera, guitar], "music")).toEqual([guitar])
    expect(filterListedItemsBySearch([camera, guitar], "mia")).toEqual([camera])
    expect(filterListedItemsBySearch([camera, guitar], "dslr")).toEqual([camera])
  })

  it("prioritizes stronger name matches ahead of weaker matches", () => {
    const exact = makeItem("1", { name: "Camera" })
    const partial = makeItem("2", { name: "Camera Bag" })
    const descriptionMatch = makeItem("3", { name: "Tripod", description: "Works with camera" })

    expect(filterListedItemsBySearch([descriptionMatch, partial, exact], "camera")).toEqual([
      exact,
      partial,
      descriptionMatch,
    ])
  })
})
