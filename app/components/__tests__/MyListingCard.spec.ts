import { describe, it, expect } from "vitest"

type DisplayStatus = "ACTIVE" | "IN_USE" | "INACTIVE" | "DISPUTED"
type ItemStatus = "AVAILABLE" | "RENTED" | "DEACTIVATED"
type RateOption = "PER_HOUR" | "PER_DAY"

const STATUS_LABELS: Record<DisplayStatus, string> = {
  ACTIVE: "ACTIVE",
  IN_USE: "IN USE",
  INACTIVE: "INACTIVE",
  DISPUTED: "DISPUTED",
}

function getStatusLabel(displayStatus: DisplayStatus) {
  return STATUS_LABELS[displayStatus]
}

function getTypeBadge(freeToBorrow: boolean) {
  return freeToBorrow ? "Borrow" : "Rent"
}

function getToggleTarget(status: ItemStatus): "AVAILABLE" | "DEACTIVATED" | null {
  if (status === "AVAILABLE") return "DEACTIVATED"
  if (status === "DEACTIVATED") return "AVAILABLE"
  return null
}

function isToggleDisabled(status: ItemStatus) {
  return status === "RENTED"
}

function formatPrice(freeToBorrow: boolean, rentalFee: number, rateOption: RateOption) {
  if (freeToBorrow) return "₱Free"
  const unit = rateOption === "PER_DAY" ? "day" : "hr"
  return `₱${rentalFee}/${unit}`
}

function getStatusClass(hasActiveDispute: boolean) {
  return hasActiveDispute ? "text-cinnabar-red" : "text-indigo-900"
}

describe("MyListingCard logic", () => {
  it("renders ACTIVE from display status", () => {
    expect(getStatusLabel("ACTIVE")).toBe("ACTIVE")
  })

  it("renders IN USE from display status", () => {
    expect(getStatusLabel("IN_USE")).toBe("IN USE")
  })

  it("renders INACTIVE from display status", () => {
    expect(getStatusLabel("INACTIVE")).toBe("INACTIVE")
  })

  it("renders DISPUTED from display status", () => {
    expect(getStatusLabel("DISPUTED")).toBe("DISPUTED")
  })

  it("uses dispute styling when the listing has an active dispute", () => {
    expect(getStatusClass(true)).toBe("text-cinnabar-red")
    expect(getStatusClass(false)).toBe("text-indigo-900")
  })

  it("shows Borrow type badge when freeToBorrow is true", () => {
    expect(getTypeBadge(true)).toBe("Borrow")
  })

  it("shows Rent type badge when freeToBorrow is false", () => {
    expect(getTypeBadge(false)).toBe("Rent")
  })

  it("toggle is disabled when item is RENTED", () => {
    expect(isToggleDisabled("RENTED")).toBe(true)
    expect(isToggleDisabled("AVAILABLE")).toBe(false)
    expect(isToggleDisabled("DEACTIVATED")).toBe(false)
  })

  it("toggle target is DEACTIVATED for AVAILABLE items", () => {
    expect(getToggleTarget("AVAILABLE")).toBe("DEACTIVATED")
  })

  it("toggle target is AVAILABLE for DEACTIVATED items", () => {
    expect(getToggleTarget("DEACTIVATED")).toBe("AVAILABLE")
  })

  it("formats ₱Free for free-to-borrow items", () => {
    expect(formatPrice(true, 0, "PER_DAY")).toBe("₱Free")
  })

  it("formats price per day for paid rental items", () => {
    expect(formatPrice(false, 500, "PER_DAY")).toBe("₱500/day")
  })

  it("formats price per hour for per-hour rental items", () => {
    expect(formatPrice(false, 20, "PER_HOUR")).toBe("₱20/hr")
  })
})
