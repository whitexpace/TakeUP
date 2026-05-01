import { ref, type Ref } from "vue"

type UseFilteredResultsCountOptions = {
  searchQuery: Ref<string>
  filterParams?: Ref<Record<string, string | undefined>>
  debounceMs?: number
}

type ResultsCountCacheEntry = {
  count: number
  expiresAt: number
}

const RESULTS_COUNT_CACHE_TTL_MS = 30_000
const filteredResultsCountCache = new Map<string, ResultsCountCacheEntry>()
const pendingResultsCountRequests = new Map<string, Promise<number>>()

const buildResultsCountQuery = (
  searchQuery: Ref<string>,
  filterParams?: Ref<Record<string, string | undefined>>,
) => {
  const params: Record<string, string | undefined> = {
    search: searchQuery.value || undefined,
  }

  if (!filterParams?.value) {
    return params
  }

  for (const [key, value] of Object.entries(filterParams.value)) {
    if (value !== undefined) {
      params[key] = value
    }
  }

  return params
}

const serializeResultsCountQuery = (query: Record<string, string | undefined>) =>
  Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join("&")

const getCachedResultsCount = (cacheKey: string) => {
  const cachedEntry = filteredResultsCountCache.get(cacheKey)
  if (!cachedEntry) {
    return null
  }

  if (cachedEntry.expiresAt <= Date.now()) {
    filteredResultsCountCache.delete(cacheKey)
    return null
  }

  return cachedEntry.count
}

const setCachedResultsCount = (cacheKey: string, count: number) => {
  filteredResultsCountCache.set(cacheKey, {
    count,
    expiresAt: Date.now() + RESULTS_COUNT_CACHE_TTL_MS,
  })
}

export const resetFilteredResultsCountCache = () => {
  filteredResultsCountCache.clear()
  pendingResultsCountRequests.clear()
}

export const useFilteredResultsCount = ({
  searchQuery,
  filterParams,
  debounceMs = 75,
}: UseFilteredResultsCountOptions) => {
  const supabase =
    !import.meta.server && typeof useSupabaseClient === "function" ? useSupabaseClient() : null
  const canUseSharedCache = !import.meta.server
  const totalResultsCount = ref<number | null>(null)
  const isCountLoading = ref(false)
  const requestVersion = ref(0)
  let pendingRefreshTimeout: ReturnType<typeof setTimeout> | null = null

  const cancelPendingResultsCountRefresh = () => {
    if (pendingRefreshTimeout !== null) {
      clearTimeout(pendingRefreshTimeout)
      pendingRefreshTimeout = null
    }
  }

  const fetchResultsCount = async (version = requestVersion.value) => {
    const query = buildResultsCountQuery(searchQuery, filterParams)
    let viewerCacheKey = "anonymous"
    let accessToken: string | undefined
    if (import.meta.server) {
      const event = useRequestEvent()
      viewerCacheKey = event?.context.authUser?.id ?? viewerCacheKey
    } else if (supabase) {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      accessToken = session?.access_token
      viewerCacheKey = session?.user?.id ?? viewerCacheKey
    }

    const cacheKey = `${viewerCacheKey}:${serializeResultsCountQuery(query)}`
    const cachedCount = canUseSharedCache ? getCachedResultsCount(cacheKey) : null

    if (cachedCount !== null) {
      if (version === requestVersion.value) {
        totalResultsCount.value = cachedCount
        isCountLoading.value = false
      }
      return
    }

    isCountLoading.value = true

    try {
      const pendingRequest = canUseSharedCache ? pendingResultsCountRequests.get(cacheKey) : null
      const count = pendingRequest
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
            const request = $fetch<{ count: number }>("/api/items/count", requestOptions).then(
              (result) => result.count,
            )

            if (canUseSharedCache) {
              pendingResultsCountRequests.set(cacheKey, request)
            }

            return request.finally(() => {
              if (canUseSharedCache && pendingResultsCountRequests.get(cacheKey) === request) {
                pendingResultsCountRequests.delete(cacheKey)
              }
            })
          })()

      if (version === requestVersion.value) {
        if (canUseSharedCache) {
          setCachedResultsCount(cacheKey, count)
        }
        totalResultsCount.value = count
      }
    } catch {
      if (version === requestVersion.value) {
        totalResultsCount.value = null
      }
    } finally {
      if (version === requestVersion.value) {
        isCountLoading.value = false
      }
    }
  }

  const refreshResultsCount = async () => {
    cancelPendingResultsCountRefresh()
    requestVersion.value++
    await fetchResultsCount(requestVersion.value)
  }

  const scheduleResultsCountRefresh = (delayMs = debounceMs) => {
    cancelPendingResultsCountRefresh()
    requestVersion.value++
    const version = requestVersion.value

    pendingRefreshTimeout = setTimeout(() => {
      pendingRefreshTimeout = null
      void fetchResultsCount(version)
    }, delayMs)
  }

  return {
    totalResultsCount,
    isCountLoading,
    refreshResultsCount,
    scheduleResultsCountRefresh,
    cancelPendingResultsCountRefresh,
  }
}
