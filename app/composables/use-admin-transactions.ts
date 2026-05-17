import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../server/trpc/routers"
import type { TransactionStatus } from "../../shared/schemas/transaction"

type RouterOutputs = inferRouterOutputs<AppRouter>
export type AdminTransactionListItem =
  RouterOutputs["transaction"]["adminList"]["transactions"][number]

type AdminTransactionListResponse = RouterOutputs["transaction"]["adminList"]
type PaginationCursor = { id: string; createdAt: Date } | null

type UseAdminTransactionsOptions = {
  status: Ref<TransactionStatus | null>
  searchQuery: Ref<string>
  createdAtFrom: Ref<string>
  createdAtTo: Ref<string>
  limit?: number
}

export const useAdminTransactions = ({
  status,
  searchQuery,
  createdAtFrom,
  createdAtTo,
  limit = 10,
}: UseAdminTransactionsOptions) => {
  const transactions = ref<AdminTransactionListItem[]>([])
  const isLoading = ref(true)
  const error = ref<string | null>(null)
  const nextCursor = ref<PaginationCursor>(null)
  const hasMore = computed(() => nextCursor.value !== null)
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
  let isInitialFetch = true

  const reset = () => {
    transactions.value = []
    nextCursor.value = null
    error.value = null
    isLoading.value = false
    isInitialFetch = false
  }

  const fetchPage = async (cursor: PaginationCursor = null) => {
    if (isLoading.value && !isInitialFetch) return

    isLoading.value = true
    isInitialFetch = false
    error.value = null

    try {
      const query: Record<string, string | number> = { limit }
      const trimmedSearch = searchQuery.value.trim()

      if (status.value) query.status = status.value
      if (trimmedSearch) query.search = trimmedSearch
      if (createdAtFrom.value) query.createdAtFrom = createdAtFrom.value
      if (createdAtTo.value) query.createdAtTo = createdAtTo.value
      if (cursor) query.cursor = JSON.stringify(cursor)

      const result = await $fetch<AdminTransactionListResponse>("/api/admin/transactions", {
        query,
      })

      if (cursor) {
        transactions.value = [...transactions.value, ...result.transactions]
      } else {
        transactions.value = result.transactions
      }

      nextCursor.value = result.nextCursor as PaginationCursor
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

      error.value = "Unable to load admin transactions. Please try again."
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

  watch([status, createdAtFrom, createdAtTo], () => {
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
    transactions,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    fetchPage,
  }
}
