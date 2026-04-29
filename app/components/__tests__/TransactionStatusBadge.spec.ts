import { describe, expect, it } from "vitest"
import type { TransactionStatus } from "#shared/schemas/transaction"

// Pure logic extracted from TransactionStatusBadge.vue for unit testing
const getLabel = (status: TransactionStatus, role: "LENDER" | "BORROWER"): string => {
  switch (status) {
    case "PENDING":
      return role === "BORROWER" ? "To Receive" : "Ready for Approval"
    case "ACTIVE":
      return "In Use"
    case "COMPLETED":
      return "Completed"
    case "CANCELLED":
      return "Cancelled"
    case "RETURNED":
      return "Item Returned"
    default:
      return ""
  }
}

const getBadgeClass = (status: TransactionStatus): string => {
  switch (status) {
    case "PENDING":
      return "bg-burning-orange"
    case "ACTIVE":
    case "COMPLETED":
    case "RETURNED":
      return "bg-indigo-900"
    case "CANCELLED":
      return "bg-cinnabar-red"
    default:
      return "bg-gray-400"
  }
}

describe("TransactionStatusBadge logic", () => {
  describe("label", () => {
    it("returns 'To Receive' for PENDING as BORROWER", () => {
      expect(getLabel("PENDING", "BORROWER")).toBe("To Receive")
    })

    it("returns 'Ready for Approval' for PENDING as LENDER", () => {
      expect(getLabel("PENDING", "LENDER")).toBe("Ready for Approval")
    })

    it("returns 'In Use' for ACTIVE (both roles)", () => {
      expect(getLabel("ACTIVE", "BORROWER")).toBe("In Use")
      expect(getLabel("ACTIVE", "LENDER")).toBe("In Use")
    })

    it("returns 'Completed' for COMPLETED (both roles)", () => {
      expect(getLabel("COMPLETED", "BORROWER")).toBe("Completed")
      expect(getLabel("COMPLETED", "LENDER")).toBe("Completed")
    })

    it("returns 'Cancelled' for CANCELLED (both roles)", () => {
      expect(getLabel("CANCELLED", "BORROWER")).toBe("Cancelled")
      expect(getLabel("CANCELLED", "LENDER")).toBe("Cancelled")
    })

    it("returns 'Item Returned' for RETURNED (both roles)", () => {
      expect(getLabel("RETURNED", "BORROWER")).toBe("Item Returned")
      expect(getLabel("RETURNED", "LENDER")).toBe("Item Returned")
    })
  })

  describe("badge class", () => {
    it("uses bg-burning-orange for PENDING", () => {
      expect(getBadgeClass("PENDING")).toBe("bg-burning-orange")
    })

    it("uses bg-indigo-900 for ACTIVE", () => {
      expect(getBadgeClass("ACTIVE")).toBe("bg-indigo-900")
    })

    it("uses bg-indigo-900 for COMPLETED", () => {
      expect(getBadgeClass("COMPLETED")).toBe("bg-indigo-900")
    })

    it("uses bg-indigo-900 for RETURNED", () => {
      expect(getBadgeClass("RETURNED")).toBe("bg-indigo-900")
    })

    it("uses bg-cinnabar-red for CANCELLED", () => {
      expect(getBadgeClass("CANCELLED")).toBe("bg-cinnabar-red")
    })
  })
})
