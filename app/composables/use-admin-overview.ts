import { onMounted, ref } from "vue"
import type { AdminOverviewResponse } from "~/types/admin-overview"

export const useAdminOverview = () => {
  const overview = ref<AdminOverviewResponse | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const fetchOverview = async () => {
    if (isLoading.value) return

    isLoading.value = true
    error.value = null

    try {
      overview.value = await $fetch<AdminOverviewResponse>("/api/admin/overview")
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode

      if (statusCode === 401) {
        await navigateTo("/")
        return
      }

      if (statusCode === 403) {
        await navigateTo("/account")
        return
      }

      error.value = "Unable to load admin overview. Please try again."
    } finally {
      isLoading.value = false
    }
  }

  onMounted(() => {
    void fetchOverview()
  })

  return {
    overview,
    isLoading,
    error,
    refresh: fetchOverview,
  }
}
