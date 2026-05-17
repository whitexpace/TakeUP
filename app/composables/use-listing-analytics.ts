import { computed, ref } from "vue"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../server/trpc/routers"
import type { ListingAnalyticsRange } from "#shared/schemas/listing-analytics"
import { usePersistedSessionState } from "./use-persisted-session-state"
import { recordPerfEvent, withPerfTimer } from "../utils/performance-telemetry"
import { useViewerSession } from "./use-viewer-session"

type RouterOutputs = inferRouterOutputs<AppRouter>
export type ListingAnalyticsResponse = RouterOutputs["listingAnalytics"]["list"]
export type ListingAnalyticsItem = ListingAnalyticsResponse["listings"][number]
export type ListingAnalyticsCategory = ListingAnalyticsResponse["categoryBreakdown"][number]
export type { ListingAnalyticsRange }

export type ListingAnalyticsPreviewItem = {
  listingId: string
  itemName: string
  thumbnailImage: string | null
  totalViews: number
  totalBookings: number
  totalRevenue: number
}

export type ListingAnalyticsPreviewResponse = {
  summary: ListingAnalyticsResponse["summary"]
  listingCount: number
  chartItems: ListingAnalyticsPreviewItem[]
  topItems: ListingAnalyticsPreviewItem[]
  range: ListingAnalyticsRange
}

const LISTING_ANALYTICS_CACHE_TTL_MS = 2 * 60_000
const LISTING_ANALYTICS_FULL_PREFETCH_DELAY_MS = 120

const pendingAnalyticsRequests = new Map<ListingAnalyticsRange, Promise<ListingAnalyticsResponse>>()
const pendingAnalyticsTopRequests = new Map<
  ListingAnalyticsRange,
  Promise<ListingAnalyticsPreviewResponse>
>()
let analyticsFullPrefetchTimer: ReturnType<typeof setTimeout> | null = null

const clearAnalyticsFullPrefetchTimer = () => {
  if (analyticsFullPrefetchTimer) {
    clearTimeout(analyticsFullPrefetchTimer)
    analyticsFullPrefetchTimer = null
  }
}

export const useListingAnalytics = () => {
  const analytics = usePersistedSessionState<ListingAnalyticsResponse | null>(
    "listing-analytics:data",
    () => null,
  )
  const analyticsPreview = usePersistedSessionState<ListingAnalyticsPreviewResponse | null>(
    "listing-analytics:preview",
    () => null,
  )
  const selectedRange = usePersistedSessionState<ListingAnalyticsRange>(
    "listing-analytics:selected-range",
    () => "all",
  )
  const isLoading = ref(false)
  const isPreviewLoading = ref(false)
  const error = ref<string | null>(null)
  const hasFetched = usePersistedSessionState<boolean>("listing-analytics:fetched", () => false)
  const hasTopFetched = usePersistedSessionState<boolean>(
    "listing-analytics:top-fetched",
    () => false,
  )
  const lastLoadedAt = usePersistedSessionState<number | null>(
    "listing-analytics:last-loaded-at",
    () => null,
  )
  const lastTopLoadedAt = usePersistedSessionState<number | null>(
    "listing-analytics:top-last-loaded-at",
    () => null,
  )
  const currentAnalytics = computed(() =>
    analytics.value?.range === selectedRange.value ? analytics.value : null,
  )
  const currentPreview = computed(() =>
    analyticsPreview.value?.range === selectedRange.value ? analyticsPreview.value : null,
  )
  const hasFreshCache = computed(
    () =>
      hasFetched.value &&
      currentAnalytics.value !== null &&
      lastLoadedAt.value !== null &&
      Date.now() - lastLoadedAt.value < LISTING_ANALYTICS_CACHE_TTL_MS,
  )
  const hasFreshTopCache = computed(
    () =>
      hasTopFetched.value &&
      currentPreview.value !== null &&
      lastTopLoadedAt.value !== null &&
      Date.now() - lastTopLoadedAt.value < LISTING_ANALYTICS_CACHE_TTL_MS,
  )

  const { getAuthHeaders } = useViewerSession()

  const fetchAnalyticsTop = async () => {
    const range = selectedRange.value
    if (isPreviewLoading.value) return

    const pending = pendingAnalyticsTopRequests.get(range)
    if (pending) {
      isPreviewLoading.value = true
      try {
        analyticsPreview.value = await pending
        hasTopFetched.value = true
        lastTopLoadedAt.value = Date.now()
      } catch (err: unknown) {
        const httpStatus = (err as { statusCode?: number })?.statusCode
        if (httpStatus === 401) {
          await navigateTo("/")
        }
      } finally {
        isPreviewLoading.value = false
      }
      return
    }

    isPreviewLoading.value = true

    const request = withPerfTimer("listing-analytics", `${range}:top`, async () =>
      $fetch<ListingAnalyticsPreviewResponse>("/api/account/listing-analytics/top", {
        query: { range },
        headers: await getAuthHeaders(),
        credentials: "same-origin",
      }),
    )

    pendingAnalyticsTopRequests.set(range, request)

    try {
      analyticsPreview.value = await request
      hasTopFetched.value = true
      lastTopLoadedAt.value = Date.now()
    } catch (err: unknown) {
      const httpStatus = (err as { statusCode?: number })?.statusCode
      if (httpStatus === 401) {
        await navigateTo("/")
        return
      }
    } finally {
      if (pendingAnalyticsTopRequests.get(range) === request) {
        pendingAnalyticsTopRequests.delete(range)
      }
      isPreviewLoading.value = false
    }
  }

  const fetchAnalytics = async () => {
    const range = selectedRange.value
    if (isLoading.value) return

    const pending = pendingAnalyticsRequests.get(range)
    if (pending) {
      isLoading.value = true
      error.value = null
      try {
        analytics.value = await pending
        lastLoadedAt.value = Date.now()
      } catch (err: unknown) {
        const httpStatus = (err as { statusCode?: number })?.statusCode
        if (httpStatus === 401) {
          await navigateTo("/")
          return
        }

        error.value = "Unable to load listing analytics. Please try again."
      } finally {
        hasFetched.value = true
        isLoading.value = false
      }
      return
    }

    isLoading.value = true
    error.value = null

    if (hasFreshCache.value) {
      recordPerfEvent("listing-analytics", range, "cache-hit")
    } else if (hasFetched.value) {
      recordPerfEvent("listing-analytics", range, "cache-stale")
    } else {
      recordPerfEvent("listing-analytics", range, "cache-miss")
    }

    const request = withPerfTimer("listing-analytics", range, async () =>
      $fetch<ListingAnalyticsResponse>("/api/account/listing-analytics", {
        query: { range },
        headers: await getAuthHeaders(),
        credentials: "same-origin",
      }),
    )

    pendingAnalyticsRequests.set(range, request)

    try {
      analytics.value = await request
      lastLoadedAt.value = Date.now()
    } catch (err: unknown) {
      const httpStatus = (err as { statusCode?: number })?.statusCode
      if (httpStatus === 401) {
        await navigateTo("/")
        return
      }

      error.value = "Unable to load listing analytics. Please try again."
    } finally {
      if (pendingAnalyticsRequests.get(range) === request) {
        pendingAnalyticsRequests.delete(range)
      }
      hasFetched.value = true
      isLoading.value = false
    }
  }

  const refresh = async () => {
    analytics.value = null
    analyticsPreview.value = null
    hasTopFetched.value = false
    lastTopLoadedAt.value = null
    clearAnalyticsFullPrefetchTimer()
    await fetchAnalytics()
  }

  const setRange = async (range: ListingAnalyticsRange) => {
    if (selectedRange.value === range && hasFetched.value) return
    selectedRange.value = range
    await refresh()
  }

  const listings = computed(() => currentAnalytics.value?.listings ?? [])
  const summary = computed(
    () => currentAnalytics.value?.summary ?? currentPreview.value?.summary ?? null,
  )
  const listingCount = computed(
    () => currentAnalytics.value?.listings.length ?? currentPreview.value?.listingCount ?? 0,
  )
  const previewChartItems = computed(() => currentPreview.value?.chartItems ?? [])
  const previewTopItems = computed(() => currentPreview.value?.topItems ?? [])
  const categoryBreakdown = computed(() => currentAnalytics.value?.categoryBreakdown ?? [])
  const topViewedItems = computed(() => currentAnalytics.value?.topViewedItems ?? [])
  const topRequestedItems = computed(() => currentAnalytics.value?.topRequestedItems ?? [])
  const topBookedItems = computed(() => currentAnalytics.value?.topBookedItems ?? [])
  const itemRatings = computed(() => currentAnalytics.value?.itemRatings ?? [])
  const hasListings = computed(() => listings.value.length > 0)
  const hasActivity = computed(() => {
    const current = summary.value
    if (!current) return false

    return (
      current.totalViews > 0 ||
      current.totalBookings > 0 ||
      current.totalCompletedTransactions > 0 ||
      current.totalRevenue > 0 ||
      current.bookedDays > 0
    )
  })

  return {
    analytics,
    analyticsPreview,
    selectedRange,
    summary,
    listingCount,
    listings,
    previewChartItems,
    previewTopItems,
    categoryBreakdown,
    topViewedItems,
    topRequestedItems,
    topBookedItems,
    itemRatings,
    isLoading,
    isPreviewLoading,
    error,
    hasFetched,
    hasTopFetched,
    hasFreshCache,
    hasFreshTopCache,
    hasListings,
    hasActivity,
    fetchAnalyticsTop,
    fetchAnalytics,
    refresh,
    setRange,
  }
}

export const useListingAnalyticsPrefetch = () => {
  const user = typeof useSupabaseUser === "function" ? useSupabaseUser() : null
  const { selectedRange, hasFreshCache, hasFreshTopCache, fetchAnalyticsTop, fetchAnalytics } =
    useListingAnalytics()

  const warmListingAnalytics = (targetPath = "/account/analytics") => {
    if (!import.meta.client) return Promise.resolve()
    if (user && !user.value) return Promise.resolve()

    void preloadRouteComponents(targetPath).catch(() => {})

    if (hasFreshTopCache.value && hasFreshCache.value) {
      return Promise.resolve()
    }

    const range = selectedRange.value
    const topPending = pendingAnalyticsTopRequests.get(range)

    const warmTop = topPending ?? (hasFreshTopCache.value ? Promise.resolve() : fetchAnalyticsTop())

    return Promise.resolve(warmTop)
      .catch(() => {})
      .then(() => {
        if (hasFreshCache.value || pendingAnalyticsRequests.has(range)) return

        clearAnalyticsFullPrefetchTimer()
        analyticsFullPrefetchTimer = setTimeout(() => {
          analyticsFullPrefetchTimer = null
          void fetchAnalytics()
        }, LISTING_ANALYTICS_FULL_PREFETCH_DELAY_MS)
      })
  }

  return {
    warmListingAnalytics,
  }
}
