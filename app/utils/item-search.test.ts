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
  boostScore: 0,
  rating: 4,
  lenderId: "lender-1",
  ownerName: "Alice",
  lenderUsername: "alice-lender",
  lenderFullName: "Alice Lender",
  borrowerId: null,
  categories: ["ELECTRONICS"],
  tags: [],
  hasActiveBoost: false,
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

  it("matches lender identity, description, and offer details", () => {
    const projector = makeItem("1", {
      name: "Portable Projector",
      ownerName: "Mia",
      lenderUsername: "mia.rents",
      lenderFullName: "Mia Santos",
      description: "Compact projector for movie nights",
      whatItemOffers: "Sharp 1080p projection with HDMI support",
      whatIsIncluded: "Tripod stand and remote control",
      knownIssues: "Minor scratch on the side panel",
      usageLimitations: "Indoor use only",
    })
    const speaker = makeItem("2", {
      name: "Bluetooth Speaker",
      ownerName: "Noah",
      lenderUsername: "noah.audio",
      lenderFullName: "Noah Cruz",
    })

    expect(filterListedItemsBySearch([projector, speaker], "mia.rents")).toEqual([projector])
    expect(filterListedItemsBySearch([projector, speaker], "santos")).toEqual([projector])
    expect(filterListedItemsBySearch([projector, speaker], "movie nights")).toEqual([projector])
    expect(filterListedItemsBySearch([projector, speaker], "hdmi")).toEqual([projector])
    expect(filterListedItemsBySearch([projector, speaker], "tripod")).toEqual([projector])
    expect(filterListedItemsBySearch([projector, speaker], "indoor")).toEqual([projector])
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

  it("returns an empty list when nothing matches", () => {
    const camera = makeItem("1", { name: "Canon Camera" })
    const guitar = makeItem("2", { name: "Acoustic Guitar" })

    expect(filterListedItemsBySearch([camera, guitar], "microscope")).toEqual([])
  })
})
