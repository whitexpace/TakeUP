import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  DASHBOARD_FILTERS_SESSION_STORAGE_KEY,
  PRICE_RANGES,
  useDashboardFilters,
} from "../use-dashboard-filters"

const createSessionStorageMock = () => {
  const store = new Map<string, string>()

  return {
    clear: vi.fn(() => {
      store.clear()
    }),
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
    get length() {
      return store.size
    },
  }
}

let sessionStorageMock: ReturnType<typeof createSessionStorageMock>

beforeEach(() => {
  sessionStorageMock = createSessionStorageMock()
  vi.stubGlobal("sessionStorage", sessionStorageMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("useDashboardFilters", () => {
  it("treats no-op selections as inactive filters", () => {
    const filters = useDashboardFilters()

    filters.selectedPriceRange.value = PRICE_RANGES[0]!.label
    filters.selectedListingTypes.value = ["For Borrow", "For Rent"]

    expect(filters.filterQueryParams.value).toEqual({})
    expect(filters.hasActiveFilters.value).toBe(false)
  })

  it("makes borrow-only selection override paid price ranges", () => {
    const filters = useDashboardFilters()

    filters.selectedPriceRange.value = PRICE_RANGES.find(
      (range) => range.bucket === "100to500",
    )!.label
    filters.selectedListingTypes.value = ["For Borrow"]

    expect(filters.filterQueryParams.value).toEqual({
      freeToBorrow: "true",
    })
    expect(filters.hasActiveFilters.value).toBe(true)
  })

  it("makes rent-only selection override free borrowing price state", () => {
    const filters = useDashboardFilters()

    filters.selectedPriceRange.value = PRICE_RANGES.find((range) => range.bucket === "free")!.label
    filters.selectedListingTypes.value = ["For Rent"]
    filters.selectedRating.value = 4

    expect(filters.filterQueryParams.value).toEqual({
      freeToBorrow: "false",
      minRating: "4",
    })
  })

  it("clears all filter state", () => {
    const filters = useDashboardFilters()

    filters.selectedCategories.value = ["Electronics"]
    filters.selectedConditions.value = ["Good"]
    filters.selectedPriceRange.value = PRICE_RANGES.find(
      (range) => range.bucket === "under100",
    )!.label
    filters.dateFrom.value = "2026-03-10"
    filters.timeFrom.value = "09:00:00"

    filters.clearAll()

    expect(filters.filterQueryParams.value).toEqual({})
    expect(filters.hasActiveFilters.value).toBe(false)
  })

  it("restores the last used filters from session storage", () => {
    sessionStorageMock.setItem(
      DASHBOARD_FILTERS_SESSION_STORAGE_KEY,
      JSON.stringify({
        selectedListingTypes: ["For Rent"],
        selectedCategories: ["Electronics"],
        selectedPriceRange: PRICE_RANGES.find((range) => range.bucket === "under100")!.label,
        selectedRating: 4,
        selectedConditions: ["Good"],
        dateFrom: "2026-03-10",
        timeFrom: "09:00:00",
        dateTo: "2026-03-12",
        timeTo: "17:30:00",
      }),
    )

    const filters = useDashboardFilters()

    expect(filters.selectedListingTypes.value).toEqual(["For Rent"])
    expect(filters.selectedCategories.value).toEqual(["Electronics"])
    expect(filters.selectedPriceRange.value).toBe("Under ₱100")
    expect(filters.selectedRating.value).toBe(4)
    expect(filters.selectedConditions.value).toEqual(["Good"])
    expect(filters.dateFrom.value).toBe("2026-03-10")
    expect(filters.timeFrom.value).toBe("09:00:00")
    expect(filters.dateTo.value).toBe("2026-03-12")
    expect(filters.timeTo.value).toBe("17:30:00")
  })

  it("persists filter changes into session storage", () => {
    const filters = useDashboardFilters()

    filters.selectedListingTypes.value = ["For Borrow"]
    filters.selectedCategories.value = ["Electronics"]
    filters.selectedRating.value = 5

    expect(sessionStorageMock.setItem).toHaveBeenCalled()

    const storedState = JSON.parse(
      sessionStorageMock.getItem(DASHBOARD_FILTERS_SESSION_STORAGE_KEY) ?? "{}",
    )

    expect(storedState).toMatchObject({
      selectedListingTypes: ["For Borrow"],
      selectedCategories: ["Electronics"],
      selectedRating: 5,
    })
  })

  it("removes the stored session filters when cleared back to defaults", () => {
    const filters = useDashboardFilters()

    filters.selectedCategories.value = ["Electronics"]
    filters.selectedPriceRange.value = PRICE_RANGES.find((range) => range.bucket === "free")!.label

    expect(sessionStorageMock.getItem(DASHBOARD_FILTERS_SESSION_STORAGE_KEY)).not.toBeNull()

    filters.clearAll()

    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith(
      DASHBOARD_FILTERS_SESSION_STORAGE_KEY,
    )
    expect(sessionStorageMock.getItem(DASHBOARD_FILTERS_SESSION_STORAGE_KEY)).toBeNull()
  })
})
