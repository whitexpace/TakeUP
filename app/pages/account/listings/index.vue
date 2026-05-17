<script setup lang="ts">
import type { MyListingCategory, MyListingFilterStatus } from "../../../composables/use-my-listings"
import { resetFilteredResultsCountCache } from "../../../composables/use-filtered-results-count"
import { resetPaginatedItemsCache } from "../../../composables/use-paginated-items"

definePageMeta({ layout: "account", middleware: "account-auth" })

const route = useRoute()

const {
  listings,
  isLoading,
  error,
  hasFetched,
  hasFreshCache,
  hasMore,
  searchQuery,
  selectedStatuses,
  selectedCategories,
  hasActiveFilters,
  toggleStatusFilter,
  toggleCategoryFilter,
  removeStatusFilter,
  removeCategoryFilter,
  clearFilters,
  loadMore,
  refresh,
  toggleStatus,
} = useMyListings()
const { warmMyListings } = useMyListingsPrefetch()

const togglingId = ref<string | null>(null)
const boostErrorMessage = ref("")
const boostSuccessMessage = ref("")
const boostingId = ref<string | null>(null)
const categorySearch = ref("")
const isCategoryDropdownOpen = ref(false)
const showBoostToast = ref(false)
const boostToastTone = ref<"success" | "error">("success")
let boostToastTimeout: ReturnType<typeof setTimeout> | null = null

const { data: rewardsSummary, refresh: refreshRewards } = useLazyAsyncData(
  "account:listings:rewards",
  () =>
    $fetch<{
      availablePoints: number
    }>("/api/rewards"),
)

const STATUS_OPTIONS: Array<{ value: MyListingFilterStatus; label: string }> = [
  { value: "ACTIVE", label: "Active" },
  { value: "IN_USE", label: "In Use" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "DISPUTED", label: "Disputed" },
]

const CATEGORY_OPTIONS: Array<{ value: MyListingCategory; label: string }> = [
  { value: "ELECTRONICS", label: "Electronics" },
  { value: "BOOKS", label: "Books" },
  { value: "CLOTHING", label: "Clothing" },
  { value: "TOOLS", label: "Tools" },
  { value: "HOME_APPLIANCES", label: "Home Appliances" },
  { value: "SPORTS_OUTDOORS", label: "Sports & Outdoors" },
  { value: "MUSIC_AUDIO", label: "Music & Audio" },
  { value: "TOYS_GAMES", label: "Toys & Games" },
  { value: "FURNITURE", label: "Furniture" },
  { value: "VEHICLES_ACCESSORIES", label: "Vehicles & Accessories" },
  { value: "HEALTH_BEAUTY", label: "Health & Beauty" },
  { value: "SCHOOL_SUPPLIES", label: "School Supplies" },
  { value: "PET_SUPPLIES", label: "Pet Supplies" },
  { value: "OTHER", label: "Other" },
]

const filteredCategoryOptions = computed(() => {
  const query = categorySearch.value.trim().toLowerCase()
  if (!query) return CATEGORY_OPTIONS

  return CATEGORY_OPTIONS.filter((category) => category.label.toLowerCase().includes(query))
})

const selectedCategoryEntries = computed(() =>
  CATEGORY_OPTIONS.filter((category) => selectedCategories.value.includes(category.value)),
)

const showBoostIntentBanner = computed(() => route.query.boost === "true")

const emptyStateMessage = computed(() => {
  if (searchQuery.value.trim() || hasActiveFilters.value) {
    return "No listings match your current search or filters."
  }

  return "You haven't listed any items yet."
})

const toggleCategoryMenu = () => {
  isCategoryDropdownOpen.value = !isCategoryDropdownOpen.value
}

const handleToggleStatus = async (id: string, status: "AVAILABLE" | "DEACTIVATED") => {
  togglingId.value = id
  try {
    await toggleStatus(id, status)
  } catch {
    // error handled inline through page state
  } finally {
    togglingId.value = null
  }
}

const showBoostToastMessage = (tone: "success" | "error", message: string) => {
  boostToastTone.value = tone

  if (tone === "success") {
    boostSuccessMessage.value = message
    boostErrorMessage.value = ""
  } else {
    boostErrorMessage.value = message
    boostSuccessMessage.value = ""
  }

  showBoostToast.value = false

  if (boostToastTimeout) {
    clearTimeout(boostToastTimeout)
  }

  requestAnimationFrame(() => {
    showBoostToast.value = true
  })

  boostToastTimeout = setTimeout(() => {
    showBoostToast.value = false
    boostToastTimeout = null
  }, 3200)
}

const handleBoostListing = async (itemId: string) => {
  const targetListing = listings.value.find((listing) => listing.id === itemId)

  if (!targetListing || targetListing.displayStatus !== "ACTIVE" || targetListing.hasActiveBoost) {
    showBoostToastMessage(
      "error",
      "Only active available listings without an existing boost can be boosted.",
    )
    return
  }

  boostingId.value = itemId
  boostErrorMessage.value = ""
  boostSuccessMessage.value = ""

  try {
    await $fetch("/api/rewards/boosts", {
      method: "POST",
      body: {
        itemId,
        boostType: "STANDARD_24_HOUR",
      },
    })
    resetPaginatedItemsCache()
    resetFilteredResultsCountCache()
    showBoostToastMessage("success", "Listing boost activated for 24 hours.")
    await Promise.all([refresh(), refreshRewards()])
  } catch (error: unknown) {
    const data = (error as { data?: { statusMessage?: string; message?: string } })?.data
    showBoostToastMessage(
      "error",
      data?.statusMessage ?? data?.message ?? "Unable to boost this listing right now.",
    )
  } finally {
    boostingId.value = null
  }
}

onMounted(() => {
  if (!hasFetched.value) {
    void warmMyListings("/account/listings")
    return
  }

  if (!hasFreshCache.value) {
    void warmMyListings("/account/listings")
  }
})

onBeforeUnmount(() => {
  if (boostToastTimeout) {
    clearTimeout(boostToastTimeout)
  }
})
</script>

<template>
  <div class="mx-auto max-w-[1100px] space-y-6 pb-10 font-geist lg:px-16 xl:px-24">
    <!-- Page Header -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
      <section class="space-y-3">
        <div class="space-y-2">
          <h1 class="font-montravia text-[36px] font-medium text-noble-black">My Listings</h1>
          <div class="w-10 h-0.5 bg-burning-orange"></div>
        </div>
        <p class="text-[16px] font-light text-noble-black/50">
          Manage your listed items and track their availability.
        </p>
      </section>

      <div class="flex gap-3 shrink-0">
        <NuxtLink
          to="/account/requests"
          class="inline-flex h-10 items-center gap-2 px-6 bg-white border-[1.5px] border-burning-orange text-burning-orange rounded-[10px] text-[13px] font-bold hover:bg-burning-orange/5 transition-all"
        >
          View Requests
        </NuxtLink>
        <NuxtLink
          to="/account/listings/new"
          class="inline-flex h-10 items-center gap-2 px-6 bg-burning-orange text-white rounded-[10px] text-[13px] font-bold hover:brightness-110 shadow-[0_4px_14px_rgba(232,101,10,0.3)] transition-all"
        >
          <Icon name="ph:plus" class="w-[18px] h-[18px]" />
          Add New Item
        </NuxtLink>
      </div>
    </div>

    <!-- Modernized Rewards Banner -->
    <div
      class="flex flex-col gap-4 rounded-[14px] border border-burning-orange/30 p-[14px_20px] sm:flex-row sm:items-center sm:justify-between shadow-sm mb-6"
      style="
        background: linear-gradient(
          135deg,
          theme(&quot;colors.burning-orange / 4%&quot;),
          theme(&quot;colors.burning-orange / 8%&quot;)
        );
      "
    >
      <div class="flex items-center gap-3">
        <!-- Small Trophy Icon -->
        <Icon name="ph:trophy" class="shrink-0 text-burning-orange w-5 h-5" />

        <div class="flex flex-wrap items-center gap-1.5 font-geist">
          <span class="text-[14px] font-semibold text-noble-black">
            You have {{ rewardsSummary?.availablePoints ?? 0 }} points
          </span>
          <span class="text-[13px] text-noble-black/50">•</span>
          <span class="text-[13px] text-noble-black/50 font-medium">
            {{
              showBoostIntentBanner
                ? "Select an eligible listing below to activate boost."
                : "Spend 50 points to boost visibility for 24 hours."
            }}
          </span>
        </div>
      </div>

      <NuxtLink
        to="/account/rewards"
        class="text-[13px] font-bold text-burning-orange hover:brightness-90 transition-all flex items-center gap-1.5 whitespace-nowrap"
      >
        Spend on Boost <span class="text-[15px]">→</span>
      </NuxtLink>
    </div>

    <!-- Redesigned Search + Filter Row -->
    <div
      class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between py-2 mb-4 bg-white relative z-30"
    >
      <!-- Search Bar -->
      <div
        class="flex h-10 min-w-0 flex-1 items-center gap-1.5 rounded-[10px] border-[1.5px] border-noble-black/20 bg-white px-2.5 transition-all focus-within:border-burning-orange focus-within:shadow-[0_0_0_3px_rgba(232,101,10,0.05)]"
      >
        <button
          v-if="searchQuery"
          type="button"
          class="flex h-8 w-8 items-center justify-center text-noble-black/30 hover:text-burning-orange transition-colors"
          title="Clear search"
          @click="searchQuery = ''"
        >
          <Icon name="ph:x" class="w-4 h-4" />
        </button>
        <Icon v-else name="ph:magnifying-glass" class="shrink-0 text-noble-black/50 w-4 h-4 ml-2" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search your listings..."
          class="flex-1 bg-transparent text-[14px] font-medium text-noble-black placeholder:text-noble-black/50 focus:outline-none"
        />
      </div>

      <!-- Compact Toggle Chips + Category -->
      <div class="flex flex-wrap items-center gap-3 lg:gap-4">
        <!-- Status Filters -->
        <div class="flex flex-wrap items-center gap-2">
          <button
            v-for="option in STATUS_OPTIONS"
            :key="option.value"
            type="button"
            class="px-[14px] py-1.5 rounded-full text-[13px] font-bold transition-all duration-200 border-[1.5px]"
            :class="
              selectedStatuses.includes(option.value)
                ? 'bg-burning-orange/[0.12] border-burning-orange/30 text-burning-orange'
                : 'bg-white border-noble-black/20 text-noble-black/40 hover:border-noble-black/30 hover:text-noble-black/60'
            "
            @click="toggleStatusFilter(option.value)"
          >
            {{ option.label }}
          </button>
        </div>

        <!-- Category Dropdown -->
        <div class="relative">
          <button
            type="button"
            class="h-10 inline-flex items-center gap-2.5 rounded-[10px] border-[1.5px] border-noble-black/20 bg-white px-4 text-[13px] font-bold text-noble-black transition-all hover:border-burning-orange/40 hover:bg-noble-black/5 min-w-[160px] justify-between"
            @click="toggleCategoryMenu"
          >
            <span class="truncate">
              {{
                selectedCategories.length > 0
                  ? `Categories (${selectedCategories.length})`
                  : "All Categories"
              }}
            </span>
            <Icon
              name="ph:caret-down"
              class="h-4 w-4 text-noble-black/50 transition-transform duration-300"
              :class="{ 'rotate-180': isCategoryDropdownOpen }"
            />
          </button>

          <div
            v-if="isCategoryDropdownOpen"
            class="absolute right-0 z-40 mt-2 w-[280px] rounded-[20px] border border-cinnamon-ice/20 bg-white p-4 shadow-[0_20px_40px_rgba(0,0,0,0.12)] animate-in zoom-in-95 duration-200"
          >
            <input
              v-model="categorySearch"
              type="text"
              placeholder="Search categories..."
              class="mb-3 h-10 w-full rounded-[10px] border border-noble-black/10 bg-noble-black/5 px-4 text-[14px] text-noble-black placeholder:text-noble-black/50 focus:border-burning-orange focus:bg-white focus:outline-none transition-all"
            />

            <div class="max-h-64 space-y-1 overflow-y-auto custom-modal-scrollbar pr-1">
              <label
                v-for="category in filteredCategoryOptions"
                :key="category.value"
                class="flex cursor-pointer items-center justify-between rounded-[10px] px-3 py-2 transition-colors group"
                :class="
                  selectedCategories.includes(category.value)
                    ? 'bg-burning-orange/5'
                    : 'hover:bg-noble-black/5'
                "
              >
                <span
                  class="text-[13px] font-semibold transition-colors"
                  :class="
                    selectedCategories.includes(category.value)
                      ? 'text-burning-orange'
                      : 'text-noble-black/70'
                  "
                >
                  {{ category.label }}
                </span>
                <div class="relative flex items-center justify-center">
                  <input
                    :checked="selectedCategories.includes(category.value)"
                    type="checkbox"
                    class="peer sr-only"
                    @change="toggleCategoryFilter(category.value)"
                  />
                  <div
                    class="w-5 h-5 rounded-md border-2 border-noble-black/20 peer-checked:border-burning-orange peer-checked:bg-burning-orange transition-all"
                  ></div>
                  <Icon
                    name="ph:check"
                    class="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                  />
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Active Filter Tags -->
    <div
      v-if="selectedStatuses.length > 0 || selectedCategoryEntries.length > 0"
      class="flex flex-wrap gap-2 pt-2 mb-6"
    >
      <button
        v-for="status in selectedStatuses"
        :key="status"
        type="button"
        class="inline-flex items-center gap-2 rounded-lg bg-burning-orange text-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider shadow-sm hover:brightness-110 transition-all"
        @click="removeStatusFilter(status)"
      >
        {{ STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status }}
        <Icon name="ph:x" class="w-3 h-3" />
      </button>

      <button
        v-for="category in selectedCategoryEntries"
        :key="category.value"
        type="button"
        class="inline-flex items-center gap-2 rounded-lg bg-noble-black/10 text-noble-black/50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider hover:bg-noble-black/10 transition-all"
        @click="removeCategoryFilter(category.value)"
      >
        {{ category.label }}
        <Icon name="ph:x" class="w-3 h-3" />
      </button>

      <button
        v-if="hasActiveFilters"
        type="button"
        class="text-[12px] font-bold text-burning-orange hover:underline ml-2"
        @click="clearFilters"
      >
        Clear all
      </button>
    </div>

    <!-- Listings Grid (No Container) -->
    <div class="space-y-8">
      <div
        v-if="(!hasFetched || isLoading) && listings.length === 0"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5"
      >
        <ItemCardSkeleton v-for="i in 4" :key="`listing-skeleton-${i}`" is-management />
      </div>

      <div
        v-else-if="error"
        class="bg-red-50 border border-red-200 rounded-xl p-6 text-center space-y-3"
      >
        <p class="text-red-600 text-base font-geist">{{ error }}</p>
        <button
          class="px-6 py-2 bg-red-500 text-white rounded-xl text-sm font-geist hover:bg-red-600 transition-colors"
          @click="refresh"
        >
          Try Again
        </button>
      </div>

      <div
        v-else-if="!isLoading && listings.length === 0"
        class="bg-cream rounded-[24px] border border-cinnamon-ice/20 p-16 text-center space-y-5 shadow-sm"
      >
        <div
          class="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm border border-noble-black/10"
        >
          <Icon name="ph:squares-four" class="w-10 h-10 text-noble-black/20" />
        </div>
        <div>
          <p class="text-[18px] font-semibold text-noble-black">
            {{ emptyStateMessage }}
          </p>
          <p
            v-if="!searchQuery && !hasActiveFilters"
            class="mt-1 text-[14px] text-noble-black/40 font-light"
          >
            Start listing items to earn rewards and build your profile.
          </p>
        </div>
        <NuxtLink
          v-if="!searchQuery && !hasActiveFilters"
          to="/account/listings/new"
          class="inline-flex h-11 items-center px-8 bg-burning-orange text-white rounded-[12px] text-[14px] font-bold hover:brightness-110 shadow-lg shadow-burning-orange/20 transition-all"
        >
          Create Your First Listing
        </NuxtLink>
        <button
          v-else
          type="button"
          class="inline-flex h-10 items-center px-6 border-[1.5px] border-burning-orange text-burning-orange rounded-[10px] text-[13px] font-bold hover:bg-burning-orange/5 transition-all"
          @click="clearFilters"
        >
          Clear All Filters
        </button>
      </div>

      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
        <MyListingCard
          v-for="item in listings"
          :key="item.id"
          :item="item"
          :is-toggling="togglingId === item.id || boostingId === item.id"
          @toggle-status="handleToggleStatus"
          @boost-listing="handleBoostListing"
        />
      </div>

      <div v-if="hasMore && !isLoading" class="flex justify-center pt-8">
        <button
          class="text-[15px] font-bold text-noble-black/40 hover:text-burning-orange hover:underline transition-all duration-300"
          @click="loadMore"
        >
          Load More
        </button>
      </div>

      <div v-if="isLoading && listings.length > 0" class="flex justify-center py-4">
        <div
          class="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"
        />
      </div>
    </div>

    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="translate-y-3 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-2 opacity-0"
    >
      <div
        v-if="showBoostToast && (boostSuccessMessage || boostErrorMessage)"
        class="pointer-events-none fixed bottom-6 right-6 z-[150] max-w-sm"
      >
        <div
          class="rounded-[20px] px-5 py-4 shadow-2xl ring-1 backdrop-blur-sm"
          :class="
            boostToastTone === 'success'
              ? 'bg-emerald-500 text-white ring-emerald-400/40'
              : 'bg-red-500 text-white ring-red-400/40'
          "
        >
          <p class="text-sm font-semibold">
            {{ boostToastTone === "success" ? "Boost updated" : "Boost failed" }}
          </p>
          <p class="mt-1 text-sm leading-5 text-white/90">
            {{ boostToastTone === "success" ? boostSuccessMessage : boostErrorMessage }}
          </p>
        </div>
      </div>
    </Transition>
  </div>
</template>
