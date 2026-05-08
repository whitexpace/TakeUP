<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue"
import type { TransactionStatus } from "#shared/schemas/transaction"
import type { BookingStatus } from "#shared/schemas/booking"
import type { ReviewType } from "#shared/schemas/review"
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

const groupedHistoryEntries = computed(() => {
  const groups: Array<{ title: string; entries: HistoryEntry[] }> = []
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

  // Start of this week (Monday)
  const day = now.getDay() || 7
  const startOfWeek = today - (day - 1) * 24 * 60 * 60 * 1000

  visibleHistoryEntries.value.forEach((entry) => {
    const entryDate = new Date(entry.date)
    const entryTime = new Date(
      entryDate.getFullYear(),
      entryDate.getMonth(),
      entryDate.getDate(),
    ).getTime()

    let groupTitle = ""
    if (entryTime === today) {
      groupTitle = "Today"
    } else if (entryTime >= startOfWeek) {
      groupTitle = "This Week"
    } else {
      groupTitle = entryDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    }

    const existingGroup = groups.find((g) => g.title === groupTitle)
    if (existingGroup) {
      existingGroup.entries.push(entry)
    } else {
      groups.push({ title: groupTitle, entries: [entry] })
    }
  })

  return groups
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
  <div class="mx-auto max-w-[1100px] space-y-6 pb-10 font-geist lg:px-16 xl:px-24">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <section class="space-y-3">
        <div class="space-y-2">
          <h1 class="text-[28px] font-semibold text-noble-black">My Transactions</h1>
          <div class="w-10 h-0.5 bg-burning-orange"></div>
        </div>
        <p class="text-[16px] font-medium text-noble-black/50">
          Review your borrowing and lending history
        </p>
      </section>

      <NuxtLink
        to="/account/requests"
        class="inline-flex h-11 shrink-0 items-center gap-2 rounded-[12px] border-[1.5px] border-burning-orange px-6 text-[13px] font-bold text-burning-orange transition-all hover:bg-burning-orange/5"
      >
        View Requests
      </NuxtLink>
    </div>

    <!-- Search bar -->
    <div
      class="flex items-center gap-3 bg-white rounded-[12px] border-[1.5px] border-gray-200 h-12 px-5 mb-2 transition-all focus-within:border-burning-orange focus-within:shadow-[0_0_0_3px_rgba(232,101,10,0.05)]"
    >
      <Icon name="ph:magnifying-glass-light" class="w-5 h-5 text-gray-400 shrink-0" />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search transactions..."
        class="flex-1 bg-transparent outline-none text-noble-black text-[15px] font-medium placeholder:text-gray-400 min-w-0"
      />
      <!-- Clear Search Button -->
      <button
        v-if="searchQuery"
        class="text-gray-400 hover:text-noble-black transition-colors"
        title="Clear search"
        @click="searchQuery = ''"
      >
        <Icon name="ph:x-light" class="w-[18px] h-[18px]" />
      </button>
    </div>

    <!-- Tab bar -->
    <div class="flex items-center border-b border-cinnamon-ice/20 gap-8 px-2 mb-4">
      <button
        class="pb-4 text-[18px] font-semibold transition-all relative"
        :class="
          activeRole === 'BORROWER'
            ? 'text-burning-orange'
            : 'text-noble-black/40 hover:text-noble-black/60'
        "
        @click="setRole('BORROWER')"
      >
        Borrow History
        <div
          v-if="activeRole === 'BORROWER'"
          class="absolute bottom-0 left-0 right-0 h-0.5 bg-burning-orange rounded-full"
        ></div>
      </button>

      <button
        class="pb-4 text-[18px] font-semibold transition-all relative"
        :class="
          activeRole === 'LENDER'
            ? 'text-burning-orange'
            : 'text-noble-black/40 hover:text-noble-black/60'
        "
        @click="setRole('LENDER')"
      >
        Lend History
        <div
          v-if="activeRole === 'LENDER'"
          class="absolute bottom-0 left-0 right-0 h-0.5 bg-burning-orange rounded-full"
        ></div>
      </button>
    </div>

    <!-- Content panel -->
    <div
      class="bg-cream rounded-[24px] border border-cinnamon-ice/20 p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
    >
      <!-- Action & Filter Row -->
      <div class="flex items-center mb-8">
        <!-- Status filter chips -->
        <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            v-for="chip in statusChips"
            :key="chip.label"
            class="px-[14px] py-1.5 rounded-full text-[13px] font-bold transition-all duration-200 shrink-0 border-[1.5px]"
            :class="
              activeStatus === chip.value
                ? 'bg-burning-orange/[0.12] border-burning-orange/30 text-burning-orange'
                : 'bg-white border-gray-200 text-noble-black/40 hover:border-gray-300 hover:text-noble-black/60'
            "
            @click="setStatus(chip.value)"
          >
            {{ chip.label }}
          </button>
        </div>
      </div>

      <!-- Loading skeletons -->
      <template v-if="isInitialLoading">
        <div class="flex flex-col gap-4">
          <TransactionCardSkeleton />
          <BorrowerRequestCardSkeleton />
          <TransactionCardSkeleton />
        </div>
      </template>

      <!-- Error state -->
      <div
        v-else-if="hasInitialError"
        class="flex flex-col items-center justify-center py-12 sm:py-16 text-center"
      >
        <Icon
          name="ph:warning-circle-light"
          class="w-10 h-10 sm:w-12 sm:h-12 text-cinnamon-ice mb-4"
        />
        <p class="text-noble-black/50 text-base mb-6 font-medium">{{ combinedError }}</p>
        <button
          class="bg-burning-orange text-white rounded-[12px] px-8 py-2.5 text-[15px] font-bold hover:brightness-110 transition-all shadow-lg shadow-burning-orange/20"
          @click="refreshAll"
        >
          Retry
        </button>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="hasEmptyState"
        class="flex flex-col items-center justify-center py-16 sm:py-20 text-center"
      >
        <div
          class="w-20 h-20 bg-cinnamon-ice/10 rounded-full flex items-center justify-center mb-6 text-cinnamon-ice/40"
        >
          <Icon name="ph:files-light" class="w-10 h-10" />
        </div>
        <p class="text-noble-black text-[18px] font-bold mb-1">{{ emptyTitle }}</p>
        <p class="text-noble-black/40 text-[14px] font-medium max-w-xs">{{ emptySubtitle }}</p>
      </div>

      <!-- Transaction list (Grouped & Internal Scroll) -->
      <div v-else class="max-h-[600px] overflow-y-auto pr-4 -mr-4 custom-scrollbar space-y-10">
        <div v-for="group in groupedHistoryEntries" :key="group.title" class="space-y-5">
          <div class="flex items-center gap-4 px-2 sticky top-0 bg-cream z-20 py-2">
            <span
              class="text-[12px] font-bold text-noble-black/30 uppercase tracking-[0.2em] shrink-0"
            >
              {{ group.title }}
            </span>
            <div class="h-[1px] w-full bg-cinnamon-ice/10"></div>
          </div>

          <div class="flex flex-col gap-4">
            <template v-for="entry in group.entries" :key="`${entry.kind}-${entry.id}`">
              <BorrowerRequestCard v-if="entry.kind === 'request'" :request="entry.request" />
              <TransactionCard
                v-else
                :transaction="entry.transaction"
                :active-role="activeRole === 'LENDER' ? 'LENDER' : 'BORROWER'"
                @write-review="openReviewModal"
              />
            </template>
          </div>
        </div>
      </div>

      <!-- Load More -->
      <div
        v-if="hasMore || (isLoading && visibleTransactions.length > 0)"
        class="flex justify-center mt-8 sm:mt-10"
      >
        <button
          :disabled="isLoading"
          class="bg-white border-[1.5px] border-burning-orange text-burning-orange rounded-[12px] px-8 py-2.5 text-[15px] font-bold hover:bg-burning-orange/5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          @click="loadMore"
        >
          <span v-if="isLoading" class="flex items-center gap-2">
            <Icon name="ph:spinner-gap-light" class="animate-spin w-4 h-4" />
            Loading…
          </span>
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
