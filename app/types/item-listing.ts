export interface ItemAvailabilityRange {
  id: string
  startDate: string | Date
  endDate: string | Date
  status: string
}

export interface ItemPaginationCursor {
  id: string
  bookingCount: number
  createdAt: string | Date
}

export interface ListedItemImage {
  path: string
  isPrimary: boolean
  sortOrder: number
}

export interface ListedItem {
  id: string
  name: string
  description: string | null
  condition: string
  status: string
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
  rating: number
  lenderId: string
  ownerName: string
  borrowerId: string | null
  categories: string[]
  tags: string[]
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
  isLiked?: boolean
}

export interface FilterMetadata {
  categories: Record<string, number>
  prices: Record<string, number>
  conditions: Record<string, number>
  freeToborrowCount: number
}
