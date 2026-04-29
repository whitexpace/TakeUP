import { z } from "zod"

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
