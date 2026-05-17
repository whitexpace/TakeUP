import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../server/trpc/routers"
import { useAccountPrefetch } from "./use-account-prefetch"

type RouterOutputs = inferRouterOutputs<AppRouter>
type MyDisputesResponse = RouterOutputs["dispute"]["mine"]
type ReportableTransactionsResponse = RouterOutputs["dispute"]["reportableTransactions"]

type CacheEntry<T> = {
  expiresAt: number
  response: T
}

const ACCOUNT_DISPUTES_CACHE_TTL_MS = 5 * 60_000

const myDisputesCache = new Map<string, CacheEntry<MyDisputesResponse>>()
const reportableTransactionsCache = new Map<string, CacheEntry<ReportableTransactionsResponse>>()
const pendingMyDisputesRequests = new Map<string, Promise<MyDisputesResponse>>()
const pendingReportableTransactionsRequests = new Map<
  string,
  Promise<ReportableTransactionsResponse>
>()

const cloneResponse = <T>(response: T): T => structuredClone(response)

const getViewerKey = () => {
  if (import.meta.server) {
    return useRequestEvent()?.context.authUser?.id ?? "anonymous"
  }

  if (typeof useSupabaseUser === "function") {
    return useSupabaseUser().value?.id ?? "anonymous"
  }

  return "anonymous"
}

const getCachedResponse = <T>(cache: Map<string, CacheEntry<T>>, cacheKey: string) => {
  const cachedEntry = cache.get(cacheKey)
  if (!cachedEntry) return null

  if (cachedEntry.expiresAt <= Date.now()) {
    cache.delete(cacheKey)
    return null
  }

  return cloneResponse(cachedEntry.response)
}

const setCachedResponse = <T>(cache: Map<string, CacheEntry<T>>, cacheKey: string, response: T) => {
  cache.set(cacheKey, {
    expiresAt: Date.now() + ACCOUNT_DISPUTES_CACHE_TTL_MS,
    response: cloneResponse(response),
  })
}

export const clearAccountDisputesCache = () => {
  const viewerKey = getViewerKey()

  myDisputesCache.delete(viewerKey)
  reportableTransactionsCache.delete(viewerKey)
  pendingMyDisputesRequests.delete(viewerKey)
  pendingReportableTransactionsRequests.delete(viewerKey)
}

export const fetchMyDisputes = async (options: { force?: boolean } = {}) => {
  const cacheKey = getViewerKey()

  if (!options.force) {
    const cachedResponse = getCachedResponse(myDisputesCache, cacheKey)
    if (cachedResponse) return cachedResponse

    const pendingRequest = pendingMyDisputesRequests.get(cacheKey)
    if (pendingRequest) return cloneResponse(await pendingRequest)
  }

  const request = $fetch<MyDisputesResponse>("/api/my-disputes", {
    credentials: "same-origin",
  })
    .then((response) => {
      setCachedResponse(myDisputesCache, cacheKey, response)
      return response
    })
    .finally(() => {
      if (pendingMyDisputesRequests.get(cacheKey) === request) {
        pendingMyDisputesRequests.delete(cacheKey)
      }
    })

  pendingMyDisputesRequests.set(cacheKey, request)
  return cloneResponse(await request)
}

export const fetchDisputeReportableTransactions = async (options: { force?: boolean } = {}) => {
  const cacheKey = getViewerKey()

  if (!options.force) {
    const cachedResponse = getCachedResponse(reportableTransactionsCache, cacheKey)
    if (cachedResponse) return cachedResponse

    const pendingRequest = pendingReportableTransactionsRequests.get(cacheKey)
    if (pendingRequest) return cloneResponse(await pendingRequest)
  }

  const request = $fetch<ReportableTransactionsResponse>("/api/dispute-reportable-transactions", {
    credentials: "same-origin",
  })
    .then((response) => {
      setCachedResponse(reportableTransactionsCache, cacheKey, response)
      return response
    })
    .finally(() => {
      if (pendingReportableTransactionsRequests.get(cacheKey) === request) {
        pendingReportableTransactionsRequests.delete(cacheKey)
      }
    })

  pendingReportableTransactionsRequests.set(cacheKey, request)
  return cloneResponse(await request)
}

export const prefetchAccountDisputes = async () => {
  const [reportableTransactions, disputes] = await Promise.all([
    fetchDisputeReportableTransactions(),
    fetchMyDisputes(),
  ])

  return { reportableTransactions, disputes }
}

export const useAccountDisputesPrefetch = () => {
  const { warmAccount } = useAccountPrefetch()
  const user = typeof useSupabaseUser === "function" ? useSupabaseUser() : null

  const warmAccountDisputes = (targetPath = "/account/disputes") => {
    if (!import.meta.client) return Promise.resolve()
    if (user && !user.value) return Promise.resolve()

    void preloadRouteComponents("/account/disputes").catch(() => {})

    return (async () => {
      await warmAccount(targetPath)
      await prefetchAccountDisputes()
    })().catch(() => {})
  }

  return {
    clearAccountDisputesCache,
    fetchDisputeReportableTransactions,
    fetchMyDisputes,
    prefetchAccountDisputes,
    warmAccountDisputes,
  }
}
