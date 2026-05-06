<template>
  <div class="mx-auto px-4 sm:px-8 lg:px-10 xl:px-12 py-8 pt-16 max-w-[1600px]">
    <!-- Header Section -->
    <div class="mb-10">
      <h1 class="font-rewon text-[40px] text-noble-black leading-tight mb-2">
        Good {{ greeting }}, {{ firstName }}!
      </h1>
      <p class="font-geist font-normal text-[20px] text-noble-black/70">
        Discover items to rent or borrow near you.
      </p>

      <!-- Search Bar Section (Modernized) -->
      <div class="mt-6 sm:mt-8 flex items-center w-full max-w-3xl">
        <!-- Unified Search Container -->
        <div
          class="relative flex-1 flex items-center h-[48px] bg-white rounded-[14px] border-[1.5px] border-noble-black/20 px-1.5 transition-all duration-300 focus-within:border-burning-orange focus-within:ring-4 focus-within:ring-burning-orange/5"
        >
          <!-- Search Icon / Clear Button -->
          <div class="flex items-center justify-center w-10 shrink-0">
            <button
              v-if="searchInput"
              class="text-noble-black/30 hover:text-noble-black/60 transition-colors"
              title="Clear search"
              @click="clearSearch"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
            <svg
              v-else
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-noble-black/30"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>

          <!-- Search Input -->
          <input
            v-model="searchInput"
            type="text"
            placeholder="Search for items to rent or borrow"
            class="flex-1 bg-transparent px-2 font-geist font-medium text-[15px] text-noble-black placeholder:text-noble-black/30 focus:outline-none"
            @focus="onSearchFocus"
            @blur="onSearchBlur"
            @keydown.down.prevent="moveSuggestionHighlight(1)"
            @keydown.up.prevent="moveSuggestionHighlight(-1)"
            @keydown.enter.prevent="applySuggestionOrSearch"
          />

          <!-- Integrated Search Button -->
          <button
            class="h-9 px-6 bg-burning-orange text-white rounded-[10px] font-bold text-[13px] hover:brightness-110 shadow-md shadow-burning-orange/20 transition-all shrink-0 flex items-center justify-center"
            @click="applySearch"
          >
            Search
          </button>

          <!-- Suggestions Dropdown -->
          <div
            v-if="showSuggestions"
            class="absolute top-full left-0 right-0 mt-2 z-30 rounded-[14px] border border-cinnamon-ice/30 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12)] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            <button
              v-for="(suggestion, index) in searchSuggestions"
              :key="`${suggestion.type}-${suggestion.value}-${index}`"
              type="button"
              class="w-full px-5 py-3 text-left font-geist text-[14px] text-noble-black hover:bg-cream/50 transition-colors flex items-center justify-between group"
              :class="index === highlightedSuggestionIndex ? 'bg-cream' : ''"
              @mousedown.prevent="selectSuggestion(suggestion.value)"
            >
              <div class="flex items-center gap-3">
                <svg
                  class="text-noble-black/20 group-hover:text-burning-orange transition-colors"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <span class="font-medium">{{ suggestion.label }}</span>
              </div>
              <span
                class="text-[10px] font-bold uppercase tracking-widest text-noble-black/30 bg-noble-black/5 px-2 py-0.5 rounded"
                >{{ suggestion.type }}</span
              >
            </button>
          </div>
        </div>
      </div>

      <!-- Results Count -->
      <p
        v-if="visibleResultsCount !== null"
        class="mt-3 font-geist text-[14px] text-noble-black/50"
      >
        {{ visibleResultsCount }} {{ visibleResultsCount === 1 ? "result" : "results" }}
      </p>
    </div>

    <!-- User Search Results (Shopee style) -->
    <div
      v-if="
        serverSearchQuery && (isSearchingUsers || (topMatchingUsers && topMatchingUsers.length > 0))
      "
      class="mb-10 animate-fade-in"
    >
      <div class="flex items-center gap-2 mb-4">
        <h3
          class="font-geist font-bold text-noble-black uppercase tracking-wider text-xs opacity-50"
        >
          Top Matches
        </h3>
        <div class="h-[1px] flex-1 bg-cinnamon-ice/20"></div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <template v-if="isSearchingUsers">
          <UserSearchCardSkeleton v-for="i in 3" :key="`user-skeleton-${i}`" />
        </template>
        <template v-else>
          <UserSearchCard
            v-for="matchingUser in topMatchingUsers"
            :key="matchingUser.id"
            v-bind="matchingUser"
          />
        </template>
      </div>
    </div>

    <!-- Items Grid (Modernized: Fluid & Responsive) -->
    <div
      v-if="cardItems.length > 0 || isLoading"
      class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 sm:gap-8"
    >
      <ItemCard
        v-for="item in cardItems"
        :id="item.id"
        :key="item.id"
        :type="item.type"
        :status="item.status"
        :is-trending="item.isTrending"
        :image="item.image"
        :category="item.category"
        :name="item.name"
        :rating="item.rating"
        :reviews="item.reviews"
        :price="item.price"
        :price-unit="item.priceUnit"
        :owner="item.owner"
        :owner-username="item.ownerUsername"
        :is-liked="item.isLiked"
      />

      <template v-if="isLoading">
        <ItemCardSkeleton v-for="i in 4" :key="`skeleton-${i}`" />
      </template>
    </div>

    <!-- Error State -->
    <div
      v-else-if="errorMessage"
      class="w-full flex flex-col items-center justify-center py-24 px-4 text-center bg-cream rounded-[20px] border border-cinnamon-ice/50 shadow-sm mt-4"
    >
      <h3 class="font-geist font-semibold text-[24px] sm:text-[28px] text-noble-black mb-3">
        Unable to load items
      </h3>
      <p
        class="font-geist font-normal text-[16px] sm:text-[18px] text-noble-black/70 max-w-md mx-auto"
      >
        {{ errorMessage }}
      </p>
      <button
        class="mt-8 h-[48px] px-8 bg-burning-orange text-white rounded-[12px] font-geist font-medium text-[16px] hover:bg-blue-estate transition-colors"
        @click="reload"
      >
        Retry
      </button>
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="w-full flex flex-col items-center justify-center py-24 px-4 text-center bg-cream rounded-[20px] border border-cinnamon-ice/50 shadow-sm mt-4"
    >
      <div class="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          class="stroke-cinnamon-ice"
          stroke-width="1.5"
        >
          <path
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path d="M8 11h4m-4 0v-4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <h3 class="font-geist font-semibold text-[24px] sm:text-[28px] text-noble-black mb-3">
        No available items
      </h3>
      <p
        class="font-geist font-normal text-[16px] sm:text-[18px] text-noble-black/70 max-w-md mx-auto"
      >
        We couldn't find any bookable items matching your search or filters. Try adjusting them to
        see more results.
      </p>
      <button
        v-if="searchInput || filters.hasActiveFilters.value"
        class="mt-8 h-[48px] px-8 bg-burning-orange text-white rounded-[12px] font-geist font-medium text-[16px] hover:bg-blue-estate transition-colors"
        @click="
          () => {
            clearSearch()
            filters.clearAll()
          }
        "
      >
        Clear Search & Filters
      </button>
    </div>

    <!-- Intersection Trigger -->
    <div ref="loadMoreTrigger" class="h-10 w-full mt-4 flex items-center justify-center" />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch } from "vue"
import type { ItemCardViewModel } from "../../types/item-listing"
import type { UserSearchResult } from "~/types/user"
import { mapListedItemsToCards } from "../../utils/item-card-mapper"
import { DEFAULT_TRENDING_BADGE_STRATEGY, getTrendingItemIds } from "../../utils/item-trending"
import { filterListedItemsBySearch } from "../../utils/item-search"
import { usePaginatedItems } from "../../composables/use-paginated-items"
import { useFilteredResultsCount } from "../../composables/use-filtered-results-count"
import type { useDashboardFilters } from "../../composables/use-dashboard-filters"

definePageMeta({
  layout: "dashboard",
})

// ── Injected filter state from layout ────────────────────────────────────────
const filters = inject<ReturnType<typeof useDashboardFilters>>("dashboardFilters")!

// User & Greeting State
const user = useSupabaseUser()
const firstName = computed(() => {
  if (!user.value) return "User"
  const fullName = user.value.user_metadata?.full_name || user.value.user_metadata?.name || "User"
  return fullName.split(" ")[0]
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return "morning"
  if (hour < 18) return "afternoon"
  return "evening"
})

// Search State
const searchInput = ref("")
let searchBlurTimeout: ReturnType<typeof setTimeout> | null = null
const isSearchFocused = ref(false)
const highlightedSuggestionIndex = ref(-1)
const serverSearchQuery = ref("")
const searchTerm = computed(() => searchInput.value.trim())
const INITIAL_DASHBOARD_PAGE_SIZE = 8
let prefetchNextPageTimeout: ReturnType<typeof setTimeout> | null = null

// User Search Logic
const { data: topMatchingUsers, pending: isSearchingUsers } = await useAsyncData(
  () => `user-search-${serverSearchQuery.value}`,
  async () => {
    if (!serverSearchQuery.value) return [] as UserSearchResult[]
    return await $fetch<UserSearchResult[]>("/api/users/search", {
      query: { q: serverSearchQuery.value },
    })
  },
  { watch: [serverSearchQuery] },
)

const clearSearch = () => {
  searchInput.value = ""
  if (!serverSearchQuery.value) {
    return
  }

  serverSearchQuery.value = ""
  scheduleReload()
}

const applySearch = () => {
  const nextQuery = searchTerm.value
  searchInput.value = nextQuery

  if (serverSearchQuery.value === nextQuery) {
    return
  }

  serverSearchQuery.value = nextQuery
  scheduleReload()
}

type SearchSuggestion = {
  label: string
  value: string
  type: "item" | "tag" | "category" | "lender" | "condition"
}

const searchSuggestions = computed<SearchSuggestion[]>(() => {
  const query = searchInput.value.trim().toLowerCase()
  if (!query) return []

  const suggestions: SearchSuggestion[] = []
  const seen = new Set<string>()

  const pushSuggestion = (suggestion: SearchSuggestion) => {
    const key = `${suggestion.type}:${suggestion.value.toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    suggestions.push(suggestion)
  }

  for (const item of listedItems.value) {
    if (item.name.toLowerCase().includes(query)) {
      pushSuggestion({ label: item.name, value: item.name, type: "item" })
    }

    if (item.ownerName.toLowerCase().includes(query)) {
      pushSuggestion({ label: item.ownerName, value: item.ownerName, type: "lender" })
    }

    if (item.condition.toLowerCase().includes(query)) {
      pushSuggestion({ label: item.condition, value: item.condition, type: "condition" })
    }

    for (const category of item.categories) {
      if (category.toLowerCase().includes(query)) {
        pushSuggestion({ label: category, value: category, type: "category" })
      }
    }

    for (const tag of item.tags) {
      if (tag.toLowerCase().includes(query)) {
        pushSuggestion({ label: tag, value: tag, type: "tag" })
      }
    }
  }

  return suggestions.slice(0, 8)
})

const showSuggestions = computed(
  () =>
    isSearchFocused.value &&
    searchInput.value.trim().length > 0 &&
    searchSuggestions.value.length > 0,
)

const resetSuggestionHighlight = () => {
  highlightedSuggestionIndex.value = -1
}

const onSearchFocus = () => {
  isSearchFocused.value = true
  if (searchBlurTimeout !== null) {
    clearTimeout(searchBlurTimeout)
    searchBlurTimeout = null
  }
}

const onSearchBlur = () => {
  searchBlurTimeout = setTimeout(() => {
    isSearchFocused.value = false
    resetSuggestionHighlight()
    searchBlurTimeout = null
  }, 120)
}

const selectSuggestion = (value: string) => {
  searchInput.value = value
  applySearch()
  isSearchFocused.value = false
  resetSuggestionHighlight()
}

const moveSuggestionHighlight = (step: number) => {
  if (!showSuggestions.value) return
  const total = searchSuggestions.value.length
  if (total === 0) return

  if (highlightedSuggestionIndex.value < 0) {
    highlightedSuggestionIndex.value = step > 0 ? 0 : total - 1
    return
  }

  highlightedSuggestionIndex.value = (highlightedSuggestionIndex.value + step + total) % total
}

const applySuggestionOrSearch = () => {
  if (
    showSuggestions.value &&
    highlightedSuggestionIndex.value >= 0 &&
    highlightedSuggestionIndex.value < searchSuggestions.value.length
  ) {
    selectSuggestion(searchSuggestions.value[highlightedSuggestionIndex.value]!.value)
    return
  }
  applySearch()
}

const {
  items: listedItems,
  isLoading,
  hasMore,
  errorMessage,
  hasCachedState,
  fetchNextPage,
  refresh,
} = usePaginatedItems({
  searchQuery: serverSearchQuery,
  filterParams: filters.filterQueryParams,
  pageSize: INITIAL_DASHBOARD_PAGE_SIZE,
  stateKey: "dashboard-listed-items",
})

const locallyFilteredItems = computed(() =>
  filterListedItemsBySearch(listedItems.value, searchTerm.value),
)

const trendingItemIds = computed(() =>
  getTrendingItemIds(locallyFilteredItems.value, DEFAULT_TRENDING_BADGE_STRATEGY),
)

const cardItems = computed<ItemCardViewModel[]>(() =>
  mapListedItemsToCards(locallyFilteredItems.value, {
    trendingItemIds: trendingItemIds.value,
  }),
)

const {
  totalResultsCount,
  hasCachedCount,
  refreshResultsCount,
  scheduleResultsCountRefresh,
  cancelPendingResultsCountRefresh,
} = useFilteredResultsCount({
  searchQuery: serverSearchQuery,
  filterParams: filters.filterQueryParams,
  stateKey: "dashboard-results-count",
})

const visibleResultsCount = computed(() =>
  searchTerm.value ? locallyFilteredItems.value.length : totalResultsCount.value,
)

const cancelPendingPrefetch = () => {
  if (prefetchNextPageTimeout !== null) {
    clearTimeout(prefetchNextPageTimeout)
    prefetchNextPageTimeout = null
  }
}

const scheduleNextPagePrefetch = () => {
  cancelPendingPrefetch()

  if (!hasMore.value) {
    return
  }

  prefetchNextPageTimeout = setTimeout(() => {
    prefetchNextPageTimeout = null

    if (hasMore.value && !isLoading.value) {
      void fetchNextPage()
    }
  }, 120)
}

const reload = async () => {
  await refresh()
  scheduleNextPagePrefetch()
  await refreshResultsCount()
}

const scheduleReload = () => {
  void refresh().then(() => {
    scheduleNextPagePrefetch()
    scheduleResultsCountRefresh()
  })
}

const { data: initialDashboardItemsLoaded } = await useAsyncData(
  "dashboard-initial-listed-items",
  async () => {
    if (hasCachedState.value && hasCachedCount.value) {
      return true
    }

    await refresh()
    if (!hasCachedCount.value) {
      await refreshResultsCount()
    }
    return true
  },
  {
    default: () => false,
  },
)

// Infinite Scroll State
const loadMoreTrigger = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && hasMore.value && !isLoading.value) {
        void fetchNextPage()
      }
    },
    {
      rootMargin: "100px",
      threshold: 0.1,
    },
  )

  if (hasCachedState.value && hasCachedCount.value) {
    scheduleNextPagePrefetch()
  } else if (initialDashboardItemsLoaded.value) {
    scheduleNextPagePrefetch()
  } else {
    void reload()
  }

  if (loadMoreTrigger.value) {
    observer.observe(loadMoreTrigger.value)
  }
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
  }
  if (searchBlurTimeout !== null) {
    clearTimeout(searchBlurTimeout)
    searchBlurTimeout = null
  }
  cancelPendingPrefetch()
  cancelPendingResultsCountRefresh()
})

watch(searchInput, () => {
  resetSuggestionHighlight()
})

// Re-fetch when filters change
watch(
  filters.filterQueryParams,
  () => {
    scheduleReload()
  },
  { deep: true },
)
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.4s ease-out both;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
