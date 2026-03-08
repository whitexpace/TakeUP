import type { ListedItem } from "../types/item-listing"
import { sortItemsByRanking } from "./item-ranking"

export type TrendingBadgeStrategy =
  | {
      mode: "topN"
      topN: number
    }
  | {
      mode: "bookingCountAtLeast"
      minBookingCount: number
    }
  | {
      mode: "percentile"
      percentile: number
    }

// Default badge rule: mark top ranked items as trending.
export const DEFAULT_TRENDING_BADGE_STRATEGY: TrendingBadgeStrategy = {
  mode: "topN",
  topN: 10,
}

const normalizeTopN = (value: number) => Math.max(0, Math.floor(value))

const normalizePercentile = (value: number) => Math.min(100, Math.max(0, value))

export const getTrendingItemIds = (
  items: ListedItem[],
  strategy: TrendingBadgeStrategy = DEFAULT_TRENDING_BADGE_STRATEGY,
) => {
  if (items.length === 0) {
    return new Set<string>()
  }

  if (strategy.mode === "bookingCountAtLeast") {
    return new Set(
      items.filter((item) => item.bookingCount >= strategy.minBookingCount).map((item) => item.id),
    )
  }

  const rankedItems = sortItemsByRanking(items)

  if (strategy.mode === "percentile") {
    const percentile = normalizePercentile(strategy.percentile)
    const topCount = Math.ceil((percentile / 100) * rankedItems.length)
    return new Set(rankedItems.slice(0, topCount).map((item) => item.id))
  }

  const topCount = normalizeTopN(strategy.topN)
  return new Set(rankedItems.slice(0, topCount).map((item) => item.id))
}
