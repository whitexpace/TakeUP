import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import type {
  AdminActionLogCursor,
  AdminActionLogRecord,
  AdminActionLogsResponse,
} from "~/types/admin-action-log"

type UseAdminActionLogsOptions = {
  targetType: Ref<"LISTING" | "USER" | null>
  searchQuery: Ref<string>
}

export const useAdminActionLogs = ({ targetType, searchQuery }: UseAdminActionLogsOptions) => {
  const logs = ref<AdminActionLogRecord[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const nextCursor = ref<AdminActionLogCursor>(null)
  const hasMore = computed(() => nextCursor.value !== null)
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

  const reset = () => {
    logs.value = []
    nextCursor.value = null
    error.value = null
    isLoading.value = false
  }

  const fetchPage = async (cursor: AdminActionLogCursor = null) => {
    if (isLoading.value) return

    isLoading.value = true
    error.value = null

    try {
      const query: Record<string, string | number> = { limit: 20 }
      const trimmedSearch = searchQuery.value.trim()

      if (targetType.value) query.targetType = targetType.value
      if (trimmedSearch) query.search = trimmedSearch
      if (cursor) query.cursor = JSON.stringify(cursor)

      const result = await $fetch<AdminActionLogsResponse>("/api/admin/system-logs", { query })
      logs.value = cursor ? [...logs.value, ...result.logs] : result.logs
      nextCursor.value = result.nextCursor
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode

      if (statusCode === 401) {
        await navigateTo("/")
        return
      }

      if (statusCode === 403) {
        await navigateTo("/account")
        return
      }

      error.value = "Unable to load system logs. Please try again."
    } finally {
      isLoading.value = false
    }
  }

  const refresh = async () => {
    reset()
    await fetchPage()
  }

  const loadMore = () => {
    if (!hasMore.value || isLoading.value) return
    void fetchPage(nextCursor.value)
  }

  watch(targetType, () => {
    void refresh()
  })

  watch(searchQuery, () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(() => {
      void refresh()
      searchDebounceTimer = null
    }, 250)
  })

  onMounted(() => {
    void fetchPage()
  })

  onBeforeUnmount(() => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  })

  return {
    logs,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
  }
}
