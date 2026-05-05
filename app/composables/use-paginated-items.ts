import { useState } from "#app"
import { ref, type Ref } from "vue"
import type {
  ItemPaginationCursor,
  ListedItem,
  PaginatedItemsResponse,
} from "../types/item-listing"
import { useViewerSession } from "./use-viewer-session"

type UsePaginatedItemsOptions = {
  searchQuery: Ref<string>
  filterParams?: Ref<Record<string, string | undefined>>
  pageSize?: number
  /** When set, items persist in useState across navigations (survives unmount). */
  stateKey?: string
}

type PaginatedItemsQuery = Record<string, number | string | undefined>

type PaginatedItemsCacheEntry = {
  expiresAt: number
  response: PaginatedItemsResponse
}

const PAGINATED_ITEMS_CACHE_TTL_MS = 30_000
const paginatedItemsCache = new Map<string, PaginatedItemsCacheEntry>()
const pendingPaginatedItemsRequests = new Map<string, Promise<PaginatedItemsResponse>>()

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
  pendingPaginatedItemsRequests.clear()
}

export const usePaginatedItems = ({
  searchQuery,
  filterParams,
  pageSize = 12,
  stateKey,
}: UsePaginatedItemsOptions) => {
  const canUseSharedCache = !import.meta.server
  const { getAccessToken, session } = useViewerSession()
  const items: Ref<ListedItem[]> = stateKey
    ? useState<ListedItem[]>(stateKey, () => [])
    : ref<ListedItem[]>([])
  const cursor: Ref<ItemPaginationCursor | null> = stateKey
    ? useState<ItemPaginationCursor | null>(`${stateKey}:cursor`, () => null)
    : ref<ItemPaginationCursor | null>(null)
  const isLoading = ref(false)
  const hasMore: Ref<boolean> = stateKey
    ? useState<boolean>(`${stateKey}:has-more`, () => true)
    : ref(true)
  const errorMessage = ref<string | null>(null)
  const requestVersion = ref(0)
  const loadedIds = new Set(items.value.map((item) => item.id))
  const isFreshFetch = ref(false)

  const resetState = () => {
    cursor.value = null
    hasMore.value = true
    isLoading.value = false
    errorMessage.value = null
    loadedIds.clear()
    isFreshFetch.value = true
  }

  const applyResponse = (response: PaginatedItemsResponse, version: number) => {
    if (version !== requestVersion.value) return

    const uniqueItems = response.items.filter((item) => !loadedIds.has(item.id))
    for (const item of uniqueItems) {
      loadedIds.add(item.id)
    }

    // Fresh fetch — replace items (keeps old items visible during load, then swaps)
    if (isFreshFetch.value) {
      items.value = uniqueItems
      isFreshFetch.value = false
    } else {
      items.value = [...items.value, ...uniqueItems]
    }
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
    let viewerCacheKey = "anonymous"
    let accessToken: string | undefined
    if (import.meta.server) {
      const event = useRequestEvent()
      viewerCacheKey = event?.context.authUser?.id ?? viewerCacheKey
    } else {
      accessToken = await getAccessToken()
      viewerCacheKey = session.value?.user?.id ?? viewerCacheKey
    }

    const cacheKey = `${viewerCacheKey}:${serializePaginatedItemsQuery(query)}`
    const cachedResponse = canUseSharedCache ? getCachedPaginatedItemsResponse(cacheKey) : null

    if (cachedResponse) {
      applyResponse(cachedResponse, version)
      return
    }

    isLoading.value = true

    try {
      const pendingRequest = canUseSharedCache ? pendingPaginatedItemsRequests.get(cacheKey) : null
      const response = pendingRequest
        ? await pendingRequest
        : await (() => {
            const headers = import.meta.server
              ? useRequestHeaders(["cookie"])
              : accessToken
                ? { authorization: `Bearer ${accessToken}` }
                : undefined
            const requestOptions = {
              query,
              ...(headers ? { headers } : {}),
            }
            const request = $fetch<PaginatedItemsResponse>("/api/items", requestOptions)

            if (canUseSharedCache) {
              pendingPaginatedItemsRequests.set(cacheKey, request)
            }

            return request.finally(() => {
              if (canUseSharedCache && pendingPaginatedItemsRequests.get(cacheKey) === request) {
                pendingPaginatedItemsRequests.delete(cacheKey)
              }
            })
          })()

      if (version !== requestVersion.value) return

      if (canUseSharedCache) {
        setCachedPaginatedItemsResponse(cacheKey, response)
      }
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
