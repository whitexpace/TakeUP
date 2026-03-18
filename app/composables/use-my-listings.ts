import { ref, computed } from "vue"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../server/trpc/routers"

type RouterOutputs = inferRouterOutputs<AppRouter>
export type MyListingItem = RouterOutputs["item"]["myListings"]["items"][number]
type MyListingsResponse = RouterOutputs["item"]["myListings"]

type PaginationCursor = { id: string; createdAt: Date } | null

export const useMyListings = () => {
  const listings = ref<MyListingItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const nextCursor = ref<PaginationCursor>(null)
  const hasMore = computed(() => nextCursor.value !== null)

  const fetchListings = async (cursor: PaginationCursor = null, append = false) => {
    if (isLoading.value) return
    isLoading.value = true
    error.value = null
    try {
      const query: Record<string, string | number> = {}
      if (cursor) query.cursor = JSON.stringify(cursor)

      const result = await $fetch<MyListingsResponse>("/api/my-listings", { query })
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
      error.value = "Unable to load listings. Please try again."
    } finally {
      isLoading.value = false
    }
  }

  const updateListing = async (
    id: string,
    data: Record<string, unknown>,
  ): Promise<MyListingItem> => {
    const result = await $fetch<MyListingItem>(`/api/items/${id}`, { method: "PATCH", body: data })
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
    listings.value = listings.value.map((item) => (item.id === id ? result : item))
    return result
  }

  const loadMore = () => {
    if (!hasMore.value || isLoading.value) return
    fetchListings(nextCursor.value, true)
  }

  const refresh = async () => {
    listings.value = []
    nextCursor.value = null
    await fetchListings()
  }

  return {
    listings,
    isLoading,
    error,
    hasMore,
    fetchListings,
    updateListing,
    toggleStatus,
    loadMore,
    refresh,
  }
}
