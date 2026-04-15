import { z } from "zod"

export const accountDeletionReasonDetailSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1).optional(),
})

export const accountDeletionReasonSchema = z.object({
  code: z.enum([
    "ACTIVE_TRANSACTIONS",
    "PENDING_OR_UPCOMING_BOOKINGS",
    "ACTIVE_DISPUTES",
    "REMAINING_PAYOUT_BALANCE",
    "UNSETTLED_PAYMENTS_OR_FEES",
    "ACCOUNT_RESTRICTION",
  ]),
  title: z.string().min(1),
  message: z.string().min(1),
  nextStep: z.string().min(1),
  details: z.array(accountDeletionReasonDetailSchema).optional(),
})

export const accountDeletionEligibilitySchema = z.object({
  eligible: z.boolean(),
  reasons: z.array(accountDeletionReasonSchema),
})

export const deleteAccountRequestSchema = z.object({
  confirmation: z
    .string()
    .trim()
    .refine((value) => value === "DELETE", {
      message: 'Type "DELETE" to confirm account deletion.',
    }),
})

export type AccountDeletionReason = z.infer<typeof accountDeletionReasonSchema>
export type AccountDeletionReasonDetail = z.infer<typeof accountDeletionReasonDetailSchema>
export type AccountDeletionEligibility = z.infer<typeof accountDeletionEligibilitySchema>
export type DeleteAccountRequest = z.infer<typeof deleteAccountRequestSchema>
