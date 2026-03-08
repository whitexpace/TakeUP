import type { Prisma } from "@prisma/client"

type SortDirection = "asc" | "desc"

type ItemSortField = "bookingCount" | "createdAt" | "id" | "viewCount" | "likeCount" | "isTrending"

type SortCriterion = {
  field: ItemSortField
  direction: SortDirection
}

type ItemSortStrategy = {
  trendingFactors: SortCriterion[]
  tieBreakers: SortCriterion[]
}

// Keep ranking criteria config-driven so future score factors can be added in one place.
export const DEFAULT_ITEM_SORT_STRATEGY: Readonly<ItemSortStrategy> = {
  trendingFactors: [{ field: "bookingCount", direction: "desc" }],
  tieBreakers: [
    { field: "createdAt", direction: "desc" },
    { field: "id", direction: "desc" },
  ],
}

export const getDefaultItemOrderBy = (): Prisma.ItemOrderByWithRelationInput[] => {
  const criteria = [
    ...DEFAULT_ITEM_SORT_STRATEGY.trendingFactors,
    ...DEFAULT_ITEM_SORT_STRATEGY.tieBreakers,
  ]

  return criteria.map((criterion) => ({ [criterion.field]: criterion.direction }))
}
