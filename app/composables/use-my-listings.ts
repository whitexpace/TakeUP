import { computed, ref, watch } from "vue"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../server/trpc/routers"
import { resetPaginatedItemsCache } from "./use-paginated-items"
import { resetFilteredResultsCountCache } from "./use-filtered-results-count"

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

const invalidateItemSearchCaches = () => {
  resetPaginatedItemsCache()
  resetFilteredResultsCountCache()
}

export const useMyListings = () => {
  const supabase = typeof useSupabaseClient === "function" ? useSupabaseClient() : null
  const listings = ref<MyListingItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const nextCursor = ref<PaginationCursor>(null)
  const hasFetched = ref(false)
  const requestVersion = ref(0)
  const searchQuery = ref("")
  const selectedStatuses = ref<MyListingFilterStatus[]>([])
  const selectedCategories = ref<MyListingCategory[]>([])
  const hasMore = computed(() => nextCursor.value !== null)
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

  const getAccessToken = async () => {
    if (!supabase) return undefined

    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token
  }

  const fetchListings = async (
    cursor: PaginationCursor = null,
    append = false,
    version = requestVersion.value,
  ) => {
    if (version !== requestVersion.value || isLoading.value) return
    isLoading.value = true
    error.value = null

    try {
      const accessToken = await getAccessToken()
      const result = await $fetch<MyListingsResponse>("/api/my-listings", {
        query: buildQuery(cursor),
        ...(accessToken
          ? {
              headers: {
                authorization: `Bearer ${accessToken}`,
              },
            }
          : {}),
      })

      if (version !== requestVersion.value) return

      if (append) {
        listings.value = [...listings.value, ...result.items]
      } else {
        listings.value = result.items
      }
      nextCursor.value = result.nextCursor as PaginationCursor
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
