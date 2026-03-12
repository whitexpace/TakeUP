<template>
  <div class="space-y-0">
    <!-- Sticky Header Unit (FILTERS + Clear All + X Icon + Divider) -->
    <div
      class="sticky top-0 bg-cream z-20 -mx-6 px-6 pt-4 pb-4 shadow-[0_4px_12px_-4px_rgba(32,33,36,0.02)]"
    >
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <h2
            class="font-geist font-bold text-[16px] tracking-widest text-noble-black/65 uppercase whitespace-nowrap"
          >
            FILTERS
          </h2>
          <div class="w-[1px] h-4 bg-cinnamon-ice/40"></div>
          <button
            class="font-geist font-normal text-[13px] text-burning-orange hover:text-blue-estate transition-all duration-300 whitespace-nowrap"
            @click="clearAll"
          >
            Clear all
          </button>
        </div>

        <button
          class="p-1 hover:bg-pale-cashmere rounded-full transition-colors text-noble-black/60 hover:text-noble-black"
          title="Close Sidebar"
          @click="$emit('toggle-sidebar')"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M18 6L6 18M6 6L18 18"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
      <div class="w-full h-[1px] bg-cinnamon-ice/50 mt-4 -mb-4"></div>
    </div>

    <!-- Listing Types -->
    <div class="flex flex-col">
      <div
        class="flex items-center justify-between cursor-pointer group py-5"
        @click="toggleSection('listingTypes')"
      >
        <h3
          class="font-geist font-bold text-[14px] text-noble-black/80 group-hover:text-burning-orange transition-colors"
        >
          Listing Types
        </h3>
        <svg
          class="w-4 h-4 text-noble-black/80 transition-transform duration-300"
          :class="{ 'rotate-180': !collapsedSections.listingTypes }"
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
      </div>
      <transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="transform -translate-y-2 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="transform translate-y-0 opacity-100"
        leave-to-class="transform -translate-y-2 opacity-0"
      >
        <div v-if="!collapsedSections.listingTypes" class="space-y-2 pb-5 pt-1">
          <label
            v-for="type in listingTypes"
            :key="type"
            class="flex items-center group cursor-pointer"
          >
            <div class="relative flex items-center justify-center">
              <input
                v-model="selectedListingTypes"
                type="checkbox"
                :value="type"
                class="peer appearance-none w-[18px] h-[18px] border-[1.5px] border-cinnamon-ice/60 rounded-md checked:bg-burning-orange checked:border-burning-orange transition-all duration-300 cursor-pointer"
              />
              <svg
                class="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="3"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span
              class="ml-3 font-geist text-[14px] text-noble-black/80 group-hover:text-noble-black transition-colors duration-300"
            >
              {{ type }}
            </span>
          </label>
        </div>
      </transition>
      <div class="w-full h-[1px] bg-cinnamon-ice/50"></div>
    </div>

    <!-- Categories -->
    <div class="flex flex-col">
      <div
        class="flex items-center justify-between cursor-pointer group py-5"
        @click="toggleSection('categories')"
      >
        <h3
          class="font-geist font-bold text-[14px] text-noble-black/80 group-hover:text-burning-orange transition-colors"
        >
          Categories
        </h3>
        <svg
          class="w-4 h-4 text-noble-black/80 transition-transform duration-300"
          :class="{ 'rotate-180': !collapsedSections.categories }"
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
      </div>
      <transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="transform -translate-y-2 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="transform translate-y-0 opacity-100"
        leave-to-class="transform -translate-y-2 opacity-0"
      >
        <div v-if="!collapsedSections.categories" class="space-y-3 pr-2 pb-5 pt-1">
          <div class="relative" @keydown.escape="closeCategoryDropdown">
            <div class="relative flex items-center">
              <input
                v-model="categorySearch"
                type="text"
                placeholder="Search categories"
                class="w-full h-[44px] bg-white rounded-[12px] border border-cinnamon-ice/60 px-4 pr-10 font-geist text-[14px] text-noble-black placeholder:text-noble-black/45 focus:outline-none focus:border-burning-orange transition-colors"
                @focus="openCategoryDropdown"
                @input="openCategoryDropdown"
              />
              <button
                type="button"
                class="absolute right-3 p-1 text-noble-black/50 hover:text-noble-black transition-colors"
                @click="toggleCategoryDropdown"
              >
                <svg
                  class="w-4 h-4 transition-transform duration-200"
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
            </div>

            <div
              v-if="isCategoryDropdownOpen"
              class="absolute left-0 right-0 mt-2 max-h-60 overflow-y-auto rounded-[12px] border border-cinnamon-ice/60 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08)] z-20"
            >
              <button
                v-for="cat in filteredCategoryOptions"
                :key="cat.name"
                type="button"
                class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-cream transition-colors"
                @click="selectCategory(cat.name)"
              >
                <span class="font-geist text-[14px] text-noble-black/80">
                  {{ cat.name }}
                </span>
                <span class="font-geist text-[12px] text-noble-black/35"> ({{ cat.count }}) </span>
              </button>
              <div
                v-if="filteredCategoryOptions.length === 0"
                class="px-4 py-3 font-geist text-[13px] text-noble-black/45"
              >
                No matching categories
              </div>
            </div>
          </div>

          <div v-if="selectedCategoryEntries.length > 0" class="flex flex-wrap gap-2">
            <div
              v-for="cat in selectedCategoryEntries"
              :key="cat.name"
              class="inline-flex max-w-full items-center gap-2 rounded-[10px] border border-cinnamon-ice/60 bg-white px-3 py-2"
            >
              <span class="font-geist text-[13px] text-noble-black/85 truncate">
                {{ cat.name }}
              </span>
              <button
                type="button"
                class="shrink-0 text-noble-black/45 hover:text-burning-orange transition-colors"
                :title="`Remove ${cat.name}`"
                @click="removeCategory(cat.name)"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </transition>
      <div class="w-full h-[1px] bg-cinnamon-ice/50"></div>
    </div>

    <!-- Price Range -->
    <div class="flex flex-col">
      <div
        class="flex items-center justify-between cursor-pointer group py-5"
        @click="toggleSection('priceRange')"
      >
        <h3
          class="font-geist font-bold text-[14px] text-noble-black/80 group-hover:text-burning-orange transition-colors"
        >
          Price Range
        </h3>
        <svg
          class="w-4 h-4 text-noble-black/80 transition-transform duration-300"
          :class="{ 'rotate-180': !collapsedSections.priceRange }"
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
      </div>
      <transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="transform -translate-y-2 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="transform translate-y-0 opacity-100"
        leave-to-class="transform -translate-y-2 opacity-0"
      >
        <div v-if="!collapsedSections.priceRange" class="space-y-2.5 pb-5 pt-1">
          <label
            v-for="price in priceRanges"
            :key="price.label"
            class="flex items-center justify-between group cursor-pointer"
          >
            <div class="flex items-center">
              <div class="relative flex items-center justify-center">
                <input
                  v-model="selectedPriceRange"
                  type="radio"
                  name="priceRange"
                  :value="price.label"
                  class="peer appearance-none w-[18px] h-[18px] border-[1.5px] border-cinnamon-ice/60 rounded-full checked:border-burning-orange transition-all duration-300 cursor-pointer"
                />
                <div
                  class="absolute w-2.5 h-2.5 bg-burning-orange rounded-full scale-0 peer-checked:scale-100 transition-transform duration-300 pointer-events-none"
                ></div>
              </div>
              <span
                class="ml-3 font-geist text-[14px] text-noble-black/80 group-hover:text-noble-black transition-colors duration-300"
              >
                {{ price.label }}
              </span>
            </div>
            <span
              class="font-geist text-[12px] text-noble-black/30 group-hover:text-noble-black/60 transition-colors duration-300"
            >
              ({{ price.count }})
            </span>
          </label>
        </div>
      </transition>
      <div class="w-full h-[1px] bg-cinnamon-ice/50"></div>
    </div>

    <!-- Rating -->
    <div class="flex flex-col">
      <div
        class="flex items-center justify-between cursor-pointer group py-5"
        @click="toggleSection('rating')"
      >
        <h3
          class="font-geist font-bold text-[14px] text-noble-black/80 group-hover:text-burning-orange transition-colors"
        >
          Rating
        </h3>
        <svg
          class="w-4 h-4 text-noble-black/80 transition-transform duration-300"
          :class="{ 'rotate-180': !collapsedSections.rating }"
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
      </div>
      <transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="transform -translate-y-2 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="transform translate-y-0 opacity-100"
        leave-to-class="transform -translate-y-2 opacity-0"
      >
        <div v-if="!collapsedSections.rating" class="space-y-2.5 pb-5 pt-1">
          <label
            v-for="rate in ratings"
            :key="rate.value"
            class="flex items-center justify-between group cursor-pointer"
          >
            <div class="flex items-center">
              <div class="relative flex items-center justify-center">
                <input
                  v-model="selectedRating"
                  type="radio"
                  name="rating"
                  :value="rate.value"
                  class="peer appearance-none w-[18px] h-[18px] border-[1.5px] border-cinnamon-ice/60 rounded-full checked:border-burning-orange transition-all duration-300 cursor-pointer"
                />
                <div
                  class="absolute w-2.5 h-2.5 bg-burning-orange rounded-full scale-0 peer-checked:scale-100 transition-transform duration-300 pointer-events-none"
                ></div>
              </div>
              <div class="ml-3 flex items-center gap-0.5">
                <svg
                  v-for="i in 5"
                  :key="i"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  :class="[
                    i <= rate.stars ? 'fill-burning-orange' : 'fill-noble-black/10',
                    'transition-colors duration-300',
                  ]"
                >
                  <path
                    d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                  />
                </svg>
                <span v-if="rate.stars < 5" class="ml-1 font-geist text-[13px] text-noble-black/50">
                  & up
                </span>
              </div>
            </div>
            <span
              class="font-geist text-[12px] text-noble-black/30 group-hover:text-noble-black/60 transition-colors duration-300"
            >
              ({{ rate.count }})
            </span>
          </label>
        </div>
      </transition>
      <div class="w-full h-[1px] bg-cinnamon-ice/50"></div>
    </div>

    <!-- Condition -->
    <div class="flex flex-col">
      <div
        class="flex items-center justify-between cursor-pointer group py-5"
        @click="toggleSection('condition')"
      >
        <h3
          class="font-geist font-bold text-[14px] text-noble-black/80 group-hover:text-burning-orange transition-colors"
        >
          Condition
        </h3>
        <svg
          class="w-4 h-4 text-noble-black/80 transition-transform duration-300"
          :class="{ 'rotate-180': !collapsedSections.condition }"
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
      </div>
      <transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="transform -translate-y-2 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="transform translate-y-0 opacity-100"
        leave-to-class="transform -translate-y-2 opacity-0"
      >
        <div v-if="!collapsedSections.condition" class="space-y-2.5 pb-5 pt-1">
          <label
            v-for="cond in conditions"
            :key="cond.name"
            class="flex items-center justify-between group cursor-pointer"
          >
            <div class="flex items-center">
              <div class="relative flex items-center justify-center">
                <input
                  v-model="selectedConditions"
                  type="checkbox"
                  :value="cond.name"
                  class="peer appearance-none w-[18px] h-[18px] border-[1.5px] border-cinnamon-ice/60 rounded-md checked:bg-burning-orange checked:border-burning-orange transition-all duration-300 cursor-pointer"
                />
                <svg
                  class="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 pointer-events-none"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="3"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span
                class="ml-3 font-geist text-[14px] text-noble-black/80 group-hover:text-noble-black transition-colors duration-300"
              >
                {{ cond.name }}
              </span>
            </div>
            <span
              class="font-geist text-[12px] text-noble-black/30 group-hover:text-noble-black/60 transition-colors duration-300"
            >
              ({{ cond.count }})
            </span>
          </label>
        </div>
      </transition>
      <div class="w-full h-[1px] bg-cinnamon-ice/50"></div>
    </div>

    <!-- Availability Date -->
    <div class="flex flex-col pb-10">
      <div
        class="flex items-center justify-between cursor-pointer group py-5"
        @click="toggleSection('availabilityDate')"
      >
        <h3
          class="font-geist font-bold text-[14px] text-noble-black/80 group-hover:text-burning-orange transition-colors"
        >
          Availability Date
        </h3>
        <svg
          class="w-4 h-4 text-noble-black/80 transition-transform duration-300"
          :class="{ 'rotate-180': !collapsedSections.availabilityDate }"
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
      </div>
      <transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="transform -translate-y-2 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="transform translate-y-0 opacity-100"
        leave-to-class="transform -translate-y-2 opacity-0"
      >
        <div v-if="!collapsedSections.availabilityDate" class="space-y-4 pb-5 pt-1">
          <div class="space-y-1.5">
            <label class="block font-geist text-[12px] text-noble-black/50 ml-1">From:</label>
            <div class="flex gap-2">
              <div class="flex-1">
                <CustomCalendar v-model="dateFrom" placeholder="Date" disable-past />
              </div>
              <div class="w-[115px]">
                <CustomTimePicker v-model="timeFrom" placeholder="Time" />
              </div>
            </div>
          </div>
          <div class="space-y-1.5">
            <label class="block font-geist text-[12px] text-noble-black/50 ml-1">To:</label>
            <div class="flex gap-2">
              <div class="flex-1">
                <CustomCalendar
                  v-model="dateTo"
                  placeholder="Date"
                  disable-past
                  :min-date="dateFrom"
                />
              </div>
              <div class="w-[115px]">
                <CustomTimePicker
                  v-model="timeTo"
                  placeholder="Time"
                  :min-time="dateFrom === dateTo ? timeFrom : ''"
                />
              </div>
            </div>
          </div>
        </div>
      </transition>
      <div class="w-full h-[1px] bg-cinnamon-ice/50"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, watchEffect } from "vue"
import type { FilterMetadata } from "../types/item-listing"
import {
  PRICE_RANGES,
  CATEGORY_MAP,
  CONDITION_MAP,
  SIDEBAR_CATEGORIES,
} from "../composables/use-dashboard-filters"

const props = defineProps<{
  filterMetadata?: FilterMetadata | null
  selectedListingTypes?: string[]
  selectedCategories?: string[]
  selectedPriceRange?: string
  selectedRating?: number | null
  selectedConditions?: string[]
  dateFrom?: string
  timeFrom?: string
  dateTo?: string
  timeTo?: string
}>()

const emit = defineEmits<{
  "toggle-sidebar": []
  "update:selectedListingTypes": [v: string[]]
  "update:selectedCategories": [v: string[]]
  "update:selectedPriceRange": [v: string]
  "update:selectedRating": [v: number | null]
  "update:selectedConditions": [v: string[]]
  "update:dateFrom": [v: string]
  "update:timeFrom": [v: string]
  "update:dateTo": [v: string]
  "update:timeTo": [v: string]
}>()

// ── Local reactive state synced with props ────────────────────────────────────
const selectedListingTypes = ref<string[]>(props.selectedListingTypes ?? [])
const selectedCategories = ref<string[]>(props.selectedCategories ?? [])
const selectedPriceRange = ref<string>(props.selectedPriceRange ?? "")
const selectedRating = ref<number | null>(props.selectedRating ?? null)
const selectedConditions = ref<string[]>(props.selectedConditions ?? [])
const dateFrom = ref<string>(props.dateFrom ?? "")
const timeFrom = ref<string>(props.timeFrom ?? "")
const dateTo = ref<string>(props.dateTo ?? "")
const timeTo = ref<string>(props.timeTo ?? "")
const categorySearch = ref("")
const isCategoryDropdownOpen = ref(false)

// Sync inbound prop changes (e.g. clearAll from parent)
watchEffect(() => {
  selectedListingTypes.value = props.selectedListingTypes ?? []
  selectedCategories.value = props.selectedCategories ?? []
  selectedPriceRange.value = props.selectedPriceRange ?? ""
  selectedRating.value = props.selectedRating ?? null
  selectedConditions.value = props.selectedConditions ?? []
  dateFrom.value = props.dateFrom ?? ""
  timeFrom.value = props.timeFrom ?? ""
  dateTo.value = props.dateTo ?? ""
  timeTo.value = props.timeTo ?? ""
})

// Emit changes upward
watch(selectedListingTypes, (v) => emit("update:selectedListingTypes", v))
watch(selectedCategories, (v) => emit("update:selectedCategories", v))
watch(selectedPriceRange, (v) => emit("update:selectedPriceRange", v))
watch(selectedRating, (v) => emit("update:selectedRating", v))
watch(selectedConditions, (v) => emit("update:selectedConditions", v))
watch(dateFrom, (v) => emit("update:dateFrom", v))
watch(timeFrom, (v) => emit("update:timeFrom", v))
watch(dateTo, (v) => emit("update:dateTo", v))
watch(timeTo, (v) => emit("update:timeTo", v))

const listingTypes = ["For Rent", "For Borrow"]

// ── Categories with live counts ───────────────────────────────────────────────
const categories = computed(() =>
  SIDEBAR_CATEGORIES.map((name) => {
    const dbKey = CATEGORY_MAP[name]
    // "Others" is stored under the "OTHERS" key in filterMetadata.categories
    const count =
      dbKey === "OTHERS"
        ? (props.filterMetadata?.categories["OTHERS"] ?? 0)
        : dbKey
          ? (props.filterMetadata?.categories[dbKey] ?? 0)
          : 0
    return { name, count }
  }),
)

type CategoryEntry = (typeof categories.value)[number]

const selectedCategoryEntries = computed<CategoryEntry[]>(() => {
  const entries: CategoryEntry[] = []

  for (const name of selectedCategories.value) {
    const matchedCategory = categories.value.find((category) => category.name === name)
    if (matchedCategory) {
      entries.push(matchedCategory)
    }
  }

  return entries
})

const filteredCategoryOptions = computed(() => {
  const query = categorySearch.value.trim().toLowerCase()

  return categories.value.filter((category) => {
    if (selectedCategories.value.includes(category.name)) {
      return false
    }

    if (!query) {
      return true
    }

    return category.name.toLowerCase().includes(query)
  })
})

const openCategoryDropdown = () => {
  isCategoryDropdownOpen.value = true
}

const closeCategoryDropdown = () => {
  isCategoryDropdownOpen.value = false
}

const toggleCategoryDropdown = () => {
  isCategoryDropdownOpen.value = !isCategoryDropdownOpen.value
}

const selectCategory = (categoryName: string) => {
  if (selectedCategories.value.includes(categoryName)) {
    categorySearch.value = ""
    closeCategoryDropdown()
    return
  }

  selectedCategories.value = [...selectedCategories.value, categoryName]
  categorySearch.value = ""
  closeCategoryDropdown()
}

const removeCategory = (categoryName: string) => {
  selectedCategories.value = selectedCategories.value.filter((name) => name !== categoryName)
}

// ── Price ranges with live counts ─────────────────────────────────────────────
const priceRanges = computed(() =>
  PRICE_RANGES.map((p) => {
    let count = 0
    if (props.filterMetadata) {
      if (p.bucket === "all") {
        count = Object.values(props.filterMetadata.prices).reduce((a, b) => a + b, 0)
      } else if (p.bucket === "free") {
        count = props.filterMetadata.freeToborrowCount
      } else {
        count = props.filterMetadata.prices[p.bucket] ?? 0
      }
    }
    return { label: p.label, count }
  }),
)

// ── Ratings (no DB-backed count yet; keep display as-is) ─────────────────────
const ratings = [
  { value: 5, stars: 5, count: 0 },
  { value: 4, stars: 4, count: 0 },
  { value: 3, stars: 3, count: 0 },
  { value: 2, stars: 2, count: 0 },
  { value: 1, stars: 1, count: 0 },
]

// ── Conditions with live counts ───────────────────────────────────────────────
const PANEL_CONDITIONS = ["New", "Like New", "Good", "Fair"]

const conditions = computed(() =>
  PANEL_CONDITIONS.map((name) => {
    const dbKey = CONDITION_MAP[name]
    const count = dbKey ? (props.filterMetadata?.conditions[dbKey] ?? 0) : 0
    return { name, count }
  }),
)

// Watch dateFrom to ensure dateTo remains valid
watch(dateFrom, (newDateFrom) => {
  if (newDateFrom && dateTo.value && newDateFrom > dateTo.value) {
    dateTo.value = ""
  }
})

// Watch timeFrom and dateTo to ensure timeTo remains valid on the same day
watch([timeFrom, dateFrom, dateTo], ([newTimeFrom, newDateFrom, newDateTo]) => {
  if (newDateFrom === newDateTo && newTimeFrom && timeTo.value && newTimeFrom > timeTo.value) {
    timeTo.value = ""
  }
})

// Collapse State
const collapsedSections = reactive({
  listingTypes: false,
  categories: false,
  priceRange: false,
  rating: false,
  condition: false,
  availabilityDate: false,
})

const toggleSection = (section: keyof typeof collapsedSections) => {
  collapsedSections[section] = !collapsedSections[section]
}

const clearAll = () => {
  selectedListingTypes.value = []
  selectedCategories.value = []
  selectedPriceRange.value = ""
  selectedRating.value = null
  selectedConditions.value = []
  dateFrom.value = ""
  timeFrom.value = ""
  dateTo.value = ""
  timeTo.value = ""

  emit("update:selectedListingTypes", [])
  emit("update:selectedCategories", [])
  emit("update:selectedPriceRange", "")
  emit("update:selectedRating", null)
  emit("update:selectedConditions", [])
  emit("update:dateFrom", "")
  emit("update:timeFrom", "")
  emit("update:dateTo", "")
  emit("update:timeTo", "")
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 3px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: theme("colors.cinnamon-ice / 50%");
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: theme("colors.burning-orange");
}

/* For browsers that support scrollbar-color (Firefox) */
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: theme("colors.cinnamon-ice / 50%") transparent;
}
</style>
