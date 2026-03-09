import { ref, type Ref } from "vue"

type UseFilteredResultsCountOptions = {
  searchQuery: Ref<string>
  filterParams?: Ref<Record<string, string | undefined>>
  debounceMs?: number
}

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

export const useFilteredResultsCount = ({
  searchQuery,
  filterParams,
  debounceMs = 200,
}: UseFilteredResultsCountOptions) => {
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
    isCountLoading.value = true

    try {
      const result = await $fetch<{ count: number }>("/api/items/count", {
        query: buildResultsCountQuery(searchQuery, filterParams),
      })

      if (version === requestVersion.value) {
        totalResultsCount.value = result.count
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
