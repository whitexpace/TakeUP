import { z } from "zod"

export const transactionStatusSchema = z.enum([
  "PENDING",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "RETURNED",
])

export const transactionRoleSchema = z.enum(["LENDER", "BORROWER"])

export const listTransactionsSchema = z.object({
  role: transactionRoleSchema.optional(),
  status: transactionStatusSchema.optional(),
  startDateFrom: z.coerce.date().optional(),
  startDateTo: z.coerce.date().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z
    .object({
      id: z.string().uuid(),
      createdAt: z.coerce.date(),
    })
    .optional(),
})

export type TransactionStatus = z.infer<typeof transactionStatusSchema>
export type TransactionRole = z.infer<typeof transactionRoleSchema>
export type ListTransactionsInput = z.infer<typeof listTransactionsSchema>
