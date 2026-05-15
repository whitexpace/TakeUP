import { computed, ref } from "vue"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../server/trpc/routers"
import { useAccountPrefetch } from "./use-account-prefetch"
import { usePersistedSessionState } from "./use-persisted-session-state"

type RouterOutputs = inferRouterOutputs<AppRouter>
type TransactionListResponse = RouterOutputs["transaction"]["list"]
export type ReviewTransactionListItem = TransactionListResponse["transactions"][number]
export type ReviewDraftListItem = RouterOutputs["transaction"]["listReviewDrafts"][number]
export type SubmittedReviewListItem = RouterOutputs["transaction"]["listSubmittedReviews"][number]
export type ReviewLeaderboardEntry =
  RouterOutputs["review"]["borrowerLeaderboard"]["leaderboard"][number]
export type ReviewLeaderboards = {
  borrowers: ReviewLeaderboardEntry[]
  lenders: ReviewLeaderboardEntry[]
}

const ACCOUNT_REVIEWS_CACHE_TTL_MS = 2 * 60_000
const ACCOUNT_REVIEWS_SECONDARY_PREFETCH_DELAY_MS = 120
const ANONYMOUS_VIEWER_KEY = "anonymous"

const pendingReviewTransactionsRequests = new Map<string, Promise<ReviewTransactionListItem[]>>()
const pendingReviewDraftsRequests = new Map<string, Promise<ReviewDraftListItem[]>>()
const pendingSubmittedReviewsRequests = new Map<string, Promise<SubmittedReviewListItem[]>>()
const pendingReviewLeaderboardsRequests = new Map<string, Promise<ReviewLeaderboards>>()
let secondaryReviewsPrefetchTimer: ReturnType<typeof setTimeout> | null = null
let hasRevalidatedReviewsOnThisPage = false

const getViewerKey = () => {
  if (import.meta.server) {
    return useRequestEvent()?.context.authUser?.id ?? ANONYMOUS_VIEWER_KEY
  }

  if (typeof useSupabaseUser === "function") {
    return useSupabaseUser().value?.id ?? ANONYMOUS_VIEWER_KEY
  }

  return ANONYMOUS_VIEWER_KEY
}

const clearSecondaryReviewsPrefetchTimer = () => {
  if (secondaryReviewsPrefetchTimer) {
    clearTimeout(secondaryReviewsPrefetchTimer)
    secondaryReviewsPrefetchTimer = null
  }
}

export const useAccountReviews = () => {
  const transactionsData = usePersistedSessionState<ReviewTransactionListItem[] | null>(
    "account-reviews:transactions",
    () => null,
  )
  const draftsData = usePersistedSessionState<ReviewDraftListItem[] | null>(
    "account-reviews:drafts",
    () => null,
  )
  const historyData = usePersistedSessionState<SubmittedReviewListItem[] | null>(
    "account-reviews:history",
    () => null,
  )
  const leaderboardData = usePersistedSessionState<ReviewLeaderboards | null>(
    "account-reviews:leaderboards",
    () => null,
  )
  const reviewsViewerKey = usePersistedSessionState<string>(
    "account-reviews:viewer-key",
    () => ANONYMOUS_VIEWER_KEY,
  )
  const transactionsLoadedAt = usePersistedSessionState<number | null>(
    "account-reviews:transactions-loaded-at",
    () => null,
  )
  const draftsLoadedAt = usePersistedSessionState<number | null>(
    "account-reviews:drafts-loaded-at",
    () => null,
  )
  const historyLoadedAt = usePersistedSessionState<number | null>(
    "account-reviews:history-loaded-at",
    () => null,
  )
  const leaderboardsLoadedAt = usePersistedSessionState<number | null>(
    "account-reviews:leaderboards-loaded-at",
    () => null,
  )

  const transactionsPending = ref(false)
  const draftsPending = ref(false)
  const historyPending = ref(false)
  const leaderboardPending = ref(false)
  const transactionsError = ref<unknown>(null)
  const draftsError = ref<unknown>(null)
  const historyError = ref<unknown>(null)
  const leaderboardError = ref<unknown>(null)

  const applyViewerKey = (viewerKey: string) => {
    if (reviewsViewerKey.value !== viewerKey) {
      transactionsData.value = null
      draftsData.value = null
      historyData.value = null
      leaderboardData.value = null
      transactionsLoadedAt.value = null
      draftsLoadedAt.value = null
      historyLoadedAt.value = null
      leaderboardsLoadedAt.value = null
    }

    reviewsViewerKey.value = viewerKey
  }

  const isFresh = (loadedAt: number | null, hasData: boolean) =>
    hasData &&
    reviewsViewerKey.value === getViewerKey() &&
    loadedAt !== null &&
    Date.now() - loadedAt < ACCOUNT_REVIEWS_CACHE_TTL_MS

  const hasFreshTransactionsCache = computed(() =>
    isFresh(transactionsLoadedAt.value, transactionsData.value !== null),
  )
  const hasFreshDraftsCache = computed(() =>
    isFresh(draftsLoadedAt.value, draftsData.value !== null),
  )
  const hasFreshHistoryCache = computed(() =>
    isFresh(historyLoadedAt.value, historyData.value !== null),
  )
  const hasFreshLeaderboardsCache = computed(() =>
    isFresh(leaderboardsLoadedAt.value, leaderboardData.value !== null),
  )
  const hasFreshSecondaryCache = computed(
    () =>
      hasFreshDraftsCache.value && hasFreshHistoryCache.value && hasFreshLeaderboardsCache.value,
  )

  const fetchReviewTransactions = async (options: { force?: boolean } = {}) => {
    const viewerKey = getViewerKey()
    applyViewerKey(viewerKey)

    if (!options.force && hasFreshTransactionsCache.value) {
      return transactionsData.value ?? []
    }

    const pendingRequest = pendingReviewTransactionsRequests.get(viewerKey)
    if (!options.force && pendingRequest) {
      transactionsPending.value = true
      try {
        transactionsData.value = await pendingRequest
        return transactionsData.value ?? []
      } finally {
        transactionsPending.value = false
      }
    }

    const request = $fetch<TransactionListResponse>("/api/transactions", {
      query: {
        status: "COMPLETED",
        limit: 100,
      },
      credentials: "same-origin",
    })
      .then((response) => {
        applyViewerKey(viewerKey)
        transactionsData.value = response.transactions
        transactionsLoadedAt.value = Date.now()
        transactionsError.value = null
        return response.transactions
      })
      .catch(async (error: unknown) => {
        const httpStatus = (error as { statusCode?: number })?.statusCode
        if (httpStatus === 401) {
          await navigateTo("/")
        }

        transactionsError.value = error
        return transactionsData.value ?? []
      })
      .finally(() => {
        if (pendingReviewTransactionsRequests.get(viewerKey) === request) {
          pendingReviewTransactionsRequests.delete(viewerKey)
        }
      })

    pendingReviewTransactionsRequests.set(viewerKey, request)
    transactionsPending.value = true

    try {
      return await request
    } finally {
      transactionsPending.value = false
    }
  }

  const fetchReviewDrafts = async (options: { force?: boolean } = {}) => {
    const viewerKey = getViewerKey()
    applyViewerKey(viewerKey)

    if (!options.force && hasFreshDraftsCache.value) return draftsData.value ?? []

    const pendingRequest = pendingReviewDraftsRequests.get(viewerKey)
    if (!options.force && pendingRequest) {
      draftsPending.value = true
      try {
        draftsData.value = await pendingRequest
        return draftsData.value ?? []
      } finally {
        draftsPending.value = false
      }
    }

    const request = $fetch<ReviewDraftListItem[]>("/api/my-reviews/drafts", {
      credentials: "same-origin",
    })
      .then((response) => {
        applyViewerKey(viewerKey)
        draftsData.value = response
        draftsLoadedAt.value = Date.now()
        draftsError.value = null
        return response
      })
      .catch((error: unknown) => {
        draftsError.value = error
        return draftsData.value ?? []
      })
      .finally(() => {
        if (pendingReviewDraftsRequests.get(viewerKey) === request) {
          pendingReviewDraftsRequests.delete(viewerKey)
        }
      })

    pendingReviewDraftsRequests.set(viewerKey, request)
    draftsPending.value = true

    try {
      return await request
    } finally {
      draftsPending.value = false
    }
  }

  const fetchSubmittedReviews = async (options: { force?: boolean } = {}) => {
    const viewerKey = getViewerKey()
    applyViewerKey(viewerKey)

    if (!options.force && hasFreshHistoryCache.value) return historyData.value ?? []

    const pendingRequest = pendingSubmittedReviewsRequests.get(viewerKey)
    if (!options.force && pendingRequest) {
      historyPending.value = true
      try {
        historyData.value = await pendingRequest
        return historyData.value ?? []
      } finally {
        historyPending.value = false
      }
    }

    const request = $fetch<SubmittedReviewListItem[]>("/api/my-reviews/submitted", {
      credentials: "same-origin",
    })
      .then((response) => {
        applyViewerKey(viewerKey)
        historyData.value = response
        historyLoadedAt.value = Date.now()
        historyError.value = null
        return response
      })
      .catch((error: unknown) => {
        historyError.value = error
        return historyData.value ?? []
      })
      .finally(() => {
        if (pendingSubmittedReviewsRequests.get(viewerKey) === request) {
          pendingSubmittedReviewsRequests.delete(viewerKey)
        }
      })

    pendingSubmittedReviewsRequests.set(viewerKey, request)
    historyPending.value = true

    try {
      return await request
    } finally {
      historyPending.value = false
    }
  }

  const fetchReviewLeaderboards = async (options: { force?: boolean } = {}) => {
    const viewerKey = getViewerKey()
    applyViewerKey(viewerKey)

    if (!options.force && hasFreshLeaderboardsCache.value) {
      return leaderboardData.value ?? { borrowers: [], lenders: [] }
    }

    const pendingRequest = pendingReviewLeaderboardsRequests.get(viewerKey)
    if (!options.force && pendingRequest) {
      leaderboardPending.value = true
      try {
        leaderboardData.value = await pendingRequest
        return leaderboardData.value ?? { borrowers: [], lenders: [] }
      } finally {
        leaderboardPending.value = false
      }
    }

    const request = Promise.all([
      $fetch<{ leaderboard: ReviewLeaderboardEntry[] }>("/api/reviews/leaderboard/borrowers", {
        credentials: "same-origin",
      }),
      $fetch<{ leaderboard: ReviewLeaderboardEntry[] }>("/api/reviews/leaderboard/lenders", {
        credentials: "same-origin",
      }),
    ])
      .then(([borrowersResponse, lendersResponse]) => {
        const response = {
          borrowers: borrowersResponse.leaderboard,
          lenders: lendersResponse.leaderboard,
        }
        applyViewerKey(viewerKey)
        leaderboardData.value = response
        leaderboardsLoadedAt.value = Date.now()
        leaderboardError.value = null
        return response
      })
      .catch((error: unknown) => {
        leaderboardError.value = error
        return leaderboardData.value ?? { borrowers: [], lenders: [] }
      })
      .finally(() => {
        if (pendingReviewLeaderboardsRequests.get(viewerKey) === request) {
          pendingReviewLeaderboardsRequests.delete(viewerKey)
        }
      })

    pendingReviewLeaderboardsRequests.set(viewerKey, request)
    leaderboardPending.value = true

    try {
      return await request
    } finally {
      leaderboardPending.value = false
    }
  }

  const fetchSecondaryReviewsData = () =>
    Promise.all([fetchReviewDrafts(), fetchSubmittedReviews(), fetchReviewLeaderboards()])

  const refreshReviewTransactions = () => fetchReviewTransactions({ force: true })
  const refreshReviewDrafts = () => fetchReviewDrafts({ force: true })
  const refreshSubmittedReviews = () => fetchSubmittedReviews({ force: true })
  const refreshReviewLeaderboards = () => fetchReviewLeaderboards({ force: true })

  return {
    transactionsData,
    draftsData,
    historyData,
    leaderboardData,
    transactionsPending,
    draftsPending,
    historyPending,
    leaderboardPending,
    transactionsError,
    draftsError,
    historyError,
    leaderboardError,
    hasFreshTransactionsCache,
    hasFreshDraftsCache,
    hasFreshHistoryCache,
    hasFreshLeaderboardsCache,
    hasFreshSecondaryCache,
    fetchReviewTransactions,
    fetchReviewDrafts,
    fetchSubmittedReviews,
    fetchReviewLeaderboards,
    fetchSecondaryReviewsData,
    refreshReviewTransactions,
    refreshReviewDrafts,
    refreshSubmittedReviews,
    refreshReviewLeaderboards,
  }
}

export const useAccountReviewsPrefetch = () => {
  const user = typeof useSupabaseUser === "function" ? useSupabaseUser() : null
  const { warmAccount } = useAccountPrefetch()
  const {
    hasFreshTransactionsCache,
    hasFreshDraftsCache,
    hasFreshHistoryCache,
    hasFreshLeaderboardsCache,
    hasFreshSecondaryCache,
    fetchReviewTransactions,
    fetchReviewDrafts,
    fetchSubmittedReviews,
    fetchReviewLeaderboards,
  } = useAccountReviews()

  const warmAccountReviews = (targetPath = "/account/reviews") => {
    if (!import.meta.client) return Promise.resolve()
    if (user && !user.value) return Promise.resolve()

    void preloadRouteComponents("/account/reviews").catch(() => {})

    const shouldRevalidate = !hasRevalidatedReviewsOnThisPage
    hasRevalidatedReviewsOnThisPage = true

    if (!shouldRevalidate && hasFreshTransactionsCache.value && hasFreshSecondaryCache.value) {
      return Promise.resolve()
    }

    return (async () => {
      await warmAccount(targetPath)

      await fetchReviewTransactions({ force: shouldRevalidate || !hasFreshTransactionsCache.value })

      if (!shouldRevalidate && hasFreshSecondaryCache.value) return

      clearSecondaryReviewsPrefetchTimer()
      secondaryReviewsPrefetchTimer = setTimeout(() => {
        secondaryReviewsPrefetchTimer = null
        void Promise.all([
          fetchReviewDrafts({ force: shouldRevalidate || !hasFreshDraftsCache.value }),
          fetchSubmittedReviews({ force: shouldRevalidate || !hasFreshHistoryCache.value }),
          fetchReviewLeaderboards({ force: shouldRevalidate || !hasFreshLeaderboardsCache.value }),
        ])
      }, ACCOUNT_REVIEWS_SECONDARY_PREFETCH_DELAY_MS)
    })().catch(() => {})
  }

  return {
    warmAccountReviews,
  }
}
