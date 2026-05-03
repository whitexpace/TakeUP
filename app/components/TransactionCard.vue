<script setup lang="ts">
import { computed } from "vue"
import type { AdminTransactionListItem } from "../composables/use-admin-transactions"
import type { TransactionListItem } from "../composables/use-transactions"
import type { ReviewType } from "../../shared/schemas/review"
import { isChatAvailableForTransactionStatus } from "../../shared/chat-rules"

const props = defineProps<{
  transaction: TransactionListItem | AdminTransactionListItem
  activeRole?: "LENDER" | "BORROWER"
  variant?: "user" | "admin"
}>()

const emit = defineEmits<{
  writeReview: [payload: { transaction: TransactionListItem; reviewType: ReviewType }]
}>()

const router = useRouter()
const isAdminVariant = computed(() => props.variant === "admin")
const userRole = computed(() => props.activeRole ?? "BORROWER")
const userTransaction = computed(() =>
  isAdminVariant.value ? null : (props.transaction as TransactionListItem),
)

const formatPeso = (value: number) =>
  `₱${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(value)}`

const formatParticipantName = (user: { firstName: string; lastName: string }, fallback: string) => {
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

const detailPath = computed(() =>
  isAdminVariant.value
    ? null
    : props.transaction.bookingId
      ? `/account/transactions/${props.transaction.bookingId}`
      : `/account/transactions/${props.transaction.id}`,
)

const rootComponent = computed(() => (detailPath.value ? "NuxtLink" : "div"))
const rootBindings = computed(() => (detailPath.value ? { to: detailPath.value } : {}))
const rootClass = computed(() => [
  "block overflow-hidden rounded-[16px] border border-cinnamon-ice/35 bg-white font-geist shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200",
  isAdminVariant.value
    ? "cursor-default"
    : "cursor-pointer hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]",
])

const canOpenChat = computed(
  () => !isAdminVariant.value && isChatAvailableForTransactionStatus(props.transaction.status),
)

const reviewActions = computed(
  () => userTransaction.value?.reviewState.actions.filter((entry) => entry.canSubmit) ?? [],
)

const submittedReviewActions = computed(
  () => userTransaction.value?.reviewState.actions.filter((entry) => entry.hasSubmitted) ?? [],
)

const handleWriteReview = (reviewType: ReviewType) => {
  if (!userTransaction.value) return
  emit("writeReview", { transaction: userTransaction.value, reviewType })
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
  <component :is="rootComponent" v-bind="rootBindings" :class="rootClass">
    <div
      class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-cinnamon-ice/25 bg-white/80 px-4 py-3 sm:px-5"
    >
      <div class="min-w-0 flex-1">
        <div v-if="isAdminVariant" class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class="text-[13px] font-semibold text-noble-black sm:text-[14px]">
            Borrower: {{ borrowerName }}
          </span>
          <span
            v-if="borrowerRating !== null"
            class="rounded-full bg-burning-orange/10 px-2 py-0.5 text-[11px] font-bold text-burning-orange"
          >
            {{ borrowerRating.toFixed(1) }}
          </span>
          <span class="hidden text-noble-black/25 sm:inline">|</span>
          <span class="text-[13px] font-semibold text-noble-black sm:text-[14px]">
            Lender: {{ lenderName }}
          </span>
          <span
            v-if="lenderRating !== null"
            class="rounded-full bg-burning-orange/10 px-2 py-0.5 text-[11px] font-bold text-burning-orange"
          >
            {{ lenderRating.toFixed(1) }}
          </span>
        </div>

        <div v-else class="flex flex-wrap items-center gap-2">
          <span class="truncate text-[14px] font-semibold text-noble-black">
            {{ counterpartName }}
          </span>

          <button
            v-if="canOpenChat"
            class="flex h-7 w-7 items-center justify-center rounded-full border border-burning-orange/30 bg-burning-orange/[0.12] text-burning-orange transition-colors hover:bg-burning-orange/[0.2]"
            title="Open Chat"
            aria-label="Open chat"
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
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>

          <button
            v-for="action in reviewActions"
            :key="action.reviewType"
            class="rounded-full bg-burning-orange px-3 py-1 text-[12px] font-bold text-white transition-colors hover:bg-cinnabar-red"
            @click.stop.prevent="handleWriteReview(action.reviewType)"
          >
            {{ action.label }}
          </button>
          <span
            v-for="action in submittedReviewActions"
            :key="`${action.reviewType}-submitted`"
            class="rounded-full bg-blue-estate px-3 py-1 text-[12px] font-bold text-white"
          >
            {{ action.submittedLabel }}
          </span>
        </div>
      </div>

      <TransactionStatusBadge
        :status="transaction.status"
        :role="activeRole"
        :context="isAdminVariant ? 'admin' : 'user'"
      />
    </div>

    <div class="flex items-start gap-3 px-4 py-4 sm:gap-4 sm:px-5">
      <div class="relative shrink-0">
        <img
          v-if="transaction.item.thumbnailImage"
          :src="transaction.item.thumbnailImage"
          :alt="transaction.item.name"
          class="h-16 w-16 rounded-[10px] border border-cinnamon-ice/30 object-cover"
        />
        <div
          v-else
          class="flex h-16 w-16 items-center justify-center rounded-[10px] border border-cinnamon-ice/30 bg-cinnamon-ice/10"
        >
          <svg
            class="h-6 w-6 text-cinnamon-ice/50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      </div>

      <div class="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <h4 class="truncate text-[15px] font-bold leading-tight text-noble-black">
            {{ transaction.item.name }}
          </h4>
          <p class="mt-1 truncate font-mono text-[11px] font-semibold text-noble-black/45">
            {{ orderId }}
          </p>
          <div
            class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-noble-black/60"
          >
            <span v-if="isAdminVariant">Logged: {{ createdAtLabel }}</span>
            <span>{{ dateRange }}</span>
            <span>{{ duration }}</span>
            <span v-if="isAdminVariant">Commission: {{ commissionLabel }}</span>
          </div>
        </div>

        <div class="shrink-0 text-left sm:text-right">
          <p class="text-[13px] font-medium leading-none text-noble-black/45">{{ rateLabel }}</p>
          <div class="mt-2 flex items-baseline gap-1.5 sm:justify-end">
            <span class="text-[11px] font-bold uppercase tracking-[0.1em] text-noble-black/45">
              Total
            </span>
            <span class="text-[16px] font-bold leading-none text-burning-orange">
              {{ totalLabel }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </component>
</template>
