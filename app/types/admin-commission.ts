import type { TransactionStatus } from "../../shared/schemas/transaction"

export type AdminCommissionSummary = {
  totalCommissionCollected: number
  currentCommissionBalance: number
  commissionTransactionCount: number
  currency: string
}

export type AdminCommissionRecord = {
  id: string
  walletId: string
  referenceCode: string
  bookingId: string | null
  sourceTransactionId: string | null
  transactionStatus: TransactionStatus | null
  itemName: string | null
  grossAmount: number
  commissionAmount: number
  netReleasedToLender: number
  walletStatus: string
  collectedAt: string | Date
}

export type AdminCommissionCursor = {
  id: string
  createdAt: string | Date
} | null

export type AdminCommissionResponse = {
  summary: AdminCommissionSummary
  records: AdminCommissionRecord[]
  nextCursor: AdminCommissionCursor
}
