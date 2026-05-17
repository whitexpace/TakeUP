<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import type { ItemCardViewModel } from "../../types/item-listing"
import { mapListedItemsToCards } from "../../utils/item-card-mapper"
import { DEFAULT_TRENDING_BADGE_STRATEGY, getTrendingItemIds } from "../../utils/item-trending"
import { filterListedItemsBySearch } from "../../utils/item-search"
import { usePaginatedItems } from "../../composables/use-paginated-items"
import { usePersistedSessionState } from "../../composables/use-persisted-session-state"

definePageMeta({
  layout: "dashboard",
  hideDashboardSidebar: true,
})

const searchInput = ref("")
let searchBlurTimeout: ReturnType<typeof setTimeout> | null = null
const isSearchFocused = ref(false)
const highlightedSuggestionIndex = ref(-1)
const serverSearchQuery = ref("")
const searchTerm = computed(() => searchInput.value.trim())
const INITIAL_LIKES_PAGE_SIZE = 8
let prefetchNextPageTimeout: ReturnType<typeof setTimeout> | null = null

const selectedCategory = usePersistedSessionState<string>("likes:selected-category", () => "ALL")
const availableCategoryValues = usePersistedSessionState<string[]>(
  "likes:available-category-values",
  () => [],
)

const CATEGORY_OPTIONS = [
  { value: "BOOKS", label: "Books" },
  { value: "ELECTRONICS", label: "Electronics" },
  { value: "CLOTHING", label: "Clothing" },
  { value: "TOOLS", label: "Tools" },
  { value: "HOME_APPLIANCES", label: "Home & Appliances" },
  { value: "SPORTS_OUTDOORS", label: "Sports & Outdoors" },
  { value: "MUSIC_AUDIO", label: "Music & Audio" },
  { value: "TOYS_GAMES", label: "Toys & Games" },
  { value: "FURNITURE", label: "Furniture" },
  { value: "VEHICLES_ACCESSORIES", label: "Vehicles & Accessories" },
  { value: "HEALTH_BEAUTY", label: "Health & Beauty" },
  { value: "SCHOOL_SUPPLIES", label: "School Supplies" },
  { value: "PET_SUPPLIES", label: "Pet Supplies" },
  { value: "OTHER", label: "Other" },
] as const

const categoryOptions = computed(() =>
  CATEGORY_OPTIONS.filter((category) => availableCategoryValues.value.includes(category.value)),
)

const clearSearch = () => {
  searchInput.value = ""
}

const applySearch = () => {
  searchInput.value = searchTerm.value
}

type SearchSuggestion = {
  label: string
  value: string
  type: "item" | "tag" | "category" | "lender" | "condition"
}

const filterParams = computed<Record<string, string | undefined>>(() => ({
  likedOnly: "true",
  categories: selectedCategory.value !== "ALL" ? selectedCategory.value : undefined,
}))

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
  filterParams,
  pageSize: INITIAL_LIKES_PAGE_SIZE,
  stateKey: "likes-listed-items",
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

const clearFilters = () => {
  selectedCategory.value = "ALL"
}

const fetchLikedCategories = async () => {
  try {
    const { getAuthHeaders } = useViewerSession()
    return await $fetch<string[]>("/api/items/liked-categories", {
      headers: await getAuthHeaders(),
    })
  } catch {
    return []
  }
}

const syncLikedCategories = async () => {
  const categoryValues = await fetchLikedCategories()
  availableCategoryValues.value = categoryValues

  if (selectedCategory.value === "ALL") {
    return
  }

  if (!categoryValues.includes(selectedCategory.value)) {
    selectedCategory.value = "ALL"
  }
}

const reload = async () => {
  await syncLikedCategories()
  await refresh()
  scheduleNextPagePrefetch()
}

const likedItemsCount = computed(() => locallyFilteredItems.value.length)

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

const scheduleReload = () => {
  void refresh().then(() => {
    scheduleNextPagePrefetch()
  })
}

const handleLikeChanged = async (payload: { itemId: string; isLiked: boolean }) => {
  if (payload.isLiked) return
  await reload()
}

const loadMoreTrigger = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const { data: initialLikesLoaded } = useLazyAsyncData(
  "likes-initial-listed-items",
  async () => {
    if (hasCachedState.value && availableCategoryValues.value.length > 0) {
      return true
    }

    await syncLikedCategories()
    await refresh()
    return true
  },
  {
    default: () => false,
  },
)

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

  if (hasCachedState.value && availableCategoryValues.value.length > 0) {
    scheduleNextPagePrefetch()
  } else if (initialLikesLoaded.value) {
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
})

watch(searchInput, () => {
  resetSuggestionHighlight()
})

watch(
  selectedCategory,
  () => {
    scheduleReload()
  },
  { deep: true },
)
</script>

<template>
  <div class="mx-auto max-w-7xl py-8 pt-20 sm:pt-24">
    <div class="mb-8">
      <div class="space-y-2">
        <h1 class="font-montravia text-[36px] font-medium leading-tight text-noble-black">
          Liked Items
        </h1>
        <div class="h-[2px] w-10 bg-burning-orange rounded-full"></div>
      </div>
      <p class="mt-2 font-geist text-[16px] font-light text-noble-black/50">
        Review and manage items you like
      </p>
    </div>

    <!-- Search Bar Section (Modernized to match Dashboard) -->
    <div class="mb-8 flex items-center w-full max-w-3xl">
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
            <Icon name="ph:x" class="w-[18px] h-[18px]" />
          </button>
          <Icon v-else name="ph:magnifying-glass" class="w-[18px] h-[18px] text-noble-black/30" />
        </div>

        <!-- Search Input -->
        <input
          v-model="searchInput"
          type="text"
          placeholder="Search for your liked items..."
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
          class="absolute top-full left-0 right-0 mt-2 z-30 rounded-[14px] border border-cinnamon-ice/30 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12)] overflow-hidden"
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
              <Icon
                name="ph:magnifying-glass"
                class="w-3.5 h-3.5 text-noble-black/20 group-hover:text-burning-orange transition-colors"
              />
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

    <!-- Sophisticated Filter Pills (Two-pill layout) -->
    <div class="flex items-center gap-3 mb-4">
      <!-- All Pill -->
      <button
        class="px-5 py-2.5 rounded-full font-geist text-[13px] font-bold transition-all border-[1.5px] whitespace-nowrap"
        :class="
          selectedCategory === 'ALL'
            ? 'bg-burning-orange border-burning-orange text-white shadow-sm'
            : 'bg-white border-noble-black/10 text-noble-black/60 hover:border-burning-orange/30 hover:bg-burning-orange/5'
        "
        @click="clearFilters"
      >
        All Items
      </button>

      <!-- Categories Dropdown Pill -->
      <div class="relative">
        <select
          v-model="selectedCategory"
          class="appearance-none px-5 pr-10 py-2.5 rounded-full font-geist text-[13px] font-bold transition-all border-[1.5px] bg-white cursor-pointer focus:outline-none min-w-[140px]"
          :class="
            selectedCategory !== 'ALL'
              ? 'bg-burning-orange border-burning-orange text-white shadow-sm'
              : 'border-noble-black/10 text-noble-black/60 hover:border-burning-orange/30 hover:bg-burning-orange/5'
          "
        >
          <option value="ALL">All Categories</option>
          <option
            v-for="category in categoryOptions"
            :key="category.value"
            :value="category.value"
            class="text-noble-black bg-white"
          >
            {{ category.label }}
          </option>
        </select>
        <!-- Custom Chevron Icon -->
        <div
          class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
          :class="selectedCategory !== 'ALL' ? 'text-white' : 'text-noble-black/40'"
        >
          <Icon name="ph:caret-down" class="w-3.5 h-3.5" />
        </div>
      </div>
    </div>

    <!-- Results Count -->
    <p class="font-geist text-[14px] text-noble-black/50 mb-6">
      {{ likedItemsCount }} {{ likedItemsCount === 1 ? "liked item" : "liked items" }}
    </p>

    <div class="">
      <div
        v-if="cardItems.length > 0 || isLoading"
        class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 sm:gap-8"
      >
        <ItemCard
          v-for="item in cardItems"
          :id="item.id"
          :key="item.id"
          from-page="likes"
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
          @like-changed="handleLikeChanged"
        />

        <template v-if="isLoading">
          <ItemCardSkeleton v-for="i in 4" :key="`likes-skeleton-${i}`" />
        </template>
      </div>

      <div
        v-else-if="errorMessage"
        class="mt-2 rounded-[20px] border border-cinnamon-ice/50 bg-cream px-4 py-20 text-center"
      >
        <h3 class="font-geist text-[26px] font-semibold text-noble-black">Unable to load likes</h3>
        <p class="mx-auto mt-2 max-w-md font-geist text-[16px] text-noble-black/70">
          {{ errorMessage }}
        </p>
        <button
          class="mt-6 h-[46px] rounded-[12px] bg-burning-orange px-7 font-geist text-[15px] font-medium text-white transition-colors hover:bg-blue-estate"
          @click="reload"
        >
          Retry
        </button>
      </div>

      <div
        v-else
        class="mt-2 rounded-[20px] border border-cinnamon-ice/50 bg-cream px-4 py-20 text-center"
      >
        <h3 class="font-geist text-[26px] font-semibold text-noble-black">
          No available liked items
        </h3>
        <p class="mx-auto mt-2 max-w-md font-geist text-[16px] text-noble-black/70">
          Your liked items may be inactive, fully booked, or outside their available dates.
        </p>
        <button
          v-if="searchInput || selectedCategory !== 'ALL'"
          class="mt-6 h-[46px] rounded-[12px] bg-burning-orange px-7 font-geist text-[15px] font-medium text-white transition-colors hover:bg-blue-estate"
          @click="
            () => {
              clearSearch()
              clearFilters()
            }
          "
        >
          Clear Search & Filters
        </button>
      </div>

      <div ref="loadMoreTrigger" class="h-10 w-full" />
    </div>
  </div>
</template>

<style scoped>
.custom-main-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-main-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-main-scrollbar::-webkit-scrollbar-thumb {
  background: theme("colors.noble-black / 10%");
  border-radius: 20px;
}

.custom-main-scrollbar::-webkit-scrollbar-thumb:hover {
  background: theme("colors.noble-black / 20%");
}

.custom-main-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: theme("colors.noble-black / 10%") transparent;
}
</style>
