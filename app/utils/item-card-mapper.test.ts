import { describe, expect, it } from "vitest"
import { mapListedItemToCard } from "./item-card-mapper"
import type { ListedItem } from "../types/item-listing"

const makeItem = (overrides: Partial<ListedItem> = {}): ListedItem => ({
  id: "11111111-1111-1111-1111-111111111111",
  name: "Camera",
  description: "Mirrorless camera.",
  condition: "GOOD",
  status: "AVAILABLE",
  rateOption: "PER_DAY",
  createdAt: new Date("2026-03-10T00:00:00.000Z"),
  rentalFee: 300,
  replacementCost: null,
  freeToBorrow: false,
  availability: [],
  whatItemOffers: "Sharp photos.",
  whatIsIncluded: "Camera body and battery.",
  knownIssues: null,
  usageLimitations: null,
  images: [],
  thumbnailImage: null,
  photos: [],
  isTrending: false,
  viewCount: 0,
  bookingCount: 0,
  likeCount: 0,
  rating: 4.2,
  lenderId: "owner-1",
  ownerName: "Owner",
  borrowerId: null,
  categories: ["ELECTRONICS"],
  tags: [],
  isLiked: false,
  ...overrides,
})

describe("item-card-mapper", () => {
  it("uses the stored primary image when one exists", () => {
    const card = mapListedItemToCard(
      makeItem({
        images: [{ path: "https://example.com/camera.jpg", isPrimary: true, sortOrder: 0 }],
      }),
      0,
    )

    expect(card.image).toBe("https://example.com/camera.jpg")
  })

  it("does not inject a fallback image when the item has no stored images", () => {
    const card = mapListedItemToCard(makeItem(), 0)

    expect(card.image).toBeNull()
  })
})
