import { z } from "zod"

export const bookingIdSchema = z.object({
  id: z.string().uuid(),
})

export const bookingStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "RETURNED",
  "CANCELLED",
  "COMPLETED",
  "IN_DISPUTE",
])

export const bookingPaymentStatusSchema = z.enum([
  "NOT_REQUIRED",
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
])

export const returnStatusSchema = z.enum(["NOT_RETURNED", "RETURNED", "EARLY_RETURNED"])

export const refundStatusSchema = z.enum(["NONE", "PENDING", "PROCESSED", "NOT_ELIGIBLE", "FAILED"])

export const refundReasonSchema = z.enum(["EARLY_RETURN"])

export const paymentMethodSchema = z.enum(["CASH", "GCASH", "CARD", "BANK_TRANSFER", "WALLET"])

export const bookingRoleSchema = z.enum(["LENDER", "BORROWER"])

const bookingDateRangeShape = {
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}

export const createBookingSchema = z
  .object({
    itemId: z.string().uuid(),
    ...bookingDateRangeShape,
    platformCommission: z.number().int().min(0).default(0),
    paymentMethod: paymentMethodSchema.default("GCASH"),
    cancellationReason: z.string().trim().max(500).optional(),
  })
  .refine((payload) => payload.endDate > payload.startDate, {
    message: "endDate must be later than startDate.",
    path: ["endDate"],
  })

export const updateBookingSchema = z
  .object({
    id: z.string().uuid(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    platformCommission: z.number().int().min(0).optional(),
    paymentMethod: paymentMethodSchema.optional(),
    status: bookingStatusSchema.optional(),
    paymentStatus: bookingPaymentStatusSchema.optional(),
    cancellationReason: z.string().trim().max(500).nullable().optional(),
  })
  .refine(
    (payload) =>
      payload.startDate !== undefined ||
      payload.endDate !== undefined ||
      payload.platformCommission !== undefined ||
      payload.paymentMethod !== undefined ||
      payload.status !== undefined ||
      payload.paymentStatus !== undefined ||
      payload.cancellationReason !== undefined,
    { message: "At least one field is required for update." },
  )

export const deleteBookingSchema = bookingIdSchema

export const returnBookingSchema = bookingIdSchema

export const earlyReturnBookingSchema = z.object({
  id: z.string().uuid(),
  returnReason: z.string().trim().max(500).optional(),
})

export const bookingCursorSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.coerce.date(),
})

export const listBookingsSchema = z
  .object({
    role: bookingRoleSchema.optional(),
    status: bookingStatusSchema.optional(),
    itemId: z.string().uuid().optional(),
    startDateFrom: z.coerce.date().optional(),
    startDateTo: z.coerce.date().optional(),
    limit: z.number().int().min(1).max(100).default(20),
    cursor: bookingCursorSchema.optional(),
  })
  .default({})

export type BookingStatus = z.infer<typeof bookingStatusSchema>
export type BookingPaymentStatus = z.infer<typeof bookingPaymentStatusSchema>
export type ReturnStatus = z.infer<typeof returnStatusSchema>
export type RefundStatus = z.infer<typeof refundStatusSchema>
export type RefundReason = z.infer<typeof refundReasonSchema>
export type PaymentMethod = z.infer<typeof paymentMethodSchema>
export type BookingRole = z.infer<typeof bookingRoleSchema>
export type CreateBookingInput = z.infer<typeof createBookingSchema>
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>
export type ListBookingsInput = z.infer<typeof listBookingsSchema>
