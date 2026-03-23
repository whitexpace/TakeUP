import { ref } from "vue"
import type { RequestFeedPost, RequestFeedResponse } from "../types/request-feed"

export const useRequestFeed = () => {
  const posts = ref<RequestFeedPost[]>([])
  const isLoading = ref(false)
  const errorMessage = ref<string | null>(null)

  const refresh = async () => {
    isLoading.value = true
    errorMessage.value = null

    try {
      const response = await $fetch<RequestFeedResponse>("/api/requests")
      posts.value = response.posts
    } catch {
      posts.value = []
      errorMessage.value = "Unable to load active requests."
    } finally {
      isLoading.value = false
    }
  }

  return {
    posts,
    isLoading,
    errorMessage,
    refresh,
  }
}
