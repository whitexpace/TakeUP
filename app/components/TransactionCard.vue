<script setup lang="ts">
import { computed } from "vue"
import type { AdminTransactionListItem } from "../composables/use-admin-transactions"
import type { TransactionListItem } from "../composables/use-transactions"
import { useBookingDetailPrefetch } from "../composables/use-booking-detail-prefetch"
import type { ReviewType } from "#shared/schemas/review"
import { isChatAvailableForTransactionStatus } from "#shared/chat-rules"

const props = defineProps<{
  transaction: TransactionListItem | AdminTransactionListItem
  activeRole?: "LENDER" | "BORROWER"
  variant?: "user" | "admin"
}>()

const emit = defineEmits<{
  writeReview: [payload: { transaction: TransactionListItem; reviewType: ReviewType }]
}>()

const router = useRouter()
const { warmBookingDetail } = useBookingDetailPrefetch()
const isAdminVariant = computed(() => props.variant === "admin")
const userRole = computed(() => (props.activeRole === "LENDER" ? "LENDER" : "BORROWER"))
const userTransaction = computed(() =>
  isAdminVariant.value ? null : (props.transaction as TransactionListItem),
)

const formatPeso = (value: number) =>
  `₱${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(value)}`

const formatParticipantName = (
  user: { firstName: string; lastName: string } | null | undefined,
  fallback: string,
) => {
  if (!user) return fallback
  let first = (user.firstName || "").trim()
  const last = (user.lastName || "").trim()

  if (!first && !last) return fallback

  if (first.toLowerCase().endsWith(" user")) {
    first = first.slice(0, -5).trim()
  }

  const displayFirst = first ? first.charAt(0).toUpperCase() + first.slice(1) : fallback
  const isGenericLast = /^user$/i.test(last) || !last

  if (isGenericLast) return displayFirst

  return `${displayFirst} ${last.charAt(0).toUpperCase()}.`
}

const counterpartName = computed(() => {
  const user =
    userRole.value === "BORROWER" ? props.transaction.lender.user : props.transaction.borrower.user

  return formatParticipantName(user, "Former user")
})

const borrowerName = computed(() =>
  formatParticipantName(props.transaction.borrower.user, "Former borrower"),
)

const lenderName = computed(() =>
  formatParticipantName(props.transaction.lender.user, "Former lender"),
)

const borrowerRating = computed(() => props.transaction.borrower.borrowerRating)
const lenderRating = computed(() => props.transaction.lender.lenderRating)

const formatRating = (rating: number | null) => (rating === null ? null : rating.toFixed(1))

const formatDate = (date: Date | string) =>
  new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

const formatTime = (date: Date | string) =>
  new Date(date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })

const dateRange = computed(() => {
  const start = formatDate(props.transaction.startDate)
  const end = formatDate(props.transaction.endDate)
  const sameDay = start === end
  return sameDay ? start : `${start} - ${end}`
})

const timeRange = computed(() => {
  const start = formatTime(props.transaction.startDate)
  const end = formatTime(props.transaction.endDate)
  return `${start} – ${end}`
})

const computeDuration = (startDate: Date | string, endDate: Date | string): string => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

  if (totalDays <= 0) return "1 day"
  if (totalDays === 1) return "1 day"
  if (totalDays < 7) return `${totalDays} days`

  const weeks = Math.floor(totalDays / 7)
  const remainingDays = totalDays % 7

  if (remainingDays === 0) return weeks === 1 ? "1 week" : `${weeks} weeks`

  const weekPart = weeks === 1 ? "1 week" : `${weeks} weeks`
  const dayPart = remainingDays === 1 ? "1 day" : `${remainingDays} days`
  return `${weekPart} and ${dayPart}`
}

const duration = computed(() =>
  computeDuration(props.transaction.startDate, props.transaction.endDate),
)

const rateLabel = computed(() => {
  if (props.transaction.item.freeToBorrow) return "Free"
  const unit = props.transaction.item.rateOption === "PER_HOUR" ? "/hour" : "/day"
  return `${formatPeso(props.transaction.item.rentalFee)}${unit}`
})

const totalLabel = computed(() =>
  props.transaction.item.freeToBorrow ? "₱0" : formatPeso(props.transaction.totalAmount),
)

const commissionLabel = computed(() => formatPeso(props.transaction.commissionAmount))

const createdAtLabel = computed(() =>
  new Date(props.transaction.createdAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }),
)

const shortTransactionId = computed(() => props.transaction.id.slice(0, 12).toUpperCase())

const detailPath = computed(() => {
  if (isAdminVariant.value) {
    const bookingId = props.transaction.bookingId
    return bookingId ? `/account/transactions/${bookingId}` : null
  }
  return props.transaction.bookingId
    ? `/account/transactions/${props.transaction.bookingId}`
    : `/account/transactions/${props.transaction.id}`
})

const rootClass = computed(() => [
  "block overflow-hidden rounded-[16px] border border-cinnamon-ice/20 bg-white font-geist shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200",
  detailPath.value ? "cursor-pointer hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] group/card" : "",
])

const canOpenChat = computed(
  () => !isAdminVariant.value && isChatAvailableForTransactionStatus(props.transaction.status),
)

const reviewActions = computed(
  () => userTransaction.value?.reviewState.actions.filter((entry) => entry.canSubmit) ?? [],
)

const handleWriteReview = (reviewType: ReviewType) => {
  if (!userTransaction.value) return
  emit("writeReview", { transaction: userTransaction.value, reviewType })
}

const warmOrderDetails = () => {
  if (!detailPath.value) return
  void warmBookingDetail(detailPath.value, { priority: true }).catch(() => {})
}

const warmOrderDetailsImmediately = () => {
  if (!detailPath.value) return
  void warmBookingDetail(detailPath.value, { immediate: true, priority: true }).catch(() => {})
}

const handleOpenChat = async () => {
  if (!canOpenChat.value) return

  await router.push({
    path: "/chat",
    query: { transactionId: props.transaction.id },
  })
}
</script>

<template>
  <template v-if="detailPath">
    <NuxtLink
      :to="detailPath"
      :class="rootClass"
      :prefetch-on="{ interaction: true }"
      @pointerenter="warmOrderDetails"
      @focus="warmOrderDetails"
      @mousedown="warmOrderDetailsImmediately"
      @touchstart.passive="warmOrderDetails"
    >
      <div class="border-b border-[#F3F0EB] bg-white/50 px-5 py-3">
        <div
          v-if="isAdminVariant"
          class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
        >
          <div class="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-3">
            <div class="flex min-w-0 items-center gap-2">
              <span class="text-[10px] font-bold uppercase tracking-widest text-noble-black/30">
                Borrower
              </span>
              <span class="truncate text-[14px] font-semibold text-noble-black">
                {{ borrowerName }}
              </span>
              <span
                v-if="formatRating(borrowerRating)"
                class="rounded-full bg-burning-orange/[0.08] px-2 py-0.5 text-[10px] font-bold text-burning-orange"
              >
                {{ formatRating(borrowerRating) }}
              </span>
            </div>

            <div class="hidden h-4 w-px bg-cinnamon-ice/40 lg:block"></div>

            <div class="flex min-w-0 items-center gap-2">
              <span class="text-[10px] font-bold uppercase tracking-widest text-noble-black/30">
                Lender
              </span>
              <span class="truncate text-[14px] font-semibold text-noble-black">
                {{ lenderName }}
              </span>
              <span
                v-if="formatRating(lenderRating)"
                class="rounded-full bg-burning-orange/[0.08] px-2 py-0.5 text-[10px] font-bold text-burning-orange"
              >
                {{ formatRating(lenderRating) }}
              </span>
            </div>
          </div>

          <TransactionStatusBadge :status="transaction.status" :role="activeRole" context="admin" />
        </div>

        <div v-else class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-noble-black text-[14px] font-semibold">
              {{ counterpartName }}
            </span>

            <button
              v-if="canOpenChat"
              class="w-7 h-7 flex items-center justify-center rounded-full bg-burning-orange/[0.12] border border-burning-orange/30 text-burning-orange hover:bg-burning-orange/[0.2] transition-all group/chat"
              title="Open Chat"
              aria-label="Open chat"
              @click.stop.prevent="handleOpenChat"
            >
              <Icon
                name="ph:chat-centered-text"
                class="w-3.5 h-3.5 transition-transform group-hover/chat:scale-110 shrink-0"
              />
            </button>
          </div>

          <TransactionStatusBadge :status="transaction.status" :role="activeRole" />
        </div>
      </div>

      <div class="p-5 flex items-center gap-4 relative">
        <div class="relative shrink-0">
          <img
            v-if="transaction.item.thumbnailImage"
            :src="transaction.item.thumbnailImage"
            :alt="transaction.item.name"
            class="w-16 h-16 object-cover rounded-[10px] border border-gray-100"
          />
          <div
            v-else
            class="w-16 h-16 bg-cinnamon-ice/10 rounded-[10px] border border-gray-100 flex items-center justify-center"
          >
            <Icon name="ph:image" class="w-6 h-6 text-cinnamon-ice/40 shrink-0" />
          </div>
        </div>

        <div class="flex-1 min-w-0">
          <h4 class="text-noble-black text-[15px] font-bold truncate leading-tight mb-1">
            {{ transaction.item.name }}
          </h4>
          <div
            class="flex flex-wrap items-center gap-1.5 text-[10px] text-[#B0B0B0] font-medium leading-none"
          >
            <span class="font-mono tracking-wider">{{ shortTransactionId }}</span>
            <span class="opacity-50 select-none">·</span>
            <span v-if="isAdminVariant">Logged {{ createdAtLabel }}</span>
            <span v-else>{{ dateRange }}</span>
            <span class="opacity-50 select-none">·</span>
            <span v-if="!isAdminVariant">{{ timeRange }}</span>
            <span v-if="!isAdminVariant" class="opacity-50 select-none">·</span>
            <span>{{ duration }}</span>
            <template v-if="isAdminVariant">
              <span class="opacity-50 select-none">·</span>
              <span>Commission {{ commissionLabel }}</span>
            </template>
          </div>

          <div v-if="reviewActions.length" class="mt-2.5 flex flex-wrap gap-3 relative z-10">
            <button
              v-for="action in reviewActions"
              :key="action.reviewType"
              class="text-[12px] font-bold text-burning-orange hover:underline underline-offset-4 transition-all"
              @click.stop.prevent="handleWriteReview(action.reviewType)"
            >
              {{ action.label }}
            </button>
          </div>
        </div>

        <div class="shrink-0 z-10 text-right">
          <div class="flex flex-col items-end">
            <p class="text-[13px] text-gray-400 font-medium leading-none mb-1.5">{{ rateLabel }}</p>
            <div class="flex items-baseline gap-1.5">
              <span class="text-[11px] text-[#9CA3AF] font-bold uppercase tracking-wider">
                Total:
              </span>
              <span class="text-[16px] font-bold text-burning-orange leading-none">
                {{ totalLabel }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </NuxtLink>
  </template>
  <template v-else>
    <div :class="rootClass">
      <div class="border-b border-[#F3F0EB] bg-white/50 px-5 py-3">
        <div
          v-if="isAdminVariant"
          class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
        >
          <div class="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-3">
            <div class="flex min-w-0 items-center gap-2">
              <span class="text-[10px] font-bold uppercase tracking-widest text-noble-black/30">
                Borrower
              </span>
              <span class="truncate text-[14px] font-semibold text-noble-black">
                {{ borrowerName }}
              </span>
              <span
                v-if="formatRating(borrowerRating)"
                class="rounded-full bg-burning-orange/[0.08] px-2 py-0.5 text-[10px] font-bold text-burning-orange"
              >
                {{ formatRating(borrowerRating) }}
              </span>
            </div>

            <div class="hidden h-4 w-px bg-cinnamon-ice/40 lg:block"></div>

            <div class="flex min-w-0 items-center gap-2">
              <span class="text-[10px] font-bold uppercase tracking-widest text-noble-black/30">
                Lender
              </span>
              <span class="truncate text-[14px] font-semibold text-noble-black">
                {{ lenderName }}
              </span>
              <span
                v-if="formatRating(lenderRating)"
                class="rounded-full bg-burning-orange/[0.08] px-2 py-0.5 text-[10px] font-bold text-burning-orange"
              >
                {{ formatRating(lenderRating) }}
              </span>
            </div>
          </div>

          <TransactionStatusBadge :status="transaction.status" :role="activeRole" context="admin" />
        </div>

        <div v-else class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-noble-black text-[14px] font-semibold">
              {{ counterpartName }}
            </span>

            <button
              v-if="canOpenChat"
              class="w-7 h-7 flex items-center justify-center rounded-full bg-burning-orange/[0.12] border border-burning-orange/30 text-burning-orange hover:bg-burning-orange/[0.2] transition-all group/chat"
              title="Open Chat"
              aria-label="Open chat"
              @click.stop.prevent="handleOpenChat"
            >
              <Icon
                name="ph:chat-centered-text"
                class="w-3.5 h-3.5 transition-transform group-hover/chat:scale-110 shrink-0"
              />
            </button>
          </div>

          <TransactionStatusBadge :status="transaction.status" :role="activeRole" />
        </div>
      </div>

      <div class="p-5 flex items-center gap-4 relative">
        <div class="relative shrink-0">
          <img
            v-if="transaction.item.thumbnailImage"
            :src="transaction.item.thumbnailImage"
            :alt="transaction.item.name"
            class="w-16 h-16 object-cover rounded-[10px] border border-gray-100"
          />
          <div
            v-else
            class="w-16 h-16 bg-cinnamon-ice/10 rounded-[10px] border border-gray-100 flex items-center justify-center"
          >
            <Icon name="ph:image" class="w-6 h-6 text-cinnamon-ice/40 shrink-0" />
          </div>
        </div>

        <div class="flex-1 min-w-0">
          <h4 class="text-noble-black text-[15px] font-bold truncate leading-tight mb-1">
            {{ transaction.item.name }}
          </h4>
          <div
            class="flex flex-wrap items-center gap-1.5 text-[10px] text-[#B0B0B0] font-medium leading-none"
          >
            <span class="font-mono tracking-wider">{{ shortTransactionId }}</span>
            <span class="opacity-50 select-none">·</span>
            <span v-if="isAdminVariant">Logged {{ createdAtLabel }}</span>
            <span v-else>{{ dateRange }}</span>
            <span class="opacity-50 select-none">·</span>
            <span v-if="!isAdminVariant">{{ timeRange }}</span>
            <span v-if="!isAdminVariant" class="opacity-50 select-none">·</span>
            <span>{{ duration }}</span>
            <template v-if="isAdminVariant">
              <span class="opacity-50 select-none">·</span>
              <span>Commission {{ commissionLabel }}</span>
            </template>
          </div>

          <div v-if="reviewActions.length" class="mt-2.5 flex flex-wrap gap-3 relative z-10">
            <button
              v-for="action in reviewActions"
              :key="action.reviewType"
              class="text-[12px] font-bold text-burning-orange hover:underline underline-offset-4 transition-all"
              @click.stop.prevent="handleWriteReview(action.reviewType)"
            >
              {{ action.label }}
            </button>
          </div>
        </div>

        <div class="shrink-0 z-10 text-right">
          <div class="flex flex-col items-end">
            <p class="text-[13px] text-gray-400 font-medium leading-none mb-1.5">{{ rateLabel }}</p>
            <div class="flex items-baseline gap-1.5">
              <span class="text-[11px] text-[#9CA3AF] font-bold uppercase tracking-wider">
                Total:
              </span>
              <span class="text-[16px] font-bold text-burning-orange leading-none">
                {{ totalLabel }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>
