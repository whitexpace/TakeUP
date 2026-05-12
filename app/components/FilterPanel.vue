<template>
  <div class="space-y-0">
    <!-- Sticky Header Unit (FILTERS + Clear All + Divider) -->
    <div
      class="sticky top-0 bg-cream z-20 -mx-6 px-6 pt-4 pb-4 shadow-[0_4px_12px_-4px_rgba(32,33,36,0.02)]"
    >
      <div class="flex items-center justify-between gap-4">
        <h2
          class="font-geist font-bold text-[16px] tracking-widest text-noble-black/65 uppercase whitespace-nowrap"
        >
          FILTERS
        </h2>
        <button
          class="font-geist font-normal text-[13px] text-burning-orange hover:text-blue-estate transition-all duration-300 whitespace-nowrap"
          @click="clearAll"
        >
          Clear all
        </button>
      </div>
      <div class="w-full h-[1px] bg-cinnamon-ice/30 mt-4 -mb-4"></div>
    </div>

    <!-- Listing Types -->
    <div class="flex flex-col">
      <div
        class="flex items-center justify-between cursor-pointer group py-5"
        @click="toggleSection('listingTypes')"
      >
        <h3 class="section-title group-hover:text-burning-orange transition-colors">
          Listing Types
        </h3>
        <Icon
          name="ph:caret-down"
          class="w-4 h-4 text-noble-black/40 transition-transform duration-300 shrink-0"
          :class="{ 'rotate-180': !collapsedSections.listingTypes }"
        />
      </div>
      <transition name="section">
        <div v-if="!collapsedSections.listingTypes" class="space-y-1.5 pb-5 pt-1">
          <label
            v-for="type in listingTypes"
            :key="type"
            class="flex items-center group cursor-pointer"
          >
            <div class="relative flex items-center justify-center">
              <input
                v-model="internalSelectedListingType"
                type="radio"
                :value="type"
                name="listingType"
                class="peer appearance-none w-4 h-4 border-[1.5px] border-cinnamon-ice/40 rounded-full checked:border-burning-orange transition-all duration-300 cursor-pointer"
              />
              <div
                class="absolute w-2 h-2 bg-burning-orange rounded-full opacity-0 peer-checked:opacity-100 transition-opacity duration-300 pointer-events-none"
              ></div>
            </div>
            <span class="ml-3 filter-option-label group-hover:text-noble-black">
              {{ type }}
            </span>
          </label>
        </div>
      </transition>
      <div class="divider"></div>
    </div>

    <!-- Categories -->
    <div class="flex flex-col">
      <div
        class="flex items-center justify-between cursor-pointer group py-5"
        @click="toggleSection('categories')"
      >
        <h3 class="section-title group-hover:text-burning-orange transition-colors">Categories</h3>
        <Icon
          name="ph:caret-down"
          class="w-4 h-4 text-noble-black/40 transition-transform duration-300 shrink-0"
          :class="{ 'rotate-180': !collapsedSections.categories }"
        />
      </div>
      <transition name="section">
        <div v-if="!collapsedSections.categories" class="space-y-3 pr-2 pb-5 pt-1">
          <div class="relative" @keydown.escape="closeCategoryDropdown">
            <div class="relative flex items-center">
              <input
                v-model="categorySearch"
                type="text"
                placeholder="Search categories"
                class="w-full h-10 bg-white rounded-[10px] border border-cinnamon-ice/30 px-3 pr-10 font-geist text-[13px] text-noble-black placeholder:text-noble-black/40 focus:outline-none focus:border-burning-orange transition-colors"
                @focus="openCategoryDropdown"
                @input="openCategoryDropdown"
              />
              <button
                type="button"
                class="absolute right-3 p-1 text-noble-black/30 hover:text-noble-black transition-colors"
                @click="toggleCategoryDropdown"
              >
                <Icon
                  name="ph:caret-down"
                  class="w-3.5 h-3.5 transition-transform duration-200 shrink-0"
                  :class="{ 'rotate-180': isCategoryDropdownOpen }"
                />
              </button>
            </div>

            <div
              v-if="isCategoryDropdownOpen"
              class="absolute left-0 right-0 mt-2 max-h-60 overflow-y-auto rounded-[12px] border border-cinnamon-ice/20 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08)] z-20 custom-scrollbar"
            >
              <button
                v-for="cat in filteredCategoryOptions"
                :key="cat.name"
                type="button"
                class="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-cream transition-colors"
                @click="selectCategory(cat.name)"
              >
                <span class="font-geist text-[13px] text-noble-black/70">
                  {{ cat.name }}
                </span>
                <span class="font-geist text-[11px] text-noble-black/30"> ({{ cat.count }}) </span>
              </button>
              <div
                v-if="filteredCategoryOptions.length === 0"
                class="px-4 py-3 font-geist text-[12px] text-noble-black/40"
              >
                No matching categories
              </div>
            </div>
          </div>

          <div v-if="selectedCategoryEntries.length > 0" class="flex flex-wrap gap-2">
            <div
              v-for="cat in selectedCategoryEntries"
              :key="cat.name"
              class="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-cinnamon-ice/20 bg-white px-2.5 py-1.5"
            >
              <span class="font-geist text-[12px] font-bold text-noble-black/70 truncate">
                {{ cat.name }}
              </span>
              <button
                type="button"
                class="shrink-0 text-noble-black/30 hover:text-burning-orange transition-colors"
                @click="removeCategory(cat.name)"
              >
                <Icon name="ph:x" class="w-3 h-3 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </transition>
      <div class="divider"></div>
    </div>

    <!-- Price Range (Slider) -->
    <div class="flex flex-col">
      <div
        class="flex items-center justify-between cursor-pointer group py-5"
        @click="toggleSection('priceRange')"
      >
        <h3 class="section-title group-hover:text-burning-orange transition-colors">Price Range</h3>
        <Icon
          name="ph:caret-down"
          class="w-4 h-4 text-noble-black/40 transition-transform duration-300 shrink-0"
          :class="{ 'rotate-180': !collapsedSections.priceRange }"
        />
      </div>
      <transition name="section">
        <div v-if="!collapsedSections.priceRange" class="pb-6 pt-2 px-1">
          <!-- Dual-handle range slider implementation -->
          <div class="relative h-1 w-full bg-noble-black/10 rounded-full mb-8">
            <div
              class="absolute h-full bg-burning-orange rounded-full"
              :style="{ left: sliderLeft + '%', right: 100 - sliderRight + '%' }"
            ></div>

            <input
              type="range"
              min="0"
              max="2000"
              step="50"
              :value="internalMinPrice"
              class="absolute inset-0 w-full h-1 bg-transparent appearance-none pointer-events-none z-10 slider-thumb"
              @input="updateMinPrice"
            />
            <input
              type="range"
              min="0"
              max="2000"
              step="50"
              :value="internalMaxPrice"
              class="absolute inset-0 w-full h-1 bg-transparent appearance-none pointer-events-none z-10 slider-thumb"
              @input="updateMaxPrice"
            />
          </div>

          <div class="flex items-center justify-between">
            <div class="flex flex-col">
              <span
                class="text-[10px] font-bold text-noble-black/30 uppercase tracking-wider mb-0.5"
                >Min</span
              >
              <span class="text-[13px] font-bold text-noble-black">₱{{ internalMinPrice }}</span>
            </div>
            <div class="flex flex-col text-right">
              <span
                class="text-[10px] font-bold text-noble-black/30 uppercase tracking-wider mb-0.5"
                >Max</span
              >
              <span class="text-[13px] font-bold text-noble-black"
                >₱{{ internalMaxPrice === 2000 ? "2,000+" : internalMaxPrice }}</span
              >
            </div>
          </div>
        </div>
      </transition>
      <div class="divider"></div>
    </div>

    <!-- Rating -->
    <div class="flex flex-col">
      <div
        class="flex items-center justify-between cursor-pointer group py-5"
        @click="toggleSection('rating')"
      >
        <h3 class="section-title group-hover:text-burning-orange transition-colors">Rating</h3>
        <Icon
          name="ph:caret-down"
          class="w-4 h-4 text-noble-black/40 transition-transform duration-300 shrink-0"
          :class="{ 'rotate-180': !collapsedSections.rating }"
        />
      </div>
      <transition name="section">
        <div v-if="!collapsedSections.rating" class="space-y-1.5 pb-5 pt-1">
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
                  class="peer appearance-none w-4 h-4 border-[1.5px] border-cinnamon-ice/40 rounded-full checked:border-burning-orange transition-all duration-300 cursor-pointer"
                />
                <div
                  class="absolute w-2 h-2 bg-burning-orange rounded-full opacity-0 peer-checked:opacity-100 transition-opacity duration-300 pointer-events-none"
                ></div>
              </div>
              <div class="ml-3 flex items-center gap-0.5">
                <Icon
                  v-for="i in 5"
                  :key="i"
                  name="ph:star-fill"
                  class="w-3 h-3 transition-colors duration-300 shrink-0"
                  :class="i <= rate.stars ? 'text-burning-orange' : 'text-noble-black/10'"
                />
                <span
                  v-if="rate.stars < 5"
                  class="ml-1 text-[12px] font-medium text-noble-black/40"
                >
                  & up
                </span>
              </div>
            </div>
          </label>
        </div>
      </transition>
      <div class="divider"></div>
    </div>

    <!-- Condition -->
    <div class="flex flex-col">
      <div
        class="flex items-center justify-between cursor-pointer group py-5"
        @click="toggleSection('condition')"
      >
        <h3 class="section-title group-hover:text-burning-orange transition-colors">Condition</h3>
        <Icon
          name="ph:caret-down"
          class="w-4 h-4 text-noble-black/40 transition-transform duration-300 shrink-0"
          :class="{ 'rotate-180': !collapsedSections.condition }"
        />
      </div>
      <transition name="section">
        <div v-if="!collapsedSections.condition" class="space-y-1.5 pb-5 pt-1">
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
                  class="peer appearance-none w-4 h-4 border-[1.5px] border-cinnamon-ice/40 rounded-md checked:bg-burning-orange checked:border-burning-orange transition-all duration-300 cursor-pointer"
                />
                <Icon
                  name="ph:check"
                  class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 pointer-events-none"
                />
              </div>
              <span class="ml-3 filter-option-label group-hover:text-noble-black">
                {{ cond.name }}
              </span>
            </div>
          </label>
        </div>
      </transition>
      <div class="divider"></div>
    </div>

    <!-- Availability Date -->
    <div class="flex flex-col pb-10">
      <div
        class="flex items-center justify-between cursor-pointer group py-5"
        @click="toggleSection('availabilityDate')"
      >
        <h3 class="section-title group-hover:text-burning-orange transition-colors">
          Availability Date
        </h3>
        <Icon
          name="ph:caret-down"
          class="w-4 h-4 text-noble-black/40 transition-transform duration-300 shrink-0"
          :class="{ 'rotate-180': !collapsedSections.availabilityDate }"
        />
      </div>
      <transition name="section">
        <div v-if="!collapsedSections.availabilityDate" class="space-y-4 pb-5 pt-1">
          <div class="space-y-1.5">
            <label
              class="block font-geist text-[11px] font-bold uppercase tracking-wider text-noble-black/30 ml-1"
              >From</label
            >
            <div class="flex gap-2">
              <div class="flex-1">
                <CustomCalendar v-model="dateFrom" placeholder="Date" disable-past />
              </div>
              <div class="w-[115px]">
                <CustomTimePicker v-model="timeFrom" placeholder="Time" :min-time="minTimeFrom" />
              </div>
            </div>
          </div>
          <div class="space-y-1.5">
            <label
              class="block font-geist text-[11px] font-bold uppercase tracking-wider text-noble-black/30 ml-1"
              >To</label
            >
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
                  :min-time="minTimeTo"
                  strict-min
                />
              </div>
            </div>
          </div>
        </div>
      </transition>
      <div class="divider"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, watchEffect } from "vue"
import type { FilterMetadata } from "../types/item-listing"
import {
  CATEGORY_MAP,
  CONDITION_MAP,
  SIDEBAR_CATEGORIES,
} from "../composables/use-dashboard-filters"

const props = defineProps<{
  filterMetadata?: FilterMetadata | null
  selectedListingTypes?: string[]
  selectedCategories?: string[]
  minPrice?: number | null
  maxPrice?: number | null
  selectedRating?: number | null
  selectedConditions?: string[]
  dateFrom?: string
  timeFrom?: string
  dateTo?: string
  timeTo?: string
}>()

const emit = defineEmits<{
  "update:selectedListingTypes": [v: string[]]
  "update:selectedCategories": [v: string[]]
  "update:minPrice": [v: number | null]
  "update:maxPrice": [v: number | null]
  "update:selectedRating": [v: number | null]
  "update:selectedConditions": [v: string[]]
  "update:dateFrom": [v: string]
  "update:timeFrom": [v: string]
  "update:dateTo": [v: string]
  "update:timeTo": [v: string]
}>()

// ── Local reactive state synced with props ────────────────────────────────────
const selectedListingTypes = ref<string[]>(props.selectedListingTypes ?? [])

const internalSelectedListingType = computed({
  get: () => selectedListingTypes.value[0] || "",
  set: (val) => {
    selectedListingTypes.value = val ? [val] : []
  },
})

const selectedCategories = ref<string[]>(props.selectedCategories ?? [])
const minPrice = ref<number | null>(props.minPrice ?? null)
const maxPrice = ref<number | null>(props.maxPrice ?? null)
const selectedRating = ref<number | null>(props.selectedRating ?? null)
const selectedConditions = ref<string[]>(props.selectedConditions ?? [])
const dateFrom = ref<string>(props.dateFrom ?? "")
const timeFrom = ref<string>(props.timeFrom ?? "")
const dateTo = ref<string>(props.dateTo ?? "")
const timeTo = ref<string>(props.timeTo ?? "")

const minTimeFrom = computed(() => {
  if (!dateFrom.value) return ""
  const todayStr = new Date().toLocaleDateString("en-CA") // YYYY-MM-DD
  if (dateFrom.value !== todayStr) return ""

  const now = new Date()
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`
})

const minTimeTo = computed(() => {
  if (!dateTo.value || !dateFrom.value || dateFrom.value !== dateTo.value || !timeFrom.value)
    return ""

  // Add 1 hour to timeFrom
  const [h = 0, m = 0] = timeFrom.value.split(":").map(Number)
  const date = new Date()
  date.setHours(h + 1, m, 0, 0)
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`
})

const categorySearch = ref("")
const isCategoryDropdownOpen = ref(false)

// Sync inbound prop changes (e.g. clearAll from parent)
watchEffect(() => {
  selectedListingTypes.value = props.selectedListingTypes ?? []
  selectedCategories.value = props.selectedCategories ?? []
  minPrice.value = props.minPrice ?? null
  maxPrice.value = props.maxPrice ?? null
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
watch(minPrice, (v) => emit("update:minPrice", v))
watch(maxPrice, (v) => emit("update:maxPrice", v))
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
    if (selectedCategories.value.includes(category.name)) return false
    if (!query) return true
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

// ── Price Slider Logic ───────────────────────────────────────────────────────
const MAX_VAL = 2000
const internalMinPrice = computed(() => minPrice.value ?? 0)
const internalMaxPrice = computed(() => maxPrice.value ?? MAX_VAL)

const sliderLeft = computed(() => (internalMinPrice.value / MAX_VAL) * 100)
const sliderRight = computed(() => (internalMaxPrice.value / MAX_VAL) * 100)

const updateMinPrice = (e: Event) => {
  const val = parseInt((e.target as HTMLInputElement).value)
  if (val < internalMaxPrice.value) {
    minPrice.value = val === 0 ? null : val
  }
}

const updateMaxPrice = (e: Event) => {
  const val = parseInt((e.target as HTMLInputElement).value)
  if (val > internalMinPrice.value) {
    maxPrice.value = val === MAX_VAL ? null : val
  }
}

// ── Ratings ──────────────────────────────────────────────────────────────────
const ratings = [
  { value: 5, stars: 5 },
  { value: 4, stars: 4 },
  { value: 3, stars: 3 },
  { value: 2, stars: 2 },
  { value: 1, stars: 1 },
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

watch(dateFrom, (newDateFrom) => {
  if (newDateFrom && dateTo.value && newDateFrom > dateTo.value) {
    dateTo.value = ""
  }
})

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
  minPrice.value = null
  maxPrice.value = null
  selectedRating.value = null
  selectedConditions.value = []
  dateFrom.value = ""
  timeFrom.value = ""
  dateTo.value = ""
  timeTo.value = ""

  emit("update:selectedListingTypes", [])
  emit("update:selectedCategories", [])
  emit("update:minPrice", null)
  emit("update:maxPrice", null)
  emit("update:selectedRating", null)
  emit("update:selectedConditions", [])
  emit("update:dateFrom", "")
  emit("update:timeFrom", "")
  emit("update:dateTo", "")
  emit("update:timeTo", "")
}
</script>

<style scoped>
.section-title {
  font-family: theme("fontFamily.geist");
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: theme("colors.noble-black / 30%");
}

.filter-option-label {
  font-family: theme("fontFamily.geist");
  font-size: 13px;
  color: theme("colors.gray.700");
  font-weight: 500;
  transition: color 0.2s ease;
}

.divider {
  width: 100%;
  height: 1px;
  background-color: theme("colors.cinnamon-ice / 15%");
}

/* Range Slider Styling */
.slider-thumb {
  pointer-events: none;
}
.slider-thumb::-webkit-slider-thumb {
  pointer-events: auto;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  border: 2px solid theme("colors.burning-orange");
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}
.slider-thumb::-moz-range-thumb {
  pointer-events: auto;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  border: 2px solid theme("colors.burning-orange");
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

/* Transition animations */
.section-enter-active,
.section-leave-active {
  transition: all 0.25s ease-out;
}
.section-enter-from,
.section-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

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
</style>
