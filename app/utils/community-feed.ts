import type {
  CommunityMember,
  CommunityOffer,
  CommunityOfferNotification,
  CommunityOfferStatus,
  CommunityOfferableItem,
  CommunityRequest,
  CommunityRequestStatus,
  Reply,
  TrendingRequest,
  UserActivity,
} from "~/types/community-requests"

export const COMMUNITY_FEED_CACHE_TTL_MS = 30_000
export const COMMUNITY_FEED_PREVIEW_LIMIT = 5

export type ApiCommunityMember = {
  profileId: number
  userId: string
  username: string
  name: string
  avatar: string
}

export type ApiCommunityOffer = {
  id: number
  lenderID: number
  requestID: number
  itemID: number
  itemName: string
  rentalFee: number
  availability: boolean
  condition: string
  rentalTerms: string
  status: string
  borrowerReadAt: string | Date | null
  createdAt: string | Date
  updatedAt: string | Date
  lender: ApiCommunityMember
  itemThumbnailImage: string | null
}

export type ApiCommunityRequest = {
  id: number
  borrowerID: number
  itemNeeded: string
  referenceImageUrl: string | null
  requestedDates: Array<string | Date>
  priceRange: number[]
  description: string
  status: string
  createdAt: string | Date
  updatedAt: string | Date
  offersCount: number
  repliesCount: number
  borrower: ApiCommunityMember
  offers: ApiCommunityOffer[]
  replies?: ApiCommunityReply[]
}

export type ApiCommunityReply = {
  id: string
  requestId: number
  parentReplyId: string | null
  user: {
    userId?: string
    name: string
    avatar: string
    username: string
  }
  text: string
  upvotes: number
  isUpvoted: boolean
  createdAt: string | Date
  updatedAt?: string | Date
  replies?: ApiCommunityReply[]
}

export type ApiCommunityNotification = {
  id: number
  requestId: number
  requestTitle: string
  recipientId: number
  actorName: string
  itemName: string
  fee: number
  createdAt: string | Date
  read: boolean
}

export type ApiOfferableItem = {
  id: string
  numericId: number
  name: string
  thumbnailImage: string | null
  condition: string
  rentalFee: number
  freeToBorrow: boolean
  status: string
  rateOption: string
  createdAt: string | Date
}

export type ApiCommunityFeedPreviewResponse = {
  requests: ApiCommunityRequest[]
  notifications: ApiCommunityNotification[]
  offerableItems: ApiOfferableItem[]
  userActivity: UserActivity
  trendingItems: TrendingRequest[]
  currentDbUserId: string
  viewerKey: string
}

const toDate = (value: string | Date | null | undefined) => {
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}

export const normalizeCommunityMember = (member: ApiCommunityMember): CommunityMember => ({
  profileId: Number(member.profileId),
  userId: member.userId,
  username: member.username,
  name: member.name,
  avatar: member.avatar || "",
})

export const normalizeCommunityOffer = (offer: ApiCommunityOffer): CommunityOffer => ({
  id: Number(offer.id),
  lenderID: Number(offer.lenderID),
  requestID: Number(offer.requestID),
  itemID: Number(offer.itemID),
  itemName: offer.itemName,
  itemThumbnailImage: offer.itemThumbnailImage,
  rentalFee: Number(offer.rentalFee),
  availability: Boolean(offer.availability),
  condition: offer.condition as CommunityOffer["condition"],
  rentalTerms: offer.rentalTerms ?? "",
  status: offer.status as CommunityOfferStatus,
  borrowerReadAt: toDate(offer.borrowerReadAt),
  createdAt: toDate(offer.createdAt) ?? new Date(),
  updatedAt: toDate(offer.updatedAt) ?? new Date(),
  lender: normalizeCommunityMember(offer.lender),
})

export const normalizeCommunityReply = (reply: ApiCommunityReply): Reply => ({
  id: reply.id,
  requestId: Number(reply.requestId),
  parentReplyId: reply.parentReplyId,
  user: {
    name: reply.user.name,
    avatar: reply.user.avatar,
    username: reply.user.username,
  },
  text: reply.text,
  upvotes: Number(reply.upvotes ?? 0),
  isUpvoted: Boolean(reply.isUpvoted),
  createdAt: toDate(reply.createdAt) ?? new Date(),
  replies: (reply.replies ?? []).map(normalizeCommunityReply),
})

export const normalizeCommunityRequest = (request: ApiCommunityRequest): CommunityRequest => ({
  id: Number(request.id),
  borrowerID: Number(request.borrowerID),
  itemNeeded: request.itemNeeded,
  referenceImageUrl: request.referenceImageUrl,
  requestedDates: request.requestedDates
    .map((value) => toDate(value))
    .filter((value): value is Date => Boolean(value)),
  priceRange: [Number(request.priceRange[0] ?? 0), Number(request.priceRange[1] ?? 0)],
  description: request.description,
  status: request.status as CommunityRequestStatus,
  createdAt: toDate(request.createdAt) ?? new Date(),
  updatedAt: toDate(request.updatedAt) ?? new Date(),
  offersCount: Number(request.offersCount ?? 0),
  repliesCount: Number(request.repliesCount ?? 0),
  borrower: normalizeCommunityMember(request.borrower),
  offers: request.offers.map(normalizeCommunityOffer),
  replies: (request.replies ?? []).map(normalizeCommunityReply),
})

export const normalizeCommunityNotification = (
  notification: ApiCommunityNotification,
): CommunityOfferNotification => ({
  id: Number(notification.id),
  requestId: Number(notification.requestId),
  requestTitle: notification.requestTitle,
  recipientId: Number(notification.recipientId),
  actorName: notification.actorName,
  itemName: notification.itemName,
  fee: Number(notification.fee),
  createdAt: toDate(notification.createdAt) ?? new Date(),
  read: Boolean(notification.read),
})

export const normalizeOfferableItem = (item: ApiOfferableItem): CommunityOfferableItem => ({
  id: item.id,
  numericId: Number(item.numericId),
  name: item.name,
  thumbnailImage: item.thumbnailImage,
  condition: item.condition as CommunityOfferableItem["condition"],
  rentalFee: Number(item.rentalFee),
  freeToBorrow: Boolean(item.freeToBorrow),
  status: item.status,
  rateOption: item.rateOption,
  createdAt: toDate(item.createdAt) ?? new Date(),
})

export const buildCommunityFeedActivity = (
  requests: CommunityRequest[],
  currentDbUserId: string,
): UserActivity => {
  if (!currentDbUserId) {
    return { postsMade: 0, offersSent: 0, offersReceived: 0 }
  }

  const myRequests = requests.filter((request) => request.borrower.userId === currentDbUserId)
  const offersSent = requests.reduce((count, request) => {
    return count + request.offers.filter((offer) => offer.lender.userId === currentDbUserId).length
  }, 0)
  const offersReceived = myRequests.reduce((count, request) => count + request.offersCount, 0)

  return {
    postsMade: myRequests.length,
    offersSent,
    offersReceived,
  }
}

export const buildCommunityFeedTrendingItems = (
  requests: CommunityRequest[],
): TrendingRequest[] => {
  return [...requests]
    .sort((left, right) => {
      if (right.offersCount !== left.offersCount) return right.offersCount - left.offersCount
      return right.createdAt.getTime() - left.createdAt.getTime()
    })
    .slice(0, 5)
    .map((request) => ({
      id: request.id,
      title: request.itemNeeded,
      offersCount: request.offersCount,
    }))
}

export const getStaleCommunityFeedTimestamp = (now = Date.now()) =>
  now - COMMUNITY_FEED_CACHE_TTL_MS - 1
