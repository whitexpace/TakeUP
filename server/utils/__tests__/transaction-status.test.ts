import { describe, expect, it } from "vitest"
import { toNullableUiTransactionStatus, transactionStatusGroups } from "../transaction-status"

describe("transaction-status utilities", () => {
  it("keeps accepted transactions pending until handoff proof moves them ongoing", () => {
    expect(toNullableUiTransactionStatus("CONFIRMED")).toBe("PENDING")
    expect(toNullableUiTransactionStatus("PAID")).toBe("PENDING")
    expect(toNullableUiTransactionStatus("ONGOING")).toBe("ACTIVE")
  })

  it("uses ongoing as the in-use transaction filter", () => {
    expect(transactionStatusGroups.ACTIVE).toEqual(["ONGOING"])
    expect(transactionStatusGroups.PENDING).toEqual([
      "PENDING",
      "AWAITING_LENDER_APPROVAL",
      "CONFIRMED",
      "PAID",
    ])
  })
})
