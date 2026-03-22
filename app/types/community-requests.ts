export interface CommunityRequest {
  id: string
  createdAt: number
  user: {
    name: string
    avatar: string
  }
  timeAgo: string
  flair: string
  title: string
  description: string
  upvotes: number
  repliesCount: number
  replies: Reply[]
}

export interface Reply {
  id: string
  user: {
    name: string
    avatar: string
  }
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
