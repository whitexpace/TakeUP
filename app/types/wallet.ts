export type WalletTransactionType = "TOP_UP" | "PAYMENT" | "REFUND" | "ADJUSTMENT"
export type WalletTransactionMethod = "PSEUDO" | "GCASH" | "BANK" | "MAYA"
export type WalletTransactionStatus = "SUCCESS" | "FAILED" | "REVERSED" | "PENDING"

export interface WalletTransaction {
  id: string
  type: WalletTransactionType
  method: WalletTransactionMethod
  amount: number
  balanceBefore: number
  balanceAfter: number
  referenceCode: string
  status: WalletTransactionStatus
  createdAt: string
}

export interface Wallet {
  id: string
  balance: number
  currency: string
  status: "ACTIVE" | "SUSPENDED" | "CLOSED"
}

export interface LinkedAccount {
  id: string
  type: "GCASH" | "LANDBANK" | "MAYA"
  accountName: string
  accountNumber: string
}
