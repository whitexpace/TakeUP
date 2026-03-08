import { ref, computed } from "vue"

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
export const CATEGORY_MAP: Record<string, string> = {
  "Books & Academics": "BOOKS",
  Electronics: "ELECTRONICS",
  "Arts & Craft Supplies": "OTHER",
  "Event & Party": "OTHER",
  "Sports Equipment": "SPORTS_OUTDOORS",
  "Dorm Essentials": "SCHOOL_SUPPLIES",
  Photography: "ELECTRONICS",
  "Music & Audio": "MUSIC_AUDIO",
  Tools: "TOOLS",
  Attire: "CLOTHING",
}

// ── Condition → DB enum mapping ──────────────────────────────────────────────
export const CONDITION_MAP: Record<string, string> = {
  New: "NEW",
  "Like New": "LIKE_NEW",
  Good: "GOOD",
  Fair: "FAIR",
  Poor: "POOR",
}

// ── Filter state ─────────────────────────────────────────────────────────────
export const useDashboardFilters = () => {
  const selectedListingTypes = ref<string[]>([])
  const selectedCategories = ref<string[]>([])
  const selectedPriceRange = ref<string>("")
  const selectedRating = ref<number | null>(null)
  const selectedConditions = ref<string[]>([])
  const dateFrom = ref<string>("")
  const timeFrom = ref<string>("")
  const dateTo = ref<string>("")
  const timeTo = ref<string>("")

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
  }

  // ── Derived query params (for API calls) ──────────────────────────────────
  const filterQueryParams = computed(() => {
    const params: Record<string, string | undefined> = {}

    // Categories → DB enums (comma-separated)
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

    // Listing type: "For Borrow" → freeToBorrow=true; "For Rent" → freeToBorrow=false
    if (
      selectedListingTypes.value.includes("For Borrow") &&
      !selectedListingTypes.value.includes("For Rent")
    ) {
      params.freeToBorrow = "true"
    } else if (
      selectedListingTypes.value.includes("For Rent") &&
      !selectedListingTypes.value.includes("For Borrow")
    ) {
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

    return params
  })

  const hasActiveFilters = computed(() => {
    return (
      selectedListingTypes.value.length > 0 ||
      selectedCategories.value.length > 0 ||
      Boolean(selectedPriceRange.value) ||
      selectedRating.value !== null ||
      selectedConditions.value.length > 0 ||
      Boolean(dateFrom.value) ||
      Boolean(dateTo.value)
    )
  })

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
