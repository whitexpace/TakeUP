<script setup lang="ts">
import type { MyListingCategory, MyListingFilterStatus } from "../../../composables/use-my-listings"

definePageMeta({ layout: "account", middleware: "account-auth" })

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
} = useMyListings()

const categorySearch = ref("")
const isCategoryDropdownOpen = ref(false)

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

const emptyStateMessage = computed(() => {
  if (searchQuery.value.trim() || hasActiveFilters.value) {
    return "No listings match your current search or filters."
  }

  return "You haven't listed any items yet."
})

const toggleCategoryMenu = () => {
  isCategoryDropdownOpen.value = !isCategoryDropdownOpen.value
}

onMounted(() => {
  void refresh()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-neutral-800 text-xl sm:text-2xl font-bold font-geist">My Listings</h1>
        <p class="text-neutral-800 text-base sm:text-lg font-normal font-geist tracking-wide mt-1">
          Manage your listed items for borrow or rent
        </p>
      </div>
      <div class="flex gap-3 shrink-0">
        <NuxtLink
          to="/account/requests"
          class="inline-flex items-center gap-2 px-5 py-2.5 border border-orange-500 text-orange-600 rounded-[30px] text-sm font-medium font-geist hover:bg-cream transition-colors"
        >
          View Requests
        </NuxtLink>
        <NuxtLink
          to="/account/listings/new"
          class="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-[30px] text-sm font-medium font-geist hover:bg-orange-600 transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add New Item
        </NuxtLink>
      </div>
    </div>

    <div class="rounded-[24px] border border-cinnamon-ice bg-cream px-4 py-4 sm:px-5">
      <div class="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div
          class="flex min-w-0 flex-1 items-center gap-3 rounded-[20px] border border-cinnamon-ice bg-white px-4 py-3"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="shrink-0 text-neutral-800/50"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search your listings"
            class="flex-1 bg-transparent text-neutral-800/70 text-base font-normal font-geist placeholder:text-neutral-800/50 focus:outline-none"
          />
        </div>

        <div
          class="flex flex-col gap-3 xl:min-w-[420px] xl:flex-row xl:items-center xl:justify-end"
        >
          <div class="flex flex-wrap gap-2">
            <button
              v-for="option in STATUS_OPTIONS"
              :key="option.value"
              type="button"
              class="rounded-full border px-4 py-2 text-sm font-medium font-geist transition-colors"
              :class="
                selectedStatuses.includes(option.value)
                  ? 'border-burning-orange bg-burning-orange text-white'
                  : 'border-cinnamon-ice bg-white text-neutral-800 hover:border-burning-orange/40 hover:text-burning-orange'
              "
              @click="toggleStatusFilter(option.value)"
            >
              {{ option.label }}
            </button>
          </div>

          <div class="relative">
            <button
              type="button"
              class="inline-flex w-full items-center justify-between gap-2 rounded-full border border-cinnamon-ice bg-white px-4 py-2 text-sm font-medium font-geist text-neutral-800 transition-colors hover:border-burning-orange/40 hover:text-burning-orange xl:min-w-[190px]"
              @click="toggleCategoryMenu"
            >
              <span>
                {{
                  selectedCategories.length > 0
                    ? `Categories (${selectedCategories.length})`
                    : "Categories"
                }}
              </span>
              <svg
                class="h-4 w-4 transition-transform duration-200"
                :class="{ 'rotate-180': isCategoryDropdownOpen }"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            <div
              v-if="isCategoryDropdownOpen"
              class="absolute right-0 z-20 mt-2 w-full min-w-[260px] rounded-[18px] border border-cinnamon-ice bg-white p-3 shadow-[0_12px_32px_rgba(0,0,0,0.08)]"
            >
              <input
                v-model="categorySearch"
                type="text"
                placeholder="Search categories"
                class="mb-3 h-[42px] w-full rounded-[12px] border border-cinnamon-ice/60 px-4 font-geist text-[14px] text-neutral-800 placeholder:text-neutral-800/45 focus:border-burning-orange focus:outline-none"
              />

              <div class="max-h-60 space-y-2 overflow-y-auto pr-1">
                <label
                  v-for="category in filteredCategoryOptions"
                  :key="category.value"
                  class="flex cursor-pointer items-center justify-between rounded-[12px] px-3 py-2 hover:bg-cream"
                >
                  <span class="font-geist text-sm text-neutral-800">{{ category.label }}</span>
                  <input
                    :checked="selectedCategories.includes(category.value)"
                    type="checkbox"
                    class="h-4 w-4 rounded border-cinnamon-ice text-burning-orange focus:ring-burning-orange"
                    @change="toggleCategoryFilter(category.value)"
                  />
                </label>
                <p
                  v-if="filteredCategoryOptions.length === 0"
                  class="px-3 py-2 font-geist text-sm text-neutral-800/50"
                >
                  No matching categories
                </p>
              </div>
            </div>
          </div>

          <button
            v-if="hasActiveFilters"
            type="button"
            class="text-sm font-medium font-geist text-burning-orange transition-colors hover:text-blue-estate"
            @click="clearFilters"
          >
            Clear all
          </button>
        </div>
      </div>

      <div
        v-if="selectedStatuses.length > 0 || selectedCategoryEntries.length > 0"
        class="mt-4 flex flex-wrap gap-2"
      >
        <button
          v-for="status in selectedStatuses"
          :key="status"
          type="button"
          class="inline-flex items-center gap-2 rounded-full border border-burning-orange/25 bg-white px-3 py-1.5 text-xs font-medium font-geist text-burning-orange"
          @click="removeStatusFilter(status)"
        >
          {{ STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status }}
          <span aria-hidden="true">×</span>
        </button>

        <button
          v-for="category in selectedCategoryEntries"
          :key="category.value"
          type="button"
          class="inline-flex items-center gap-2 rounded-full border border-cinnamon-ice bg-white px-3 py-1.5 text-xs font-medium font-geist text-neutral-800"
          @click="removeCategoryFilter(category.value)"
        >
          {{ category.label }}
          <span aria-hidden="true">×</span>
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
      class="bg-cream rounded-[20px] border border-cinnamon-ice p-10 text-center space-y-4"
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        class="text-neutral-800/30 mx-auto"
      >
        <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
        <path d="M16 3H8l-2 4h12l-2-4z" />
      </svg>
      <p class="text-neutral-800/60 text-lg font-geist">
        {{ emptyStateMessage }}
      </p>
    </div>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MyListingCard v-for="item in listings" :key="item.id" :item="item" />
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
  </div>
</template>
