<template>
  <div class="flex flex-col h-screen font-geist bg-white overflow-hidden">
    <!-- Fixed Header -->
    <Header />

    <!-- Main Scrollable Area -->
    <main class="flex-1 overflow-y-auto custom-main-scrollbar bg-white">
      <div class="container mx-auto px-4 py-8 pt-10 max-w-[1440px]">
        <div class="flex flex-col lg:flex-row gap-10">
          <!-- Left Column: YOUR ACTIVITY -->
          <aside class="hidden lg:block lg:w-[240px] xl:w-[280px] shrink-0">
            <div class="sticky top-6">
              <CommunityActivitySidebar
                :posts-made="userActivity.postsMade"
                :upvotes-received="userActivity.upvotesReceived"
                :replies="userActivity.replies"
              />
            </div>
          </aside>

          <!-- Middle Column: Main Feed -->
          <div class="flex-1 min-w-0 flex flex-col gap-8">
            <div class="flex flex-col gap-1">
              <h1 class="font-rewon text-[42px] text-noble-black leading-tight">Community Feed</h1>
              <p class="font-geist font-normal text-[18px] text-noble-black/60">
                Post what you need — the UPC community will help
              </p>
            </div>

            <CommunityCreatePost
              ref="createPostRef"
              :user-avatar="currentUserAvatar"
              :user-name="currentUserName"
              @post="handleNewPost"
            />

            <div class="flex flex-wrap items-center gap-3">
              <button
                v-for="filter in filters"
                :key="filter"
                class="px-6 py-2 rounded-full text-[14px] font-bold transition-all duration-300 border ease-in-out"
                :class="
                  activeFilter === filter
                    ? 'bg-blue-estate text-white shadow-md transform scale-105 border-blue-estate'
                    : 'bg-cream text-noble-black/40 hover:bg-white hover:text-noble-black/70 border-transparent hover:border-cinnamon-ice/30 hover:shadow-sm'
                "
                @click="activeFilter = filter"
              >
                {{ filter }}
              </button>
            </div>

            <div v-if="sortedRequests.length > 0" class="flex flex-col gap-6">
              <CommunityPostCard
                v-for="request in sortedRequests"
                :key="request.id"
                :request="request"
                :current-user-avatar="currentUserAvatar"
                :current-user-name="currentUserName"
                @upvote-post="handleUpvotePost"
                @upvote-reply="handleUpvoteReply"
                @add-reply="handleAddReply"
              />
            </div>

            <!-- Empty State -->
            <div
              v-else
              class="flex flex-col items-center justify-center py-32 px-6 text-center bg-white rounded-[32px] border border-dashed border-cinnamon-ice/30"
            >
              <div
                class="w-20 h-20 bg-cream rounded-full flex items-center justify-center mb-8 text-burning-orange/30"
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.517 15.153 3 13.66 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
              <h3 class="text-[22px] font-bold text-noble-black mb-2">
                Silence is golden, but sharing is better
              </h3>
              <p class="text-[15px] text-noble-black/40 max-w-[320px] leading-relaxed mb-8">
                We couldn't find any requests here. Why not be the first to start a conversation?
              </p>
              <button
                class="px-8 py-2.5 bg-burning-orange text-white rounded-full font-bold text-[14px] hover:bg-blue-estate transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                @click="triggerCreatePost"
              >
                Create Post
              </button>
            </div>
          </div>

          <!-- Right Column: TRENDING NOW -->
          <aside class="hidden lg:block lg:w-[280px] xl:w-[320px] shrink-0">
            <div class="sticky top-6">
              <CommunityTrendingSidebar :trending-items="trendingItems" />
            </div>
          </aside>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import type {
  CommunityRequest,
  UserActivity,
  TrendingRequest,
  Reply,
} from "~/types/community-requests"
import CommunityCreatePost from "~/components/CommunityCreatePost.vue"

definePageMeta({ layout: false })

const createPostRef = ref<InstanceType<typeof CommunityCreatePost> | null>(null)

const triggerCreatePost = () => {
  createPostRef.value?.triggerHighlight()
}

// Auth State
const user = useSupabaseUser()
const asNonEmptyString = (value: unknown) => {
  if (typeof value !== "string") return undefined
  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : undefined
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== "object" || value === null) return null
  return value as Record<string, unknown>
}

const getIdentityMetadata = (authUser: unknown) => {
  const authUserRecord = asRecord(authUser)
  const identities = authUserRecord?.identities

  if (!Array.isArray(identities)) return []

  return identities
    .map((identity) => {
      const identityRecord = asRecord(identity)
      return asRecord(identityRecord?.identity_data) ?? asRecord(identityRecord?.provider_metadata)
    })
    .filter((identityData): identityData is Record<string, unknown> => Boolean(identityData))
}

const buildNameFromSource = (source: Record<string, unknown> | null) => {
  if (!source) return undefined

  const directName =
    asNonEmptyString(source.full_name) ||
    asNonEmptyString(source.name) ||
    asNonEmptyString(source.display_name)

  if (directName) return directName

  const firstName =
    asNonEmptyString(source.given_name) ||
    asNonEmptyString(source.first_name) ||
    asNonEmptyString(source.firstName)
  const lastName =
    asNonEmptyString(source.family_name) ||
    asNonEmptyString(source.last_name) ||
    asNonEmptyString(source.lastName)

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()
  return fullName || undefined
}

const getAvatarFromSource = (source: Record<string, unknown> | null) => {
  if (!source) return undefined

  return (
    asNonEmptyString(source.picture) ||
    asNonEmptyString(source.avatar_url) ||
    asNonEmptyString(source.photo_url) ||
    asNonEmptyString(source.profile_image) ||
    asNonEmptyString(source.image)
  )
}

const currentUserProfile = computed(() => {
  const authUser = user.value
  const authUserRecord = asRecord(authUser)
  const metadataSources = [
    asRecord(authUserRecord?.user_metadata),
    asRecord(authUserRecord?.app_metadata),
    ...getIdentityMetadata(authUser),
  ]

  const name =
    metadataSources.map(buildNameFromSource).find(Boolean) ||
    asNonEmptyString(authUserRecord?.email) ||
    "User"
  const avatar = metadataSources.map(getAvatarFromSource).find(Boolean)

  return { name, avatar }
})

const currentUserName = computed(() => {
  return currentUserProfile.value.name
})
const currentUserAvatar = computed(() => {
  return currentUserProfile.value.avatar
})

const filters = ["Trending", "Newest", "Top Voted", "Unanswered"]
const activeFilter = ref("Trending")

const userActivity = ref<UserActivity>({ postsMade: 12, upvotesReceived: 450, replies: 28 })

const trendingItems = ref<TrendingRequest[]>([
  { id: "1", title: "High-end DSLR Camera for weekend", upvotes: 156 },
  { id: "2", title: "Heavy duty pressure washer", upvotes: 142 },
  { id: "3", title: "Projector for outdoor movie night", upvotes: 98 },
  { id: "4", title: "Camping tent (4-person)", upvotes: 87 },
  { id: "5", title: "Nintendo Switch with Ring Fit", upvotes: 64 },
])

const now = Date.now()

const requests = ref<CommunityRequest[]>([
  {
    id: "101",
    createdAt: now - 2 * 60 * 60 * 1000,
    user: { name: "Sarah Jenkins", avatar: "" },
    timeAgo: "2h ago",
    flair: "Electronics",
    title: "Looking for a professional drone for a wedding shoot",
    description:
      "My drone crashed during practice and I have a wedding to shoot this weekend in Tagaytay. If anyone has a DJI Mavic 3 or similar that I can rent, please let me know!",
    upvotes: 42,
    repliesCount: 8,
    replies: [
      {
        id: "r1",
        user: { name: "Mike Ross", avatar: "" },
        text: "I have a Mavic Air 2S if that works for you?",
        upvotes: 12,
        replies: [],
      },
      {
        id: "r2",
        user: { name: "Elena Gilbert", avatar: "" },
        text: "Check with David, he usually rents out his pro gear.",
        upvotes: 3,
        replies: [],
      },
      {
        id: "r3",
        user: { name: "Harvey Specter", avatar: "" },
        text: "I can vouch for David, his equipment is top notch.",
        upvotes: 5,
        replies: [],
      },
      {
        id: "r4",
        user: { name: "Rachel Zane", avatar: "" },
        text: "Is the wedding on Saturday or Sunday?",
        upvotes: 1,
        replies: [],
      },
      {
        id: "r5",
        user: { name: "Louis Litt", avatar: "" },
        text: "You should definitely get insurance for the rental.",
        upvotes: 8,
        replies: [],
      },
      {
        id: "r6",
        user: { name: "Donna Paulsen", avatar: "" },
        text: "I know someone who might have a Mavic 3.",
        upvotes: 4,
        replies: [],
      },
      {
        id: "r7",
        user: { name: "Jessica Pearson", avatar: "" },
        text: "Good luck with the shoot!",
        upvotes: 2,
        replies: [],
      },
      {
        id: "r8",
        user: { name: "Robert Zane", avatar: "" },
        text: "I have some spare batteries if you need them.",
        upvotes: 0,
        replies: [],
      },
    ],
  },
  {
    id: "102",
    createdAt: now - 5 * 60 * 60 * 1000,
    user: { name: "James Wilson", avatar: "" },
    timeAgo: "5h ago",
    flair: "Tools",
    title: "Need a concrete drill for some DIY home repairs",
    description:
      "Just moved into a new place and need to mount some heavy shelves on a concrete wall. Does anyone have a hammer drill I could borrow for a few hours?",
    upvotes: 15,
    repliesCount: 1,
    replies: [
      {
        id: "r9",
        user: { name: "Kevin Hart", avatar: "" },
        text: "I have one you can use. I live near the central park area.",
        upvotes: 5,
        replies: [],
      },
    ],
  },
])

const sortedRequests = computed(() => {
  const reqs = [...requests.value]
  if (activeFilter.value === "Newest") {
    return [...reqs].sort((left, right) => right.createdAt - left.createdAt)
  }
  if (activeFilter.value === "Top Voted") return [...reqs].sort((a, b) => b.upvotes - a.upvotes)
  if (activeFilter.value === "Unanswered") return reqs.filter((r) => r.repliesCount === 0)
  return reqs
})

const handleNewPost = (post: { title: string; description: string; flair: string }) => {
  const newRequest: CommunityRequest = {
    id: Date.now().toString(),
    createdAt: Date.now(),
    user: { name: currentUserName.value, avatar: currentUserAvatar.value || "" },
    timeAgo: "Just now",
    flair: post.flair,
    title: post.title,
    description: post.description,
    upvotes: 0,
    repliesCount: 0,
    replies: [],
  }
  requests.value.unshift(newRequest)
  userActivity.value.postsMade++
}

const handleUpvotePost = (postId: string) => {
  const post = requests.value.find((r) => r.id === postId)
  if (post) {
    userActivity.value.upvotesReceived++
  }
}

const handleUpvoteReply = ({
  postId: _postId,
  replyId: _replyId,
}: {
  postId: string
  replyId: string
}) => {
  userActivity.value.upvotesReceived++
}

const findReplyRecursive = (replies: Reply[], targetId: string): Reply | null => {
  for (const reply of replies) {
    if (reply.id === targetId) return reply
    if (reply.replies && reply.replies.length > 0) {
      const found = findReplyRecursive(reply.replies, targetId)
      if (found) return found
    }
  }
  return null
}

const handleAddReply = (data: {
  postId: string
  parentReplyId?: string | null
  text: string
  userName: string
  userAvatar?: string | null
}) => {
  const post = requests.value.find((r) => r.id === data.postId)
  if (!post) return

  const newReply: Reply = {
    id: Date.now().toString(),
    user: { name: data.userName, avatar: data.userAvatar || "" },
    text: data.text,
    upvotes: 0,
    replies: [],
  }

  if (data.parentReplyId) {
    const parentReply = findReplyRecursive(post.replies, data.parentReplyId)
    if (parentReply) {
      if (!parentReply.replies) parentReply.replies = []
      parentReply.replies.push(newReply)
    } else {
      post.replies.push(newReply)
    }
  } else {
    post.replies.push(newReply)
  }

  post.repliesCount++
  userActivity.value.replies++
}
</script>

<style scoped>
.custom-main-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-main-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-main-scrollbar::-webkit-scrollbar-thumb {
  background: theme("colors.noble-black / 10%");
  border-radius: 20px;
}
.custom-main-scrollbar::-webkit-scrollbar-thumb:hover {
  background: theme("colors.noble-black / 20%");
}
.custom-main-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: theme("colors.noble-black / 10%") transparent;
}
.container {
  scrollbar-gutter: stable;
}
</style>
