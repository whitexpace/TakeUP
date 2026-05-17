import { computed, ref } from "vue"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../server/trpc/routers"
import { useAccountPrefetch } from "./use-account-prefetch"
import { usePersistedSessionState } from "./use-persisted-session-state"

type RouterOutputs = inferRouterOutputs<AppRouter>
export type RewardsSummary = RouterOutputs["rewards"]["summary"]
export type ActiveBoost = RouterOutputs["rewards"]["activeBoosts"][number]

const REWARDS_CACHE_TTL_MS = 2 * 60_000
const REWARDS_ACTIVE_BOOSTS_PREFETCH_DELAY_MS = 120
const ANONYMOUS_VIEWER_KEY = "anonymous"

const pendingRewardsSummaryRequests = new Map<string, Promise<RewardsSummary | null>>()
const pendingActiveBoostsRequests = new Map<string, Promise<ActiveBoost[]>>()
let activeBoostsPrefetchTimer: ReturnType<typeof setTimeout> | null = null

const getViewerKey = () => {
  if (import.meta.server) {
    return useRequestEvent()?.context.authUser?.id ?? ANONYMOUS_VIEWER_KEY
  }

  if (typeof useSupabaseUser === "function") {
    return useSupabaseUser().value?.id ?? ANONYMOUS_VIEWER_KEY
  }

  return ANONYMOUS_VIEWER_KEY
}

const clearActiveBoostsPrefetchTimer = () => {
  if (activeBoostsPrefetchTimer) {
    clearTimeout(activeBoostsPrefetchTimer)
    activeBoostsPrefetchTimer = null
  }
}

export const useRewards = () => {
  const summary = usePersistedSessionState<RewardsSummary | null>("rewards:summary", () => null)
  const activeBoostsResponse = usePersistedSessionState<ActiveBoost[] | null>(
    "rewards:active-boosts",
    () => null,
  )
  const rewardsViewerKey = usePersistedSessionState<string>(
    "rewards:viewer-key",
    () => ANONYMOUS_VIEWER_KEY,
  )
  const summaryLastLoadedAt = usePersistedSessionState<number | null>(
    "rewards:summary-loaded-at",
    () => null,
  )
  const boostsLastLoadedAt = usePersistedSessionState<number | null>(
    "rewards:boosts-loaded-at",
    () => null,
  )
  const summaryPending = ref(false)
  const boostsPending = ref(false)
  const summaryError = ref<unknown>(null)
  const boostsError = ref<unknown>(null)

  const hasFreshSummaryCache = computed(
    () =>
      summary.value !== null &&
      rewardsViewerKey.value === getViewerKey() &&
      summaryLastLoadedAt.value !== null &&
      Date.now() - summaryLastLoadedAt.value < REWARDS_CACHE_TTL_MS,
  )
  const hasFreshBoostsCache = computed(
    () =>
      rewardsViewerKey.value === getViewerKey() &&
      boostsLastLoadedAt.value !== null &&
      Date.now() - boostsLastLoadedAt.value < REWARDS_CACHE_TTL_MS,
  )

  const applyViewerKey = (viewerKey: string) => {
    if (rewardsViewerKey.value !== viewerKey) {
      summary.value = null
      activeBoostsResponse.value = null
      summaryLastLoadedAt.value = null
      boostsLastLoadedAt.value = null
    }

    rewardsViewerKey.value = viewerKey
  }

  const fetchRewardsSummary = async (options: { force?: boolean } = {}) => {
    const viewerKey = getViewerKey()
    applyViewerKey(viewerKey)

    if (!options.force && hasFreshSummaryCache.value) {
      return summary.value
    }

    const pendingRequest = pendingRewardsSummaryRequests.get(viewerKey)
    if (!options.force && pendingRequest) {
      summaryPending.value = true
      try {
        summary.value = await pendingRequest
        return summary.value
      } finally {
        summaryPending.value = false
      }
    }

    const request = $fetch<RewardsSummary>("/api/rewards", {
      credentials: "same-origin",
    })
      .then((response) => {
        applyViewerKey(viewerKey)
        summary.value = response
        summaryLastLoadedAt.value = Date.now()
        summaryError.value = null
        return response
      })
      .catch(async (error: unknown) => {
        const httpStatus = (error as { statusCode?: number })?.statusCode
        if (httpStatus === 401) {
          await navigateTo("/")
          return null
        }

        summaryError.value = error
        return summary.value
      })
      .finally(() => {
        if (pendingRewardsSummaryRequests.get(viewerKey) === request) {
          pendingRewardsSummaryRequests.delete(viewerKey)
        }
      })

    pendingRewardsSummaryRequests.set(viewerKey, request)
    summaryPending.value = true

    try {
      return await request
    } finally {
      summaryPending.value = false
    }
  }

  const fetchActiveBoosts = async (options: { force?: boolean } = {}) => {
    const viewerKey = getViewerKey()
    applyViewerKey(viewerKey)

    if (!options.force && hasFreshBoostsCache.value) {
      return activeBoostsResponse.value ?? []
    }

    const pendingRequest = pendingActiveBoostsRequests.get(viewerKey)
    if (!options.force && pendingRequest) {
      boostsPending.value = true
      try {
        activeBoostsResponse.value = await pendingRequest
        return activeBoostsResponse.value ?? []
      } finally {
        boostsPending.value = false
      }
    }

    const request = $fetch<ActiveBoost[]>("/api/rewards/boosts/active", {
      credentials: "same-origin",
    })
      .then((response) => {
        applyViewerKey(viewerKey)
        activeBoostsResponse.value = response
        boostsLastLoadedAt.value = Date.now()
        boostsError.value = null
        return response
      })
      .catch((error: unknown) => {
        boostsError.value = error
        return activeBoostsResponse.value ?? []
      })
      .finally(() => {
        if (pendingActiveBoostsRequests.get(viewerKey) === request) {
          pendingActiveBoostsRequests.delete(viewerKey)
        }
      })

    pendingActiveBoostsRequests.set(viewerKey, request)
    boostsPending.value = true

    try {
      return await request
    } finally {
      boostsPending.value = false
    }
  }

  const refreshRewardsSummary = () => fetchRewardsSummary({ force: true })
  const refreshActiveBoosts = () => fetchActiveBoosts({ force: true })

  return {
    summary,
    activeBoostsResponse,
    summaryPending,
    boostsPending,
    summaryError,
    boostsError,
    hasFreshSummaryCache,
    hasFreshBoostsCache,
    fetchRewardsSummary,
    fetchActiveBoosts,
    refreshRewardsSummary,
    refreshActiveBoosts,
  }
}

export const useRewardsPrefetch = () => {
  const user = typeof useSupabaseUser === "function" ? useSupabaseUser() : null
  const { warmAccount } = useAccountPrefetch()
  const { hasFreshSummaryCache, hasFreshBoostsCache, fetchRewardsSummary, fetchActiveBoosts } =
    useRewards()

  const warmRewards = (targetPath = "/account/rewards") => {
    if (!import.meta.client) return Promise.resolve()
    if (user && !user.value) return Promise.resolve()

    void preloadRouteComponents("/account/rewards").catch(() => {})

    if (hasFreshSummaryCache.value && hasFreshBoostsCache.value) {
      return Promise.resolve()
    }

    return (async () => {
      await warmAccount(targetPath)

      if (!hasFreshSummaryCache.value) {
        await fetchRewardsSummary()
      }

      if (hasFreshBoostsCache.value) return

      clearActiveBoostsPrefetchTimer()
      activeBoostsPrefetchTimer = setTimeout(() => {
        activeBoostsPrefetchTimer = null
        void fetchActiveBoosts()
      }, REWARDS_ACTIVE_BOOSTS_PREFETCH_DELAY_MS)
    })().catch(() => {})
  }

  return {
    warmRewards,
  }
}
