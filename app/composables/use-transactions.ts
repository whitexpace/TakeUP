import { computed, ref, watch, type Ref } from "vue"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../server/trpc/routers"
import type { TransactionStatus } from "#shared/schemas/transaction"
import { addBoundedSetEntry, pruneExpiredEntries, setBoundedMapEntry } from "../utils/bounded-cache"
import { useAccountPrefetch } from "./use-account-prefetch"

type RouterOutputs = inferRouterOutputs<AppRouter>
export type TransactionListItem = RouterOutputs["transaction"]["list"]["transactions"][number]

type TransactionListResponse = RouterOutputs["transaction"]["list"]
type TransactionRole = "LENDER" | "BORROWER"
type PaginationCursor = { id: string; createdAt: Date | string } | null
type TransactionQuery = {
  role: TransactionRole
  status: TransactionStatus | null
  limit: number
  cursor: PaginationCursor
}

type UseTransactionsOptions = {
  role: Ref<TransactionRole>
  status: Ref<TransactionStatus | null>
  searchQuery: Ref<string>
}

type TransactionPageCacheEntry = {
  expiresAt: number
  response: TransactionListResponse
}

const TRANSACTION_PAGE_LIMIT = 20
const TRANSACTION_CACHE_TTL_MS = 5 * 60_000
const TRANSACTION_LOOKAHEAD_DELAY_MS = 450
const MAX_WARMED_TRANSACTION_IMAGE_URLS = 80
const MAX_TRANSACTION_CACHE_ENTRIES = 48

const transactionPageCache = new Map<string, TransactionPageCacheEntry>()
const pendingTransactionPageRequests = new Map<string, Promise<TransactionListResponse>>()
const warmedTransactionImageUrls = new Set<string>()
let lookaheadTimer: ReturnType<typeof setTimeout> | null = null

const cloneTransactionListResponse = (response: TransactionListResponse): TransactionListResponse =>
  structuredClone(response)

const serializeTransactionQuery = (query: Record<string, string | number | undefined>) =>
  Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join("&")

const getTransactionViewerKey = () => {
  if (import.meta.server) {
    return useRequestEvent()?.context.authUser?.id ?? "anonymous"
  }

  if (typeof useSupabaseUser === "function") {
    return useSupabaseUser().value?.id ?? "anonymous"
  }

  return "anonymous"
}

const buildTransactionRequestQuery = ({ role, status, limit, cursor }: TransactionQuery) => ({
  limit,
  role,
  status: status ?? undefined,
  cursor: cursor ? JSON.stringify(cursor) : undefined,
})

const buildTransactionCacheKey = (query: TransactionQuery) =>
  `${getTransactionViewerKey()}:${serializeTransactionQuery(buildTransactionRequestQuery(query))}`

const getCachedTransactionPage = (cacheKey: string) => {
  pruneExpiredEntries(transactionPageCache)
  const cachedEntry = transactionPageCache.get(cacheKey)
  if (!cachedEntry) return null

  if (cachedEntry.expiresAt <= Date.now()) {
    transactionPageCache.delete(cacheKey)
    return null
  }

  return cloneTransactionListResponse(cachedEntry.response)
}

const warmTransactionImage = (src: string | null | undefined) => {
  if (!import.meta.client || !src || warmedTransactionImageUrls.has(src)) return

  if (warmedTransactionImageUrls.size >= MAX_WARMED_TRANSACTION_IMAGE_URLS) {
    const oldestUrl = warmedTransactionImageUrls.values().next().value
    if (oldestUrl) warmedTransactionImageUrls.delete(oldestUrl)
  }

  const browserImage = new Image()
  const priorityImage = browserImage as HTMLImageElement & {
    fetchPriority?: "high" | "low" | "auto"
  }

  browserImage.decoding = "async"
  if ("fetchPriority" in priorityImage) {
    priorityImage.fetchPriority = "low"
  }
  browserImage.src = src
  addBoundedSetEntry(warmedTransactionImageUrls, src, MAX_WARMED_TRANSACTION_IMAGE_URLS)
}

const warmTransactionImages = (transactions: TransactionListItem[]) => {
  for (const transaction of transactions.slice(0, 8)) {
    warmTransactionImage(transaction.item.thumbnailImage)
  }
}

const setCachedTransactionPage = (cacheKey: string, response: TransactionListResponse) => {
  pruneExpiredEntries(transactionPageCache)
  setBoundedMapEntry(
    transactionPageCache,
    cacheKey,
    {
      expiresAt: Date.now() + TRANSACTION_CACHE_TTL_MS,
      response: cloneTransactionListResponse(response),
    },
    MAX_TRANSACTION_CACHE_ENTRIES,
  )
  warmTransactionImages(response.transactions)
}

const fetchTransactionPageResponse = async (
  query: TransactionQuery,
  options: { force?: boolean } = {},
) => {
  const cacheKey = buildTransactionCacheKey(query)

  if (!options.force) {
    const cachedResponse = getCachedTransactionPage(cacheKey)
    if (cachedResponse) {
      return cachedResponse
    }

    const pendingRequest = pendingTransactionPageRequests.get(cacheKey)
    if (pendingRequest) {
      return cloneTransactionListResponse(await pendingRequest)
    }
  }

  const request = $fetch<TransactionListResponse>("/api/transactions", {
    query: buildTransactionRequestQuery(query),
  })
    .then((response) => {
      setCachedTransactionPage(cacheKey, response)
      return response
    })
    .finally(() => {
      if (pendingTransactionPageRequests.get(cacheKey) === request) {
        pendingTransactionPageRequests.delete(cacheKey)
      }
    })

  pendingTransactionPageRequests.set(cacheKey, request)
  return cloneTransactionListResponse(await request)
}

const cancelLookaheadPrefetch = () => {
  if (lookaheadTimer !== null) {
    clearTimeout(lookaheadTimer)
    lookaheadTimer = null
  }
}

const scheduleLookaheadPrefetch = (query: TransactionQuery, nextCursor: PaginationCursor) => {
  if (!import.meta.client || !nextCursor) return

  cancelLookaheadPrefetch()
  lookaheadTimer = setTimeout(() => {
    lookaheadTimer = null
    void fetchTransactionPageResponse({ ...query, cursor: nextCursor }).catch(() => {})
  }, TRANSACTION_LOOKAHEAD_DELAY_MS)
}

export const resetTransactionsCache = () => {
  transactionPageCache.clear()
  pendingTransactionPageRequests.clear()
  warmedTransactionImageUrls.clear()
  cancelLookaheadPrefetch()
}

export const prefetchTransactionHistory = async (
  role: TransactionRole,
  options: {
    status?: TransactionStatus | null
    limit?: number
    prefetchNextPage?: boolean
    priority?: boolean
  } = {},
) => {
  if (options.priority) {
    cancelLookaheadPrefetch()
  }

  const query: TransactionQuery = {
    role,
    status: options.status ?? null,
    limit: options.limit ?? TRANSACTION_PAGE_LIMIT,
    cursor: null,
  }

  const response = await fetchTransactionPageResponse(query)

  if (options.prefetchNextPage && response.nextCursor) {
    scheduleLookaheadPrefetch(query, response.nextCursor as PaginationCursor)
  }

  return response
}

export const useTransactionHistoryPrefetch = () => {
  const { warmAccount } = useAccountPrefetch()
  const user = typeof useSupabaseUser === "function" ? useSupabaseUser() : null

  const warmTransactionHistory = (
    role: TransactionRole = "BORROWER",
    options: {
      targetPath?: string
      priority?: boolean
      prefetchNextPage?: boolean
    } = {},
  ) => {
    if (!import.meta.client) return Promise.resolve()
    if (user && !user.value) return Promise.resolve()

    const targetPath = options.targetPath ?? "/account/transactions"
    void preloadRouteComponents("/account/transactions").catch(() => {})

    return (async () => {
      await warmAccount(targetPath)
      await prefetchTransactionHistory(role, {
        priority: options.priority,
        prefetchNextPage: options.prefetchNextPage ?? role === "BORROWER",
      })
    })().catch(() => {})
  }

  return {
    warmTransactionHistory,
  }
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

const mergeUniqueTransactions = (
  existingTransactions: TransactionListItem[],
  nextTransactions: TransactionListItem[],
) => {
  const existingIds = new Set(existingTransactions.map((transaction) => transaction.id))
  return [
    ...existingTransactions,
    ...nextTransactions.filter((transaction) => !existingIds.has(transaction.id)),
  ]
}

export const useTransactions = ({ role, status, searchQuery }: UseTransactionsOptions) => {
  const transactions = ref<TransactionListItem[]>([])
  const isLoading = ref(true)
  const error = ref<string | null>(null)
  const nextCursor = ref<PaginationCursor>(null)
  const requestVersion = ref(0)
  const hasMore = computed(() => nextCursor.value !== null)
  let isInitialFetch = true

  const reset = () => {
    requestVersion.value += 1
    transactions.value = []
    nextCursor.value = null
    error.value = null
    isLoading.value = false
    isInitialFetch = false
  }

  const applyResponse = (
    response: TransactionListResponse,
    cursor: PaginationCursor,
    version: number,
  ) => {
    if (version !== requestVersion.value) return

    transactions.value = cursor
      ? mergeUniqueTransactions(transactions.value, response.transactions)
      : response.transactions

    nextCursor.value = response.nextCursor as PaginationCursor
  }

  const fetchPage = async (cursor: PaginationCursor = null, options: { force?: boolean } = {}) => {
    if (isLoading.value && !isInitialFetch) return

    const version = requestVersion.value
    const query: TransactionQuery = {
      role: role.value,
      status: status.value,
      limit: TRANSACTION_PAGE_LIMIT,
      cursor,
    }
    const cachedResponse = options.force
      ? null
      : getCachedTransactionPage(buildTransactionCacheKey(query))

    if (cachedResponse) {
      applyResponse(cachedResponse, cursor, version)
      isLoading.value = false
      isInitialFetch = false
      return
    }

    isLoading.value = true
    isInitialFetch = false
    error.value = null

    try {
      const result = await fetchTransactionPageResponse(query, { force: options.force })
      applyResponse(result, cursor, version)
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode
      if (status === 401) {
        await navigateTo("/")
        return
      }

      if (version === requestVersion.value) {
        error.value = "Unable to load transactions. Please try again."
      }
    } finally {
      if (version === requestVersion.value) {
        isLoading.value = false
      }
    }
  }

  const loadMore = () => {
    if (!hasMore.value || isLoading.value) return Promise.resolve()
    return fetchPage(nextCursor.value)
  }

  const refresh = async () => {
    reset()
    await fetchPage(null, { force: true })
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
