import type { ItemStatus, RateOption } from "@prisma/client"

export interface PublicProfile {
  user: {
    id: string
    username: string
    name: string
    avatarUrl: string | null
    createdAt: string | Date
    bio: string | null
    rating: number
    borrowerRating: number
    itemsSold: number
    activeListings: number
  }
  reviews: Array<{
    id: string
    rating: number
    text: string
    createdAt: string | Date
    isAnonymous: boolean
    reviewType: "LENDER_REVIEW" | "BORROWER_REVIEW"
    reviewer: {
      username: string
      name: string
      avatarUrl: string | null
    }
  }>
  items: Array<{
    id: string
    name: string
    status: ItemStatus
    rentalFee: number
    freeToBorrow: boolean
    rateOption: RateOption
    rating: number
    bookingCount: number
    ownerName: string
    lenderUsername: string | null
    category: string
    image: string | null
    isLiked: boolean
  }>
}

export interface UserSearchResult {
  id: string
  username: string
  name: string
  avatarUrl: string | null
  rating: number
  activeListings: number
}
