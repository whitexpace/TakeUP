export interface RequestFeedRequester {
  id: string
  username: string
}

export interface RequestFeedPost {
  id: string
  itemNeeded: string
  description: string
  requestedFrom: string | Date
  requestedTo: string | Date
  minTargetPrice: number
  maxTargetPrice: number
  createdAt: string | Date
  requester: RequestFeedRequester
}

export interface RequestFeedResponse {
  posts: RequestFeedPost[]
}
