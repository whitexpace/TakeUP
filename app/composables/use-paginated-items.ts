import { ref, type Ref } from "vue"
import type { ItemPaginationCursor, ListedItem, PaginatedItemsResponse } from "../types/item-listing"
import { sortItemsByRanking } from "../utils/item-ranking"

type UsePaginatedItemsOptions = {
  searchQuery: Ref<string>
  filterParams?: Ref<Record<string, string | undefined>>
  pageSize?: number
}

export const usePaginatedItems = ({
  searchQuery,
  filterParams,
  pageSize = 12,
}: UsePaginatedItemsOptions) => {
  const items = ref<ListedItem[]>([])
  const cursor = ref<ItemPaginationCursor | null>(null)
  const isLoading = ref(false)
  const hasMore = ref(true)
  const errorMessage = ref<string | null>(null)
  const requestVersion = ref(0)
  const loadedIds = new Set<string>()

  const resetState = () => {
    items.value = []
    cursor.value = null
    hasMore.value = true
    errorMessage.value = null
    loadedIds.clear()
  }

  const fetchNextPage = async (version = requestVersion.value) => {
    if (isLoading.value || !hasMore.value) return

    isLoading.value = true
    errorMessage.value = null

    try {
      const extraParams: Record<string, string | undefined> = {}
      if (filterParams?.value) {
        for (const [k, v] of Object.entries(filterParams.value)) {
          if (v !== undefined) extraParams[k] = v
        }
      }

      const response = await $fetch<PaginatedItemsResponse>("/api/items", {
        query: {
          limit: pageSize,
          search: searchQuery.value || undefined,
          cursor: cursor.value ? JSON.stringify(cursor.value) : undefined,
          ...extraParams,
        },
      })

      if (version !== requestVersion.value) return

      const uniqueItems = response.items.filter((item) => !loadedIds.has(item.id))
      for (const item of uniqueItems) {
        loadedIds.add(item.id)
      }

      items.value = sortItemsByRanking([...items.value, ...uniqueItems])
      cursor.value = response.nextCursor
      hasMore.value = Boolean(response.nextCursor)
    } catch {
      if (version === requestVersion.value) {
        errorMessage.value = "Unable to load items."
      }
    } finally {
      if (version === requestVersion.value) {
        isLoading.value = false
      }
    }
  }

  const refresh = async () => {
    requestVersion.value++
    const currentVersion = requestVersion.value
    resetState()
    // Allow a new fetch to proceed even if a stale request is still in flight.
    isLoading.value = false
    await fetchNextPage(currentVersion)
  }

  return {
    items,
    isLoading,
    hasMore,
    errorMessage,
    fetchNextPage,
    refresh,
  }
}
