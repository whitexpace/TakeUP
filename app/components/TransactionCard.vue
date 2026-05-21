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
      <div class="border-b border-[#F3F0EB] bg-white/50 px-3 sm:px-5 py-2 sm:py-3">
        <div
          v-if="isAdminVariant"
          class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-[9px] font-bold uppercase tracking-widest text-noble-black/30"
                >B</span
              >
              <span class="truncate text-[13px] font-semibold text-noble-black">{{
                borrowerName
              }}</span>
              <span
                v-if="formatRating(borrowerRating)"
                class="text-[10px] font-bold text-burning-orange bg-burning-orange/5 px-1 rounded"
                >★{{ formatRating(borrowerRating) }}</span
              >
            </div>
            <div class="hidden sm:block h-3 w-px bg-gray-200"></div>
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-[9px] font-bold uppercase tracking-widest text-noble-black/30"
                >L</span
              >
              <span class="truncate text-[13px] font-semibold text-noble-black">{{
                lenderName
              }}</span>
              <span
                v-if="formatRating(lenderRating)"
                class="text-[10px] font-bold text-burning-orange bg-burning-orange/5 px-1 rounded"
                >★{{ formatRating(lenderRating) }}</span
              >
            </div>
          </div>
          <TransactionStatusBadge
            :status="transaction.status"
            :role="activeRole"
            context="admin"
            class="scale-90 origin-right sm:scale-100"
          />
        </div>

        <div v-else class="flex items-center justify-between gap-3">
          <span class="text-noble-black text-[13px] sm:text-[14px] font-semibold truncate">
            {{ counterpartName }}
          </span>

          <div class="flex items-center gap-2">
            <button
              v-if="canOpenChat"
              class="w-6 h-6 flex items-center justify-center rounded-full bg-burning-orange/[0.08] text-burning-orange hover:bg-burning-orange/[0.15] transition-all"
              title="Open Chat"
              @click.stop.prevent="handleOpenChat"
            >
              <Icon name="ph:chat-centered-text" class="w-3.5 h-3.5" />
            </button>
            <TransactionStatusBadge
              :status="transaction.status"
              :role="activeRole"
              class="scale-90 origin-right sm:scale-100"
            />
          </div>
        </div>
      </div>

      <div class="p-3 sm:p-5 flex items-center gap-3 sm:gap-4">
        <div class="shrink-0">
          <img
            v-if="transaction.item.thumbnailImage"
            :src="transaction.item.thumbnailImage"
            :alt="transaction.item.name"
            class="w-11 h-11 sm:w-16 sm:h-16 object-cover rounded-lg border border-gray-100"
          />
          <div
            v-else
            class="w-11 h-11 sm:w-16 sm:h-16 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100"
          >
            <Icon name="ph:image" class="w-5 h-5 text-gray-300" />
          </div>
        </div>

        <div class="flex-1 min-w-0">
          <h4 class="text-noble-black text-[14px] sm:text-[15px] font-bold truncate leading-tight">
            {{ transaction.item.name }}
          </h4>
          <div
            class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-[11px] text-noble-black/40 font-medium"
          >
            <span class="font-mono text-noble-black/25">{{ shortTransactionId }}</span>
            <span class="hidden xs:inline text-noble-black/10">|</span>
            <span v-if="isAdminVariant">Logged {{ createdAtLabel }}</span>
            <span v-else>{{ dateRange }}</span>
            <span class="hidden xs:inline text-noble-black/10">|</span>
            <span v-if="!isAdminVariant">{{ timeRange }}</span>
            <span v-if="!isAdminVariant" class="hidden sm:inline text-noble-black/10">|</span>
            <span class="hidden sm:inline">{{ duration }}</span>
            <template v-if="isAdminVariant">
              <span class="hidden xs:inline text-noble-black/10">|</span>
              <span>Commission {{ commissionLabel }}</span>
            </template>
          </div>

          <div v-if="reviewActions.length" class="mt-1.5 flex gap-3">
            <button
              v-for="action in reviewActions"
              :key="action.reviewType"
              class="text-[11px] font-bold text-burning-orange hover:underline"
              @click.stop.prevent="handleWriteReview(action.reviewType)"
            >
              {{ action.label }}
            </button>
          </div>
        </div>

        <div class="shrink-0 text-right">
          <p class="text-[10px] sm:text-[12px] text-noble-black/30 font-medium leading-none mb-1">
            {{ rateLabel }}
          </p>
          <div class="flex items-center justify-end gap-1">
            <span class="text-[9px] text-noble-black/20 font-bold uppercase tracking-tight"
              >Total</span
            >
            <p class="text-[14px] sm:text-[16px] font-extrabold text-burning-orange leading-none">
              {{ totalLabel }}
            </p>
          </div>
        </div>
      </div>
    </NuxtLink>
  </template>
  <template v-else>
    <div :class="rootClass">
      <div class="border-b border-[#F3F0EB] bg-white/50 px-3 sm:px-5 py-2 sm:py-3">
        <div
          v-if="isAdminVariant"
          class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-[9px] font-bold uppercase tracking-widest text-noble-black/30"
                >B</span
              >
              <span class="truncate text-[13px] font-semibold text-noble-black">{{
                borrowerName
              }}</span>
              <span
                v-if="formatRating(borrowerRating)"
                class="text-[10px] font-bold text-burning-orange bg-burning-orange/5 px-1 rounded"
                >★{{ formatRating(borrowerRating) }}</span
              >
            </div>
            <div class="hidden sm:block h-3 w-px bg-gray-200"></div>
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-[9px] font-bold uppercase tracking-widest text-noble-black/30"
                >L</span
              >
              <span class="truncate text-[13px] font-semibold text-noble-black">{{
                lenderName
              }}</span>
              <span
                v-if="formatRating(lenderRating)"
                class="text-[10px] font-bold text-burning-orange bg-burning-orange/5 px-1 rounded"
                >★{{ formatRating(lenderRating) }}</span
              >
            </div>
          </div>
          <TransactionStatusBadge
            :status="transaction.status"
            :role="activeRole"
            context="admin"
            class="scale-90 origin-right sm:scale-100"
          />
        </div>

        <div v-else class="flex items-center justify-between gap-3">
          <span class="text-noble-black text-[13px] sm:text-[14px] font-semibold truncate">
            {{ counterpartName }}
          </span>

          <div class="flex items-center gap-2">
            <button
              v-if="canOpenChat"
              class="w-6 h-6 flex items-center justify-center rounded-full bg-burning-orange/[0.08] text-burning-orange hover:bg-burning-orange/[0.15] transition-all"
              title="Open Chat"
              @click.stop.prevent="handleOpenChat"
            >
              <Icon name="ph:chat-centered-text" class="w-3.5 h-3.5" />
            </button>
            <TransactionStatusBadge
              :status="transaction.status"
              :role="activeRole"
              class="scale-90 origin-right sm:scale-100"
            />
          </div>
        </div>
      </div>

      <div class="p-3 sm:p-5 flex items-center gap-3 sm:gap-4">
        <div class="shrink-0">
          <img
            v-if="transaction.item.thumbnailImage"
            :src="transaction.item.thumbnailImage"
            :alt="transaction.item.name"
            class="w-11 h-11 sm:w-16 sm:h-16 object-cover rounded-lg border border-gray-100"
          />
          <div
            v-else
            class="w-11 h-11 sm:w-16 sm:h-16 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100"
          >
            <Icon name="ph:image" class="w-5 h-5 text-gray-300" />
          </div>
        </div>

        <div class="flex-1 min-w-0">
          <h4 class="text-noble-black text-[14px] sm:text-[15px] font-bold truncate leading-tight">
            {{ transaction.item.name }}
          </h4>
          <div
            class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-[11px] text-noble-black/40 font-medium"
          >
            <span class="font-mono text-noble-black/25">{{ shortTransactionId }}</span>
            <span class="hidden xs:inline text-noble-black/10">|</span>
            <span v-if="isAdminVariant">Logged {{ createdAtLabel }}</span>
            <span v-else>{{ dateRange }}</span>
            <span class="hidden xs:inline text-noble-black/10">|</span>
            <span v-if="!isAdminVariant">{{ timeRange }}</span>
            <span v-if="!isAdminVariant" class="hidden sm:inline text-noble-black/10">|</span>
            <span class="hidden sm:inline">{{ duration }}</span>
            <template v-if="isAdminVariant">
              <span class="hidden xs:inline text-noble-black/10">|</span>
              <span>Commission {{ commissionLabel }}</span>
            </template>
          </div>

          <div v-if="reviewActions.length" class="mt-1.5 flex gap-3">
            <button
              v-for="action in reviewActions"
              :key="action.reviewType"
              class="text-[11px] font-bold text-burning-orange hover:underline"
              @click.stop.prevent="handleWriteReview(action.reviewType)"
            >
              {{ action.label }}
            </button>
          </div>
        </div>

        <div class="shrink-0 text-right">
          <p class="text-[10px] sm:text-[12px] text-noble-black/30 font-medium leading-none mb-1">
            {{ rateLabel }}
          </p>
          <div class="flex items-center justify-end gap-1">
            <span class="text-[9px] text-noble-black/20 font-bold uppercase tracking-tight"
              >Total</span
            >
            <p class="text-[14px] sm:text-[16px] font-extrabold text-burning-orange leading-none">
              {{ totalLabel }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>
