import { useState } from "#app"
import { useViewerSession } from "./use-viewer-session"

export const useLikes = () => {
  const likesCount = useState<number>("likes-count", () => 0)
  const isLoading = useState<boolean>("likes-loading", () => false)
  const hasLoaded = useState<boolean>("likes-loaded", () => false)

  const loadLikesCount = async (options: { force?: boolean } = {}) => {
    if (isLoading.value && !options.force) return
    if (hasLoaded.value && !options.force) return

    isLoading.value = true

    try {
      const { getAuthHeaders } = useViewerSession()
      const response = await $fetch<{ count: number }>("/api/items/count", {
        query: {
          likedOnly: "true",
        },
        headers: await getAuthHeaders(),
      })
      likesCount.value = response.count
      hasLoaded.value = true
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
