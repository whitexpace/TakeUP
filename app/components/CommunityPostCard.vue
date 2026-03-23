<template>
  <div
    ref="cardRef"
    class="relative flex flex-col gap-4 rounded-[24px] border border-cinnamon-ice/30 bg-cream p-6 shadow-sm transition-shadow duration-300 hover:shadow-md"
  >
    <!-- Post Header -->
    <div class="flex items-start justify-between">
      <div class="flex items-center gap-3 flex-1">
        <UserAvatar :avatar-url="request.user.avatar" :user-name="request.user.name" />
        <div class="flex flex-col flex-1">
          <div class="flex items-center justify-between w-full">
            <div class="flex items-center gap-2">
              <span class="text-[15px] font-bold text-noble-black">{{ request.user.name }}</span>
              <span class="text-[12px] text-noble-black/40">{{ request.timeAgo }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="ml-4 flex items-start gap-3">
        <span
          class="rounded-full border border-blue-estate/10 bg-blue-estate/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-blue-estate"
        >
          {{ request.flair }}
        </span>

        <div class="relative">
          <button
            class="rounded-full p-1 text-noble-black/20 transition-colors hover:bg-white hover:text-noble-black/45"
            aria-label="Post actions"
            aria-haspopup="menu"
            :aria-expanded="showMenu"
            @click.stop="toggleMenu"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>

          <transition name="menu">
            <div
              v-if="showMenu"
              class="absolute right-0 top-10 z-20 w-[220px] rounded-[18px] border border-cinnamon-ice/20 bg-white p-2 shadow-xl"
              role="menu"
            >
              <button
                v-if="!isOwner"
                class="flex w-full items-center justify-between rounded-[14px] px-4 py-3 text-left text-[14px] font-semibold text-noble-black transition-colors hover:bg-cream"
                role="menuitem"
                @click="handleOfferAction"
              >
                <span>{{ hasCurrentUserOffer ? "Update Offer" : "Offer Item" }}</span>
                <span class="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-estate/60">
                  {{ hasCurrentUserOffer ? "Edit" : "New" }}
                </span>
              </button>

              <button
                v-else-if="request.offers.length > 0"
                class="flex w-full items-center justify-between rounded-[14px] px-4 py-3 text-left text-[14px] font-semibold text-noble-black transition-colors hover:bg-cream"
                role="menuitem"
                @click="toggleOffersFromMenu"
              >
                <span>{{ showOffers ? "Hide Offers" : "View Offers" }}</span>
                <span class="text-[12px] text-noble-black/40">{{ request.offers.length }}</span>
              </button>

              <p v-else class="px-4 py-3 text-[13px] leading-relaxed text-noble-black/45">
                {{
                  isOwner
                    ? "Offers will appear here once lenders respond."
                    : "Send an offer directly to the requester."
                }}
              </p>
            </div>
          </transition>
        </div>
      </div>
    </div>

    <!-- Post Content -->
    <div class="flex flex-col gap-2">
      <h3 class="text-[18px] font-bold text-noble-black leading-tight">{{ request.title }}</h3>
      <p class="text-[15px] text-noble-black/70 leading-relaxed">{{ request.description }}</p>

      <div v-if="request.offers.length > 0" class="mt-1 flex flex-wrap items-center gap-2">
        <span
          class="inline-flex items-center rounded-full border border-burning-orange/15 bg-burning-orange/5 px-3 py-1 text-[12px] font-bold text-burning-orange"
        >
          {{ offerStatusLabel }}
        </span>

        <button
          v-if="isOwner"
          class="text-[12px] font-bold text-blue-estate transition-colors hover:text-burning-orange"
          @click="toggleOffers"
        >
          {{ showOffers ? "Hide offer details" : "View offer details" }}
        </button>

        <span
          v-else-if="hasCurrentUserOffer"
          class="inline-flex items-center rounded-full border border-blue-estate/10 bg-blue-estate/5 px-3 py-1 text-[12px] font-semibold text-blue-estate"
        >
          Your offer is live
        </span>
      </div>
    </div>

    <div
      v-if="isOwner && request.offers.length > 0 && showOffers"
      class="rounded-[22px] border border-cinnamon-ice/25 bg-white/80 p-4"
    >
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-[12px] font-bold uppercase tracking-[0.14em] text-noble-black/35">
            Received Offers
          </p>
          <p class="mt-1 text-[14px] text-noble-black/55">
            Review lender terms directly from your request card.
          </p>
        </div>
        <span class="rounded-full bg-blue-estate px-3 py-1 text-[12px] font-bold text-white">
          {{ request.offers.length }}
        </span>
      </div>

      <div class="mt-4 flex flex-col gap-3">
        <div
          v-for="offer in sortedOffers"
          :key="offer.id"
          class="rounded-[18px] border border-cinnamon-ice/20 bg-cream px-4 py-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-start gap-3">
              <UserAvatar
                :avatar-url="offer.lender.avatar"
                :user-name="offer.lender.name"
                size="sm"
              />
              <div class="flex flex-col gap-1">
                <span class="text-[15px] font-bold text-noble-black">{{ offer.lender.name }}</span>
                <span class="text-[13px] text-noble-black/60">{{ offer.itemName }}</span>
              </div>
            </div>
            <span
              class="rounded-full border border-blue-estate/10 bg-white px-3 py-1 text-[12px] font-bold text-blue-estate"
            >
              {{ formatFee(offer.fee) }}
            </span>
          </div>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span
              class="rounded-full border border-cinnamon-ice/25 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-noble-black/60"
            >
              {{ offer.condition }}
            </span>
            <span
              class="rounded-full border border-burning-orange/15 bg-burning-orange/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-burning-orange"
            >
              {{ offer.availabilityConfirmed ? "Available now" : "Availability pending" }}
            </span>
          </div>

          <p class="mt-3 text-[14px] leading-relaxed text-noble-black/70">
            {{ offer.rentalTerms }}
          </p>

          <p class="mt-3 text-[12px] text-noble-black/35">
            Submitted {{ formatRelativeTime(offer.createdAt) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Post Actions -->
    <div class="flex items-center gap-6 mt-2 pt-4 border-t border-cinnamon-ice/10">
      <button
        class="flex items-center gap-2 group transition-all duration-300"
        :class="
          isUpvoted
            ? 'text-burning-orange scale-105'
            : 'text-noble-black/40 hover:text-burning-orange'
        "
        @click="toggleUpvote"
      >
        <div class="p-2 rounded-full group-hover:bg-burning-orange/5 transition-colors">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            :class="{ 'fill-burning-orange/10': isUpvoted }"
          >
            <path d="M7 11l5-5 5 5M12 18V6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <span class="text-[13px] font-bold tracking-tight">{{
          request.upvotes + (isUpvoted ? 1 : 0)
        }}</span>
      </button>

      <button
        class="flex items-center gap-2 group transition-all duration-300"
        :class="
          showReplies ? 'text-blue-estate scale-105' : 'text-noble-black/40 hover:text-blue-estate'
        "
        @click="toggleReplies"
      >
        <div class="p-2 rounded-full group-hover:bg-blue-estate/5 transition-colors">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
            />
          </svg>
        </div>
        <span class="text-[13px] font-bold tracking-tight">{{ request.repliesCount }} Replies</span>
      </button>
    </div>

    <!-- Replies Section -->
    <div v-if="showReplies" class="flex flex-col gap-4 mt-2">
      <div class="flex flex-col gap-4 pl-4 border-l border-cinnamon-ice/15">
        <CommunityReplyItem
          v-for="reply in visibleReplies"
          :key="reply.id"
          :reply="reply"
          @reply="(name, id) => focusReplyInput(name, id)"
          @upvote-reply="(id) => $emit('upvote-reply', { postId: request.id, replyId: id })"
        />

        <button
          v-if="hasMoreReplies"
          class="text-[12px] font-bold text-burning-orange hover:text-blue-estate transition-all w-fit ml-11 mt-1 px-3 py-1.5 rounded-lg hover:bg-burning-orange/5"
          @click="loadMoreReplies"
        >
          View more replies ({{ request.replies.length - visibleReplies.length }})
        </button>
      </div>

      <!-- Reply Input Area -->
      <div class="flex gap-3 mt-4 pl-4 items-start">
        <UserAvatar :avatar-url="currentUserAvatar" :user-name="currentUserName" size="sm" />
        <div class="flex-1 flex flex-col gap-2">
          <transition name="fade">
            <div
              v-if="replyingTo"
              class="bg-blue-estate border-blue-estate/20 flex w-fit items-center gap-2 rounded-lg border px-3 py-1.5 text-white shadow-sm"
            >
              <span class="text-[10px] font-bold uppercase tracking-wider"
                >Replying to {{ replyingTo }}</span
              >
              <button class="text-white/70 transition-colors hover:text-white" @click="cancelReply">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </transition>

          <div
            class="flex items-center gap-3 bg-white rounded-full border border-cinnamon-ice/20 px-4 py-2 focus-within:border-cinnamon-ice/40 transition-all duration-300"
          >
            <input
              ref="replyInputRef"
              v-model="newReplyText"
              placeholder="Write a reply"
              class="flex-1 bg-transparent border-none focus:ring-0 text-[14px] text-noble-black placeholder:text-noble-black/30 outline-none"
              @keydown.enter="handleReply"
            />
            <button
              class="text-[13px] font-bold text-burning-orange hover:text-blue-estate transition-colors disabled:opacity-20 disabled:grayscale transition-all duration-300"
              :disabled="!newReplyText.trim()"
              @click="handleReply"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import type { CommunityRequest } from "~/types/community-requests"

const props = defineProps<{
  request: CommunityRequest
  currentUserId: string
  currentUserAvatar?: string | null
  currentUserName: string
}>()

const emit = defineEmits(["upvote-post", "upvote-reply", "add-reply", "offer-item"])

const showReplies = ref(false)
const showOffers = ref(false)
const showMenu = ref(false)
const isUpvoted = ref(false)
const newReplyText = ref("")
const visibleCount = ref(5)
const cardRef = ref<HTMLElement | null>(null)
const replyInputRef = ref<HTMLInputElement | null>(null)
const replyingTo = ref("")
const replyingToId = ref<string | null>(null)

const isOwner = computed(() => {
  return props.request.user.id === props.currentUserId
})

const hasCurrentUserOffer = computed(() => {
  return props.request.offers.some((offer) => offer.lender.id === props.currentUserId)
})

const offerStatusLabel = computed(() => {
  const count = props.request.offers.length
  return `${count} ${count === 1 ? "offer received" : "offers received"}`
})

const sortedOffers = computed(() => {
  return [...props.request.offers].sort((left, right) => right.createdAt - left.createdAt)
})

const visibleReplies = computed(() => {
  return [...props.request.replies].slice(0, visibleCount.value)
})

const hasMoreReplies = computed(() => {
  return props.request.replies.length > visibleCount.value
})

const toggleReplies = () => {
  showReplies.value = !showReplies.value
}

const toggleOffers = () => {
  showOffers.value = !showOffers.value
}

const toggleOffersFromMenu = () => {
  showMenu.value = false
  toggleOffers()
}

const toggleUpvote = () => {
  isUpvoted.value = !isUpvoted.value
  emit("upvote-post", props.request.id)
}

const toggleMenu = () => {
  showMenu.value = !showMenu.value
}

const handleOfferAction = () => {
  showMenu.value = false
  emit("offer-item", props.request.id)
}

const loadMoreReplies = () => {
  visibleCount.value += 5
}

const focusReplyInput = (userName?: string, replyId?: string) => {
  showReplies.value = true
  if (userName) {
    replyingTo.value = userName
    replyingToId.value = replyId || null
  }
  setTimeout(() => {
    replyInputRef.value?.focus()
  }, 0)
}

const cancelReply = () => {
  replyingTo.value = ""
  replyingToId.value = null
}

const handleReply = () => {
  if (!newReplyText.value.trim()) return

  emit("add-reply", {
    postId: props.request.id,
    parentReplyId: replyingToId.value,
    text: newReplyText.value,
    userName: props.currentUserName,
    userAvatar: props.currentUserAvatar,
  })

  newReplyText.value = ""
  cancelReply()
}

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
})

const formatFee = (fee: number) => {
  return fee === 0 ? "Free" : currencyFormatter.format(fee)
}

const formatRelativeTime = (timestamp: number) => {
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / (60 * 1000)))

  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.round(hours / 24)
  return `${days}d ago`
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
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

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
