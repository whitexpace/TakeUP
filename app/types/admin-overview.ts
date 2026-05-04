import type { TransactionStatus } from "../../shared/schemas/transaction"

export type AdminOverviewResponse = {
  summary: {
    totalUsers: number
    activeUsers: number
    activeUsersWindowDays: number
    activeUsersDefinition: string
    totalTransactions: number
    activeTransactions: number
    completedTransactions: number
    disputedTransactions: number
    totalListings: number
    activeListings: number
    totalCommissionCollected: number
    currentSystemWalletBalance: number
    currency: string
  }
  ratings: {
    averageBorrowerRating: number | null
    ratedBorrowerCount: number
    averageLenderRating: number | null
    ratedLenderCount: number
  }
  topItems: Array<{
    id: string
    name: string
    averageRating: number
    reviewCount: number
    bookingCount: number
    thumbnailImage: string | null
  }>
  previews: {
    recentTransactions: Array<{
      id: string
      bookingId: string | null
      itemName: string
      borrowerName: string
      lenderName: string
      status: TransactionStatus
      totalAmount: number
      createdAt: string | Date
    }>
    recentDisputes: Array<{
      id: string
      transactionId: string
      itemName: string
      reason: string
      status: string
      raisedByName: string
      createdAt: string | Date
    }>
    recentListings: Array<{
      id: string
      name: string
      status: string
      rating: number
      bookingCount: number
      thumbnailImage: string | null
      createdAt: string | Date
    }>
  }
  generatedAt: string | Date
}
