import { computed, ref } from "vue"
import type { AdminOverviewResponse } from "~/types/admin-overview"
import { usePersistedSessionState } from "./use-persisted-session-state"
import { recordPerfEvent, withPerfTimer } from "../utils/performance-telemetry"

const ADMIN_OVERVIEW_CACHE_TTL_MS = 30_000
let inflightOverviewRequest: Promise<AdminOverviewResponse> | null = null

export const useAdminOverview = () => {
  const overview = usePersistedSessionState<AdminOverviewResponse | null>("admin-overview:data", () => null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const hasFetched = usePersistedSessionState<boolean>("admin-overview:fetched", () => false)
  const lastFetchedAt = usePersistedSessionState<number | null>("admin-overview:last-fetched-at", () => null)
  const hasFreshCache = computed(
    () =>
      hasFetched.value &&
      lastFetchedAt.value !== null &&
      Date.now() - lastFetchedAt.value < ADMIN_OVERVIEW_CACHE_TTL_MS,
  )

  const fetchOverview = async (options: { force?: boolean } = {}) => {
    if (isLoading.value) return
    if (hasFreshCache.value && !options.force) {
      recordPerfEvent("admin-overview", "summary", "cache-hit")
      return
    }

    if (inflightOverviewRequest && !options.force) {
      recordPerfEvent("admin-overview", "summary", "request-dedup-hit")
      await inflightOverviewRequest
      return
    }

    isLoading.value = true
    error.value = null
    if (hasFetched.value && !options.force) {
      recordPerfEvent("admin-overview", "summary", "cache-stale")
    } else if (options.force) {
      recordPerfEvent("admin-overview", "summary", "cache-bypass")
    } else {
      recordPerfEvent("admin-overview", "summary", "cache-miss")
    }

    try {
      inflightOverviewRequest = withPerfTimer("admin-overview", "summary", () =>
        $fetch<AdminOverviewResponse>("/api/admin/overview"),
      )
      overview.value = await inflightOverviewRequest
      hasFetched.value = true
      lastFetchedAt.value = Date.now()
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode

      if (statusCode === 401) {
        await navigateTo("/")
        return
      }

      if (statusCode === 403) {
        await navigateTo("/account")
        return
      }

      error.value = "Unable to load admin overview. Please try again."
    } finally {
      isLoading.value = false
      inflightOverviewRequest = null
    }
  }

  return {
    overview,
    isLoading,
    error,
    hasFetched,
    hasFreshCache,
    refresh: fetchOverview,
    fetchOverview,
  }
}
