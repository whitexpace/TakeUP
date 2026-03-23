import { ref } from "vue"
import type {
  RequestFeedPost,
  RequestFeedResponse,
  RequestFormFields,
} from "../types/request-feed"
import { validateRequestForm, type RequestFormErrors } from "../utils/request-form"

export const useRequestFeed = () => {
  const posts = ref<RequestFeedPost[]>([])
  const isLoading = ref(false)
  const errorMessage = ref<string | null>(null)
  const isSubmitting = ref(false)
  const submitErrorMessage = ref<string | null>(null)
  const fieldErrors = ref<RequestFormErrors>({})

  const refresh = async (options: { accessToken?: string | null } = {}) => {
    isLoading.value = true
    errorMessage.value = null

    try {
      const response = await $fetch<RequestFeedResponse>("/api/requests", {
        headers: options.accessToken
          ? {
              Authorization: `Bearer ${options.accessToken}`,
            }
          : undefined,
      })
      posts.value = response.posts
    } catch {
      posts.value = []
      errorMessage.value = "Unable to load active requests."
    } finally {
      isLoading.value = false
    }
  }

  const createPost = async (
    fields: RequestFormFields,
    options: { accessToken?: string | null } = {},
  ) => {
    submitErrorMessage.value = null
    fieldErrors.value = {}

    const validation = validateRequestForm(fields)
    if (!validation.success) {
      fieldErrors.value = validation.errors
      return { success: false as const, reason: "validation" as const }
    }

    isSubmitting.value = true

    try {
      await $fetch("/api/requests", {
        method: "POST",
        body: validation.payload,
        headers: options.accessToken
          ? {
              Authorization: `Bearer ${options.accessToken}`,
            }
          : undefined,
      })
      await refresh(options)
      return { success: true as const }
    } catch (error) {
      submitErrorMessage.value =
        (error as { data?: { error?: { message?: string }; statusMessage?: string } })?.data?.error
          ?.message ??
        (error as { data?: { statusMessage?: string } })?.data?.statusMessage ??
        (error as { statusMessage?: string })?.statusMessage ??
        (error as { message?: string })?.message ??
        "Unable to post request."
      return { success: false as const, reason: "server" as const }
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    posts,
    isLoading,
    errorMessage,
    isSubmitting,
    submitErrorMessage,
    fieldErrors,
    refresh,
    createPost,
  }
}
