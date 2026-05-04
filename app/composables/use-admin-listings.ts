import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import type {
  AdminListingCursor,
  AdminListingRecord,
  AdminListingsResponse,
  AdminListingSummary,
} from "~/types/admin-listing"

type AdminListingStatus = AdminListingRecord["status"]

type UseAdminListingsOptions = {
  statuses: Ref<AdminListingStatus[]>
  categories: Ref<string[]>
  searchQuery: Ref<string>
}

const emptySummary = (): AdminListingSummary => ({
  totalListings: 0,
  activeListings: 0,
  inactiveListings: 0,
})

export const useAdminListings = ({
  statuses,
  categories,
  searchQuery,
}: UseAdminListingsOptions) => {
  const summary = ref<AdminListingSummary>(emptySummary())
  const listings = ref<AdminListingRecord[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const nextCursor = ref<AdminListingCursor>(null)
  const hasMore = computed(() => nextCursor.value !== null)
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

  const reset = () => {
    listings.value = []
    nextCursor.value = null
    error.value = null
    isLoading.value = false
  }

  const fetchPage = async (cursor: AdminListingCursor = null) => {
    if (isLoading.value) return

    isLoading.value = true
    error.value = null

    try {
      const query: Record<string, string | number | string[]> = { limit: 20 }
      const trimmedSearch = searchQuery.value.trim()

      if (statuses.value.length > 0) query.statuses = statuses.value
      if (categories.value.length > 0) query.categories = categories.value
      if (trimmedSearch) query.search = trimmedSearch
      if (cursor) query.cursor = JSON.stringify(cursor)

      const result = await $fetch<AdminListingsResponse>("/api/admin/listings", { query })
      summary.value = result.summary
      listings.value = cursor ? [...listings.value, ...result.listings] : result.listings
      nextCursor.value = result.nextCursor
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

      error.value = "Unable to load admin listings. Please try again."
    } finally {
      isLoading.value = false
    }
  }

  const refresh = async () => {
    reset()
    await fetchPage()
  }

  const loadMore = () => {
    if (!hasMore.value || isLoading.value) return
    void fetchPage(nextCursor.value)
  }

  const moderateListing = async (
    listingId: string,
    action: "activate" | "deactivate" | "remove",
  ) => {
    await $fetch(`/api/admin/listings/${listingId}/${action}`, {
      method: "POST",
      body: { confirmation: true },
    })
    await refresh()
  }

  watch([statuses, categories], () => {
    void refresh()
  })

  watch(searchQuery, () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(() => {
      void refresh()
      searchDebounceTimer = null
    }, 250)
  })

  onMounted(() => {
    void fetchPage()
  })

  onBeforeUnmount(() => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  })

  return {
    summary,
    listings,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    moderateListing,
  }
}
