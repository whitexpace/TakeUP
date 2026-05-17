import { computed, ref, watch } from "vue"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../server/trpc/routers"
import { resetPaginatedItemsCache } from "./use-paginated-items"
import { resetFilteredResultsCountCache } from "./use-filtered-results-count"
import { clearPersistedSessionState, usePersistedSessionState } from "./use-persisted-session-state"
import { recordPerfEvent, withPerfTimer } from "../utils/performance-telemetry"
import { useViewerSession } from "./use-viewer-session"
import { useAccountPrefetch } from "./use-account-prefetch"

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
type MyListingsRequestQuery = {
  categories?: MyListingCategory[]
  cursor?: PaginationCursor
  limit?: number
  search?: string
  statuses?: MyListingFilterStatus[]
}

const SEARCH_DEBOUNCE_MS = 250
const MY_LISTINGS_CACHE_TTL_MS = 5 * 60_000
const MY_LISTINGS_PREFETCH_INITIAL_LIMIT = 8
const MY_LISTINGS_PREFETCH_REMAINDER_LIMIT = 48
const MY_LISTINGS_PREFETCH_REMAINDER_DELAY_MS = 180
const MAX_WARMED_MY_LISTING_IMAGE_URLS = 80

const warmedMyListingImageUrls = new Set<string>()
const myListingDetailCache = new Map<string, MyListingItem>()
const pendingMyListingDetailRequests = new Map<string, Promise<MyListingItem | null>>()
let pendingMyListingsWarmup: Promise<void> | null = null
let pendingMyListingsRemainderWarmup: Promise<void> | null = null
let myListingsRemainderTimer: ReturnType<typeof setTimeout> | null = null
let myListingsPrefetchGeneration = 0

const warmMyListingImage = (src: string | null | undefined) => {
  if (!import.meta.client || !src || warmedMyListingImageUrls.has(src)) return

  if (warmedMyListingImageUrls.size >= MAX_WARMED_MY_LISTING_IMAGE_URLS) {
    const oldestUrl = warmedMyListingImageUrls.values().next().value
    if (oldestUrl) warmedMyListingImageUrls.delete(oldestUrl)
  }

  const browserImage = new Image()
  const priorityImage = browserImage as HTMLImageElement & {
    fetchPriority?: "high" | "low" | "auto"
  }

  browserImage.decoding = "async"
  if ("fetchPriority" in priorityImage) {
    priorityImage.fetchPriority = "low"
  }
  browserImage.src = src
  warmedMyListingImageUrls.add(src)
}

const warmMyListingImages = (items: MyListingItem[]) => {
  for (const item of items.slice(0, 8)) {
    warmMyListingImage(
      item.images.find((image) => image.isPrimary)?.path ??
        item.images[0]?.path ??
        item.thumbnailImage,
    )
  }
}

const warmMyListingDetailImages = (item: MyListingItem) => {
  warmMyListingImage(
    item.images.find((image) => image.isPrimary)?.path ??
      item.images[0]?.path ??
      item.thumbnailImage,
  )
}

const serializeMyListingsQuery = (query: MyListingsRequestQuery) => {
  const requestQuery: Record<string, string | number | string[]> = {}

  if (query.search?.trim()) requestQuery.search = query.search.trim()
  if (query.statuses?.length) requestQuery.statuses = query.statuses
  if (query.categories?.length) requestQuery.categories = query.categories
  if (query.limit) requestQuery.limit = query.limit
  if (query.cursor) requestQuery.cursor = JSON.stringify(query.cursor)

  return requestQuery
}

const mergeUniqueMyListings = (existing: MyListingItem[], next: MyListingItem[]) => {
  const existingIds = new Set(existing.map((item) => item.id))
  return [...existing, ...next.filter((item) => !existingIds.has(item.id))]
}

const cancelMyListingsRemainderPrefetch = () => {
  if (myListingsRemainderTimer) {
    clearTimeout(myListingsRemainderTimer)
    myListingsRemainderTimer = null
  }
}

const invalidateMyListingsWarmup = () => {
  myListingsPrefetchGeneration += 1
  myListingDetailCache.clear()
  pendingMyListingDetailRequests.clear()
  pendingMyListingsWarmup = null
  pendingMyListingsRemainderWarmup = null
  cancelMyListingsRemainderPrefetch()
}

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

export const seedPrefetchedMyListingDetail = (item: MyListingItem) => {
  if (!import.meta.client) return

  myListingDetailCache.set(item.id, item)
  warmMyListingDetailImages(item)
}

export const getPrefetchedMyListingDetail = <T = MyListingItem>(itemId: string) => {
  if (!import.meta.client) return undefined
  return myListingDetailCache.get(itemId) as T | undefined
}

export const prefetchMyListingEdit = (
  itemId: string | null | undefined,
  item?: MyListingItem | null,
) => {
  if (!import.meta.client || !itemId) return Promise.resolve(null)

  if (item) {
    seedPrefetchedMyListingDetail(item)
  }

  void preloadRouteComponents(`/account/listings/${itemId}/edit`).catch(() => {})

  const cached = myListingDetailCache.get(itemId)
  const pending = pendingMyListingDetailRequests.get(itemId)
  if (pending) return pending

  const request = $fetch<MyListingItem | null>(`/api/items/${itemId}/prefetch`, {
    credentials: "same-origin",
  })
    .then((data) => {
      if (data) {
        seedPrefetchedMyListingDetail({
          ...(cached ?? {}),
          ...data,
        } as MyListingItem)
      }

      return myListingDetailCache.get(itemId) ?? data
    })
    .catch(() => myListingDetailCache.get(itemId) ?? null)
    .finally(() => {
      if (pendingMyListingDetailRequests.get(itemId) === request) {
        pendingMyListingDetailRequests.delete(itemId)
      }
    })

  pendingMyListingDetailRequests.set(itemId, request)
  return request
}

export const useMyListings = () => {
  const listings = usePersistedSessionState<MyListingItem[]>("my-listings:items", () => [])
  const isLoading = ref(true)
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
  let isInitialFetch = true

  const reset = () => {
    listings.value = []
    nextCursor.value = null
    error.value = null
    isLoading.value = false
    isInitialFetch = false
  }

  const buildQuery = (cursor: PaginationCursor = null, limit?: number) =>
    serializeMyListingsQuery({
      search: searchQuery.value,
      statuses: selectedStatuses.value,
      categories: selectedCategories.value,
      cursor,
      limit,
    })

  const { getAuthHeaders } = useViewerSession()

  const fetchListings = async (
    cursor: PaginationCursor = null,
    append = false,
    version = requestVersion.value,
  ) => {
    if (version !== requestVersion.value || (isLoading.value && !isInitialFetch)) return
    isLoading.value = true
    isInitialFetch = false
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
    invalidateMyListingsWarmup()
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
    invalidateMyListingsWarmup()
    invalidateItemSearchCaches()
    await refresh()
    return result
  }

  const updateListing = async (
    id: string,
    data: Record<string, unknown>,
  ): Promise<MyListingItem> => {
    const result = await $fetch<MyListingItem>(`/api/items/${id}`, { method: "PATCH", body: data })
    invalidateMyListingsWarmup()
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
    invalidateMyListingsWarmup()
    invalidateItemSearchCaches()
    await refresh()
    return result
  }

  const deleteListing = async (id: string): Promise<MyListingItem> => {
    const result = await $fetch<MyListingItem>(`/api/items/${id}`, {
      method: "DELETE",
    })
    invalidateMyListingsWarmup()
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

export const useMyListingsPrefetch = () => {
  const listings = usePersistedSessionState<MyListingItem[]>("my-listings:items", () => [])
  const nextCursor = usePersistedSessionState<PaginationCursor>(
    "my-listings:next-cursor",
    () => null,
  )
  const hasFetched = usePersistedSessionState<boolean>("my-listings:fetched", () => false)
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
  const { getAuthHeaders } = useViewerSession()
  const { warmAccount } = useAccountPrefetch()
  const user = typeof useSupabaseUser === "function" ? useSupabaseUser() : null

  const hasFreshPrefetchedListings = () =>
    hasFetched.value &&
    lastLoadedAt.value !== null &&
    Date.now() - lastLoadedAt.value < MY_LISTINGS_CACHE_TTL_MS

  const fetchMyListingsPage = async (query: MyListingsRequestQuery) => {
    const response = await $fetch<MyListingsResponse>("/api/my-listings", {
      query: serializeMyListingsQuery(query),
      headers: await getAuthHeaders(),
      credentials: "same-origin",
    })

    warmMyListingImages(response.items)
    return response
  }

  const prefetchRemainingListings = async (
    baseQuery: Omit<MyListingsRequestQuery, "cursor" | "limit">,
    cursor: PaginationCursor,
    generation: number,
  ) => {
    let currentCursor = cursor

    while (currentCursor && generation === myListingsPrefetchGeneration) {
      const response = await fetchMyListingsPage({
        ...baseQuery,
        cursor: currentCursor,
        limit: MY_LISTINGS_PREFETCH_REMAINDER_LIMIT,
      })

      if (generation !== myListingsPrefetchGeneration) return

      listings.value = mergeUniqueMyListings(listings.value, response.items)
      nextCursor.value = response.nextCursor as PaginationCursor
      lastLoadedAt.value = Date.now()
      currentCursor = response.nextCursor as PaginationCursor
    }
  }

  const scheduleRemainingListingsPrefetch = (
    baseQuery: Omit<MyListingsRequestQuery, "cursor" | "limit">,
    cursor: PaginationCursor,
    generation: number,
  ) => {
    if (!cursor || pendingMyListingsRemainderWarmup) return

    cancelMyListingsRemainderPrefetch()
    myListingsRemainderTimer = setTimeout(() => {
      myListingsRemainderTimer = null
      pendingMyListingsRemainderWarmup = prefetchRemainingListings(baseQuery, cursor, generation)
        .catch(() => {})
        .finally(() => {
          pendingMyListingsRemainderWarmup = null
        })
    }, MY_LISTINGS_PREFETCH_REMAINDER_DELAY_MS)
  }

  const warmMyListings = (targetPath = "/account/listings") => {
    if (!import.meta.client) return Promise.resolve()
    if (user && !user.value) return Promise.resolve()

    void preloadRouteComponents("/account/listings").catch(() => {})

    if (hasFreshPrefetchedListings()) {
      warmMyListingImages(listings.value)
      return Promise.resolve()
    }

    if (pendingMyListingsWarmup) {
      return pendingMyListingsWarmup
    }

    const generation = ++myListingsPrefetchGeneration
    const baseQuery = {
      search: searchQuery.value,
      statuses: selectedStatuses.value,
      categories: selectedCategories.value,
    }

    pendingMyListingsWarmup = (async () => {
      await warmAccount(targetPath)

      const firstPage = await fetchMyListingsPage({
        ...baseQuery,
        limit: MY_LISTINGS_PREFETCH_INITIAL_LIMIT,
      })

      if (generation !== myListingsPrefetchGeneration) return

      listings.value = listings.value.length
        ? mergeUniqueMyListings(firstPage.items, listings.value)
        : firstPage.items
      nextCursor.value = firstPage.nextCursor as PaginationCursor
      hasFetched.value = true
      lastLoadedAt.value = Date.now()

      scheduleRemainingListingsPrefetch(
        baseQuery,
        firstPage.nextCursor as PaginationCursor,
        generation,
      )
    })()
      .catch(() => {})
      .finally(() => {
        pendingMyListingsWarmup = null
      })

    return pendingMyListingsWarmup
  }

  return {
    warmMyListings,
  }
}
