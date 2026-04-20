import type { Booking } from "@prisma/client"

export interface RefundCalculation {
  eligible: boolean
  totalPaidAmount: number
  nonRefundableFees: number
  refundableRentalAmount: number
  usedDurationMs: number
  unusedDurationMs: number
  totalDurationMs: number
  usagePercentage: number
  unusedRentalValue: number
  penaltyAmount: number
  refundAmount: number
  currency: string
  reason?: string
}

export const calculateEarlyReturnRefund = (
  booking: Booking,
  actualReturnTime: Date,
): RefundCalculation => {
  const currency = "PHP" // Default for the app
  const totalPaidAmount = booking.totalFee
  const nonRefundableFees = booking.platformCommission
  const rentalAmount = Math.max(0, totalPaidAmount - nonRefundableFees)

  const scheduledStartTime = booking.startDate.getTime()
  const scheduledEndTime = booking.endDate.getTime()
  const actualReturnTimeMs = actualReturnTime.getTime()

  const totalDuration = scheduledEndTime - scheduledStartTime
  const usedDuration = Math.min(totalDuration, Math.max(0, actualReturnTimeMs - scheduledStartTime))
  const unusedDuration = Math.min(totalDuration, Math.max(0, scheduledEndTime - actualReturnTimeMs))

  const usagePercentage = totalDuration > 0 ? usedDuration / totalDuration : 1

  if (usagePercentage >= 0.7) {
    return {
      eligible: false,
      totalPaidAmount,
      nonRefundableFees,
      refundableRentalAmount: rentalAmount,
      usedDurationMs: usedDuration,
      unusedDurationMs: unusedDuration,
      totalDurationMs: totalDuration,
      usagePercentage,
      unusedRentalValue: 0,
      penaltyAmount: 0,
      refundAmount: 0,
      currency,
      reason: "Usage exceeded refund threshold (70%)",
    }
  }

  const unusedRentalValue = Math.round(rentalAmount * (unusedDuration / totalDuration))
  const refundAmount = Math.round(unusedRentalValue * 0.7) // 30% penalty
  const penaltyAmount = unusedRentalValue - refundAmount

  return {
    eligible: true,
    totalPaidAmount,
    nonRefundableFees,
    refundableRentalAmount: rentalAmount,
    usedDurationMs: usedDuration,
    unusedDurationMs: unusedDuration,
    totalDurationMs: totalDuration,
    usagePercentage,
    unusedRentalValue: Math.round(unusedRentalValue),
    penaltyAmount,
    refundAmount,
    currency,
  }
}
