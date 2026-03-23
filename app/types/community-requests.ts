export const communityOfferConditions = ["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"] as const
export const communityRequestStatuses = ["OPEN", "FULFILLED", "CANCELLED"] as const
export const communityOfferStatuses = ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED"] as const

export type CommunityOfferCondition = (typeof communityOfferConditions)[number]
export type CommunityRequestStatus = (typeof communityRequestStatuses)[number]
export type CommunityOfferStatus = (typeof communityOfferStatuses)[number]

export interface CommunityMember {
  profileId: number
  userId: string
  name: string
  avatar: string
}

export interface CommunityOfferableItem {
  id: string
  numericId: number
  name: string
  condition: CommunityOfferCondition
  rentalFee: number
  freeToBorrow: boolean
  status: string
  rateOption: string
  createdAt: Date
}

export interface CommunityOffer {
  id: number
  lenderID: number
  requestID: number
  itemID: number
  itemName: string
  rentalFee: number
  availability: boolean
  condition: CommunityOfferCondition
  rentalTerms: string
  status: CommunityOfferStatus
  borrowerReadAt: Date | null
  createdAt: Date
  updatedAt: Date
  lender: CommunityMember
}

export interface CommunityOfferFormInput {
  itemID: number
  rentalFee: number
  availability: boolean
  condition: CommunityOfferCondition
  rentalTerms: string
}

export interface CommunityRequest {
  id: number
  borrowerID: number
  itemNeeded: string
  requestedDates: Date[]
  priceRange: [number, number]
  description: string
  status: CommunityRequestStatus
  createdAt: Date
  updatedAt: Date
  offersCount: number
  borrower: CommunityMember
  offers: CommunityOffer[]
}

export interface CommunityRequestComposerInput {
  itemNeeded: string
  description: string
  startDate: string
  endDate: string
  minimumPrice: number
  maximumPrice: number
}

export interface Reply {
  id: string
  user: Pick<CommunityMember, "name" | "avatar">
  text: string
  upvotes: number
  replies?: Reply[]
}

export interface UserActivity {
  postsMade: number
  offersSent: number
  offersReceived: number
}

export interface TrendingRequest {
  id: number
  title: string
  offersCount: number
}

export interface CommunityOfferNotification {
  id: number
  requestId: number
  requestTitle: string
  recipientId: number
  actorName: string
  itemName: string
  fee: number
  createdAt: Date
  read: boolean
}

export interface CommunityOfferNotification {
  id: string
  requestId: string
  requestTitle: string
  recipientId: string
  actorName: string
  itemName: string
  fee: number
  createdAt: number
  read: boolean
}
