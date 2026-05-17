<template>
  <div
    ref="cardRef"
    class="relative flex flex-col gap-4 rounded-[24px] border border-gray-100 bg-white p-6 transition-all duration-300 hover:shadow-lg group/card"
  >
    <!-- Card Header -->
    <div class="flex items-start justify-between">
      <div class="flex items-center gap-3 min-w-0">
        <NuxtLink :to="`/profile/${request.borrower.username}`" class="shrink-0">
          <UserAvatar
            :avatar-url="request.borrower.avatar"
            :user-name="request.borrower.name"
            class="h-9 w-9 rounded-full"
          />
        </NuxtLink>
        <div class="min-w-0 flex flex-col">
          <div class="flex items-center gap-2">
            <NuxtLink
              :to="`/profile/${request.borrower.username}`"
              class="text-[13px] font-medium text-gray-900 hover:text-burning-orange transition-colors truncate"
            >
              {{ request.borrower.name }}
            </NuxtLink>
            <span class="text-[12px] text-gray-400">{{
              formatRelativeTime(request.createdAt)
            }}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <!-- Status Badge -->
        <span
          v-if="request.status === 'OPEN'"
          class="bg-blue-estate/10 text-blue-estate rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
        >
          Open
        </span>
        <span
          v-else
          class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
          :class="requestStatusClass"
        >
          {{ formatRequestStatus(request.status) }}
        </span>

        <!-- Options Menu -->
        <div v-if="isOwner" class="relative">
          <button
            class="h-8 w-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all"
            @click.stop="toggleMenu"
          >
            <Icon name="ph:dots-three" class="w-[18px] h-[18px] shrink-0" />
          </button>

          <transition name="menu">
            <div
              v-if="showMenu"
              class="absolute right-0 top-10 z-20 w-48 rounded-xl border border-gray-100 bg-white p-1.5 shadow-xl"
            >
              <button
                v-if="request.status === 'OPEN'"
                class="w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-semibold text-burning-orange hover:bg-burning-orange/5 transition-colors"
                @click="updateRequestStatus('CANCELLED')"
              >
                Cancel Request
              </button>
              <button
                v-if="request.status === 'CANCELLED'"
                class="w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-semibold text-blue-estate hover:bg-blue-estate/5 transition-colors"
                @click="updateRequestStatus('OPEN')"
              >
                Reopen Request
              </button>
              <button
                class="w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                @click="deleteRequest"
              >
                Delete Request
              </button>
            </div>
          </transition>
        </div>
      </div>
    </div>

    <!-- Title and Body Content -->
    <div class="flex gap-4">
      <div class="flex-1 flex flex-col gap-2">
        <h3 class="text-[16px] font-medium text-gray-900 leading-tight">
          {{ request.itemNeeded }}
        </h3>
        <div class="relative">
          <p
            class="text-[14px] text-gray-500 leading-relaxed transition-all duration-300"
            :class="{ 'line-clamp-2': !isExpandedBody }"
          >
            {{ request.description }}
          </p>
          <button
            v-if="request.description.length > 120"
            class="text-[12px] font-bold text-burning-orange mt-1 hover:underline"
            @click="isExpandedBody = !isExpandedBody"
          >
            {{ isExpandedBody ? "Read less" : "Read more" }}
          </button>
        </div>
      </div>

      <!-- Compact Reference Image -->
      <div
        v-if="request.referenceImageUrl"
        class="shrink-0 w-[120px] h-[90px] rounded-[10px] overflow-hidden border border-gray-100 bg-gray-50"
      >
        <img
          :src="request.referenceImageUrl"
          loading="lazy"
          decoding="async"
          class="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
        />
      </div>
    </div>

    <!-- Metadata Row -->
    <div class="flex flex-wrap items-center justify-between gap-4 pt-2">
      <div class="flex flex-wrap items-center gap-2">
        <!-- Date Chip -->
        <div
          class="flex items-center gap-1.5 bg-gray-100 rounded-[8px] px-2.5 py-1 text-[12px] text-gray-500"
        >
          <Icon name="ph:calendar-blank" class="w-[14px] h-[14px] text-gray-400 shrink-0" />
          {{ formatDateRange(request.requestedDates) }}
        </div>

        <!-- Budget Chip -->
        <div
          class="flex items-center gap-1.5 bg-gray-100 rounded-[8px] px-2.5 py-1 text-[12px] text-gray-500"
        >
          <Icon name="ph:wallet" class="w-[14px] h-[14px] text-gray-400 shrink-0" />
          {{ formatPriceRange(request.priceRange) }}
        </div>

        <span
          v-if="currentUserOffer && !isOwner"
          class="bg-blue-estate/5 border border-blue-estate/10 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-blue-estate"
        >
          Your offer: {{ formatOfferStatus(currentUserOffer.status) }}
        </span>
      </div>

      <!-- Action Button Group -->
      <div class="flex items-center gap-4 ml-auto">
        <button
          class="flex items-center gap-1.5 text-[13px] font-bold text-noble-black/40 hover:text-blue-estate transition-colors group/comment-btn"
          @click="showComments = !showComments"
        >
          <Icon
            name="ph:chat-circle"
            class="w-[18px] h-[18px] group-hover/comment-btn:scale-110 transition-transform"
          />
          <span class="font-geist">{{ totalRepliesCount }}</span>
        </button>

        <span class="w-[1px] h-4 bg-gray-100"></span>

        <span class="flex items-center gap-1.5 text-[12px] text-gray-400">
          {{ request.offersCount }} {{ request.offersCount === 1 ? "offer" : "offers" }}
        </span>
        <button
          v-if="!isOwner && request.status === 'OPEN'"
          class="h-8 px-4 bg-burning-orange text-white rounded-[8px] text-[13px] font-bold transition-all hover:brightness-110 active:scale-95 shadow-sm"
          @click="handleOfferAction"
        >
          {{ currentUserOffer ? "Update Offer" : "Make Offer" }}
        </button>
        <button
          v-else-if="isOwner && request.offers.length > 0"
          class="h-8 px-4 border-[1.5px] border-blue-estate text-blue-estate rounded-[8px] text-[13px] font-semibold transition-all hover:bg-blue-estate/5 active:scale-95"
          @click="toggleOffers"
        >
          {{ showOffers ? "Hide Offers" : "View Offers" }}
        </button>
      </div>
    </div>

    <!-- Discussion Section (Reddit-style Luxury) -->
    <div
      v-if="showComments"
      class="mt-4 pt-6 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 duration-300"
    >
      <!-- Quick Reply Input -->
      <div class="flex gap-3 mb-8">
        <UserAvatar size="sm" class="shrink-0 mt-1" user-name="You" />
        <div class="flex-1 relative group/input">
          <input
            ref="replyInputRef"
            v-model="commentText"
            type="text"
            :placeholder="
              replyingTo ? `Replying to ${replyingTo.name}...` : 'Add to the discussion...'
            "
            class="w-full bg-cream/30 border border-cinnamon-ice/10 rounded-[14px] px-4 py-2.5 text-[14px] font-geist focus:outline-none focus:border-burning-orange/30 focus:bg-white transition-all duration-300"
            @keydown.esc="cancelReply"
            @keydown.enter="postComment"
          />
          <button
            class="absolute right-2 top-1.5 h-7 px-3 bg-noble-black text-white text-[11px] font-bold uppercase tracking-wider rounded-[8px] opacity-0 group-focus-within/input:opacity-100 transition-opacity"
            @click="postComment"
          >
            Post
          </button>
        </div>
      </div>

      <!-- Nested Replies List -->
      <div class="flex flex-col gap-6">
        <CommunityReplyItem
          v-for="reply in mockReplies"
          :key="reply.id"
          :reply="reply"
          @reply="handleReplyToUser"
        />
      </div>
    </div>

    <!-- Offers List Expansion -->
    <div
      v-if="isOwner && request.offers.length > 0 && showOffers"
      class="mt-4 pt-6 border-t border-gray-100 flex flex-col gap-4"
    >
      <div class="flex items-center justify-between">
        <h4 class="text-[12px] font-bold uppercase tracking-widest text-gray-400">
          Received Offers
        </h4>
      </div>

      <div class="flex flex-col gap-3">
        <div
          v-for="offer in visibleOffers"
          :key="offer.id"
          class="rounded-xl border border-gray-100 bg-gray-50/50 p-4"
        >
          <div class="flex items-start justify-between gap-4">
            <NuxtLink
              :to="`/profile/${offer.lender.username}`"
              class="flex items-center gap-3 group/lender"
            >
              <UserAvatar
                :avatar-url="offer.lender.avatar"
                :user-name="offer.lender.name"
                size="sm"
              />
              <div class="flex flex-col">
                <span
                  class="text-[13px] font-bold text-gray-900 group-hover:text-burning-orange transition-colors"
                >
                  {{ offer.lender.name }}
                </span>
                <span class="text-[12px] text-gray-500 italic">"{{ offer.itemName }}"</span>
              </div>
            </NuxtLink>
            <span
              class="text-[13px] font-bold text-blue-estate bg-white border border-blue-estate/10 rounded-lg px-2.5 py-1"
            >
              {{ formatFee(offer.rentalFee) }}
            </span>
          </div>

          <p
            class="mt-3 text-[13px] text-gray-600 leading-relaxed bg-white/50 p-3 rounded-lg border border-gray-100/50"
          >
            {{ offer.rentalTerms }}
          </p>

          <div class="mt-4 flex items-center justify-between">
            <span class="text-[11px] text-gray-400 italic"
              >Submitted {{ formatRelativeTime(offer.createdAt) }}</span
            >
            <div v-if="request.status === 'OPEN' && offer.status === 'PENDING'" class="flex gap-2">
              <button
                class="px-3 py-1.5 rounded-lg text-[12px] font-bold text-gray-500 hover:bg-gray-200 transition-colors"
                @click="updateOfferStatus(offer.id, 'DECLINED')"
              >
                Decline
              </button>
              <button
                class="px-3 py-1.5 bg-blue-estate text-white rounded-lg text-[12px] font-bold shadow-sm hover:brightness-110 active:scale-95 transition-all"
                @click="updateOfferStatus(offer.id, 'ACCEPTED')"
              >
                Accept Offer
              </button>
            </div>
            <span
              v-else
              class="text-[11px] font-bold uppercase tracking-wider"
              :class="offerStatusClass(offer.status)"
            >
              {{ formatOfferStatus(offer.status) }}
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="request.offersCount > OFFERS_PAGE_SIZE"
        class="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p class="text-[12px] font-medium text-gray-400">Showing {{ offerRangeLabel }}</p>
          <p v-if="offerLoadError" class="mt-1 text-[12px] font-medium text-cinnabar-red">
            {{ offerLoadError }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="h-8 w-8 rounded-lg border border-gray-100 text-gray-400 transition-colors hover:border-blue-estate hover:text-blue-estate disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-100 disabled:hover:text-gray-400"
            :disabled="!hasPreviousOfferPage"
            aria-label="Previous offers"
            @click="goToOfferPage(offerPage - 1)"
          >
            <Icon name="ph:caret-left" class="mx-auto h-4 w-4" />
          </button>
          <span class="text-[12px] font-semibold text-gray-400">
            {{ offerPage }} / {{ offerPageCount }}
          </span>
          <button
            type="button"
            class="h-8 w-8 rounded-lg border border-gray-100 text-gray-400 transition-colors hover:border-blue-estate hover:text-blue-estate disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-100 disabled:hover:text-gray-400"
            :disabled="!hasNextOfferPage"
            aria-label="Next offers"
            @click="goToOfferPage(offerPage + 1)"
          >
            <Icon
              :name="isLoadingOffers ? 'ph:spinner-gap' : 'ph:caret-right'"
              class="mx-auto h-4 w-4"
              :class="{ 'animate-spin': isLoadingOffers }"
            />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import type {
  CommunityOffer,
  CommunityOfferStatus,
  CommunityRequest,
  CommunityRequestStatus,
  Reply,
} from "~/types/community-requests"

const props = defineProps<{
  request: CommunityRequest
  currentUserId: string
}>()

const emit = defineEmits<{
  (event: "offer-item" | "delete-request", requestId: number): void
  (
    event: "update-request-status",
    payload: { requestId: number; status: CommunityRequestStatus },
  ): void
  (
    event: "update-offer-status",
    payload: {
      offerId: number
      requestId: number
      status: CommunityOfferStatus
    },
  ): void
}>()

const OFFERS_PAGE_SIZE = 5

const showOffers = ref(false)
const showComments = ref(false)
const showMenu = ref(false)
const isExpandedBody = ref(false)
const offerPage = ref(1)
const loadedOffers = ref<CommunityOffer[]>([])
const isLoadingOffers = ref(false)
const offerLoadError = ref("")
const cardRef = ref<HTMLElement | null>(null)
const replyInputRef = ref<HTMLInputElement | null>(null)

// Discussion State
const commentText = ref("")
const replyingTo = ref<{ name: string; id: string } | null>(null)

// Mock Data for Discussion Demonstration
const mockReplies = ref([
  {
    id: "r1",
    user: {
      name: "Sophia Laurent",
      username: "sophia_l",
      avatar: "",
    },
    text: "I actually have a vintage film camera that might fit what you're looking for! Is it for a professional shoot?",
    upvotes: 12,
    isUpvoted: false,
    createdAt: new Date(Date.now() - 3600000),
    replies: [
      {
        id: "r2",
        user: {
          name: "Marcus Chen",
          username: "mchen",
          avatar: "",
        },
        text: "Sophia, is it the Leica M6? I've been looking for one too!",
        upvotes: 5,
        isUpvoted: true,
        createdAt: new Date(Date.now() - 1800000),
        replies: [],
      },
    ],
  },
  {
    id: "r3",
    user: {
      name: "Isabella Reed",
      username: "isabella_r",
      avatar: "",
    },
    text: "Make sure to check the lens compatibility if you're borrowing an older body.",
    upvotes: 8,
    isUpvoted: false,
    createdAt: new Date(Date.now() - 7200000),
    replies: [],
  },
])

const totalRepliesCount = computed(() => {
  const countReplies = (list: Reply[]): number => {
    let total = 0
    for (const item of list) {
      total += 1
      if (item.replies && item.replies.length > 0) {
        total += countReplies(item.replies)
      }
    }
    return total
  }
  return countReplies(mockReplies.value)
})

const handleReplyToUser = (userName: string, replyId: string) => {
  replyingTo.value = { name: userName, id: replyId }
  commentText.value = `@${userName} `

  // Focus the input field
  nextTick(() => {
    replyInputRef.value?.focus()
  })
}

const cancelReply = () => {
  replyingTo.value = null
  commentText.value = ""
  replyInputRef.value?.blur()
}

const postComment = () => {
  if (!commentText.value.trim()) return

  const newReply = {
    id: `r-new-${Date.now()}`,
    user: {
      name: "You", // Mocking current user
      username: "current_user",
      avatar: "",
    },
    text: commentText.value,
    upvotes: 0,
    isUpvoted: false,
    createdAt: new Date(),
    replies: [],
  }

  if (replyingTo.value) {
    // Helper to find and add reply to a nested thread (Mock version)
    const findAndAddReply = (list: Reply[]) => {
      for (const item of list) {
        if (item.id === replyingTo.value?.id) {
          if (!item.replies) item.replies = []
          item.replies.push(newReply)
          return true
        }
        if (item.replies && findAndAddReply(item.replies)) return true
      }
      return false
    }
    findAndAddReply(mockReplies.value)
  } else {
    // Add as top-level comment
    mockReplies.value.unshift(newReply)
  }

  // Reset after "posting"
  commentText.value = ""
  replyingTo.value = null
  replyInputRef.value?.blur()
}

const isOwner = computed(() => {
  return props.request.borrower.userId === props.currentUserId
})

const currentUserOffer = computed(() => {
  return props.request.offers.find((offer) => offer.lender.userId === props.currentUserId) ?? null
})

const normalizeOffer = (offer: CommunityOffer): CommunityOffer => ({
  ...offer,
  borrowerReadAt: offer.borrowerReadAt ? new Date(offer.borrowerReadAt) : null,
  createdAt: new Date(offer.createdAt),
  updatedAt: new Date(offer.updatedAt),
})

watch(
  () => [props.request.id, props.request.offers] as const,
  () => {
    loadedOffers.value = props.request.offers.map(normalizeOffer)
    offerPage.value = 1
    offerLoadError.value = ""
  },
  { immediate: true },
)

const sortedOffers = computed(() => {
  return [...loadedOffers.value].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  )
})
const offerPageCount = computed(() =>
  Math.max(1, Math.ceil(props.request.offersCount / OFFERS_PAGE_SIZE)),
)
const offerPageStart = computed(() => (offerPage.value - 1) * OFFERS_PAGE_SIZE)
const offerPageEnd = computed(() =>
  Math.min(offerPageStart.value + OFFERS_PAGE_SIZE, props.request.offersCount),
)
const visibleOffers = computed(() =>
  sortedOffers.value.slice(offerPageStart.value, offerPageEnd.value),
)
const offerRangeLabel = computed(() =>
  props.request.offersCount === 0
    ? ""
    : `${offerPageStart.value + 1}-${offerPageEnd.value} of ${props.request.offersCount}`,
)
const hasPreviousOfferPage = computed(() => offerPage.value > 1)
const hasNextOfferPage = computed(() => offerPage.value < offerPageCount.value)
const canLoadMoreOffers = computed(() => loadedOffers.value.length < props.request.offersCount)

const setOfferPage = (page: number) => {
  offerPage.value = Math.min(Math.max(1, page), offerPageCount.value)
}

const loadNextOfferBatch = async () => {
  if (isLoadingOffers.value || !canLoadMoreOffers.value) return
  isLoadingOffers.value = true
  offerLoadError.value = ""
  try {
    const offers = await $fetch<CommunityOffer[]>("/api/request-offers", {
      query: {
        requestID: props.request.id,
        limit: OFFERS_PAGE_SIZE,
        skip: loadedOffers.value.length,
      },
    })
    const existingIds = new Set(loadedOffers.value.map((offer) => offer.id))
    loadedOffers.value = [
      ...loadedOffers.value,
      ...offers.map(normalizeOffer).filter((offer) => !existingIds.has(offer.id)),
    ]
  } catch {
    offerLoadError.value = "Unable to load more offers right now."
  } finally {
    isLoadingOffers.value = false
  }
}

const goToOfferPage = async (page: number) => {
  const nextPage = Math.min(Math.max(1, page), offerPageCount.value)
  const requiredOfferCount = Math.min(nextPage * OFFERS_PAGE_SIZE, props.request.offersCount)

  while (loadedOffers.value.length < requiredOfferCount && canLoadMoreOffers.value) {
    const beforeCount = loadedOffers.value.length
    await loadNextOfferBatch()
    if (loadedOffers.value.length === beforeCount || offerLoadError.value) break
  }

  if (loadedOffers.value.length >= (nextPage - 1) * OFFERS_PAGE_SIZE + 1) {
    offerPage.value = nextPage
  }
}

watch(
  () => props.request.offersCount,
  () => {
    setOfferPage(offerPage.value)
  },
)

const requestStatusClass = computed(() => {
  if (props.request.status === "FULFILLED") {
    return "text-blue-estate bg-blue-estate/5"
  }

  if (props.request.status === "CANCELLED") {
    return "text-gray-400 bg-gray-50"
  }

  return "text-burning-orange bg-burning-orange/5"
})

const toggleMenu = () => {
  showMenu.value = !showMenu.value
}

const toggleOffers = () => {
  showOffers.value = !showOffers.value
}

const handleOfferAction = () => {
  showMenu.value = false
  emit("offer-item", props.request.id)
}

const updateRequestStatus = (status: CommunityRequestStatus) => {
  showMenu.value = false
  emit("update-request-status", { requestId: props.request.id, status })
}

const deleteRequest = () => {
  showMenu.value = false
  emit("delete-request", props.request.id)
}

const updateOfferStatus = (offerId: number, status: CommunityOfferStatus) => {
  emit("update-offer-status", { offerId, requestId: props.request.id, status })
}

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
})

const formatFee = (fee: number) => {
  return fee === 0 ? "Free" : currencyFormatter.format(fee)
}

const formatRequestStatus = (value: CommunityRequestStatus) => {
  return value.charAt(0) + value.slice(1).toLowerCase()
}

const formatOfferStatus = (value: CommunityOfferStatus) => {
  return value.charAt(0) + value.slice(1).toLowerCase()
}

const offerStatusClass = (status: CommunityOfferStatus) => {
  if (status === "ACCEPTED") return "text-emerald-600"
  if (status === "DECLINED" || status === "CANCELLED") {
    return "text-gray-400"
  }
  return "text-burning-orange"
}

const timeFormatter = new Intl.DateTimeFormat("en-PH", {
  hour: "numeric",
  minute: "numeric",
  hour12: true,
})

const formatRelativeTime = (timestamp: Date) => {
  const minutes = Math.max(1, Math.round((Date.now() - timestamp.getTime()) / (60 * 1000)))

  if (minutes < 60) return `${minutes}m`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`

  const days = Math.round(hours / 24)
  return `${days}d`
}

const formatDateRange = (dates: Date[]) => {
  const sorted = [...dates].sort((left, right) => left.getTime() - right.getTime())
  const start = sorted[0]
  const end = sorted.at(-1)

  if (!start || !end) return "Dates not set"

  const startStr = `${dateFormatter.format(start)} ${timeFormatter.format(start)}`
  const endStr = `${dateFormatter.format(end)} ${timeFormatter.format(end)}`

  if (startStr === endStr) return startStr

  return `${startStr} – ${endStr}`
}

const formatPriceRange = (range: [number, number]) => {
  const [minimum, maximum] = range

  if (minimum === maximum) {
    return formatFee(minimum)
  }

  return `${formatFee(minimum)}–${formatFee(maximum)}`
}

const handlePointerDownOutside = (event: PointerEvent) => {
  if (!showMenu.value) return
  if (!(event.target instanceof Node)) return
  if (cardRef.value?.contains(event.target)) return
  showMenu.value = false
}

onMounted(() => {
  document.addEventListener("pointerdown", handlePointerDownOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handlePointerDownOutside)
})
</script>

<style scoped>
.menu-enter-active,
.menu-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
