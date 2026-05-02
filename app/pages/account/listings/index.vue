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

const togglingId = ref<string | null>(null)
const boostErrorMessage = ref("")
const boostSuccessMessage = ref("")
const boostingId = ref<string | null>(null)
const categorySearch = ref("")
const isCategoryDropdownOpen = ref(false)
const showBoostToast = ref(false)
const boostToastTone = ref<"success" | "error">("success")
let boostToastTimeout: ReturnType<typeof setTimeout> | null = null

const { data: rewardsSummary, refresh: refreshRewards } = await useAsyncData(
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
  void refresh()
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
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
      <section class="space-y-3">
        <div class="space-y-1">
          <h1 class="text-[28px] font-bold text-noble-black">My Listings</h1>
          <div class="w-10 h-[2px] bg-burning-orange"></div>
        </div>
        <p class="text-[14px] font-medium text-noble-black/40">
          Manage your listed items and track their availability.
        </p>
      </section>

      <div class="flex gap-3 shrink-0">
        <NuxtLink
          to="/account/requests"
          class="inline-flex h-11 items-center gap-2 px-6 border-[1.5px] border-burning-orange text-burning-orange rounded-[12px] text-[13px] font-bold hover:bg-burning-orange/5 transition-all"
        >
          View Requests
        </NuxtLink>
        <NuxtLink
          to="/account/listings/new"
          class="inline-flex h-11 items-center gap-2 px-6 bg-burning-orange text-white rounded-[12px] text-[13px] font-bold hover:brightness-110 shadow-lg shadow-burning-orange/20 transition-all"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add New Item
        </NuxtLink>
      </div>
    </div>

    <div
      class="bg-cream border border-cinnamon-ice/20 rounded-[24px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] space-y-6"
    >
      <!-- Rewards & Boost Status -->
      <div
        class="flex flex-col gap-4 rounded-[18px] border border-burning-orange/10 bg-white p-5 sm:flex-row sm:items-center sm:justify-between shadow-sm"
      >
        <div class="flex items-center gap-4">
          <div
            class="w-12 h-12 bg-burning-orange/[0.08] text-burning-orange rounded-full flex items-center justify-center shrink-0"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="8" r="7" />
              <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
            </svg>
          </div>
          <div>
            <p class="text-[15px] font-bold text-noble-black">
              Available: {{ rewardsSummary?.availablePoints ?? 0 }} points
            </p>
            <p class="mt-0.5 text-[13px] text-noble-black/40 font-medium">
              {{
                showBoostIntentBanner
                  ? "Select an eligible listing below to activate boost."
                  : "Spend 50 points to boost visibility for 24 hours."
              }}
            </p>
          </div>
        </div>
        <NuxtLink
          to="/account/rewards"
          class="h-10 px-6 inline-flex items-center justify-center rounded-[10px] bg-burning-orange/[0.08] text-burning-orange font-bold text-[13px] transition-all hover:bg-burning-orange/[0.12]"
        >
          Open Rewards
        </NuxtLink>
      </div>

      <div class="flex flex-col gap-6 xl:flex-row xl:items-center">
        <!-- HD Search Bar -->
        <div
          class="flex min-w-0 flex-1 items-center gap-3 rounded-[12px] border border-gray-200 bg-white px-4 py-2.5 shadow-sm focus-within:border-burning-orange focus-within:ring-4 focus-within:ring-burning-orange/5 transition-all"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            class="shrink-0 text-noble-black/30"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search your listings..."
            class="flex-1 bg-transparent text-noble-black text-[15px] font-medium placeholder:text-noble-black/30 focus:outline-none"
          />
        </div>

        <div
          class="flex flex-col gap-4 xl:min-w-[420px] xl:flex-row xl:items-center xl:justify-end"
        >
          <!-- Status Filters (Pills) -->
          <div class="flex flex-wrap gap-2">
            <button
              v-for="option in STATUS_OPTIONS"
              :key="option.value"
              type="button"
              class="h-9 px-4 rounded-full text-[13px] font-bold transition-all duration-300 border-[1.5px]"
              :class="
                selectedStatuses.includes(option.value)
                  ? 'border-burning-orange bg-burning-orange text-white shadow-md shadow-burning-orange/20'
                  : 'border-gray-200 bg-white text-noble-black/50 hover:border-burning-orange/30 hover:text-noble-black'
              "
              @click="toggleStatusFilter(option.value)"
            >
              {{ option.label }}
            </button>
          </div>

          <div class="relative">
            <button
              type="button"
              class="h-9 inline-flex w-full items-center justify-between gap-3 rounded-full border-[1.5px] border-gray-200 bg-white px-5 text-[13px] font-bold text-noble-black/70 transition-all hover:border-burning-orange/30 hover:text-noble-black xl:min-w-[160px]"
              @click="toggleCategoryMenu"
            >
              <span>
                {{
                  selectedCategories.length > 0
                    ? `Categories (${selectedCategories.length})`
                    : "All Categories"
                }}
              </span>
              <svg
                class="h-4 w-4 transition-transform duration-300"
                :class="{ 'rotate-180': isCategoryDropdownOpen }"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="3"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div
              v-if="isCategoryDropdownOpen"
              class="absolute right-0 z-20 mt-2 w-full min-w-[280px] rounded-[20px] border border-cinnamon-ice/20 bg-white p-4 shadow-[0_20px_40px_rgba(0,0,0,0.12)] animate-in zoom-in-95 duration-200"
            >
              <input
                v-model="categorySearch"
                type="text"
                placeholder="Search categories..."
                class="mb-3 h-10 w-full rounded-[10px] border border-gray-100 bg-gray-50/50 px-4 text-[14px] text-noble-black placeholder:text-noble-black/30 focus:border-burning-orange focus:bg-white focus:outline-none transition-all"
              />

              <div class="max-h-64 space-y-1 overflow-y-auto custom-modal-scrollbar pr-1">
                <label
                  v-for="category in filteredCategoryOptions"
                  :key="category.value"
                  class="flex cursor-pointer items-center justify-between rounded-[10px] px-3 py-2 transition-colors group"
                  :class="
                    selectedCategories.includes(category.value)
                      ? 'bg-burning-orange/5'
                      : 'hover:bg-gray-50'
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
                      class="w-5 h-5 rounded-md border-2 border-gray-200 peer-checked:border-burning-orange peer-checked:bg-burning-orange transition-all"
                    ></div>
                    <svg
                      class="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="4"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
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
        class="flex flex-wrap gap-2 pt-2"
      >
        <button
          v-for="status in selectedStatuses"
          :key="status"
          type="button"
          class="inline-flex items-center gap-2 rounded-lg bg-burning-orange text-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider shadow-sm hover:brightness-110 transition-all"
          @click="removeStatusFilter(status)"
        >
          {{ STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status }}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <button
          v-for="category in selectedCategoryEntries"
          :key="category.value"
          type="button"
          class="inline-flex items-center gap-2 rounded-lg bg-gray-100 text-noble-black/50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider hover:bg-gray-200 transition-all"
          @click="removeCategoryFilter(category.value)"
        >
          {{ category.label }}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
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
    </div>

    <div
      v-if="(!hasFetched || isLoading) && listings.length === 0"
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div v-for="i in 4" :key="i" class="h-72 rounded-[20px] bg-cream animate-pulse" />
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
        class="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm border border-gray-100"
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          class="text-noble-black/20"
        >
          <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
          <path d="M16 3H8l-2 4h12l-2-4z" />
        </svg>
      </div>
      <div>
        <p class="text-[18px] font-bold text-noble-black">
          {{ emptyStateMessage }}
        </p>
        <p
          v-if="!searchQuery && !hasActiveFilters"
          class="mt-1 text-[14px] text-noble-black/40 font-medium"
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

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MyListingCard
        v-for="item in listings"
        :key="item.id"
        :item="item"
        :is-toggling="togglingId === item.id || boostingId === item.id"
        @toggle-status="handleToggleStatus"
        @boost-listing="handleBoostListing"
      />
    </div>

    <div v-if="hasMore && !isLoading" class="flex justify-center pt-4">
      <button
        class="px-8 py-3 bg-burning-orange text-white rounded-xl text-base font-geist hover:bg-cinnabar-red transition-colors"
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
