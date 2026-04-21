import type { BookingStatus, ItemAvailabilityStatus } from "@prisma/client"

type RankableRange = {
  startDate: Date
  endDate: Date
  status?: ItemAvailabilityStatus | BookingStatus | string | null
}

type RankableCategory = { category: string } | string
type RankableTag = { tag: { name: string } } | string

export type ViewerInterestSeed = {
  item: {
    categories: Array<{ category: string }>
    tags: Array<{ tag: { name: string } }>
  } | null
}

export type ViewerInterestProfile = {
  categoryWeights: ReadonlyMap<string, number>
  tagWeights: ReadonlyMap<string, number>
  hasSignals: boolean
}

export type RankableFeedItem = {
  id: string
  createdAt: Date | string
  boostScore?: number | null
  boostExpiresAt?: Date | null
  bookingCount?: number | null
  likeCount?: number | null
  viewCount?: number | null
  categories: RankableCategory[]
  tags: RankableTag[]
  availability?: RankableRange[] | null
  bookings?: RankableRange[] | null
}

export const PERSONALIZED_FEED_WEIGHTS = {
  categoryAffinity: 80,
  tagAffinity: 120,
  currentAvailability: 40,
  nearAvailability: 18,
  activeBoost: 16,
  bookingCount: 3,
  likeCount: 2,
  viewCount: 0.05,
  freshnessWindowDays: 30,
  maxFreshnessBoost: 24,
} as const

const DAY_MS = 24 * 60 * 60 * 1000
const SCORE_EPSILON = 0.000_001

const asNumber = (value: number | null | undefined) => (typeof value === "number" ? value : 0)

const toTimestamp = (value: Date | string) => new Date(value).getTime()

const incrementCount = (target: Map<string, number>, key: string) => {
  target.set(key, (target.get(key) ?? 0) + 1)
}

const normalizeCategory = (value: RankableCategory) =>
  (typeof value === "string" ? value : value.category).trim()

const normalizeTag = (value: RankableTag) =>
  (typeof value === "string" ? value : value.tag.name).trim().toLowerCase()

const getFutureRange = (range: RankableRange, now: Date) => {
  const startMs = range.startDate.getTime()
  const endMs = range.endDate.getTime()
  const nowMs = now.getTime()

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs || endMs <= nowMs) {
    return null
  }

  return {
    startMs: Math.max(startMs, nowMs),
    endMs,
  }
}

const isFullyCovered = (
  range: { startMs: number; endMs: number },
  blockers: Array<{ startMs: number; endMs: number }>,
) => {
  let coveredUntil = range.startMs

  for (const blocker of blockers) {
    if (blocker.endMs <= coveredUntil) continue
    if (blocker.startMs > coveredUntil) return false

    coveredUntil = Math.max(coveredUntil, blocker.endMs)
    if (coveredUntil >= range.endMs) {
      return true
    }
  }

  return coveredUntil >= range.endMs
}

const getFirstBookableRange = (
  item: Pick<RankableFeedItem, "availability" | "bookings">,
  now: Date,
) => {
  const availableRanges = (item.availability ?? [])
    .filter((range) => range.status === "AVAILABLE")
    .map((range) => getFutureRange(range, now))
    .filter((range): range is { startMs: number; endMs: number } => range !== null)
    .sort((left, right) => left.startMs - right.startMs)

  const blockers = [
    ...(item.availability ?? [])
      .filter((range) => range.status !== "AVAILABLE")
      .map((range) => getFutureRange(range, now))
      .filter((range): range is { startMs: number; endMs: number } => range !== null),
    ...(item.bookings ?? [])
      .map((range) => getFutureRange(range, now))
      .filter((range): range is { startMs: number; endMs: number } => range !== null),
  ].sort((left, right) => left.startMs - right.startMs)

  return availableRanges.find((range) => !isFullyCovered(range, blockers)) ?? null
}

const getAvailabilityScore = (item: RankableFeedItem, now: Date) => {
  const firstBookableRange = getFirstBookableRange(item, now)
  if (!firstBookableRange) return 0

  const nowMs = now.getTime()
  const visibleSpanDays = Math.max(
    0,
    (firstBookableRange.endMs - firstBookableRange.startMs) / DAY_MS,
  )
  const spanBonus = Math.min(visibleSpanDays, 7)

  if (firstBookableRange.startMs <= nowMs) {
    return PERSONALIZED_FEED_WEIGHTS.currentAvailability + spanBonus
  }

  const daysUntilAvailable = (firstBookableRange.startMs - nowMs) / DAY_MS

  if (daysUntilAvailable <= 3) {
    return PERSONALIZED_FEED_WEIGHTS.nearAvailability + spanBonus
  }

  if (daysUntilAvailable <= 7) {
    return PERSONALIZED_FEED_WEIGHTS.nearAvailability * 0.6 + spanBonus
  }

  if (daysUntilAvailable <= 14) {
    return PERSONALIZED_FEED_WEIGHTS.nearAvailability * 0.3 + spanBonus
  }

  return spanBonus
}

const getFreshnessBoost = (createdAt: Date | string, now: Date) => {
  const ageMs = Math.max(0, now.getTime() - toTimestamp(createdAt))
  const ageDays = ageMs / DAY_MS
  const freshnessRatio = Math.max(0, 1 - ageDays / PERSONALIZED_FEED_WEIGHTS.freshnessWindowDays)

  return freshnessRatio * PERSONALIZED_FEED_WEIGHTS.maxFreshnessBoost
}

const getInterestAffinityScore = (
  item: Pick<RankableFeedItem, "categories" | "tags">,
  profile: ViewerInterestProfile,
) => {
  if (!profile.hasSignals) return 0

  const categoryAffinity = item.categories.reduce(
    (total, category) => total + (profile.categoryWeights.get(normalizeCategory(category)) ?? 0),
    0,
  )
  const tagAffinity = item.tags.reduce(
    (total, tag) => total + (profile.tagWeights.get(normalizeTag(tag)) ?? 0),
    0,
  )

  return (
    categoryAffinity * PERSONALIZED_FEED_WEIGHTS.categoryAffinity +
    tagAffinity * PERSONALIZED_FEED_WEIGHTS.tagAffinity
  )
}

export const buildViewerInterestProfile = (seeds: ViewerInterestSeed[]): ViewerInterestProfile => {
  const categoryWeights = new Map<string, number>()
  const tagWeights = new Map<string, number>()

  for (const seed of seeds) {
    if (!seed.item) continue

    for (const category of seed.item.categories) {
      incrementCount(categoryWeights, category.category.trim())
    }

    for (const tag of seed.item.tags) {
      incrementCount(tagWeights, tag.tag.name.trim().toLowerCase())
    }
  }

  return {
    categoryWeights,
    tagWeights,
    hasSignals: categoryWeights.size > 0 || tagWeights.size > 0,
  }
}

export const getPersonalizedFeedScore = (
  item: RankableFeedItem,
  profile: ViewerInterestProfile,
  now = new Date(),
) => {
  const interestAffinity = getInterestAffinityScore(item, profile)
  const availabilityScore = getAvailabilityScore(item, now)
  const activeBoostScore =
    item.boostExpiresAt instanceof Date && item.boostExpiresAt.getTime() > now.getTime()
      ? PERSONALIZED_FEED_WEIGHTS.activeBoost
      : 0
  const engagementScore =
    asNumber(item.bookingCount) * PERSONALIZED_FEED_WEIGHTS.bookingCount +
    asNumber(item.likeCount) * PERSONALIZED_FEED_WEIGHTS.likeCount +
    asNumber(item.viewCount) * PERSONALIZED_FEED_WEIGHTS.viewCount +
    asNumber(item.boostScore)
  const freshnessBoost = getFreshnessBoost(item.createdAt, now)

  return interestAffinity + availabilityScore + activeBoostScore + engagementScore + freshnessBoost
}

export const compareFeedItemsByRelevance = (
  left: RankableFeedItem,
  right: RankableFeedItem,
  profile: ViewerInterestProfile,
  now = new Date(),
) => {
  const scoreDiff =
    getPersonalizedFeedScore(right, profile, now) - getPersonalizedFeedScore(left, profile, now)
  if (Math.abs(scoreDiff) > SCORE_EPSILON) {
    return scoreDiff
  }

  const createdAtDiff = toTimestamp(right.createdAt) - toTimestamp(left.createdAt)
  if (createdAtDiff !== 0) {
    return createdAtDiff
  }

  return right.id.localeCompare(left.id)
}

export const sortFeedItemsByRelevance = <T extends RankableFeedItem>(
  items: T[],
  profile: ViewerInterestProfile,
  now = new Date(),
) => [...items].sort((left, right) => compareFeedItemsByRelevance(left, right, profile, now))
