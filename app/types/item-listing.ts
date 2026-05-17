export interface ItemAvailabilityRange {
  id: string
  startDate: string | Date
  endDate: string | Date
  status: string
}

export interface ItemRankingScanCursor {
  id: string
  boostScore: number
  bookingCount: number
  createdAt: string | Date
}

export interface ItemPaginationCursor {
  version: 1
  scanExhausted: boolean
  scanCursor: ItemRankingScanCursor | null
  pendingIds: string[]
}

export interface ListedItemImage {
  path: string
  isPrimary: boolean
  sortOrder: number
}

export interface ListedItem {
  id: string
  numericId?: number
  name: string
  description: string | null
  condition: string
  status: string
  adminModerationState?: "DEACTIVATED" | "REMOVED" | null
  adminModeratedAt?: string | Date | null
  adminModeratedById?: string | null
  rateOption: string
  createdAt: string | Date
  rentalFee: number
  replacementCost: number | null
  freeToBorrow: boolean
  availability: ItemAvailabilityRange[]
  whatItemOffers: string | null
  whatIsIncluded: string | null
  knownIssues: string | null
  usageLimitations: string | null
  images: ListedItemImage[]
  thumbnailImage: string | null
  photos: string[]
  isTrending: boolean
  viewCount: number
  bookingCount: number
  likeCount: number
  boostScore: number
  rating: number
  lenderId: string
  ownerName: string
  lenderUsername?: string | null
  lenderFullName?: string | null
  lenderRating?: number
  lenderBookingCount?: number
  lenderAvatarUrl?: string | null
  categories: string[]
  tags: string[]
  hasActiveBoost?: boolean
  isLiked?: boolean
}

export interface PaginatedItemsResponse {
  items: ListedItem[]
  nextCursor: ItemPaginationCursor | null
}

export interface ItemCardViewModel {
  id: string
  type: "Rent" | "Borrow"
  status: string
  isTrending: boolean
  image: string | null
  category: string
  name: string
  rating: number | string
  reviews: number | string
  price?: string | number
  priceUnit?: "hour" | "day"
  owner: string
  ownerUsername?: string
  isLiked?: boolean
}

export interface FilterMetadata {
  categories: Record<string, number>
  prices: Record<string, number>
  conditions: Record<string, number>
  freeToborrowCount: number
}
