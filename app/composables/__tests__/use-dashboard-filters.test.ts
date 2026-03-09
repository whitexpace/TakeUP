import { describe, expect, it } from "vitest"
import { PRICE_RANGES, useDashboardFilters } from "../use-dashboard-filters"

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

    filters.selectedPriceRange.value = PRICE_RANGES.find((range) => range.bucket === "100to500")!.label
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
    filters.selectedPriceRange.value = PRICE_RANGES.find((range) => range.bucket === "under100")!.label
    filters.dateFrom.value = "2026-03-10"
    filters.timeFrom.value = "09:00:00"

    filters.clearAll()

    expect(filters.filterQueryParams.value).toEqual({})
    expect(filters.hasActiveFilters.value).toBe(false)
  })
})
