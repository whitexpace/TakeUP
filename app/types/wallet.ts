export type WalletScope = "USER" | "SYSTEM"
export type WalletTransactionType =
  | "TOP_UP"
  | "PAYMENT"
  | "REFUND"
  | "ADJUSTMENT"
  | "EARNING"
  | "COMMISSION"
export type WalletTransactionMethod = "PSEUDO" | "GCASH" | "BANK" | "MAYA" | "SYSTEM"
export type WalletTransactionStatus = "SUCCESS" | "FAILED" | "REVERSED" | "PENDING"
export type WalletTransactionDirection = "CREDIT" | "DEBIT"

export interface WalletTransaction {
  id: string
  walletId: string
  userId: string | null
  type: WalletTransactionType
  method: WalletTransactionMethod
  direction: WalletTransactionDirection
  amount: number | { toString(): string } // Decimal from Prisma serialized via superjson
  balanceBefore: number | { toString(): string }
  balanceAfter: number | { toString(): string }
  referenceCode: string
  relatedEntityType?: string | null
  relatedEntityId?: string | null
  status: WalletTransactionStatus
  metadata?: Record<string, unknown> | null
  createdAt: string | Date
  updatedAt: string | Date
}

export interface Wallet {
  id: string
  scope: WalletScope
  userId: string | null
  systemKey?: string | null
  balance: number | { toString(): string }
  currency: string
  status: "ACTIVE" | "SUSPENDED" | "CLOSED"
  createdAt: string | Date
  updatedAt: string | Date
}

export interface LinkedAccount {
  id: string
  type: "GCASH" | "LANDBANK" | "MAYA"
  accountName: string
  accountNumber: string
}
