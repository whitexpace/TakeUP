import { z } from "zod"

export const transactionStatusSchema = z.enum([
  "PENDING",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "RETURNED",
  "IN_DISPUTE",
])

export const transactionRoleSchema = z.enum(["LENDER", "BORROWER"])

const transactionListCursorSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.coerce.date(),
})

export const listTransactionsSchema = z.object({
  role: transactionRoleSchema.optional(),
  status: transactionStatusSchema.optional(),
  startDateFrom: z.coerce.date().optional(),
  startDateTo: z.coerce.date().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: transactionListCursorSchema.optional(),
})

export const listAdminTransactionsSchema = z.object({
  status: transactionStatusSchema.optional(),
  createdAtFrom: z.coerce.date().optional(),
  createdAtTo: z.coerce.date().optional(),
  search: z.string().trim().min(1).max(120).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: transactionListCursorSchema.optional(),
})

export type TransactionStatus = z.infer<typeof transactionStatusSchema>
export type TransactionRole = z.infer<typeof transactionRoleSchema>
export type ListTransactionsInput = z.infer<typeof listTransactionsSchema>
export type ListAdminTransactionsInput = z.infer<typeof listAdminTransactionsSchema>
