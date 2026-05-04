import { computed, ref, watch } from "vue"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../server/trpc/routers"
import type { TransactionStatus } from "#shared/schemas/transaction"

type RouterOutputs = inferRouterOutputs<AppRouter>
export type TransactionListItem = RouterOutputs["transaction"]["list"]["transactions"][number]

type TransactionListResponse = RouterOutputs["transaction"]["list"]

type PaginationCursor = { id: string; createdAt: Date } | null

type UseTransactionsOptions = {
  role: Ref<"LENDER" | "BORROWER">
  status: Ref<TransactionStatus | null>
  searchQuery: Ref<string>
}

const formatCounterpartName = (user: {
  firstName: string
  middleName: string | null
  lastName: string
}) => {
  const first = (user.firstName || "").trim()
  const last = (user.lastName || "").trim()

  if (last.toLowerCase() === "user" || !last) {
    return first.charAt(0).toUpperCase() + first.slice(1)
  }

  const lastInitial = last.charAt(0).toUpperCase()
  return `${first} ${lastInitial}.`
}

export const useTransactions = ({ role, status, searchQuery }: UseTransactionsOptions) => {
  const transactions = ref<TransactionListItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const nextCursor = ref<PaginationCursor>(null)
  const hasMore = computed(() => nextCursor.value !== null)

  const reset = () => {
    transactions.value = []
    nextCursor.value = null
    error.value = null
    isLoading.value = false
  }

  const fetchPage = async (cursor: PaginationCursor = null) => {
    if (isLoading.value) return
    isLoading.value = true
    error.value = null

    try {
      const query: Record<string, string | number> = { limit: 20 }
      if (role.value) query.role = role.value
      if (status.value) query.status = status.value
      if (cursor) query.cursor = JSON.stringify(cursor)

      const result = await $fetch<TransactionListResponse>("/api/transactions", { query })

      if (cursor) {
        transactions.value = [...transactions.value, ...result.transactions]
      } else {
        transactions.value = result.transactions
      }

      nextCursor.value = result.nextCursor as PaginationCursor
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode
      if (status === 401) {
        await navigateTo("/")
        return
      }
      error.value = "Unable to load transactions. Please try again."
    } finally {
      isLoading.value = false
    }
  }

  const loadMore = () => {
    if (!hasMore.value || isLoading.value) return
    fetchPage(nextCursor.value)
  }

  const refresh = async () => {
    reset()
    await fetchPage()
  }

  watch([role, status], () => {
    reset()
    fetchPage()
  })

  const filteredTransactions = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return transactions.value

    return transactions.value.filter((tx: TransactionListItem) => {
      const itemName = tx.item.name.toLowerCase()
      const orderId = tx.id.slice(0, 16).toUpperCase().toLowerCase()
      const counterpart =
        role.value === "BORROWER"
          ? formatCounterpartName(tx.lender.user).toLowerCase()
          : formatCounterpartName(tx.borrower.user).toLowerCase()

      return itemName.includes(q) || orderId.includes(q) || counterpart.includes(q)
    })
  })

  return {
    transactions,
    filteredTransactions,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    fetchPage,
  }
}
