<script setup lang="ts">
import type { TransactionListItem } from "../composables/use-transactions"
import type { ReviewType } from "#shared/schemas/review"
import { isChatAvailableForTransactionStatus } from "#shared/chat-rules"

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
  return `${user.firstName} ${user.lastName[0]}.`
})

const orderId = computed(() => `ORDER ID. ${props.transaction.id.slice(0, 16).toUpperCase()}`)

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
  <div class="bg-white rounded-2xl border-[0.50px] border-cinnamon-ice overflow-hidden font-geist">
    <!-- Top row -->
    <div
      class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 sm:px-6 py-3 border-b border-stone-300/50"
    >
      <span class="text-neutral-800/80 text-base font-bold tracking-wide mr-auto">
        {{ counterpartName }}
      </span>

      <div class="flex items-center gap-2 flex-wrap">
        <button
          v-if="canOpenChat"
          class="inline-flex items-center gap-1.5 rounded-md border border-blue-estate/15 bg-blue-estate/5 px-2.5 sm:px-3 py-1 text-sm sm:text-base font-normal leading-none text-blue-estate hover:bg-blue-estate hover:text-white transition-colors"
          @click.stop="handleOpenChat"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Chat
        </button>
        <button
          v-for="action in transaction.reviewState.actions.filter((entry) => entry.canSubmit)"
          :key="action.reviewType"
          class="bg-burning-orange text-white rounded-md px-2.5 sm:px-3 py-1 text-sm sm:text-base font-normal leading-none hover:bg-cinnabar-red transition-colors"
          @click.stop="handleWriteReview(action.reviewType)"
        >
          {{ action.label }}
        </button>
        <span
          v-for="action in transaction.reviewState.actions.filter((entry) => entry.hasSubmitted)"
          :key="`${action.reviewType}-submitted`"
          class="bg-indigo-900 text-white rounded-md px-2.5 sm:px-3 py-1 text-sm sm:text-base font-normal leading-none"
        >
          {{ action.submittedLabel }}
        </span>
      </div>

      <TransactionStatusBadge :status="transaction.status" :role="activeRole" />
    </div>

    <!-- Bottom row -->
    <NuxtLink
      :to="detailPath"
      class="flex items-start gap-3 sm:gap-4 px-4 sm:px-6 py-4 hover:bg-cream/50 transition-colors cursor-pointer block"
    >
      <!-- Thumbnail -->
      <img
        v-if="transaction.item.thumbnailImage"
        :src="transaction.item.thumbnailImage"
        :alt="transaction.item.name"
        class="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded shrink-0"
      />
      <div
        v-else
        class="w-16 h-16 sm:w-20 sm:h-20 bg-cinnamon-ice/40 rounded shrink-0 flex items-center justify-center"
      >
        <svg
          class="w-7 h-7 sm:w-8 sm:h-8 text-cinnamon-ice"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>

      <!-- Details + Price -->
      <div class="flex flex-1 min-w-0 flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
        <!-- Details -->
        <div class="flex-1 min-w-0">
          <p class="text-neutral-800 text-sm sm:text-base font-normal truncate">
            {{ transaction.item.name }}
          </p>
          <p class="text-neutral-800/80 text-xs font-normal mt-1 truncate">{{ orderId }}</p>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            <span class="flex items-center gap-1 text-neutral-800/80 text-xs">
              <svg
                class="w-3.5 h-3.5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke-width="1" />
                <line x1="16" y1="2" x2="16" y2="6" stroke-width="1" />
                <line x1="8" y1="2" x2="8" y2="6" stroke-width="1" />
                <line x1="3" y1="10" x2="21" y2="10" stroke-width="1" />
              </svg>
              {{ dateRange }}
            </span>
            <span class="text-neutral-800/80 text-xs">Duration: {{ duration }}</span>
          </div>
        </div>

        <!-- Price info -->
        <div class="text-right shrink-0 sm:ml-auto">
          <p class="text-neutral-800 text-sm sm:text-base font-normal">{{ rateLabel }}</p>
          <p class="text-orange-500 text-sm sm:text-base font-semibold mt-1 sm:mt-3">
            {{ totalLabel }}
          </p>
        </div>
      </div>
    </NuxtLink>
  </div>
</template>
