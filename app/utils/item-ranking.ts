import type { ListedItem } from "../types/item-listing"

export type TrendingMetric = "bookingCount" | "viewCount" | "likeCount" | "recencyBoost" | "manualBoost"
export type TrendingScoreWeights = Readonly<Record<TrendingMetric, number>>

// Extend this config when new ranking signals are introduced.
export const TRENDING_SCORE_WEIGHTS: TrendingScoreWeights = {
  bookingCount: 1,
  viewCount: 0,
  likeCount: 0,
  recencyBoost: 0,
  manualBoost: 0,
}

const asNumber = (value: number | null | undefined) => (typeof value === "number" ? value : 0)

export const getTrendingScore = (
  item: Pick<ListedItem, "bookingCount" | "viewCount" | "likeCount">,
  weights: TrendingScoreWeights = TRENDING_SCORE_WEIGHTS,
) => {
  return (
    asNumber(item.bookingCount) * weights.bookingCount +
    asNumber(item.viewCount) * weights.viewCount +
    asNumber(item.likeCount) * weights.likeCount
  )
}

const toTimestamp = (createdAt: string | Date) => new Date(createdAt).getTime()

export const sortItemsByRanking = (
  items: ListedItem[],
  weights: TrendingScoreWeights = TRENDING_SCORE_WEIGHTS,
) => {
  return [...items].sort((left, right) => {
    const scoreDiff = getTrendingScore(right, weights) - getTrendingScore(left, weights)
    if (scoreDiff !== 0) return scoreDiff

    const createdAtDiff = toTimestamp(right.createdAt) - toTimestamp(left.createdAt)
    if (createdAtDiff !== 0) return createdAtDiff

    return right.id.localeCompare(left.id)
  })
}
