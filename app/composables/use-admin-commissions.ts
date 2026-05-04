import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import type { TransactionStatus } from "../../shared/schemas/transaction"
import type {
  AdminCommissionCursor,
  AdminCommissionRecord,
  AdminCommissionResponse,
  AdminCommissionSummary,
} from "~/types/admin-commission"

type UseAdminCommissionsOptions = {
  status: Ref<TransactionStatus | null>
  searchQuery: Ref<string>
  collectedAtFrom: Ref<string>
  collectedAtTo: Ref<string>
}

const emptySummary = (): AdminCommissionSummary => ({
  totalCommissionCollected: 0,
  currentCommissionBalance: 0,
  commissionTransactionCount: 0,
  currency: "PHP",
})

export const useAdminCommissions = ({
  status,
  searchQuery,
  collectedAtFrom,
  collectedAtTo,
}: UseAdminCommissionsOptions) => {
  const summary = ref<AdminCommissionSummary>(emptySummary())
  const records = ref<AdminCommissionRecord[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const nextCursor = ref<AdminCommissionCursor>(null)
  const hasMore = computed(() => nextCursor.value !== null)
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

  const reset = () => {
    records.value = []
    nextCursor.value = null
    error.value = null
    isLoading.value = false
  }

  const fetchPage = async (cursor: AdminCommissionCursor = null) => {
    if (isLoading.value) return

    isLoading.value = true
    error.value = null

    try {
      const query: Record<string, string | number> = { limit: 20 }
      const trimmedSearch = searchQuery.value.trim()

      if (status.value) query.status = status.value
      if (trimmedSearch) query.search = trimmedSearch
      if (collectedAtFrom.value) query.collectedAtFrom = collectedAtFrom.value
      if (collectedAtTo.value) query.collectedAtTo = collectedAtTo.value
      if (cursor) query.cursor = JSON.stringify(cursor)

      const result = await $fetch<AdminCommissionResponse>("/api/admin/wallet/commissions", {
        query,
      })

      summary.value = result.summary
      records.value = cursor ? [...records.value, ...result.records] : result.records
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

      error.value = "Unable to load commission records. Please try again."
    } finally {
      isLoading.value = false
    }
  }

  const loadMore = () => {
    if (!hasMore.value || isLoading.value) return
    void fetchPage(nextCursor.value)
  }

  const refresh = async () => {
    reset()
    await fetchPage()
  }

  watch([status, collectedAtFrom, collectedAtTo], () => {
    void refresh()
  })

  watch(searchQuery, () => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer)
    }

    searchDebounceTimer = setTimeout(() => {
      void refresh()
      searchDebounceTimer = null
    }, 250)
  })

  onMounted(() => {
    void fetchPage()
  })

  onBeforeUnmount(() => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer)
    }
  })

  return {
    summary,
    records,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    fetchPage,
  }
}
