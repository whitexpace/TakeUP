export const communityOfferConditions = ["New", "Like New", "Good", "Fair", "Well Used"] as const

export type CommunityOfferCondition = (typeof communityOfferConditions)[number]

export interface CommunityMember {
  id: string
  name: string
  avatar: string
}

export interface CommunityOffer {
  id: string
  itemName: string
  lender: CommunityMember
  rentalTerms: string
  fee: number
  condition: CommunityOfferCondition
  availabilityConfirmed: boolean
  createdAt: number
}

export interface CommunityOfferFormInput {
  itemName: string
  rentalTerms: string
  fee: number
  condition: CommunityOfferCondition
  availabilityConfirmed: boolean
}

export interface CommunityRequest {
  id: string
  createdAt: number
  user: CommunityMember
  timeAgo: string
  flair: string
  title: string
  description: string
  upvotes: number
  repliesCount: number
  replies: Reply[]
  offers: CommunityOffer[]
}

export interface Reply {
  id: string
  user: Pick<CommunityMember, "name" | "avatar">
  text: string
  upvotes: number
  replies?: Reply[] // For threading
}

export interface UserActivity {
  postsMade: number
  upvotesReceived: number
  replies: number
}

export interface TrendingRequest {
  id: string
  title: string
  upvotes: number
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
