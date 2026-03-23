<template>
  <div
    ref="cardRef"
    class="relative flex flex-col gap-5 rounded-[24px] border border-cinnamon-ice/30 bg-cream p-6 shadow-sm transition-shadow duration-300 hover:shadow-md"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex items-center gap-3 min-w-0">
        <UserAvatar :avatar-url="request.borrower.avatar" :user-name="request.borrower.name" />
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span class="text-[15px] font-bold text-noble-black">{{ request.borrower.name }}</span>
            <span class="text-[12px] text-noble-black/40">{{
              formatRelativeTime(request.createdAt)
            }}</span>
          </div>
          <p class="text-[13px] text-noble-black/45">
            Request status: {{ formatRequestStatus(request.status) }}
          </p>
        </div>
      </div>

      <div class="ml-4 flex items-start gap-3">
        <span
          class="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
          :class="requestStatusClass"
        >
          {{ formatRequestStatus(request.status) }}
        </span>

        <div class="relative">
          <button
            class="rounded-full p-1 text-noble-black/20 transition-colors hover:bg-white hover:text-noble-black/45"
            aria-label="Request actions"
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
              class="absolute right-0 top-10 z-20 w-[230px] rounded-[18px] border border-cinnamon-ice/20 bg-white p-2 shadow-xl"
              role="menu"
            >
              <button
                v-if="!isOwner && request.status === 'OPEN'"
                class="flex w-full items-center justify-between rounded-[14px] px-4 py-3 text-left text-[14px] font-semibold text-noble-black transition-colors hover:bg-cream"
                role="menuitem"
                @click="handleOfferAction"
              >
                <span>{{ currentUserOffer ? "Update Offer" : "Offer Item" }}</span>
                <span class="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-estate/60">
                  {{ currentUserOffer ? "Edit" : "New" }}
                </span>
              </button>

              <button
                v-if="isOwner && request.offers.length > 0"
                class="flex w-full items-center justify-between rounded-[14px] px-4 py-3 text-left text-[14px] font-semibold text-noble-black transition-colors hover:bg-cream"
                role="menuitem"
                @click="toggleOffersFromMenu"
              >
                <span>{{ showOffers ? "Hide Offers" : "View Offers" }}</span>
                <span class="text-[12px] text-noble-black/40">{{ request.offers.length }}</span>
              </button>

              <button
                v-if="isOwner && request.status === 'OPEN'"
                class="flex w-full items-center justify-between rounded-[14px] px-4 py-3 text-left text-[14px] font-semibold text-burning-orange transition-colors hover:bg-burning-orange/5"
                role="menuitem"
                @click="updateRequestStatus('CANCELLED')"
              >
                <span>Cancel Request</span>
              </button>

              <button
                v-if="isOwner && request.status === 'CANCELLED'"
                class="flex w-full items-center justify-between rounded-[14px] px-4 py-3 text-left text-[14px] font-semibold text-blue-estate transition-colors hover:bg-cream"
                role="menuitem"
                @click="updateRequestStatus('OPEN')"
              >
                <span>Reopen Request</span>
              </button>

              <button
                v-if="isOwner"
                class="flex w-full items-center justify-between rounded-[14px] px-4 py-3 text-left text-[14px] font-semibold text-noble-black/65 transition-colors hover:bg-cream"
                role="menuitem"
                @click="deleteRequest"
              >
                <span>Delete Request</span>
              </button>

              <p
                v-if="!isOwner && request.status !== 'OPEN'"
                class="px-4 py-3 text-[13px] leading-relaxed text-noble-black/45"
              >
                This request is no longer accepting offers.
              </p>

              <p
                v-if="isOwner && request.offers.length === 0"
                class="px-4 py-3 text-[13px] leading-relaxed text-noble-black/45"
              >
                Offers will appear here once lenders respond.
              </p>

              <p
                v-else-if="!isOwner && request.status === 'OPEN'"
                class="px-4 py-3 text-[13px] leading-relaxed text-noble-black/45"
              >
                Send an offer directly to the requester.
              </p>
            </div>
          </transition>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <h3 class="text-[22px] font-bold text-noble-black leading-tight">{{ request.itemNeeded }}</h3>
      <p class="text-[15px] text-noble-black/70 leading-relaxed">{{ request.description }}</p>

      <div class="flex flex-wrap items-center gap-2">
        <span
          class="rounded-full border border-cinnamon-ice/25 bg-white px-3 py-1 text-[12px] font-semibold text-noble-black/65"
        >
          {{ formatDateRange(request.requestedDates) }}
        </span>
        <span
          class="rounded-full border border-cinnamon-ice/25 bg-white px-3 py-1 text-[12px] font-semibold text-noble-black/65"
        >
          Budget: {{ formatPriceRange(request.priceRange) }}
        </span>
        <span
          v-if="request.offersCount > 0"
          class="rounded-full border border-burning-orange/15 bg-burning-orange/5 px-3 py-1 text-[12px] font-bold text-burning-orange"
        >
          {{ request.offersCount }} {{ request.offersCount === 1 ? "offer" : "offers" }} received
        </span>
        <span
          v-if="currentUserOffer && !isOwner"
          class="rounded-full border border-blue-estate/10 bg-blue-estate/5 px-3 py-1 text-[12px] font-semibold text-blue-estate"
        >
          Your offer: {{ formatOfferStatus(currentUserOffer.status) }}
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
            Review lender terms and accept or decline offers here.
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
              {{ formatFee(offer.rentalFee) }}
            </span>
          </div>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span
              class="rounded-full border border-cinnamon-ice/25 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-noble-black/60"
            >
              {{ formatCondition(offer.condition) }}
            </span>
            <span
              class="rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em]"
              :class="offerStatusClass(offer.status)"
            >
              {{ formatOfferStatus(offer.status) }}
            </span>
            <span
              class="rounded-full border border-burning-orange/15 bg-burning-orange/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-burning-orange"
            >
              {{ offer.availability ? "Available now" : "Availability not confirmed" }}
            </span>
          </div>

          <p class="mt-3 text-[14px] leading-relaxed text-noble-black/70">
            {{ offer.rentalTerms }}
          </p>

          <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-[12px] text-noble-black/35">
              Submitted {{ formatRelativeTime(offer.createdAt) }}
            </p>

            <div
              v-if="request.status === 'OPEN' && offer.status === 'PENDING'"
              class="flex flex-col gap-2 sm:flex-row"
            >
              <button
                class="rounded-full border border-cinnamon-ice/30 px-4 py-2 text-[12px] font-bold text-noble-black/65 transition-all hover:bg-white"
                @click="updateOfferStatus(offer.id, 'DECLINED')"
              >
                Decline
              </button>
              <button
                class="rounded-full bg-blue-estate px-4 py-2 text-[12px] font-bold text-white transition-all hover:bg-burning-orange"
                @click="updateOfferStatus(offer.id, 'ACCEPTED')"
              >
                Accept Offer
              </button>
            </div>
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
    return "border-blue-estate/10 bg-blue-estate/5 text-blue-estate"
  }

  if (props.request.status === "CANCELLED") {
    return "border-cinnamon-ice/25 bg-white text-noble-black/55"
  }

  return "border-burning-orange/15 bg-burning-orange/5 text-burning-orange"
})

const toggleMenu = () => {
  showMenu.value = !showMenu.value
}

const toggleOffers = () => {
  showOffers.value = !showOffers.value
}

const toggleOffersFromMenu = () => {
  showMenu.value = false
  toggleOffers()
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
  year: "numeric",
})

const formatFee = (fee: number) => {
  return fee === 0 ? "Free" : currencyFormatter.format(fee)
}

const formatCondition = (value: string) => {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

const formatRequestStatus = (value: CommunityRequestStatus) => {
  return value.charAt(0) + value.slice(1).toLowerCase()
}

const formatOfferStatus = (value: CommunityOfferStatus) => {
  return value.charAt(0) + value.slice(1).toLowerCase()
}

const offerStatusClass = (status: CommunityOfferStatus) => {
  if (status === "ACCEPTED") return "border-blue-estate/10 bg-blue-estate/5 text-blue-estate"
  if (status === "DECLINED" || status === "CANCELLED") {
    return "border-cinnamon-ice/25 bg-white text-noble-black/55"
  }
  return "border-burning-orange/15 bg-burning-orange/5 text-burning-orange"
}

const formatRelativeTime = (timestamp: Date) => {
  const minutes = Math.max(1, Math.round((Date.now() - timestamp.getTime()) / (60 * 1000)))

  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.round(hours / 24)
  return `${days}d ago`
}

const formatDateRange = (dates: Date[]) => {
  const sorted = [...dates].sort((left, right) => left.getTime() - right.getTime())
  const start = sorted[0]
  const end = sorted.at(-1)

  if (!start || !end) return "Dates not set"
  if (start.getTime() === end.getTime()) return `Needed on ${dateFormatter.format(start)}`

  return `${dateFormatter.format(start)} to ${dateFormatter.format(end)}`
}

const formatPriceRange = (range: [number, number]) => {
  const [minimum, maximum] = range

  if (minimum === maximum) {
    return formatFee(minimum)
  }

  return `${formatFee(minimum)} to ${formatFee(maximum)}`
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
