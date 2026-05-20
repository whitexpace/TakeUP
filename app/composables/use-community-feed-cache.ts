import type {
  CommunityOfferNotification,
  CommunityOfferableItem,
  CommunityRequest,
  TrendingRequest,
  UserActivity,
} from "~/types/community-requests"
import {
  COMMUNITY_FEED_CACHE_TTL_MS,
  COMMUNITY_FEED_PREVIEW_LIMIT,
  type ApiCommunityFeedPreviewResponse,
  buildCommunityFeedActivity,
  buildCommunityFeedTrendingItems,
  getStaleCommunityFeedTimestamp,
  normalizeCommunityNotification,
  normalizeCommunityRequest,
  normalizeOfferableItem,
} from "../utils/community-feed"
import { addBoundedSetEntry, setBoundedMapEntry } from "../utils/bounded-cache"
import { usePersistedSessionState } from "./use-persisted-session-state"
import { useViewerSession } from "./use-viewer-session"

let pendingCommunityFeedPreview: Promise<void> | null = null
const previewWarmedAtByViewer = new Map<string, number>()
const warmedPreviewImageUrls = new Set<string>()
const MAX_PREVIEW_WARMED_VIEWERS = 32
const MAX_WARMED_PREVIEW_IMAGE_URLS = 96

export const useCommunityFeedCache = () => {
  const requests = usePersistedSessionState<CommunityRequest[]>(
    "community-feed:requests",
    () => [],
    {
      deserialize: (value) => JSON.parse(value).map(normalizeCommunityRequest),
    },
  )
  const notifications = usePersistedSessionState<CommunityOfferNotification[]>(
    "community-feed:notifications",
    () => [],
    {
      deserialize: (value) => JSON.parse(value).map(normalizeCommunityNotification),
    },
  )
  const offerableItems = usePersistedSessionState<CommunityOfferableItem[]>(
    "community-feed:offerable-items",
    () => [],
    {
      deserialize: (value) => JSON.parse(value).map(normalizeOfferableItem),
    },
  )
  const currentDbUserId = usePersistedSessionState<string>(
    "community-feed:current-db-user-id",
    () => "",
  )
  const feedHydrated = usePersistedSessionState<boolean>("community-feed:hydrated", () => false)
  const feedLastLoadedAt = usePersistedSessionState<number | null>(
    "community-feed:last-loaded-at",
    () => null,
  )
  const feedViewerKey = usePersistedSessionState<string>(
    "community-feed:viewer-key",
    () => "anonymous",
  )
  const feedActivity = usePersistedSessionState<UserActivity | null>(
    "community-feed:activity",
    () => null,
  )
  const feedTrendingItems = usePersistedSessionState<TrendingRequest[]>(
    "community-feed:trending-items",
    () => [],
  )

  const setFeedSummary = (nextRequests: CommunityRequest[], userId = currentDbUserId.value) => {
    feedActivity.value = buildCommunityFeedActivity(nextRequests, userId)
    feedTrendingItems.value = buildCommunityFeedTrendingItems(nextRequests)
  }

  return {
    requests,
    notifications,
    offerableItems,
    currentDbUserId,
    feedHydrated,
    feedLastLoadedAt,
    feedViewerKey,
    feedActivity,
    feedTrendingItems,
    setFeedSummary,
  }
}

const isFreshFeedCache = (
  cache: ReturnType<typeof useCommunityFeedCache>,
  viewerKey: string,
  now = Date.now(),
) =>
  cache.feedHydrated.value &&
  cache.feedViewerKey.value === viewerKey &&
  cache.feedLastLoadedAt.value !== null &&
  now - cache.feedLastLoadedAt.value < COMMUNITY_FEED_CACHE_TTL_MS &&
  cache.requests.value.length > 0 &&
  hasHydratedRequestReplies(cache.requests.value)

const wasPreviewRecentlyWarmed = (
  cache: ReturnType<typeof useCommunityFeedCache>,
  viewerKey: string,
  now = Date.now(),
) => {
  if (
    cache.feedHydrated.value &&
    cache.feedViewerKey.value === viewerKey &&
    cache.requests.value.length > 0 &&
    hasHydratedRequestReplies(cache.requests.value)
  ) {
    const warmedAt = previewWarmedAtByViewer.get(viewerKey)
    return warmedAt !== undefined && now - warmedAt < COMMUNITY_FEED_CACHE_TTL_MS
  }

  return false
}

const warmImage = (src: string | null | undefined) => {
  if (!import.meta.client || !src || warmedPreviewImageUrls.has(src)) return

  const browserImage = new Image()
  const priorityImage = browserImage as HTMLImageElement & {
    fetchPriority?: "high" | "low" | "auto"
  }

  browserImage.decoding = "async"
  if ("fetchPriority" in priorityImage) {
    priorityImage.fetchPriority = "low"
  }
  browserImage.src = src
  addBoundedSetEntry(warmedPreviewImageUrls, src, MAX_WARMED_PREVIEW_IMAGE_URLS)
}

const warmPreviewImages = (requests: CommunityRequest[]) => {
  for (const request of requests.slice(0, COMMUNITY_FEED_PREVIEW_LIMIT)) {
    warmImage(request.referenceImageUrl)
    warmImage(request.borrower.avatar)
  }
}

const hasHydratedRequestReplies = (requests: CommunityRequest[]) =>
  requests.every((request) => request.repliesCount === 0 || request.replies.length > 0)

export const useCommunityFeedPrefetch = () => {
  const cache = useCommunityFeedCache()
  const user = useSupabaseUser()

  const warmCommunityFeed = () => {
    if (!import.meta.client) return

    void preloadRouteComponents("/feed").catch(() => {})

    const viewerKey = user.value?.id ?? "anonymous"
    const now = Date.now()
    if (
      isFreshFeedCache(cache, viewerKey, now) ||
      wasPreviewRecentlyWarmed(cache, viewerKey, now)
    ) {
      return
    }

    if (pendingCommunityFeedPreview) {
      return
    }

    pendingCommunityFeedPreview = (async () => {
      const { getAuthHeaders } = useViewerSession()
      const headers = await getAuthHeaders()
      const response = await $fetch<ApiCommunityFeedPreviewResponse>(
        "/api/community-feed/preview",
        {
          query: { limit: COMMUNITY_FEED_PREVIEW_LIMIT },
          ...(headers ? { headers } : {}),
        },
      )
      const responseViewerKey = response.viewerKey || "anonymous"

      if (isFreshFeedCache(cache, responseViewerKey)) {
        setBoundedMapEntry(
          previewWarmedAtByViewer,
          responseViewerKey,
          Date.now(),
          MAX_PREVIEW_WARMED_VIEWERS,
        )
        return
      }

      const previewRequests = response.requests.map(normalizeCommunityRequest)
      cache.requests.value = previewRequests
      cache.notifications.value = response.notifications.map(normalizeCommunityNotification)
      cache.offerableItems.value = response.offerableItems.map(normalizeOfferableItem)
      cache.currentDbUserId.value = response.currentDbUserId
      cache.feedActivity.value = response.userActivity
      cache.feedTrendingItems.value = response.trendingItems
      cache.feedViewerKey.value = responseViewerKey
      cache.feedHydrated.value = true

      // Mark preview snapshots stale so /feed paints instantly, then refreshes the full list.
      cache.feedLastLoadedAt.value = getStaleCommunityFeedTimestamp()

      setBoundedMapEntry(
        previewWarmedAtByViewer,
        responseViewerKey,
        Date.now(),
        MAX_PREVIEW_WARMED_VIEWERS,
      )
      warmPreviewImages(previewRequests)
    })()
      .catch(() => {})
      .finally(() => {
        pendingCommunityFeedPreview = null
      })
  }

  return {
    warmCommunityFeed,
  }
}
