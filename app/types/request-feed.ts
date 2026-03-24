export interface RequestFeedRequester {
  id: string | null
  username: string | null
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

export interface RequestCreateInput {
  itemNeeded: string
  description: string
  requestedFrom: string
  requestedTo: string
  minTargetPrice: number
  maxTargetPrice: number
}

export interface RequestFormFields {
  itemNeeded: string
  description: string
  requestedFrom: string
  requestedTo: string
  minTargetPrice: string
  maxTargetPrice: string
}
