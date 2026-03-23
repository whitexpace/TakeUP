<template>
  <div class="flex flex-col h-screen font-geist bg-white overflow-hidden">
    <!-- Fixed Header -->
    <Header
      :notifications="currentUserNotifications"
      @mark-notification-read="markNotificationRead"
      @mark-all-notifications-read="markAllNotificationsRead"
    />

    <!-- Main Scrollable Area -->
    <main ref="feedMainRef" class="flex-1 overflow-y-auto custom-main-scrollbar bg-white">
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
                :current-user-id="sessionCommunityUserId"
                :current-user-avatar="currentUserAvatar"
                :current-user-name="currentUserName"
                @upvote-post="handleUpvotePost"
                @upvote-reply="handleUpvoteReply"
                @add-reply="handleAddReply"
                @offer-item="openOfferComposer"
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

    <CommunityOfferModal
      :model-value="isOfferComposerOpen"
      :request-title="selectedRequestForOffer?.title ?? ''"
      :existing-offer="existingOfferForCurrentUser"
      @update:model-value="handleOfferComposerVisibility"
      @submit="submitOffer"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import type {
  CommunityMember,
  CommunityOffer,
  CommunityOfferFormInput,
  CommunityOfferNotification,
  CommunityRequest,
  UserActivity,
  TrendingRequest,
  Reply,
} from "~/types/community-requests"
import CommunityCreatePost from "~/components/CommunityCreatePost.vue"

definePageMeta({ layout: false })

const COMMUNITY_FEED_STORAGE_KEY = "takeup-community-feed-v1"

const createPostRef = ref<InstanceType<typeof CommunityCreatePost> | null>(null)
const feedMainRef = ref<HTMLElement | null>(null)

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
const currentUserId = computed(() => {
  const authUserRecord = asRecord(user.value)
  return (
    asNonEmptyString(authUserRecord?.id) ||
    asNonEmptyString(authUserRecord?.email) ||
    currentUserName.value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") ||
    "user"
  )
})
const sessionCommunityUserId = ref(currentUserId.value)

const filters = ["Trending", "Newest", "Top Voted", "Unanswered"]
const activeFilter = ref("Trending")

const userActivity = ref<UserActivity>({ postsMade: 13, upvotesReceived: 450, replies: 29 })

const trendingItems = ref<TrendingRequest[]>([
  { id: "1", title: "High-end DSLR Camera for weekend", upvotes: 156 },
  { id: "2", title: "Heavy duty pressure washer", upvotes: 142 },
  { id: "3", title: "Projector for outdoor movie night", upvotes: 98 },
  { id: "4", title: "Camping tent (4-person)", upvotes: 87 },
  { id: "5", title: "Nintendo Switch with Ring Fit", upvotes: 64 },
])

const now = Date.now()

const createMember = (id: string, name: string, avatar = ""): CommunityMember => ({
  id,
  name,
  avatar,
})

const toCommunityId = (value: string, fallback = "user") => {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

  return normalized || fallback
}

const normalizeMember = (
  member: Partial<CommunityMember> | null | undefined,
  fallbackName = "User",
): CommunityMember => {
  const name = asNonEmptyString(member?.name) || fallbackName
  return {
    id: asNonEmptyString(member?.id) || toCommunityId(name),
    name,
    avatar: asNonEmptyString(member?.avatar) || "",
  }
}

const normalizeReply = (reply: Reply): Reply => ({
  id: asNonEmptyString(reply.id) || Date.now().toString(),
  user: {
    name: asNonEmptyString(reply.user?.name) || "User",
    avatar: asNonEmptyString(reply.user?.avatar) || "",
  },
  text: asNonEmptyString(reply.text) || "",
  upvotes: typeof reply.upvotes === "number" ? reply.upvotes : 0,
  replies: Array.isArray(reply.replies) ? reply.replies.map(normalizeReply) : [],
})

const normalizeOffer = (offer: CommunityOffer): CommunityOffer => ({
  id: asNonEmptyString(offer.id) || `offer-${Date.now()}`,
  itemName: asNonEmptyString(offer.itemName) || "Untitled item",
  lender: normalizeMember(offer.lender, "Lender"),
  rentalTerms: asNonEmptyString(offer.rentalTerms) || "",
  fee: typeof offer.fee === "number" && Number.isFinite(offer.fee) ? offer.fee : 0,
  condition: offer.condition || "Good",
  availabilityConfirmed: Boolean(offer.availabilityConfirmed),
  createdAt:
    typeof offer.createdAt === "number" && Number.isFinite(offer.createdAt)
      ? offer.createdAt
      : Date.now(),
})

const normalizeRequest = (request: CommunityRequest): CommunityRequest => ({
  id: asNonEmptyString(request.id) || Date.now().toString(),
  createdAt:
    typeof request.createdAt === "number" && Number.isFinite(request.createdAt)
      ? request.createdAt
      : Date.now(),
  user: normalizeMember(request.user, "User"),
  timeAgo: asNonEmptyString(request.timeAgo) || "Just now",
  flair: asNonEmptyString(request.flair) || "General",
  title: asNonEmptyString(request.title) || "Untitled request",
  description: asNonEmptyString(request.description) || "",
  upvotes: typeof request.upvotes === "number" ? request.upvotes : 0,
  repliesCount: typeof request.repliesCount === "number" ? request.repliesCount : 0,
  replies: Array.isArray(request.replies) ? request.replies.map(normalizeReply) : [],
  offers: Array.isArray(request.offers) ? request.offers.map(normalizeOffer) : [],
})

const normalizeNotification = (
  notification: CommunityOfferNotification,
): CommunityOfferNotification => ({
  id: asNonEmptyString(notification.id) || `notif-${Date.now()}`,
  requestId: asNonEmptyString(notification.requestId) || "",
  requestTitle: asNonEmptyString(notification.requestTitle) || "Request",
  recipientId: asNonEmptyString(notification.recipientId) || "",
  actorName: asNonEmptyString(notification.actorName) || "User",
  itemName: asNonEmptyString(notification.itemName) || "Item",
  fee:
    typeof notification.fee === "number" && Number.isFinite(notification.fee)
      ? notification.fee
      : 0,
  createdAt:
    typeof notification.createdAt === "number" && Number.isFinite(notification.createdAt)
      ? notification.createdAt
      : Date.now(),
  read: Boolean(notification.read),
})

const createSeedRequests = (viewer: CommunityMember): CommunityRequest[] => [
  {
    id: "100",
    createdAt: now - 60 * 60 * 1000,
    user: viewer,
    timeAgo: "1h ago",
    flair: "Presentation Gear",
    title: "Need a projector setup for our thesis defense this Friday",
    description:
      "Looking for a projector with HDMI and enough brightness for a classroom presentation. We only need it for one afternoon and can meet on campus for pickup.",
    upvotes: 19,
    repliesCount: 2,
    replies: [
      {
        id: "r0-1",
        user: { name: "Lara Cruz", avatar: "" },
        text: "Try asking in the architecture org chat too. They usually have one.",
        upvotes: 6,
        replies: [],
      },
      {
        id: "r0-2",
        user: { name: "Paolo Lim", avatar: "" },
        text: "Do you need a screen as well or projector only?",
        upvotes: 2,
        replies: [],
      },
    ],
    offers: [
      {
        id: "offer-seed-1",
        itemName: "Epson EB-X06 Projector",
        lender: createMember("ava-mendoza", "Ava Mendoza"),
        rentalTerms:
          "Available Friday until 7 PM. Includes HDMI cable and carrying sleeve. Please return to Sunken Garden after the defense.",
        fee: 500,
        condition: "Like New",
        availabilityConfirmed: true,
        createdAt: now - 15 * 60 * 1000,
      },
    ],
  },
  {
    id: "101",
    createdAt: now - 2 * 60 * 60 * 1000,
    user: createMember("sarah-jenkins", "Sarah Jenkins"),
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
    offers: [],
  },
  {
    id: "102",
    createdAt: now - 5 * 60 * 60 * 1000,
    user: createMember("james-wilson", "James Wilson"),
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
    offers: [],
  },
]

const createSeedNotifications = (viewer: CommunityMember): CommunityOfferNotification[] => [
  {
    id: "notif-seed-1",
    requestId: "100",
    requestTitle: "Need a projector setup for our thesis defense this Friday",
    recipientId: viewer.id,
    actorName: "Ava Mendoza",
    itemName: "Epson EB-X06 Projector",
    fee: 500,
    createdAt: now - 15 * 60 * 1000,
    read: false,
  },
]

const viewer = computed<CommunityMember>(() => {
  return createMember(
    sessionCommunityUserId.value,
    currentUserName.value,
    currentUserAvatar.value || "",
  )
})

const requests = ref<CommunityRequest[]>(createSeedRequests(viewer.value))
const notifications = ref<CommunityOfferNotification[]>(createSeedNotifications(viewer.value))
const isOfferComposerOpen = ref(false)
const activeOfferRequestId = ref<string | null>(null)
const feedStorageHydrated = ref(false)

onMounted(() => {
  const savedFeed = localStorage.getItem(COMMUNITY_FEED_STORAGE_KEY)

  if (!savedFeed) {
    feedStorageHydrated.value = true
    return
  }

  try {
    const parsed = JSON.parse(savedFeed) as Partial<{
      requests: CommunityRequest[]
      notifications: CommunityOfferNotification[]
    }>

    if (Array.isArray(parsed.requests)) {
      requests.value = parsed.requests.map(normalizeRequest)
    }

    if (Array.isArray(parsed.notifications)) {
      notifications.value = parsed.notifications.map(normalizeNotification)
    }
  } catch (error) {
    console.error("Failed to parse community feed state", error)
  } finally {
    feedStorageHydrated.value = true
  }
})

watch(
  [requests, notifications],
  ([nextRequests, nextNotifications]) => {
    if (!feedStorageHydrated.value) return

    localStorage.setItem(
      COMMUNITY_FEED_STORAGE_KEY,
      JSON.stringify({
        requests: nextRequests,
        notifications: nextNotifications,
      }),
    )
  },
  { deep: true },
)

const currentUserNotifications = computed(() => {
  return [...notifications.value]
    .filter((notification) => notification.recipientId === sessionCommunityUserId.value)
    .sort((left, right) => right.createdAt - left.createdAt)
})

const selectedRequestForOffer = computed(() => {
  return requests.value.find((request) => request.id === activeOfferRequestId.value) ?? null
})

const existingOfferForCurrentUser = computed(() => {
  return (
    selectedRequestForOffer.value?.offers.find(
      (offer) => offer.lender.id === sessionCommunityUserId.value,
    ) ?? null
  )
})

const sortedRequests = computed(() => {
  const reqs = [...requests.value]
  if (activeFilter.value === "Newest") {
    return [...reqs].sort((left, right) => right.createdAt - left.createdAt)
  }
  if (activeFilter.value === "Top Voted") return [...reqs].sort((a, b) => b.upvotes - a.upvotes)
  if (activeFilter.value === "Unanswered") {
    return reqs.filter((request) => request.repliesCount === 0 && request.offers.length === 0)
  }
  return reqs
})

const handleNewPost = (post: { title: string; description: string; flair: string }) => {
  const createdAt = Date.now()
  const newRequest: CommunityRequest = {
    id: createdAt.toString(),
    createdAt,
    user: viewer.value,
    timeAgo: "Just now",
    flair: post.flair,
    title: post.title,
    description: post.description,
    upvotes: 0,
    repliesCount: 0,
    replies: [],
    offers: [],
  }
  requests.value.unshift(newRequest)
  userActivity.value.postsMade++
  activeFilter.value = "Newest"
  feedMainRef.value?.scrollTo({ top: 0, behavior: "smooth" })
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

const openOfferComposer = (requestId: string) => {
  const request = requests.value.find((entry) => entry.id === requestId)
  if (!request || request.user.id === sessionCommunityUserId.value) return

  activeOfferRequestId.value = requestId
  isOfferComposerOpen.value = true
}

const handleOfferComposerVisibility = (isVisible: boolean) => {
  isOfferComposerOpen.value = isVisible
  if (!isVisible) {
    activeOfferRequestId.value = null
  }
}

const submitOffer = (offerInput: CommunityOfferFormInput) => {
  const request = selectedRequestForOffer.value
  if (!request || request.user.id === sessionCommunityUserId.value) return

  const submittedAt = Date.now()
  const offer: CommunityOffer = {
    id: existingOfferForCurrentUser.value?.id ?? `offer-${submittedAt}`,
    itemName: offerInput.itemName,
    lender: viewer.value,
    rentalTerms: offerInput.rentalTerms,
    fee: offerInput.fee,
    condition: offerInput.condition,
    availabilityConfirmed: offerInput.availabilityConfirmed,
    createdAt: submittedAt,
  }

  const existingOfferIndex = request.offers.findIndex(
    (existingOffer) => existingOffer.lender.id === sessionCommunityUserId.value,
  )

  if (existingOfferIndex >= 0) {
    request.offers.splice(existingOfferIndex, 1, offer)
  } else {
    request.offers.unshift(offer)
  }

  notifications.value.unshift({
    id: `notif-${submittedAt}`,
    requestId: request.id,
    requestTitle: request.title,
    recipientId: request.user.id,
    actorName: viewer.value.name,
    itemName: offer.itemName,
    fee: offer.fee,
    createdAt: submittedAt,
    read: false,
  })

  handleOfferComposerVisibility(false)
}

const markNotificationRead = (notificationId: string) => {
  const notification = notifications.value.find((entry) => entry.id === notificationId)
  if (!notification) return
  notification.read = true
}

const markAllNotificationsRead = () => {
  notifications.value.forEach((notification) => {
    if (notification.recipientId === sessionCommunityUserId.value) {
      notification.read = true
    }
  })
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
