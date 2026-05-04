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
              class="text-[13px] font-semibold text-gray-900 hover:text-burning-orange transition-colors truncate"
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
        <div class="relative">
          <button
            class="h-8 w-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all"
            @click.stop="toggleMenu"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </button>

          <transition name="menu">
            <div
              v-if="showMenu"
              class="absolute right-0 top-10 z-20 w-48 rounded-xl border border-gray-100 bg-white p-1.5 shadow-xl"
            >
              <button
                v-if="isOwner && request.status === 'OPEN'"
                class="w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-semibold text-burning-orange hover:bg-burning-orange/5 transition-colors"
                @click="updateRequestStatus('CANCELLED')"
              >
                Cancel Request
              </button>
              <button
                v-if="isOwner && request.status === 'CANCELLED'"
                class="w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-semibold text-blue-estate hover:bg-blue-estate/5 transition-colors"
                @click="updateRequestStatus('OPEN')"
              >
                Reopen Request
              </button>
              <button
                v-if="isOwner"
                class="w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                @click="deleteRequest"
              >
                Delete Request
              </button>
              <div v-if="!isOwner" class="px-3 py-2 text-[12px] text-gray-400 italic">
                No actions available
              </div>
            </div>
          </transition>
        </div>
      </div>
    </div>

    <!-- Title and Body Content -->
    <div class="flex gap-4">
      <div class="flex-1 flex flex-col gap-2">
        <h3 class="text-[16px] font-semibold text-gray-900 leading-tight">
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
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="text-gray-400"
          >
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
          </svg>
          {{ formatDateRange(request.requestedDates) }}
        </div>

        <!-- Budget Chip -->
        <div
          class="flex items-center gap-1.5 bg-gray-100 rounded-[8px] px-2.5 py-1 text-[12px] text-gray-500"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="text-gray-400"
          >
            <rect width="20" height="12" x="2" y="6" rx="2" />
            <circle cx="12" cy="12" r="2" />
            <path d="M6 12h.01M18 12h.01" />
          </svg>
          {{ formatPriceRange(request.priceRange) }}
        </div>

        <span
          v-if="currentUserOffer && !isOwner"
          class="bg-blue-estate/5 border border-blue-estate/10 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-blue-estate"
        >
          Your offer: {{ formatOfferStatus(currentUserOffer.status) }}
        </span>
      </div>

      <!-- Action Button -->
      <div class="flex items-center gap-4 ml-auto">
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
          v-for="offer in sortedOffers"
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import type {
  CommunityOfferStatus,
  CommunityRequest,
  CommunityRequestStatus,
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

const showOffers = ref(false)
const showMenu = ref(false)
const isExpandedBody = ref(false)
const cardRef = ref<HTMLElement | null>(null)

const isOwner = computed(() => {
  return props.request.borrower.userId === props.currentUserId
})

const currentUserOffer = computed(() => {
  return props.request.offers.find((offer) => offer.lender.userId === props.currentUserId) ?? null
})

const sortedOffers = computed(() => {
  return [...props.request.offers].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  )
})

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
