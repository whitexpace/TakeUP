import { z } from "zod"

export const reviewTypeSchema = z.enum(["ITEM_REVIEW", "LENDER_REVIEW", "BORROWER_REVIEW"])

export const MAX_REVIEW_IMAGES = 4
export const MAX_REVIEW_IMAGE_BYTES = 5 * 1024 * 1024
export const ALLOWED_REVIEW_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

export const createTransactionReviewSchema = z
  .object({
    transactionId: z.string().uuid(),
    reviewType: reviewTypeSchema,
    rating: z.number().int().min(1).max(5),
    reviewText: z.string().trim().min(1, "Review text is required.").max(1000),
    images: z.array(z.string().url()).max(MAX_REVIEW_IMAGES).default([]),
    isAnonymous: z.boolean().default(false),
  })
  .superRefine((input, ctx) => {
    if (input.reviewType !== "ITEM_REVIEW" && input.images.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["images"],
        message: "Images can only be attached to item reviews.",
      })
    }
  })

export const transactionReviewDraftKeySchema = z.object({
  transactionId: z.string().uuid(),
  reviewType: reviewTypeSchema,
})

export const upsertTransactionReviewDraftSchema = transactionReviewDraftKeySchema
  .extend({
    rating: z.number().int().min(1).max(5).default(5),
    reviewText: z.string().trim().max(1000).default(""),
    images: z.array(z.string().min(1)).max(MAX_REVIEW_IMAGES).default([]),
    isAnonymous: z.boolean().default(false),
  })
  .superRefine((input, ctx) => {
    if (input.reviewType !== "ITEM_REVIEW" && input.images.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["images"],
        message: "Images can only be attached to item reviews.",
      })
    }
  })

export const reviewRatingSchema = z.number().int().min(1).max(5)

export const createReviewSchema = z.object({
  bookingId: z.string().uuid(),
  rating: reviewRatingSchema,
  reviewText: z.string().trim().max(1000).optional(),
  isAnonymous: z.boolean().default(false),
  reviewType: reviewTypeSchema.optional(),
})

export const bookingReviewLookupSchema = z.object({
  bookingId: z.string().uuid(),
})

export type ReviewType = z.infer<typeof reviewTypeSchema>
export type CreateTransactionReviewInput = z.infer<typeof createTransactionReviewSchema>
export type TransactionReviewDraftKeyInput = z.infer<typeof transactionReviewDraftKeySchema>
export type UpsertTransactionReviewDraftInput = z.infer<typeof upsertTransactionReviewDraftSchema>
export type CreateReviewInput = z.infer<typeof createReviewSchema>
export type BookingReviewLookupInput = z.infer<typeof bookingReviewLookupSchema>
