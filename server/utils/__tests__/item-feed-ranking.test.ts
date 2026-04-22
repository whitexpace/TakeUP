import { describe, expect, it } from "vitest"
import {
  buildViewerInterestProfile,
  getPersonalizedFeedScore,
  sortFeedItemsByRelevance,
  type RankableFeedItem,
} from "../item-feed-ranking"

const NOW = new Date("2026-04-22T00:00:00.000Z")

const makeItem = (id: string, overrides: Partial<RankableFeedItem> = {}): RankableFeedItem => ({
  id,
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  boostScore: 0,
  boostExpiresAt: null,
  bookingCount: 0,
  likeCount: 0,
  viewCount: 0,
  categories: [{ category: "ELECTRONICS" }],
  tags: [{ tag: { name: "camera" } }],
  availability: [
    {
      startDate: new Date("2026-04-22T00:00:00.000Z"),
      endDate: new Date("2026-04-27T00:00:00.000Z"),
      status: "AVAILABLE",
    },
  ],
  bookings: [],
  ...overrides,
})

describe("item-feed-ranking", () => {
  it("prioritizes interest matches ahead of generic high-engagement items", () => {
    const profile = buildViewerInterestProfile([
      {
        item: {
          categories: [{ category: "ELECTRONICS" }],
          tags: [{ tag: { name: "camera" } }],
        },
      },
    ])

    const matchingItem = makeItem("matching")
    const genericPopularItem = makeItem("popular", {
      categories: [{ category: "TOOLS" }],
      tags: [{ tag: { name: "drill" } }],
      bookingCount: 25,
      likeCount: 30,
      viewCount: 500,
    })

    expect(sortFeedItemsByRelevance([genericPopularItem, matchingItem], profile, NOW)).toEqual([
      matchingItem,
      genericPopularItem,
    ])
  })

  it("falls back to balanced relevance for viewers without interest signals", () => {
    const anonymousProfile = buildViewerInterestProfile([])
    const freshItem = makeItem("fresh", {
      createdAt: new Date("2026-04-20T00:00:00.000Z"),
      bookingCount: 2,
      likeCount: 3,
    })
    const olderHighEngagementItem = makeItem("older", {
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      bookingCount: 10,
      likeCount: 8,
      viewCount: 120,
    })

    expect(
      getPersonalizedFeedScore(olderHighEngagementItem, anonymousProfile, NOW),
    ).toBeGreaterThan(getPersonalizedFeedScore(freshItem, anonymousProfile, NOW))
    expect(
      sortFeedItemsByRelevance([freshItem, olderHighEngagementItem], anonymousProfile, NOW),
    ).toEqual([olderHighEngagementItem, freshItem])
  })

  it("keeps boost as a helpful signal without letting it outrank a strong interest match", () => {
    const profile = buildViewerInterestProfile([
      {
        item: {
          categories: [{ category: "BOOKS" }],
          tags: [{ tag: { name: "novel" } }],
        },
      },
    ])

    const interestMatch = makeItem("interest", {
      categories: [{ category: "BOOKS" }],
      tags: [{ tag: { name: "novel" } }],
    })
    const boostedItem = makeItem("boosted", {
      categories: [{ category: "TOOLS" }],
      tags: [{ tag: { name: "saw" } }],
      boostScore: 5,
      boostExpiresAt: new Date("2026-04-25T00:00:00.000Z"),
      bookingCount: 5,
      likeCount: 5,
      viewCount: 250,
    })

    expect(sortFeedItemsByRelevance([boostedItem, interestMatch], profile, NOW)).toEqual([
      interestMatch,
      boostedItem,
    ])
  })

  it("prefers fresher items when the relevance score is otherwise tied", () => {
    const profile = buildViewerInterestProfile([])
    const newerItem = makeItem("newer", {
      createdAt: new Date("2026-04-21T00:00:00.000Z"),
      categories: [{ category: "TOOLS" }],
      tags: [{ tag: { name: "tripod" } }],
    })
    const olderItem = makeItem("older", {
      createdAt: new Date("2026-04-10T00:00:00.000Z"),
      categories: [{ category: "TOOLS" }],
      tags: [{ tag: { name: "tripod" } }],
    })

    expect(sortFeedItemsByRelevance([olderItem, newerItem], profile, NOW)).toEqual([
      newerItem,
      olderItem,
    ])
  })
})
