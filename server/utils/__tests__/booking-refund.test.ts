import { describe, it, expect } from "vitest"
import { calculateEarlyReturnRefund } from "../booking-refund"
import type { Booking } from "@prisma/client"

describe("calculateEarlyReturnRefund", () => {
  const mockBooking: Partial<Booking> = {
    id: "booking_123",
    totalFee: 5000,
    platformCommission: 500,
    startDate: new Date("2026-04-01T00:00:00.000Z"),
    endDate: new Date("2026-04-06T00:00:00.000Z"), // 5 days total
    status: "CONFIRMED",
  }

  it("calculates correct refund for 2 days used out of 5 (40% usage)", () => {
    const actualReturnTime = new Date("2026-04-03T00:00:00.000Z") // 2 days later
    const result = calculateEarlyReturnRefund(mockBooking as Booking, actualReturnTime)

    expect(result.eligible).toBe(true)
    expect(result.totalPaidAmount).toBe(5000)
    expect(result.nonRefundableFees).toBe(500)
    expect(result.refundableRentalAmount).toBe(4500)
    expect(result.usagePercentage).toBe(0.4)

    // unusedRentalValue = 4500 * (3 / 5) = 2700
    // refundAmount = 2700 * 0.70 = 1890
    expect(result.unusedRentalValue).toBe(2700)
    expect(result.refundAmount).toBe(1890)
    expect(result.penaltyAmount).toBe(810)
  })

  it("returns no refund if usage is exactly 70%", () => {
    const actualReturnTime = new Date("2026-04-04T12:00:00.000Z") // 3.5 days used
    // 3.5 / 5 = 0.7
    const result = calculateEarlyReturnRefund(mockBooking as Booking, actualReturnTime)

    expect(result.eligible).toBe(false)
    expect(result.usagePercentage).toBe(0.7)
    expect(result.refundAmount).toBe(0)
  })

  it("returns no refund if usage is > 70%", () => {
    const actualReturnTime = new Date("2026-04-05T00:00:00.000Z") // 4 days used (80%)
    const result = calculateEarlyReturnRefund(mockBooking as Booking, actualReturnTime)

    expect(result.eligible).toBe(false)
    expect(result.usagePercentage).toBe(0.8)
    expect(result.refundAmount).toBe(0)
  })

  it("handles case where return time is before start time (safety check)", () => {
    const actualReturnTime = new Date("2026-03-31T00:00:00.000Z")
    const result = calculateEarlyReturnRefund(mockBooking as Booking, actualReturnTime)

    expect(result.eligible).toBe(true)
    expect(result.usagePercentage).toBe(0)
    expect(result.refundAmount).toBe(Math.floor(4500 * 0.7))
  })

  it("handles case where return time is exactly end time", () => {
    const actualReturnTime = new Date("2026-04-06T00:00:00.000Z")
    const result = calculateEarlyReturnRefund(mockBooking as Booking, actualReturnTime)

    expect(result.eligible).toBe(false)
    expect(result.usagePercentage).toBe(1)
    expect(result.refundAmount).toBe(0)
  })
})
