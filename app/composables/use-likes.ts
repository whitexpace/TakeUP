import { useState } from "#app"
import { usePersistedSessionState } from "./use-persisted-session-state"
import { recordPerfEvent, withPerfTimer } from "../utils/performance-telemetry"
import { useViewerSession } from "./use-viewer-session"

const LIKES_COUNT_CACHE_TTL_MS = 30_000

export const useLikes = () => {
  const likesCount = usePersistedSessionState<number>("likes-count", () => 0)
  const isLoading = useState<boolean>("likes-loading", () => false)
  const hasLoaded = usePersistedSessionState<boolean>("likes-loaded", () => false)
  const lastLoadedAt = usePersistedSessionState<number | null>("likes-last-loaded-at", () => null)

  const loadLikesCount = async (options: { force?: boolean } = {}) => {
    if (isLoading.value && !options.force) return
    if (
      hasLoaded.value &&
      lastLoadedAt.value !== null &&
      Date.now() - lastLoadedAt.value < LIKES_COUNT_CACHE_TTL_MS &&
      !options.force
    ) {
      recordPerfEvent("likes", "count", "cache-hit")
      return
    }

    if (hasLoaded.value && !options.force) {
      recordPerfEvent("likes", "count", "cache-stale")
    } else if (options.force) {
      recordPerfEvent("likes", "count", "cache-bypass")
    } else {
      recordPerfEvent("likes", "count", "cache-miss")
    }

    isLoading.value = true

    try {
      const { getAuthHeaders } = useViewerSession()
      const response = await withPerfTimer("likes", "count", async () =>
        $fetch<{ count: number }>("/api/items/count", {
          query: {
            likedOnly: "true",
          },
          headers: await getAuthHeaders(),
        }),
      )
      likesCount.value = response.count
      hasLoaded.value = true
      lastLoadedAt.value = Date.now()
    } catch (error) {
      console.error("Failed to load likes count:", error)
      likesCount.value = 0
    } finally {
      isLoading.value = false
    }
  }

  const incrementLikes = () => {
    likesCount.value++
  }

  const decrementLikes = () => {
    likesCount.value = Math.max(0, likesCount.value - 1)
  }

  return {
    likesCount,
    loadLikesCount,
    incrementLikes,
    decrementLikes,
  }
}
