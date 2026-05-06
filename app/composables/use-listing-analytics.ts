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

const LISTING_ANALYTICS_CACHE_TTL_MS = 30_000

export const useListingAnalytics = () => {
  const analytics = usePersistedSessionState<ListingAnalyticsResponse | null>(
    "listing-analytics:data",
    () => null,
  )
  const selectedRange = usePersistedSessionState<ListingAnalyticsRange>(
    "listing-analytics:selected-range",
    () => "all",
  )
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const hasFetched = usePersistedSessionState<boolean>("listing-analytics:fetched", () => false)
  const lastLoadedAt = usePersistedSessionState<number | null>(
    "listing-analytics:last-loaded-at",
    () => null,
  )
  const hasFreshCache = computed(
    () =>
      hasFetched.value &&
      lastLoadedAt.value !== null &&
      Date.now() - lastLoadedAt.value < LISTING_ANALYTICS_CACHE_TTL_MS,
  )

  const { getAuthHeaders } = useViewerSession()

  const fetchAnalytics = async () => {
    if (isLoading.value) return
    isLoading.value = true
    error.value = null

    if (hasFreshCache.value) {
      recordPerfEvent("listing-analytics", selectedRange.value, "cache-hit")
    } else if (hasFetched.value) {
      recordPerfEvent("listing-analytics", selectedRange.value, "cache-stale")
    } else {
      recordPerfEvent("listing-analytics", selectedRange.value, "cache-miss")
    }

    try {
      analytics.value = await withPerfTimer("listing-analytics", selectedRange.value, async () =>
        $fetch<ListingAnalyticsResponse>("/api/account/listing-analytics", {
          query: { range: selectedRange.value },
          headers: await getAuthHeaders(),
        }),
      )
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
  }

  const refresh = async () => {
    analytics.value = null
    await fetchAnalytics()
  }

  const setRange = async (range: ListingAnalyticsRange) => {
    if (selectedRange.value === range && hasFetched.value) return
    selectedRange.value = range
    await refresh()
  }

  const listings = computed(() => analytics.value?.listings ?? [])
  const summary = computed(() => analytics.value?.summary ?? null)
  const categoryBreakdown = computed(() => analytics.value?.categoryBreakdown ?? [])
  const topViewedItems = computed(() => analytics.value?.topViewedItems ?? [])
  const topRequestedItems = computed(() => analytics.value?.topRequestedItems ?? [])
  const topBookedItems = computed(() => analytics.value?.topBookedItems ?? [])
  const itemRatings = computed(() => analytics.value?.itemRatings ?? [])
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
    selectedRange,
    summary,
    listings,
    categoryBreakdown,
    topViewedItems,
    topRequestedItems,
    topBookedItems,
    itemRatings,
    isLoading,
    error,
    hasFetched,
    hasFreshCache,
    hasListings,
    hasActivity,
    fetchAnalytics,
    refresh,
    setRange,
  }
}
