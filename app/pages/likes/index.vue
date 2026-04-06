<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import type { ItemCardViewModel } from "../../types/item-listing"
import { mapListedItemsToCards } from "../../utils/item-card-mapper"
import { DEFAULT_TRENDING_BADGE_STRATEGY, getTrendingItemIds } from "../../utils/item-trending"
import { filterListedItemsBySearch } from "../../utils/item-search"
import { usePaginatedItems } from "../../composables/use-paginated-items"

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

const selectedStatus = ref("ALL")
const selectedCategory = ref("ALL")
const availableCategoryValues = ref<string[]>([])

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
  status: selectedStatus.value !== "ALL" ? selectedStatus.value : undefined,
  categories: selectedCategory.value !== "ALL" ? selectedCategory.value : undefined,
}))

const {
  items: listedItems,
  isLoading,
  hasMore,
  errorMessage,
  fetchNextPage,
  refresh,
} = usePaginatedItems({
  searchQuery: serverSearchQuery,
  filterParams,
  pageSize: INITIAL_LIKES_PAGE_SIZE,
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

const formatEnumLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")

const statusOptions = ["ALL", "AVAILABLE", "RENTED", "DEACTIVATED"] as const

const clearFilters = () => {
  selectedStatus.value = "ALL"
  selectedCategory.value = "ALL"
}

const fetchLikedCategories = async () => {
  try {
    let accessToken: string | undefined
    if (typeof useSupabaseClient === "function") {
      const supabase = useSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      accessToken = session?.access_token
    }

    return await $fetch<string[]>("/api/items/liked-categories", {
      ...(accessToken
        ? {
            headers: {
              authorization: `Bearer ${accessToken}`,
            },
          }
        : {}),
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

  void reload()

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
  [selectedStatus, selectedCategory],
  () => {
    scheduleReload()
  },
  { deep: true },
)
</script>

<template>
  <main class="custom-main-scrollbar min-h-screen overflow-y-auto bg-white">
    <div class="container mx-auto max-w-7xl px-4 py-8 pt-20 sm:pt-24">
      <div class="mb-7">
        <h1 class="font-geist text-[36px] font-bold leading-tight text-noble-black">Liked Items</h1>
        <p class="mt-1 font-geist text-[20px] text-noble-black/70">
          Review and manage items you like
        </p>
      </div>

      <div class="flex w-full items-center gap-2 sm:gap-4">
        <div class="relative flex-1">
          <button
            v-if="searchInput"
            class="absolute left-4 top-1/2 -translate-y-1/2 focus:outline-none"
            title="Clear search"
            @click="clearSearch"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              class="stroke-noble-black/70 sm:h-6 sm:w-6"
              stroke-width="1"
            >
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <div v-else class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              class="stroke-noble-black/70 sm:h-6 sm:w-6"
              stroke-width="1"
            >
              <path
                d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path d="M21 21L16.65 16.65" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>

          <input
            v-model="searchInput"
            type="text"
            placeholder="Search for your liked item..."
            class="h-[48px] w-full rounded-[12px] border border-transparent bg-cream pl-11 pr-4 font-geist text-base text-noble-black placeholder:text-noble-black/70 transition-colors focus:border-cinnamon-ice focus:outline-none sm:h-[60px] sm:rounded-[15px] sm:pl-14 sm:pr-6 sm:text-[20px]"
            @focus="onSearchFocus"
            @blur="onSearchBlur"
            @keydown.down.prevent="moveSuggestionHighlight(1)"
            @keydown.up.prevent="moveSuggestionHighlight(-1)"
            @keydown.enter.prevent="applySuggestionOrSearch"
          />

          <div
            v-if="showSuggestions"
            class="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-[12px] border border-cinnamon-ice/50 bg-white shadow-[0_8px_28px_rgba(0,0,0,0.12)]"
          >
            <button
              v-for="(suggestion, index) in searchSuggestions"
              :key="`${suggestion.type}-${suggestion.value}-${index}`"
              type="button"
              class="flex w-full items-center justify-between px-4 py-3 text-left font-geist text-[14px] text-noble-black transition-colors hover:bg-cream/80"
              :class="index === highlightedSuggestionIndex ? 'bg-cream' : ''"
              @mousedown.prevent="selectSuggestion(suggestion.value)"
            >
              <span class="truncate">{{ suggestion.label }}</span>
              <span class="ml-3 text-[11px] uppercase tracking-wide text-noble-black/45">{{
                suggestion.type
              }}</span>
            </button>
          </div>
        </div>

        <button
          class="flex h-[48px] shrink-0 items-center justify-center rounded-[12px] bg-burning-orange px-6 font-geist text-base font-medium text-white transition-colors hover:bg-blue-estate sm:h-[60px] sm:rounded-[15px] sm:px-10 sm:text-[20px]"
          @click="applySearch"
        >
          Search
        </button>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-3">
        <button
          class="rounded-full px-5 py-2 font-geist text-[14px] transition-colors"
          :class="
            selectedStatus === 'ALL' && selectedCategory === 'ALL'
              ? 'bg-burning-orange text-white'
              : 'border border-cinnamon-ice bg-white text-noble-black/75 hover:bg-cream'
          "
          @click="clearFilters"
        >
          All
        </button>

        <select
          v-model="selectedStatus"
          class="rounded-full border border-cinnamon-ice bg-white px-4 py-2 font-geist text-[14px] text-noble-black/75 focus:outline-none"
        >
          <option v-for="status in statusOptions" :key="status" :value="status">
            {{ status === "ALL" ? "Status" : formatEnumLabel(status) }}
          </option>
        </select>

        <select
          v-model="selectedCategory"
          class="rounded-full border border-cinnamon-ice bg-white px-4 py-2 font-geist text-[14px] text-noble-black/75 focus:outline-none"
        >
          <option value="ALL">Category</option>
          <option v-for="category in categoryOptions" :key="category.value" :value="category.value">
            {{ category.label }}
          </option>
        </select>
      </div>

      <p class="mt-3 font-geist text-[14px] text-noble-black/50">
        {{ likedItemsCount }} {{ likedItemsCount === 1 ? "liked item" : "liked items" }}
      </p>

      <div class="mt-6">
        <div
          v-if="cardItems.length > 0 || isLoading"
          class="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-6 md:grid-cols-2 lg:grid-cols-4"
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
          <h3 class="font-geist text-[26px] font-semibold text-noble-black">
            Unable to load likes
          </h3>
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
            No liked items found
          </h3>
          <p class="mx-auto mt-2 max-w-md font-geist text-[16px] text-noble-black/70">
            Try adjusting your search or filters, or like items from the listings page.
          </p>
          <button
            v-if="searchInput || selectedStatus !== 'ALL' || selectedCategory !== 'ALL'"
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
  </main>
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
