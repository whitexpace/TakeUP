import { describe, it, expect } from "vitest"
import { DEFAULT_ITEM_SORT_STRATEGY, getDefaultItemOrderBy } from "../item-sorting"

describe("item-sorting", () => {
  it("keeps the default strategy focused on boost score and booking count with stable tie-breakers", () => {
    expect(DEFAULT_ITEM_SORT_STRATEGY).toEqual({
      trendingFactors: [
        { field: "boostScore", direction: "desc" },
        { field: "bookingCount", direction: "desc" },
      ],
      tieBreakers: [
        { field: "createdAt", direction: "desc" },
        { field: "id", direction: "desc" },
      ],
    })
  })

  it("builds the default Prisma orderBy array from the strategy", () => {
    expect(getDefaultItemOrderBy()).toEqual([
      { boostScore: "desc" },
      { bookingCount: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ])
  })
})
