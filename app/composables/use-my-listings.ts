import { computed, ref, watch } from "vue"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../server/trpc/routers"
import { resetPaginatedItemsCache } from "./use-paginated-items"
import { resetFilteredResultsCountCache } from "./use-filtered-results-count"
import { clearPersistedSessionState, usePersistedSessionState } from "./use-persisted-session-state"
import { recordPerfEvent, withPerfTimer } from "../utils/performance-telemetry"
import { useViewerSession } from "./use-viewer-session"

type RouterOutputs = inferRouterOutputs<AppRouter>
export type MyListingItem = RouterOutputs["item"]["myListings"]["items"][number]
type MyListingsResponse = RouterOutputs["item"]["myListings"]

export type MyListingFilterStatus = "ACTIVE" | "IN_USE" | "INACTIVE" | "DISPUTED"
export type MyListingCategory =
  | "ELECTRONICS"
  | "BOOKS"
  | "CLOTHING"
  | "TOOLS"
  | "HOME_APPLIANCES"
  | "SPORTS_OUTDOORS"
  | "MUSIC_AUDIO"
  | "TOYS_GAMES"
  | "FURNITURE"
  | "VEHICLES_ACCESSORIES"
  | "HEALTH_BEAUTY"
  | "SCHOOL_SUPPLIES"
  | "PET_SUPPLIES"
  | "OTHER"

type PaginationCursor = { id: string; createdAt: Date } | null

const SEARCH_DEBOUNCE_MS = 250
const MY_LISTINGS_CACHE_TTL_MS = 30_000

const invalidateItemSearchCaches = () => {
  resetPaginatedItemsCache()
  resetFilteredResultsCountCache()
  clearPersistedSessionState("dashboard-listed-items")
  clearPersistedSessionState("dashboard-listed-items:cursor")
  clearPersistedSessionState("dashboard-listed-items:has-more")
  clearPersistedSessionState("dashboard-results-count")
  clearPersistedSessionState("likes-listed-items")
  clearPersistedSessionState("likes-listed-items:cursor")
  clearPersistedSessionState("likes-listed-items:has-more")
}

export const useMyListings = () => {
  const listings = usePersistedSessionState<MyListingItem[]>("my-listings:items", () => [])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const nextCursor = usePersistedSessionState<PaginationCursor>(
    "my-listings:next-cursor",
    () => null,
  )
  const hasFetched = usePersistedSessionState<boolean>("my-listings:fetched", () => false)
  const requestVersion = ref(0)
  const searchQuery = usePersistedSessionState<string>("my-listings:search-query", () => "")
  const selectedStatuses = usePersistedSessionState<MyListingFilterStatus[]>(
    "my-listings:selected-statuses",
    () => [],
  )
  const selectedCategories = usePersistedSessionState<MyListingCategory[]>(
    "my-listings:selected-categories",
    () => [],
  )
  const lastLoadedAt = usePersistedSessionState<number | null>(
    "my-listings:last-loaded-at",
    () => null,
  )
  const hasMore = computed(() => nextCursor.value !== null)
  const hasFreshCache = computed(
    () =>
      hasFetched.value &&
      lastLoadedAt.value !== null &&
      Date.now() - lastLoadedAt.value < MY_LISTINGS_CACHE_TTL_MS,
  )
  const hasActiveFilters = computed(
    () =>
      searchQuery.value.trim().length > 0 ||
      selectedStatuses.value.length > 0 ||
      selectedCategories.value.length > 0,
  )

  let refreshTimeout: ReturnType<typeof setTimeout> | null = null

  const reset = () => {
    listings.value = []
    nextCursor.value = null
    error.value = null
    isLoading.value = false
  }

  const buildQuery = (cursor: PaginationCursor = null) => {
    const query: Record<string, string | number | string[]> = {}
    const trimmedSearch = searchQuery.value.trim()

    if (trimmedSearch) query.search = trimmedSearch
    if (selectedStatuses.value.length > 0) query.statuses = selectedStatuses.value
    if (selectedCategories.value.length > 0) query.categories = selectedCategories.value
    if (cursor) query.cursor = JSON.stringify(cursor)

    return query
  }

  const { getAuthHeaders } = useViewerSession()

  const fetchListings = async (
    cursor: PaginationCursor = null,
    append = false,
    version = requestVersion.value,
  ) => {
    if (version !== requestVersion.value || isLoading.value) return
    isLoading.value = true
    error.value = null

    if (!append && cursor === null) {
      if (hasFreshCache.value && !isLoading.value) {
        recordPerfEvent("my-listings", "list", "cache-hit")
      } else if (hasFetched.value) {
        recordPerfEvent("my-listings", "list", "cache-stale")
      } else {
        recordPerfEvent("my-listings", "list", "cache-miss")
      }
    }

    try {
      const result = await withPerfTimer("my-listings", "list", async () =>
        $fetch<MyListingsResponse>("/api/my-listings", {
          query: buildQuery(cursor),
          headers: await getAuthHeaders(),
        }),
      )

      if (version !== requestVersion.value) return

      if (append) {
        listings.value = [...listings.value, ...result.items]
      } else {
        listings.value = result.items
      }
      nextCursor.value = result.nextCursor as PaginationCursor
      lastLoadedAt.value = Date.now()
    } catch (err: unknown) {
      const httpStatus = (err as { statusCode?: number })?.statusCode
      if (httpStatus === 401) {
        await navigateTo("/")
        return
      }

      if (version === requestVersion.value) {
        error.value = "Unable to load listings. Please try again."
      }
    } finally {
      if (version === requestVersion.value) {
        hasFetched.value = true
        isLoading.value = false
      }
    }
  }

  const refresh = async () => {
    requestVersion.value++
    const currentVersion = requestVersion.value
    hasFetched.value = false
    reset()
    await fetchListings(null, false, currentVersion)
  }

  const scheduleRefresh = () => {
    if (refreshTimeout) {
      clearTimeout(refreshTimeout)
    }

    refreshTimeout = setTimeout(() => {
      refreshTimeout = null
      void refresh()
    }, SEARCH_DEBOUNCE_MS)
  }

  watch(
    [
      () => searchQuery.value,
      () => selectedStatuses.value.join("|"),
      () => selectedCategories.value.join("|"),
    ],
    () => {
      if (!hasFetched.value) return
      scheduleRefresh()
    },
  )

  const setSearchQuery = (value: string) => {
    searchQuery.value = value
  }

  const toggleStatusFilter = (status: MyListingFilterStatus) => {
    selectedStatuses.value = selectedStatuses.value.includes(status)
      ? selectedStatuses.value.filter((entry) => entry !== status)
      : [...selectedStatuses.value, status]
  }

  const toggleCategoryFilter = (category: MyListingCategory) => {
    selectedCategories.value = selectedCategories.value.includes(category)
      ? selectedCategories.value.filter((entry) => entry !== category)
      : [...selectedCategories.value, category]
  }

  const removeStatusFilter = (status: MyListingFilterStatus) => {
    selectedStatuses.value = selectedStatuses.value.filter((entry) => entry !== status)
  }

  const removeCategoryFilter = (category: MyListingCategory) => {
    selectedCategories.value = selectedCategories.value.filter((entry) => entry !== category)
  }

  const clearFilters = () => {
    searchQuery.value = ""
    selectedStatuses.value = []
    selectedCategories.value = []
  }

  const createListing = async (data: Record<string, unknown>): Promise<MyListingItem> => {
    const result = await $fetch<MyListingItem>("/api/items", { method: "POST", body: data })
    invalidateItemSearchCaches()
    await refresh()
    return result
  }

  const updateListing = async (
    id: string,
    data: Record<string, unknown>,
  ): Promise<MyListingItem> => {
    const result = await $fetch<MyListingItem>(`/api/items/${id}`, { method: "PATCH", body: data })
    invalidateItemSearchCaches()
    await refresh()
    return result
  }

  const toggleStatus = async (
    id: string,
    newStatus: "AVAILABLE" | "DEACTIVATED",
  ): Promise<MyListingItem> => {
    const result = await $fetch<MyListingItem>(`/api/items/${id}/status`, {
      method: "PATCH",
      body: { status: newStatus },
    })
    invalidateItemSearchCaches()
    await refresh()
    return result
  }

  const deleteListing = async (id: string): Promise<MyListingItem> => {
    const result = await $fetch<MyListingItem>(`/api/items/${id}`, {
      method: "DELETE",
    })
    invalidateItemSearchCaches()
    await refresh()
    return result
  }

  const loadMore = () => {
    if (!hasMore.value || isLoading.value) return
    void fetchListings(nextCursor.value, true)
  }

  return {
    listings,
    isLoading,
    error,
    hasFetched,
    hasMore,
    hasFreshCache,
    searchQuery,
    selectedStatuses,
    selectedCategories,
    hasActiveFilters,
    fetchListings,
    setSearchQuery,
    toggleStatusFilter,
    toggleCategoryFilter,
    removeStatusFilter,
    removeCategoryFilter,
    clearFilters,
    createListing,
    updateListing,
    toggleStatus,
    deleteListing,
    loadMore,
    refresh,
  }
}
