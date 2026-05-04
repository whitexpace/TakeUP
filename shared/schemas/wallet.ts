import { z } from "zod"
import { transactionStatusSchema } from "./transaction"

export const topUpSchema = z.object({
  amount: z.number().positive().max(100000),
})

export const payWithWalletSchema = z.object({
  amount: z.number().positive(),
  relatedEntityType: z.string(),
  relatedEntityId: z.string(),
})

export const listTransactionsSchema = z.object({
  skip: z.number().optional(),
  take: z.number().optional().default(20),
})

const commissionRecordCursorSchema = z.object({
  id: z.string(),
  createdAt: z.coerce.date(),
})

export const listCommissionRecordsSchema = z.object({
  status: transactionStatusSchema.optional(),
  collectedAtFrom: z.coerce.date().optional(),
  collectedAtTo: z.coerce.date().optional(),
  search: z.string().trim().min(1).max(120).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: commissionRecordCursorSchema.optional(),
})

export type ListCommissionRecordsInput = z.infer<typeof listCommissionRecordsSchema>
