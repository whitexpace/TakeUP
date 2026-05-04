import type { AdminListingViewStatus } from "../../shared/schemas/admin"

export type AdminListingSummary = {
  totalListings: number
  activeListings: number
  inactiveListings: number
}

export type AdminListingCursor = {
  id: string
  createdAt: string | Date
} | null

export type AdminListingRecord = {
  id: string
  numericId: number
  name: string
  category: string
  owner: {
    id: string
    name: string
    username: string
    email: string
  }
  status: AdminListingViewStatus
  statusLabel: string
  rating: number
  createdAt: string | Date
  hasActiveTransactions: boolean
  rawStatus: string
  adminModeratedAt: string | Date | null
}

export type AdminListingsResponse = {
  summary: AdminListingSummary
  listings: AdminListingRecord[]
  nextCursor: AdminListingCursor
}
