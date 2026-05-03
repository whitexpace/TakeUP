<script setup lang="ts">
import { computed } from "vue"
import type { TransactionListItem } from "../composables/use-transactions"
import type { ReviewType } from "../../shared/schemas/review"
import { isChatAvailableForTransactionStatus } from "../../shared/chat-rules"

const props = defineProps<{
  transaction: TransactionListItem
  activeRole: "LENDER" | "BORROWER"
}>()

const emit = defineEmits<{
  writeReview: [payload: { transaction: TransactionListItem; reviewType: ReviewType }]
}>()

const router = useRouter()

const formatPeso = (value: number) =>
  `₱${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(value)}`

const counterpartName = computed(() => {
  const user =
    props.activeRole === "BORROWER"
      ? props.transaction.lender.user
      : props.transaction.borrower.user

  let first = (user.firstName || "").trim()
  const last = (user.lastName || "").trim()

  // 1. Clean up "User" placeholder from firstName if it's there (e.g. "jslegaspo User")
  if (first.toLowerCase().endsWith(" user")) {
    first = first.slice(0, -5).trim()
  }

  // 2. High-reliability check for "User" placeholder in lastName
  const isGenericLast = /^user$/i.test(last) || !last

  if (isGenericLast) {
    // If we only have the first part (likely a username), capitalize it for professionalism
    return first.charAt(0).toUpperCase() + first.slice(1)
  }

  // 3. Return "FirstName L." for a professional look
  const capitalizedFirst = first.charAt(0).toUpperCase() + first.slice(1)
  const lastInitial = last.charAt(0).toUpperCase()
  return `${capitalizedFirst} ${lastInitial}.`
})

const formatDate = (date: Date | string) =>
  new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

const dateRange = computed(() => {
  const start = formatDate(props.transaction.startDate)
  const end = formatDate(props.transaction.endDate)
  const sameDay = start === end
  return sameDay ? start : `${start} - ${end}`
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

const detailPath = computed(() =>
  props.transaction.bookingId
    ? `/account/transactions/${props.transaction.bookingId}`
    : `/account/transactions/${props.transaction.id}`,
)

const canOpenChat = computed(() => isChatAvailableForTransactionStatus(props.transaction.status))

const handleWriteReview = (reviewType: ReviewType) => {
  emit("writeReview", { transaction: props.transaction, reviewType })
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
  <NuxtLink
    :to="detailPath"
    class="block bg-white rounded-[16px] border border-cinnamon-ice/20 overflow-hidden font-geist shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] transition-all duration-200 cursor-pointer group/card"
  >
    <!-- Top Zone: Slim Header -->
    <div
      class="flex items-center justify-between px-5 py-3 border-b border-cinnamon-ice/15 bg-white/50"
    >
      <div class="flex items-center gap-3">
        <span class="text-noble-black text-[14px] font-semibold">
          {{ counterpartName }}
        </span>

        <!-- Chat Button (Modern Vivid Ghost) -->
        <button
          v-if="canOpenChat"
          class="w-7 h-7 flex items-center justify-center rounded-full bg-burning-orange/[0.12] border border-burning-orange/30 text-burning-orange hover:bg-burning-orange/[0.2] transition-all group/chat"
          title="Open Chat"
          @click.stop.prevent="handleOpenChat"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="transition-transform group-hover/chat:scale-110"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>

      <!-- Single Primary Status Badge -->
      <TransactionStatusBadge :status="transaction.status" :role="activeRole" />
    </div>

    <!-- Bottom Zone: Item Row -->
    <div class="p-5 flex items-center gap-4 relative">
      <!-- Thumbnail -->
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
          <svg
            class="w-6 h-6 text-cinnamon-ice/40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      </div>

      <!-- Item Details -->
      <div class="flex-1 min-w-0">
        <h4 class="text-noble-black text-[15px] font-bold truncate leading-tight mb-1">
          {{ transaction.item.name }}
        </h4>
        <div class="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium leading-none">
          <span class="font-mono tracking-wider">{{
            transaction.id.slice(0, 12).toUpperCase()
          }}</span>
          <span class="opacity-50 select-none">·</span>
          <span>{{ dateRange }}</span>
          <span class="opacity-50 select-none">·</span>
          <span>{{ duration }}</span>
        </div>

        <!-- Inline Review Actions -->
        <div
          v-if="transaction.reviewState.canSubmitAny"
          class="mt-2.5 flex flex-wrap gap-3 relative z-10"
        >
          <button
            v-for="action in transaction.reviewState.actions.filter((entry) => entry.canSubmit)"
            :key="action.reviewType"
            class="text-[12px] font-bold text-burning-orange hover:underline underline-offset-4 transition-all"
            @click.stop.prevent="handleWriteReview(action.reviewType)"
          >
            {{ action.label }}
          </button>
        </div>
      </div>

      <!-- Pricing Info -->
      <div class="shrink-0 z-10 text-right">
        <div class="flex flex-col items-end">
          <p class="text-[13px] text-gray-400 font-medium leading-none mb-1.5">{{ rateLabel }}</p>
          <div class="flex items-baseline gap-1.5">
            <span class="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Total:</span>
            <span class="text-[16px] font-bold text-burning-orange leading-none">{{
              totalLabel
            }}</span>
          </div>
        </div>
      </div>
    </div>
  </NuxtLink>
</template>
