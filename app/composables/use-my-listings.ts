import { ref, computed } from "vue"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../server/trpc/routers"
import { resetPaginatedItemsCache } from "./use-paginated-items"
import { resetFilteredResultsCountCache } from "./use-filtered-results-count"

type RouterOutputs = inferRouterOutputs<AppRouter>
export type MyListingItem = RouterOutputs["item"]["myListings"]["items"][number]
type MyListingsResponse = RouterOutputs["item"]["myListings"]

type PaginationCursor = { id: string; createdAt: Date } | null

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
  const hasMore = computed(() => nextCursor.value !== null)

  const reset = () => {
    listings.value = []
    nextCursor.value = null
    error.value = null
    isLoading.value = false
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
      const query: Record<string, string | number> = {}
      if (cursor) query.cursor = JSON.stringify(cursor)

      let accessToken: string | undefined
      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        accessToken = session?.access_token
      }

      const result = await $fetch<MyListingsResponse>("/api/my-listings", {
        query,
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

  const createListing = async (data: Record<string, unknown>): Promise<MyListingItem> => {
    const result = await $fetch<MyListingItem>("/api/items", { method: "POST", body: data })
    invalidateItemSearchCaches()
    listings.value = [result, ...listings.value]
    return result
  }

  const updateListing = async (
    id: string,
    data: Record<string, unknown>,
  ): Promise<MyListingItem> => {
    const result = await $fetch<MyListingItem>(`/api/items/${id}`, { method: "PATCH", body: data })
    invalidateItemSearchCaches()
    listings.value = listings.value.map((item) => (item.id === id ? result : item))
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
    listings.value = listings.value.map((item) => (item.id === id ? result : item))
    return result
  }

  const loadMore = () => {
    if (!hasMore.value || isLoading.value) return
    void fetchListings(nextCursor.value, true)
  }

  const refresh = async () => {
    requestVersion.value++
    const currentVersion = requestVersion.value
    hasFetched.value = false
    reset()
    await fetchListings(null, false, currentVersion)
  }

  return {
    listings,
    isLoading,
    error,
    hasFetched,
    hasMore,
    fetchListings,
    createListing,
    updateListing,
    toggleStatus,
    loadMore,
    refresh,
  }
}
