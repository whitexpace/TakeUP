import { useState } from "#app"

export const useLikes = () => {
  const likesCount = useState<number>("likes-count", () => 0)
  const isLoading = useState<boolean>("likes-loading", () => false)
  const hasLoaded = useState<boolean>("likes-loaded", () => false)

  const loadLikesCount = async (options: { force?: boolean } = {}) => {
    if (isLoading.value && !options.force) return
    if (hasLoaded.value && !options.force) return

    isLoading.value = true

    try {
      const supabase = useSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const response = await $fetch<{ count: number }>("/api/items/count", {
        query: {
          likedOnly: "true",
        },
        headers: session?.access_token
          ? {
              Authorization: `Bearer ${session.access_token}`,
            }
          : undefined,
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
