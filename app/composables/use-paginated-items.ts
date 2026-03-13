import { ref, type Ref } from "vue"
import type {
  ItemPaginationCursor,
  ListedItem,
  PaginatedItemsResponse,
} from "../types/item-listing"
import { sortItemsByRanking } from "../utils/item-ranking"

type UsePaginatedItemsOptions = {
  searchQuery: Ref<string>
  filterParams?: Ref<Record<string, string | undefined>>
  pageSize?: number
}

type PaginatedItemsQuery = Record<string, number | string | undefined>

type PaginatedItemsCacheEntry = {
  expiresAt: number
  response: PaginatedItemsResponse
}

const PAGINATED_ITEMS_CACHE_TTL_MS = 30_000
const paginatedItemsCache = new Map<string, PaginatedItemsCacheEntry>()

const clonePaginatedItemsResponse = (response: PaginatedItemsResponse) => structuredClone(response)

const serializePaginatedItemsQuery = (query: PaginatedItemsQuery) =>
  Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join("&")

const getCachedPaginatedItemsResponse = (cacheKey: string) => {
  const cachedEntry = paginatedItemsCache.get(cacheKey)
  if (!cachedEntry) {
    return null
  }

  if (cachedEntry.expiresAt <= Date.now()) {
    paginatedItemsCache.delete(cacheKey)
    return null
  }

  return clonePaginatedItemsResponse(cachedEntry.response)
}

const setCachedPaginatedItemsResponse = (cacheKey: string, response: PaginatedItemsResponse) => {
  paginatedItemsCache.set(cacheKey, {
    expiresAt: Date.now() + PAGINATED_ITEMS_CACHE_TTL_MS,
    response: clonePaginatedItemsResponse(response),
  })
}

const buildPaginatedItemsQuery = ({
  searchQuery,
  filterParams,
  pageSize,
  cursor,
}: {
  searchQuery: Ref<string>
  filterParams?: Ref<Record<string, string | undefined>>
  pageSize: number
  cursor: ItemPaginationCursor | null
}): PaginatedItemsQuery => {
  const query: PaginatedItemsQuery = {
    limit: pageSize,
    search: searchQuery.value || undefined,
    cursor: cursor ? JSON.stringify(cursor) : undefined,
  }

  if (!filterParams?.value) {
    return query
  }

  for (const [key, value] of Object.entries(filterParams.value)) {
    if (value !== undefined) {
      query[key] = value
    }
  }

  return query
}

export const resetPaginatedItemsCache = () => {
  paginatedItemsCache.clear()
}

export const usePaginatedItems = ({
  searchQuery,
  filterParams,
  pageSize = 12,
}: UsePaginatedItemsOptions) => {
  const supabase = useSupabaseClient()
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
    isLoading.value = false
    errorMessage.value = null
    loadedIds.clear()
  }

  const applyResponse = (response: PaginatedItemsResponse, version: number) => {
    if (version !== requestVersion.value) return

    const uniqueItems = response.items.filter((item) => !loadedIds.has(item.id))
    for (const item of uniqueItems) {
      loadedIds.add(item.id)
    }

    items.value = sortItemsByRanking([...items.value, ...uniqueItems])
    cursor.value = response.nextCursor
    hasMore.value = Boolean(response.nextCursor)
  }

  const fetchNextPage = async (version = requestVersion.value) => {
    if (version !== requestVersion.value) return
    if (isLoading.value || !hasMore.value) return

    errorMessage.value = null
    const query = buildPaginatedItemsQuery({
      searchQuery,
      filterParams,
      pageSize,
      cursor: cursor.value,
    })
    const cacheKey = serializePaginatedItemsQuery(query)
    const cachedResponse = getCachedPaginatedItemsResponse(cacheKey)

    if (cachedResponse) {
      applyResponse(cachedResponse, version)
      return
    }

    isLoading.value = true

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      const response = await $fetch<PaginatedItemsResponse>("/api/items", {
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

      setCachedPaginatedItemsResponse(cacheKey, response)
      applyResponse(response, version)
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
