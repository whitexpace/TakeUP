<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue"
import type { TransactionStatus } from "../../../../shared/schemas/transaction"
import type { BookingStatus } from "../../../../shared/schemas/booking"
import type { ReviewType } from "../../../../shared/schemas/review"
import { useTransactions, type TransactionListItem } from "../../../composables/use-transactions"
import {
  useBorrowerItemRequests,
  type BorrowerItemRequest,
} from "../../../composables/use-borrower-item-requests"

definePageMeta({
  layout: "account",
  middleware: "account-auth",
})

type ActiveRole = "BORROWER" | "LENDER"
type TransactionFilter = TransactionStatus | "TO_REVIEW" | "REQUESTED_ITEMS" | null
type HistoryEntry =
  | { kind: "request"; id: string; date: Date | string; request: BorrowerItemRequest }
  | { kind: "transaction"; id: string; date: Date | string; transaction: TransactionListItem }

const route = useRoute()
const router = useRouter()
const activeRole = ref<ActiveRole>((route.query.role as ActiveRole) || "BORROWER")
const activeStatus = ref<TransactionFilter>(null)
const searchQuery = ref("")

const { filteredTransactions, isLoading, error, hasMore, loadMore, refresh, fetchPage } =
  useTransactions({
    role: activeRole,
    status: computed(() =>
      activeStatus.value === "TO_REVIEW" || activeStatus.value === "REQUESTED_ITEMS"
        ? null
        : activeStatus.value,
    ),
    searchQuery,
  })

const borrowerRequestStatuses = computed<BookingStatus[]>(() => {
  if (activeRole.value !== "BORROWER") return []

  switch (activeStatus.value) {
    case null:
    case "REQUESTED_ITEMS":
      return ["PENDING", "CONFIRMED", "CANCELLED"]
    case "PENDING":
      return ["PENDING"]
    case "ACTIVE":
      return ["CONFIRMED"]
    case "CANCELLED":
      return ["CANCELLED"]
    default:
      return []
  }
})

const shouldShowBorrowerRequests = computed(
  () => activeRole.value === "BORROWER" && borrowerRequestStatuses.value.length > 0,
)

const {
  filteredRequests: filteredBorrowerRequests,
  isLoading: areBorrowerRequestsLoading,
  error: borrowerRequestsError,
  fetchRequests: fetchBorrowerRequests,
} = useBorrowerItemRequests({
  enabled: shouldShowBorrowerRequests,
  statuses: borrowerRequestStatuses,
  searchQuery,
})

const visibleTransactions = computed(() =>
  activeStatus.value === "REQUESTED_ITEMS"
    ? []
    : activeStatus.value === "TO_REVIEW"
      ? filteredTransactions.value.filter((transaction) => transaction.reviewState.canSubmitAny)
      : filteredTransactions.value,
)

const visibleBorrowerRequests = computed(() =>
  shouldShowBorrowerRequests.value ? filteredBorrowerRequests.value : [],
)

const visibleHistoryEntries = computed<HistoryEntry[]>(() => {
  // Build maps to deduplicate transactions that correspond to a booking
  // already represented by a borrower request card. If a transaction has a
  // bookingId that matches a request.id we prefer showing the request entry
  // and skip the transaction entry to avoid duplicate cards for the same
  // underlying booking.
  const requestIdSet = new Set(visibleBorrowerRequests.value.map((r) => r.id))

  const requestEntries = visibleBorrowerRequests.value.map((request) => ({
    kind: "request" as const,
    id: request.id,
    date: request.createdAt,
    request,
  }))

  const transactionEntries = visibleTransactions.value
    .filter((transaction) => !(transaction.bookingId && requestIdSet.has(transaction.bookingId)))
    .map((transaction) => ({
      kind: "transaction" as const,
      id: transaction.id,
      date: transaction.createdAt,
      transaction,
    }))

  return [...requestEntries, ...transactionEntries].sort((left, right) => {
    const rightTime = new Date(right.date).getTime()
    const leftTime = new Date(left.date).getTime()

    if (rightTime !== leftTime) return rightTime - leftTime
    return right.id.localeCompare(left.id)
  })
})

const hasVisibleEntries = computed(() => visibleHistoryEntries.value.length > 0)

const isInitialLoading = computed(
  () =>
    !hasVisibleEntries.value &&
    (isLoading.value || (shouldShowBorrowerRequests.value && areBorrowerRequestsLoading.value)),
)

const combinedError = computed(() => error.value ?? borrowerRequestsError.value)

const hasInitialError = computed(
  () => !hasVisibleEntries.value && !isInitialLoading.value && Boolean(combinedError.value),
)

const hasEmptyState = computed(
  () => !hasVisibleEntries.value && !isInitialLoading.value && !hasInitialError.value,
)

const isReviewModalOpen = ref(false)
const selectedTransactionForReview = ref<TransactionListItem | null>(null)
const selectedReviewType = ref<ReviewType | null>(null)
const showRewardPopup = ref(false)
let rewardPopupTimeout: ReturnType<typeof setTimeout> | null = null
const REVIEW_REWARD_POPUP_STORAGE_KEY = "takeup:review-reward-popup"

type SubmittedReviewPayload = {
  transactionId: string
  reviewType: ReviewType
  currentUserRole: "BORROWER" | "LENDER"
  itemId: string | null
}

onMounted(() => {
  void fetchPage()
  void fetchBorrowerRequests()
})

const setRole = (role: ActiveRole) => {
  if (activeRole.value === role) return
  activeRole.value = role
  activeStatus.value = null
  searchQuery.value = ""
  router.replace({ query: { ...route.query, role } })
}

const setStatus = (status: TransactionFilter) => {
  activeStatus.value = status
}

type StatusChip = {
  label: string
  value: TransactionFilter
}

const statusChips = computed<StatusChip[]>(() => [
  { label: "All", value: null },
  ...(activeRole.value === "BORROWER"
    ? [{ label: "Requested Items", value: "REQUESTED_ITEMS" as TransactionFilter }]
    : []),
  {
    label: activeRole.value === "BORROWER" ? "To Receive" : "For Approval",
    value: "PENDING",
  },
  { label: "In Use", value: "ACTIVE" },
  { label: "Returned", value: "RETURNED" },
  { label: "Completed", value: "COMPLETED" },
  { label: "To Review", value: "TO_REVIEW" },
  { label: "Cancelled", value: "CANCELLED" },
])

const sectionTitle = computed(() =>
  activeRole.value === "BORROWER" ? "Borrowed Items History" : "Lent Items History",
)
const sectionSubtitle = computed(() =>
  activeRole.value === "BORROWER"
    ? "Items you've borrowed from other users"
    : "Items you've lent to other users",
)

const emptyTitle = computed(() => {
  if (activeStatus.value === "TO_REVIEW") return "No transactions awaiting your review"
  if (activeStatus.value === "REQUESTED_ITEMS") return "No requested items yet"
  return activeRole.value === "BORROWER"
    ? "No borrowing transactions yet"
    : "No lending transactions yet"
})

const emptySubtitle = computed(() => {
  if (activeStatus.value === "TO_REVIEW") {
    return "Completed transactions you can review will appear here."
  }

  if (activeStatus.value === "REQUESTED_ITEMS") {
    return "Items you request from lenders will appear here."
  }

  return activeRole.value === "BORROWER"
    ? "Items you borrow and request will appear here."
    : "Items you lend to others will appear here."
})

const refreshAll = async () => {
  await Promise.all([refresh(), fetchBorrowerRequests()])
}

const reviewContext = computed(() => {
  if (!selectedTransactionForReview.value) return null

  const counterpart =
    activeRole.value === "BORROWER"
      ? selectedTransactionForReview.value.lender.user
      : selectedTransactionForReview.value.borrower.user

  return {
    transactionId: selectedTransactionForReview.value.id,
    reviewType: selectedReviewType.value,
    currentUserRole: activeRole.value,
    itemName: selectedTransactionForReview.value.item.name,
    counterpartName: `${counterpart.firstName} ${counterpart.lastName[0]}.`,
    itemId: selectedTransactionForReview.value.item.id,
    targetUserId:
      selectedReviewType.value === "ITEM_REVIEW"
        ? null
        : activeRole.value === "BORROWER"
          ? selectedTransactionForReview.value.lenderId
          : selectedTransactionForReview.value.borrowerId,
  }
})

const openReviewModal = (payload: { transaction: TransactionListItem; reviewType: ReviewType }) => {
  selectedTransactionForReview.value = payload.transaction
  selectedReviewType.value = payload.reviewType
  isReviewModalOpen.value = true
}

const closeReviewModal = () => {
  isReviewModalOpen.value = false
  selectedTransactionForReview.value = null
  selectedReviewType.value = null
}

const triggerRewardPopup = () => {
  if (rewardPopupTimeout) {
    clearTimeout(rewardPopupTimeout)
  }

  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(REVIEW_REWARD_POPUP_STORAGE_KEY, "1")
  }

  showRewardPopup.value = true
  rewardPopupTimeout = setTimeout(() => {
    showRewardPopup.value = false
    rewardPopupTimeout = null
  }, 1800)
}

const shouldShowRewardPopup = (payload: SubmittedReviewPayload) => {
  if (payload.currentUserRole === "LENDER") {
    return true
  }

  const actions = selectedTransactionForReview.value?.reviewState.actions ?? []
  const requiredTypes: ReviewType[] = ["LENDER_REVIEW"]

  if (payload.itemId) {
    requiredTypes.push("ITEM_REVIEW")
  }

  return requiredTypes.every((reviewType) => {
    if (reviewType === payload.reviewType) {
      return true
    }

    return actions.find((action) => action.reviewType === reviewType)?.hasSubmitted ?? false
  })
}

const handleReviewSubmitted = async (payload: SubmittedReviewPayload) => {
  if (shouldShowRewardPopup(payload)) {
    triggerRewardPopup()
  }

  await refreshAll()
}

onBeforeUnmount(() => {
  if (rewardPopupTimeout) {
    clearTimeout(rewardPopupTimeout)
  }
})
</script>

<template>
  <div class="font-geist">
    <div class="mb-4 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-neutral-800 text-xl font-bold sm:text-2xl">My Transactions</h1>
        <p class="mt-1 text-base font-normal tracking-wide text-neutral-800 sm:text-lg">
          Review your borrowing and lending history
        </p>
      </div>

      <NuxtLink
        :to="{ path: '/account/disputes', query: { tab: 'disputes' } }"
        class="inline-flex items-center justify-center self-start rounded-2xl border border-blue-estate/15 bg-blue-estate px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-900 sm:self-auto"
      >
        Disputes
      </NuxtLink>
    </div>

    <!-- Search bar -->
    <div
      class="flex items-center gap-2 sm:gap-3 bg-white rounded-[20px] border-[0.50px] border-cinnamon-ice h-12 sm:h-16 px-4 sm:px-5 mb-3 sm:mb-4"
    >
      <svg
        class="w-4 h-4 sm:w-5 sm:h-5 text-stone-400 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <circle cx="11" cy="11" r="8" stroke-width="2" />
        <path d="m21 21-4.35-4.35" stroke-width="2" stroke-linecap="round" />
      </svg>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search by item, owner, or order ID"
        class="flex-1 bg-transparent outline-none text-stone-400 text-sm sm:text-lg font-normal placeholder:text-stone-400 min-w-0"
      />
      <svg
        class="w-4 h-4 sm:w-5 sm:h-5 text-neutral-800/70 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <line x1="4" y1="6" x2="20" y2="6" stroke-width="1.5" stroke-linecap="round" />
        <line x1="8" y1="12" x2="20" y2="12" stroke-width="1.5" stroke-linecap="round" />
        <line x1="12" y1="18" x2="20" y2="18" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </div>

    <!-- Tab bar -->
    <div
      class="flex items-center rounded-[20px] bg-cream border border-cinnamon-ice h-12 sm:h-16 overflow-hidden mb-3 sm:mb-4"
    >
      <!-- Borrow History tab -->
      <button
        class="flex-1 h-full flex items-center justify-center rounded-[20px] transition-colors duration-200 text-sm sm:text-xl font-medium px-2"
        :class="
          activeRole === 'BORROWER'
            ? 'bg-burning-orange text-white'
            : 'bg-transparent text-neutral-800'
        "
        @click="setRole('BORROWER')"
      >
        Borrow History
      </button>

      <!-- Lend History tab -->
      <button
        class="flex-1 h-full flex items-center justify-center rounded-[20px] transition-colors duration-200 text-sm sm:text-xl font-medium px-2"
        :class="
          activeRole === 'LENDER'
            ? 'bg-burning-orange text-white'
            : 'bg-transparent text-neutral-800'
        "
        @click="setRole('LENDER')"
      >
        Lend History
      </button>
    </div>

    <!-- Content panel -->
    <div class="bg-cream rounded-[20px] border border-cinnamon-ice p-4 sm:p-6">
      <!-- Section title -->
      <h2 class="text-neutral-800 text-lg sm:text-xl font-semibold">{{ sectionTitle }}</h2>
      <p
        class="text-neutral-800/80 text-sm sm:text-base font-normal tracking-wide mt-1 mb-4 sm:mb-5"
      >
        {{ sectionSubtitle }}
      </p>

      <!-- Status filter chips -->
      <div class="flex flex-wrap gap-1.5 sm:gap-2 mb-4 sm:mb-6">
        <button
          v-for="chip in statusChips"
          :key="chip.label"
          class="px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-base font-normal transition-colors duration-150"
          :class="
            activeStatus === chip.value
              ? 'bg-burning-orange text-white'
              : 'bg-white border-[0.30px] border-orange-500 text-neutral-800'
          "
          @click="setStatus(chip.value)"
        >
          {{ chip.label }}
        </button>
      </div>

      <!-- Loading skeletons -->
      <template v-if="isInitialLoading">
        <div
          v-for="i in 3"
          :key="i"
          class="animate-pulse bg-cinnamon-ice/40 rounded-2xl h-32 sm:h-40 mb-3 sm:mb-4"
        />
      </template>

      <!-- Error state -->
      <div
        v-else-if="hasInitialError"
        class="flex flex-col items-center justify-center py-12 sm:py-16 text-center"
      >
        <svg
          class="w-10 h-10 sm:w-12 sm:h-12 text-cinnamon-ice mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="10" stroke-width="1.5" />
          <line x1="12" y1="8" x2="12" y2="12" stroke-width="2" stroke-linecap="round" />
          <circle cx="12" cy="16" r="0.5" fill="currentColor" stroke-width="2" />
        </svg>
        <p class="text-neutral-800/80 text-sm sm:text-base mb-4">{{ combinedError }}</p>
        <button
          class="bg-burning-orange text-white rounded-xl px-5 sm:px-6 py-2 text-sm sm:text-base font-normal hover:bg-cinnabar-red transition-colors"
          @click="refreshAll"
        >
          Retry
        </button>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="hasEmptyState"
        class="flex flex-col items-center justify-center py-12 sm:py-16 text-center"
      >
        <svg
          class="w-12 h-12 sm:w-16 sm:h-16 text-cinnamon-ice mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1.5" />
          <path d="M3 9h18" stroke-width="1.5" />
          <path d="M9 21V9" stroke-width="1.5" />
        </svg>
        <p class="text-neutral-800 text-sm sm:text-base font-semibold mb-1">{{ emptyTitle }}</p>
        <p class="text-neutral-800/60 text-xs sm:text-sm">{{ emptySubtitle }}</p>
      </div>

      <!-- Transaction list -->
      <div v-else class="flex flex-col gap-3 sm:gap-4">
        <template v-for="entry in visibleHistoryEntries" :key="`${entry.kind}-${entry.id}`">
          <BorrowerRequestCard v-if="entry.kind === 'request'" :request="entry.request" />
          <TransactionCard
            v-else
            :transaction="entry.transaction"
            :active-role="activeRole"
            @write-review="openReviewModal"
          />
        </template>
      </div>

      <!-- Load More -->
      <div
        v-if="hasMore || (isLoading && visibleTransactions.length > 0)"
        class="flex justify-center mt-4 sm:mt-6"
      >
        <button
          :disabled="isLoading"
          class="bg-burning-orange text-white rounded-xl px-5 sm:px-6 py-2 text-sm sm:text-base font-normal disabled:opacity-60 hover:bg-cinnabar-red transition-colors"
          @click="loadMore"
        >
          <span v-if="isLoading">Loading…</span>
          <span v-else>Load More</span>
        </button>
      </div>
    </div>

    <TransactionReviewModal
      :open="isReviewModalOpen"
      :context="reviewContext"
      @close="closeReviewModal"
      @submitted="handleReviewSubmitted"
    />

    <Transition
      enter-active-class="transition duration-500 ease-out"
      enter-from-class="opacity-0 scale-75 translate-y-3"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition duration-300 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-90"
    >
      <div
        v-if="showRewardPopup"
        class="pointer-events-none fixed inset-0 z-[140] flex items-center justify-center px-4"
      >
        <div class="rounded-full bg-emerald-500 px-7 py-4 text-center text-white shadow-2xl">
          <p class="text-3xl font-black tracking-tight">+5 points</p>
          <p class="text-sm font-medium text-white/90">Review bonus earned</p>
        </div>
      </div>
    </Transition>
  </div>
</template>
