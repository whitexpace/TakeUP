import { computed, ref, watch } from "vue"

// Keep client-side filter constants local so Vitest and Nuxt build do not depend on
// resolving cross-root imports from app code.
export const UI_OTHERS_SENTINEL = "OTHERS" as const

export const KNOWN_SIDEBAR_DB_CATEGORIES = [
  "BOOKS",
  "ELECTRONICS",
  "SPORTS_OUTDOORS",
  "SCHOOL_SUPPLIES",
  "MUSIC_AUDIO",
  "TOOLS",
  "CLOTHING",
  "HOME_APPLIANCES",
  "TOYS_GAMES",
  "FURNITURE",
  "VEHICLES_ACCESSORIES",
  "HEALTH_BEAUTY",
  "PET_SUPPLIES",
] as const

// ── Price bucket definitions ─────────────────────────────────────────────────
export type PriceBucket = "all" | "free" | "under100" | "100to500" | "over500"

export interface PriceRange {
  bucket: PriceBucket
  label: string
  min?: number
  max?: number
  free?: boolean
}

export const PRICE_RANGES: PriceRange[] = [
  { bucket: "all", label: "All" },
  { bucket: "free", label: "Free (Borrow)", free: true },
  { bucket: "under100", label: "Under ₱100", min: 1, max: 99 },
  { bucket: "100to500", label: "₱100 – ₱500", min: 100, max: 500 },
  { bucket: "over500", label: "₱500+", min: 501 },
]

// ── Category → DB enum mapping ───────────────────────────────────────────────
// Each sidebar label maps to exactly ONE unique DB category value.
// "Others" uses the UI_OTHERS_SENTINEL which triggers the "none of known list" query.
export const CATEGORY_MAP: Record<string, string> = {
  "Books & Academics": "BOOKS",
  Electronics: "ELECTRONICS",
  "Sports Equipment": "SPORTS_OUTDOORS",
  "Dorm Essentials": "SCHOOL_SUPPLIES",
  "Music & Audio": "MUSIC_AUDIO",
  Tools: "TOOLS",
  Attire: "CLOTHING",
  "Home & Appliances": "HOME_APPLIANCES",
  "Toys & Games": "TOYS_GAMES",
  "Pet Supplies": "PET_SUPPLIES",
  // Sentinel — not a DB value; triggers the "items with no known category" query
  Others: UI_OTHERS_SENTINEL,
}

// Ordered list of sidebar panel labels (drives FilterPanel display order)
export const SIDEBAR_CATEGORIES = [
  "Books & Academics",
  "Electronics",
  "Sports Equipment",
  "Dorm Essentials",
  "Music & Audio",
  "Tools",
  "Attire",
  "Home & Appliances",
  "Toys & Games",
  "Pet Supplies",
  "Others",
] as const

// ── Condition → DB enum mapping ──────────────────────────────────────────────
export const CONDITION_MAP: Record<string, string> = {
  New: "NEW",
  "Like New": "LIKE_NEW",
  Good: "GOOD",
  Fair: "FAIR",
  Poor: "POOR",
}

export const DASHBOARD_FILTERS_SESSION_STORAGE_KEY = "dashboard:last-used-filters"

type DashboardFilterSessionState = {
  selectedListingTypes: string[]
  selectedCategories: string[]
  selectedPriceRange: string
  selectedRating: number | null
  selectedConditions: string[]
  dateFrom: string
  timeFrom: string
  dateTo: string
  timeTo: string
}

const getFilterSessionStorage = (): Storage | null => {
  if (typeof sessionStorage === "undefined") return null
  return sessionStorage
}

const normalizeStringArray = (value: unknown) => {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []
}

const normalizeString = (value: unknown) => (typeof value === "string" ? value : "")

const normalizeRating = (value: unknown) => {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

const normalizeDashboardFilterSessionState = (value: unknown): DashboardFilterSessionState => {
  const state = value && typeof value === "object" ? (value as Record<string, unknown>) : {}

  return {
    selectedListingTypes: normalizeStringArray(state.selectedListingTypes),
    selectedCategories: normalizeStringArray(state.selectedCategories),
    selectedPriceRange: normalizeString(state.selectedPriceRange),
    selectedRating: normalizeRating(state.selectedRating),
    selectedConditions: normalizeStringArray(state.selectedConditions),
    dateFrom: normalizeString(state.dateFrom),
    timeFrom: normalizeString(state.timeFrom),
    dateTo: normalizeString(state.dateTo),
    timeTo: normalizeString(state.timeTo),
  }
}

const readStoredDashboardFilterState = (): DashboardFilterSessionState | null => {
  const storage = getFilterSessionStorage()
  if (!storage) return null

  try {
    const rawState = storage.getItem(DASHBOARD_FILTERS_SESSION_STORAGE_KEY)
    if (!rawState) return null

    return normalizeDashboardFilterSessionState(JSON.parse(rawState))
  } catch {
    storage.removeItem(DASHBOARD_FILTERS_SESSION_STORAGE_KEY)
    return null
  }
}

// ── Filter state ─────────────────────────────────────────────────────────────
export const useDashboardFilters = () => {
  const storedState = readStoredDashboardFilterState()

  const selectedListingTypes = ref<string[]>(storedState?.selectedListingTypes ?? [])
  const selectedCategories = ref<string[]>(storedState?.selectedCategories ?? [])
  const selectedPriceRange = ref<string>(storedState?.selectedPriceRange ?? "")
  const selectedRating = ref<number | null>(storedState?.selectedRating ?? null)
  const selectedConditions = ref<string[]>(storedState?.selectedConditions ?? [])
  const dateFrom = ref<string>(storedState?.dateFrom ?? "")
  const timeFrom = ref<string>(storedState?.timeFrom ?? "")
  const dateTo = ref<string>(storedState?.dateTo ?? "")
  const timeTo = ref<string>(storedState?.timeTo ?? "")

  const persistCurrentState = () => {
    const storage = getFilterSessionStorage()
    if (!storage) return

    const state: DashboardFilterSessionState = {
      selectedListingTypes: [...selectedListingTypes.value],
      selectedCategories: [...selectedCategories.value],
      selectedPriceRange: selectedPriceRange.value,
      selectedRating: selectedRating.value,
      selectedConditions: [...selectedConditions.value],
      dateFrom: dateFrom.value,
      timeFrom: timeFrom.value,
      dateTo: dateTo.value,
      timeTo: timeTo.value,
    }

    const isDefaultState =
      state.selectedListingTypes.length === 0 &&
      state.selectedCategories.length === 0 &&
      state.selectedPriceRange === "" &&
      state.selectedRating === null &&
      state.selectedConditions.length === 0 &&
      state.dateFrom === "" &&
      state.timeFrom === "" &&
      state.dateTo === "" &&
      state.timeTo === ""

    if (isDefaultState) {
      storage.removeItem(DASHBOARD_FILTERS_SESSION_STORAGE_KEY)
      return
    }

    storage.setItem(DASHBOARD_FILTERS_SESSION_STORAGE_KEY, JSON.stringify(state))
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
    persistCurrentState()
  }

  // ── Derived query params (for API calls) ──────────────────────────────────
  const filterQueryParams = computed(() => {
    const params: Record<string, string | undefined> = {}

    // Categories → DB enums or OTHERS sentinel (comma-separated)
    const dbCategories = selectedCategories.value
      .map((c) => CATEGORY_MAP[c])
      .filter((v): v is string => Boolean(v))
    if (dbCategories.length) params.categories = dbCategories.join(",")

    // Conditions → DB enums (comma-separated)
    const dbConditions = selectedConditions.value
      .map((c) => CONDITION_MAP[c])
      .filter((v): v is string => Boolean(v))
    if (dbConditions.length) params.conditions = dbConditions.join(",")

    // Price Range
    const priceBucket = PRICE_RANGES.find((p) => p.label === selectedPriceRange.value)
    if (priceBucket && priceBucket.bucket !== "all") {
      if (priceBucket.free) {
        params.freeToBorrow = "true"
      } else {
        if (priceBucket.min !== undefined) params.minPrice = String(priceBucket.min)
        if (priceBucket.max !== undefined) params.maxPrice = String(priceBucket.max)
      }
    }

    const isBorrowOnly =
      selectedListingTypes.value.includes("For Borrow") &&
      !selectedListingTypes.value.includes("For Rent")
    const isRentOnly =
      selectedListingTypes.value.includes("For Rent") &&
      !selectedListingTypes.value.includes("For Borrow")

    // Listing type takes precedence over conflicting price selections.
    if (isBorrowOnly) {
      delete params.minPrice
      delete params.maxPrice
      params.freeToBorrow = "true"
    } else if (isRentOnly) {
      params.freeToBorrow = "false"
    }

    // Availability dates
    const combinedFrom = dateFrom.value
      ? `${dateFrom.value}${timeFrom.value ? `T${timeFrom.value}` : "T00:00:00"}`
      : undefined
    const combinedTo = dateTo.value
      ? `${dateTo.value}${timeTo.value ? `T${timeTo.value}` : "T23:59:59"}`
      : undefined
    if (combinedFrom) params.availableFrom = combinedFrom
    if (combinedTo) params.availableTo = combinedTo

    // Rating: pass the minimum star value as minRating
    if (selectedRating.value !== null) {
      params.minRating = String(selectedRating.value)
    }

    return params
  })

  const hasActiveFilters = computed(() => Object.keys(filterQueryParams.value).length > 0)

  watch(
    [
      selectedListingTypes,
      selectedCategories,
      selectedPriceRange,
      selectedRating,
      selectedConditions,
      dateFrom,
      timeFrom,
      dateTo,
      timeTo,
    ],
    () => {
      persistCurrentState()
    },
    { deep: true, flush: "sync" },
  )

  return {
    // State (passed to FilterPanel as v-model or props)
    selectedListingTypes,
    selectedCategories,
    selectedPriceRange,
    selectedRating,
    selectedConditions,
    dateFrom,
    timeFrom,
    dateTo,
    timeTo,
    // Derived
    filterQueryParams,
    hasActiveFilters,
    clearAll,
  }
}
