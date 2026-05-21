import { describe, expect, it } from "vitest"
import type { CommunityOffer, CommunityRequest } from "../types/community-requests"
import { buildCommunityFeedActivity, buildCommunityFeedTrendingItems } from "./community-feed"

const makeOffer = (requestId: number, lenderUserId: string, id = requestId): CommunityOffer => ({
  id,
  lenderID: id,
  requestID: requestId,
  itemID: id,
  itemName: "Projector",
  itemThumbnailImage: null,
  rentalFee: 100,
  availability: true,
  condition: "GOOD",
  rentalTerms: "Return after use.",
  status: "PENDING",
  borrowerReadAt: null,
  createdAt: new Date("2026-05-01T08:00:00.000Z"),
  updatedAt: new Date("2026-05-01T08:00:00.000Z"),
  lender: {
    profileId: id,
    userId: lenderUserId,
    username: lenderUserId,
    name: lenderUserId,
    avatar: "",
  },
})

const makeRequest = ({
  id,
  borrowerUserId = "borrower",
  offersCount = 0,
  createdAt = "2026-05-01T08:00:00.000Z",
  offers = [],
}: {
  id: number
  borrowerUserId?: string
  offersCount?: number
  createdAt?: string
  offers?: CommunityOffer[]
}): CommunityRequest => ({
  id,
  borrowerID: id,
  itemNeeded: `Item ${id}`,
  referenceImageUrl: null,
  requestedDates: [new Date("2026-05-10T08:00:00.000Z")],
  priceRange: [0, 100],
  description: "Need this for a class project.",
  status: "OPEN",
  createdAt: new Date(createdAt),
  updatedAt: new Date(createdAt),
  offersCount,
  repliesCount: 0,
  borrower: {
    profileId: id,
    userId: borrowerUserId,
    username: borrowerUserId,
    name: borrowerUserId,
    avatar: "",
  },
  offers,
  replies: [],
})

describe("community feed helpers", () => {
  it("builds activity counts for the current viewer", () => {
    const requests = [
      makeRequest({
        id: 1,
        borrowerUserId: "viewer",
        offersCount: 2,
        offers: [makeOffer(1, "lender-a", 1), makeOffer(1, "lender-b", 2)],
      }),
      makeRequest({
        id: 2,
        borrowerUserId: "other",
        offersCount: 1,
        offers: [makeOffer(2, "viewer", 3)],
      }),
      makeRequest({ id: 3, borrowerUserId: "viewer" }),
    ]

    expect(buildCommunityFeedActivity(requests, "viewer")).toEqual({
      postsMade: 2,
      offersSent: 1,
      offersReceived: 2,
    })
  })

  it("returns empty activity counts without a viewer id", () => {
    expect(buildCommunityFeedActivity([makeRequest({ id: 1 })], "")).toEqual({
      postsMade: 0,
      offersSent: 0,
      offersReceived: 0,
    })
  })

  it("sorts trending items by offers, then recency, and limits to five", () => {
    const requests = [
      makeRequest({ id: 1, offersCount: 0, createdAt: "2026-05-01T08:00:00.000Z" }),
      makeRequest({ id: 2, offersCount: 5, createdAt: "2026-05-02T08:00:00.000Z" }),
      makeRequest({ id: 3, offersCount: 5, createdAt: "2026-05-03T08:00:00.000Z" }),
      makeRequest({ id: 4, offersCount: 3, createdAt: "2026-05-04T08:00:00.000Z" }),
      makeRequest({ id: 5, offersCount: 1, createdAt: "2026-05-05T08:00:00.000Z" }),
      makeRequest({ id: 6, offersCount: 0, createdAt: "2026-05-06T08:00:00.000Z" }),
    ]

    expect(buildCommunityFeedTrendingItems(requests).map((item) => item.id)).toEqual([
      3, 2, 4, 5, 6,
    ])
  })
})
