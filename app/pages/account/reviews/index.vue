<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import type { ReviewType } from "~~/shared/schemas/review"
import {
  useAccountReviews,
  type ReviewDraftListItem,
  type ReviewTransactionListItem,
} from "../../../composables/use-account-reviews"

definePageMeta({
  layout: "account",
  middleware: "account-auth",
})

type ReviewsTab = "PENDING" | "DRAFTS" | "HISTORY"

const activeTab = ref<ReviewsTab>("PENDING")
const searchQuery = ref("")
const user = useSupabaseUser()
const {
  transactionsData,
  draftsData,
  historyData,
  leaderboardData,
  transactionsPending,
  draftsPending,
  historyPending,
  leaderboardPending,
  transactionsError,
  draftsError,
  historyError,
  hasFreshTransactionsCache,
  hasFreshDraftsCache,
  hasFreshHistoryCache,
  hasFreshLeaderboardsCache,
  fetchReviewTransactions,
  fetchReviewDrafts,
  fetchSubmittedReviews,
  fetchSecondaryReviewsData,
  refreshReviewTransactions,
  refreshReviewDrafts,
  refreshSubmittedReviews,
  refreshReviewLeaderboards,
} = useAccountReviews()

if (import.meta.client && !hasFreshTransactionsCache.value) {
  void fetchReviewTransactions()
}

const allTransactions = computed(() => transactionsData.value ?? [])
const allDrafts = computed(() => draftsData.value ?? [])
const allHistory = computed(() => historyData.value ?? [])
const borrowerLeaderboard = computed(() => leaderboardData.value?.borrowers ?? [])
const lenderLeaderboard = computed(() => leaderboardData.value?.lenders ?? [])

const currentTabPending = computed(() => {
  if (activeTab.value === "DRAFTS") {
    return draftsPending.value && draftsData.value === null
  }

  if (activeTab.value === "HISTORY") {
    return historyPending.value && historyData.value === null
  }

  return transactionsPending.value && transactionsData.value === null
})

const currentTabErrorMessage = computed(() => {
  if (activeTab.value === "DRAFTS" && draftsError.value) {
    return "We couldn't load your saved drafts right now. Please try again."
  }

  if (activeTab.value === "HISTORY" && historyError.value) {
    return "We couldn't load your posted reviews right now. Please try again."
  }

  if (activeTab.value === "PENDING" && transactionsError.value) {
    return "We couldn't load your reviews right now. Please try again."
  }

  return ""
})

const pendingTransactions = computed(() =>
  allTransactions.value.filter((transaction) => transaction.reviewState.canSubmitAny),
)

const pendingReviewCount = computed(() =>
  pendingTransactions.value.reduce(
    (total, transaction) =>
      total + transaction.reviewState.actions.filter((action) => action.canSubmit).length,
    0,
  ),
)

const tabOptions: Array<{ label: string; value: ReviewsTab }> = [
  { label: "Pending", value: "PENDING" },
  { label: "Draft", value: "DRAFTS" },
  { label: "History", value: "HISTORY" },
]

const matchesSearch = (values: Array<string | null | undefined>) => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return true

  return values.some((value) => value?.toLowerCase().includes(query))
}

const filteredPendingTransactions = computed(() =>
  pendingTransactions.value.filter((transaction) =>
    matchesSearch([
      transaction.item.name,
      transaction.id,
      transaction.borrower.user.firstName,
      transaction.borrower.user.lastName,
      transaction.lender.user.firstName,
      transaction.lender.user.lastName,
      ...transaction.reviewState.actions
        .filter((action) => action.canSubmit)
        .map((action) => action.label),
    ]),
  ),
)

const filteredDrafts = computed(() =>
  allDrafts.value.filter((draft) =>
    matchesSearch([
      draft.item?.name,
      draft.transactionReference,
      draft.counterpartName,
      draft.reviewText,
      draft.typeLabel,
    ]),
  ),
)

const filteredHistory = computed(() =>
  allHistory.value.filter((review) =>
    matchesSearch([
      review.item?.name,
      review.transactionReference,
      review.counterpartName,
      review.revieweeName,
      review.reviewText,
      review.typeLabel,
    ]),
  ),
)

const sectionTitle = computed(() => {
  if (activeTab.value === "DRAFTS") return "Draft Reviews"
  if (activeTab.value === "HISTORY") return "Posted Reviews"
  return "Transactions to Review"
})

const sectionSubtitle = computed(() => {
  if (activeTab.value === "DRAFTS") {
    return "Saved reviews you can continue and submit when you're ready."
  }

  if (activeTab.value === "HISTORY") {
    return "A record of feedback you've already submitted."
  }

  return "Completed transactions that still need one or more reviews from you."
})

const formatShortDate = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

const computeDuration = (startDate: Date | string, endDate: Date | string) => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const totalDays = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  )

  return totalDays === 1 ? "1 day rental" : `${totalDays} days rental`
}

const formatRoleLabel = (role: string | null) => (role === "LENDER" ? "Lender" : "Borrower")

const formatReviewCount = (value: number) => `${value} ${value === 1 ? "review" : "reviews"}`

const getCurrentUserRoleForTransaction = (
  transaction: ReviewTransactionListItem,
): "BORROWER" | "LENDER" => {
  if (user.value?.id && transaction.lenderId === user.value.id) {
    return "LENDER"
  }

  return "BORROWER"
}

const getCounterpartNameForTransaction = (transaction: ReviewTransactionListItem) => {
  const currentUserRole = getCurrentUserRoleForTransaction(transaction)
  const counterpart =
    currentUserRole === "BORROWER" ? transaction.lender.user : transaction.borrower.user

  return `${counterpart.firstName} ${counterpart.lastName[0]}.`
}

const isReviewModalOpen = ref(false)
const selectedTransactionForReview = ref<ReviewTransactionListItem | null>(null)
const selectedReviewType = ref<ReviewType | null>(null)
const pageActionError = ref("")
const showRewardPopup = ref(false)
const rewardPopupPoints = ref(0)
let rewardPopupTimeout: ReturnType<typeof setTimeout> | null = null
const REVIEW_REWARD_POPUP_STORAGE_KEY = "takeup:review-reward-popup"

type SubmittedReviewPayload = {
  transactionId: string
  reviewType: ReviewType
  currentUserRole: "BORROWER" | "LENDER"
  itemId: string | null
}

const reviewContext = computed(() => {
  if (!selectedTransactionForReview.value) return null

  const currentUserRole = getCurrentUserRoleForTransaction(selectedTransactionForReview.value)
  const counterpart =
    currentUserRole === "BORROWER"
      ? selectedTransactionForReview.value.lender.user
      : selectedTransactionForReview.value.borrower.user

  return {
    transactionId: selectedTransactionForReview.value.id,
    reviewType: selectedReviewType.value,
    currentUserRole,
    itemName: selectedTransactionForReview.value.item.name,
    counterpartName: `${counterpart.firstName} ${counterpart.lastName[0]}.`,
    itemId: selectedTransactionForReview.value.item.id,
    targetUserId:
      selectedReviewType.value === "ITEM_REVIEW"
        ? null
        : currentUserRole === "BORROWER"
          ? selectedTransactionForReview.value.lenderId
          : selectedTransactionForReview.value.borrowerId,
  }
})

const openReviewModal = (transaction: ReviewTransactionListItem, reviewType: ReviewType) => {
  pageActionError.value = ""
  selectedTransactionForReview.value = transaction
  selectedReviewType.value = reviewType
  isReviewModalOpen.value = true
}

const continueDraft = (draft: ReviewDraftListItem) => {
  const transaction = allTransactions.value.find((entry) => entry.id === draft.transactionId)

  if (!transaction) {
    pageActionError.value =
      "We couldn't reopen this draft because the related transaction details are unavailable."
    return
  }

  openReviewModal(transaction, draft.reviewType)
}

const closeReviewModal = () => {
  isReviewModalOpen.value = false
  selectedTransactionForReview.value = null
  selectedReviewType.value = null
}

const triggerRewardPopup = (points: number = 5) => {
  if (rewardPopupTimeout) {
    clearTimeout(rewardPopupTimeout)
  }

  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(REVIEW_REWARD_POPUP_STORAGE_KEY, "1")
  }

  rewardPopupPoints.value = points
  showRewardPopup.value = true
  rewardPopupTimeout = setTimeout(() => {
    showRewardPopup.value = false
    rewardPopupPoints.value = 0
    rewardPopupTimeout = null
  }, 1800)
}

const calculateEarnedRewardPoints = (payload: SubmittedReviewPayload): number => {
  const actions = selectedTransactionForReview.value?.reviewState.actions ?? []
  const requiredTypes: ReviewType[] = ["LENDER_REVIEW"]

  if (payload.itemId) {
    requiredTypes.push("ITEM_REVIEW")
  }

  const allRequiredComplete = requiredTypes.every((reviewType) => {
    if (reviewType === payload.reviewType) {
      return true
    }

    return actions.find((action) => action.reviewType === reviewType)?.hasSubmitted ?? false
  })

  if (!allRequiredComplete) {
    return 0
  }

  if (payload.currentUserRole === "LENDER" && payload.reviewType === "BORROWER_REVIEW") {
    return 10
  }

  return 5
}

const handleReviewSubmitted = async (payload: SubmittedReviewPayload) => {
  const earnedPoints = calculateEarnedRewardPoints(payload)
  if (earnedPoints > 0) {
    triggerRewardPopup(earnedPoints)
  }
  await Promise.all([
    refreshReviewTransactions(),
    refreshReviewDrafts(),
    refreshSubmittedReviews(),
    refreshReviewLeaderboards(),
  ])
}

const refreshCurrentTab = async () => {
  if (activeTab.value === "DRAFTS") {
    await refreshReviewDrafts()
    return
  }

  if (activeTab.value === "HISTORY") {
    await refreshSubmittedReviews()
    return
  }

  await refreshReviewTransactions()
}

watch(activeTab, async () => {
  if (activeTab.value === "DRAFTS" && !hasFreshDraftsCache.value) {
    await fetchReviewDrafts()
    return
  }

  if (activeTab.value === "HISTORY" && !hasFreshHistoryCache.value) {
    await fetchSubmittedReviews()
    return
  }

  if (activeTab.value === "PENDING" && !hasFreshTransactionsCache.value) {
    await fetchReviewTransactions()
  }
})

onMounted(() => {
  if (!hasFreshTransactionsCache.value) {
    void fetchReviewTransactions()
  }

  if (
    !hasFreshDraftsCache.value ||
    !hasFreshHistoryCache.value ||
    !hasFreshLeaderboardsCache.value
  ) {
    void fetchSecondaryReviewsData()
  }
})

onBeforeUnmount(() => {
  if (rewardPopupTimeout) {
    clearTimeout(rewardPopupTimeout)
  }
})
</script>

<template>
  <MyReviewsSkeleton
    v-if="currentTabPending && !allTransactions.length && !allDrafts.length && !allHistory.length"
  />

  <div v-else class="mx-auto max-w-[1180px] font-geist pb-20 lg:px-16 xl:px-24 text-noble-black">
    <header class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between mb-8">
      <section class="space-y-3">
        <div class="space-y-2">
          <h1 class="font-montravia text-[36px] font-medium text-noble-black leading-tight">
            My Reviews
          </h1>
          <div class="w-10 h-0.5 bg-burning-orange"></div>
        </div>
        <p class="text-[16px] font-light text-noble-black/50">
          Keep track of what you still need to review, save drafts, and manage your review history.
        </p>
      </section>
    </header>

    <!-- Stats Strip -->
    <div class="flex flex-wrap items-center gap-3 mb-10">
      <div
        class="flex items-center gap-2 px-3.5 py-1 rounded-full bg-burning-orange/[0.05] border border-burning-orange/10 text-[13px] font-semibold text-burning-orange"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-burning-orange"></span>
        {{ pendingReviewCount }} Pending
      </div>
      <div
        class="flex items-center gap-2 px-3.5 py-1 rounded-full bg-noble-black/5 border border-noble-black/5 text-[13px] font-semibold text-noble-black/40"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-noble-black/20"></span>
        {{ allDrafts.length }} Drafts
      </div>
      <div
        class="flex items-center gap-2 px-3.5 py-1 rounded-full bg-success-green/[0.05] border border-success-green/10 text-[13px] font-semibold text-success-green"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-success-green"></span>
        {{ allHistory.length }} Posted
      </div>
    </div>

    <!-- Tabs & Search Row -->
    <div
      class="flex flex-col sm:flex-row sm:items-end justify-between border-b border-cinnamon-ice/15 mb-12 gap-4"
    >
      <nav class="flex gap-8">
        <button
          v-for="tab in tabOptions"
          :key="tab.value"
          type="button"
          class="relative pb-4 text-[14px] font-bold transition-all"
          :class="
            activeTab === tab.value
              ? 'text-burning-orange'
              : 'text-noble-black/40 hover:text-noble-black/60'
          "
          @click="activeTab = tab.value"
        >
          <div class="flex items-center gap-2">
            {{ tab.label }}
            <span
              v-if="tab.value === 'PENDING' && pendingReviewCount > 0"
              class="px-1.5 py-0.5 rounded-full bg-burning-orange text-white text-[10px] font-bold leading-none"
            >
              {{ pendingReviewCount }}
            </span>
          </div>
          <div
            v-if="activeTab === tab.value"
            class="absolute bottom-0 left-0 right-0 h-[2px] bg-burning-orange rounded-full"
          ></div>
        </button>
      </nav>

      <div class="relative w-full sm:max-w-[280px] mb-4 z-20">
        <div
          class="flex h-9 items-center gap-2 bg-white border border-cinnamon-ice/20 rounded-[10px] px-2.5 transition-all focus-within:border-burning-orange/40 focus-within:ring-4 focus-within:ring-burning-orange/5 shadow-sm"
        >
          <button
            v-if="searchQuery"
            type="button"
            class="flex h-7 w-7 items-center justify-center -ml-1 text-noble-black/30 hover:text-burning-orange transition-colors"
            title="Clear search"
            @click="searchQuery = ''"
          >
            <Icon name="ph:x" class="w-4 h-4" />
          </button>
          <Icon
            v-else
            name="ph:magnifying-glass"
            class="shrink-0 text-noble-black/30 w-4 h-4 ml-1"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by item or person..."
            class="flex-1 bg-transparent text-[13px] text-noble-black outline-none placeholder:text-noble-black/30 min-w-0"
          />
        </div>
      </div>
    </div>

    <div class="grid gap-8 lg:grid-cols-[1fr_340px]">
      <!-- Main Content -->
      <div class="space-y-6">
        <!-- Content Panel -->
        <div
          class="bg-cream rounded-[24px] border border-cinnamon-ice/20 p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
        >
          <div class="border-l-[3px] border-burning-orange pl-4 mb-6">
            <h2 class="text-[20px] font-bold text-noble-black">{{ sectionTitle }}</h2>
            <p class="text-[13px] font-medium text-noble-black/50">{{ sectionSubtitle }}</p>
          </div>

          <p
            v-if="pageActionError"
            class="rounded-xl border border-cinnabar-red/20 bg-cinnabar-red/5 px-4 py-3 text-[13px] font-medium text-cinnabar-red mb-4"
          >
            {{ pageActionError }}
          </p>

          <div v-if="currentTabPending" class="mt-6 space-y-6">
            <AdminListRecordSkeleton v-for="i in 3" :key="i" />
          </div>

          <div
            v-else-if="currentTabErrorMessage"
            class="mt-6 rounded-[14px] border border-cinnabar-red/20 bg-cinnabar-red/5 p-5"
          >
            <div class="flex items-center justify-between">
              <p class="text-[13px] font-medium text-cinnabar-red">{{ currentTabErrorMessage }}</p>
              <button
                type="button"
                class="text-[13px] font-bold text-cinnabar-red hover:underline"
                @click="refreshCurrentTab()"
              >
                Retry
              </button>
            </div>
          </div>

          <!-- Internal Scrollable List -->
          <div v-else class="max-h-[600px] overflow-y-auto pr-4 -mr-4 custom-scrollbar space-y-4">
            <div v-if="activeTab === 'PENDING'">
              <div v-if="filteredPendingTransactions.length === 0" class="py-16 text-center">
                <p class="text-[14px] font-medium text-noble-black/30">
                  No reviews pending at the moment.
                </p>
              </div>
              <article
                v-for="transaction in filteredPendingTransactions"
                :key="transaction.id"
                class="block bg-white rounded-[16px] border border-cinnamon-ice/20 overflow-hidden font-geist shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] transition-all duration-200 mb-4 last:mb-0"
              >
                <!-- Top Zone: Counterparty & Badge -->
                <div
                  class="flex items-center justify-between px-5 py-3 border-b border-cinnamon-ice/10 bg-white"
                >
                  <span class="text-noble-black text-[14px] font-semibold">
                    {{ getCounterpartNameForTransaction(transaction) }}
                  </span>
                  <span
                    class="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold text-burning-orange bg-burning-orange/[0.06]"
                  >
                    NEEDS ACTION
                  </span>
                </div>

                <!-- Bottom Zone: Content Row -->
                <div class="p-5 flex items-center gap-4">
                  <!-- Thumbnail -->
                  <div class="shrink-0">
                    <img
                      v-if="transaction.item.thumbnailImage"
                      :src="transaction.item.thumbnailImage"
                      class="w-14 h-14 rounded-[10px] object-cover border border-noble-black/5"
                    />
                    <div
                      v-else
                      class="w-14 h-14 rounded-[10px] bg-noble-black/5 flex items-center justify-center text-noble-black/20"
                    >
                      <Icon name="ph:package" class="w-5 h-5" />
                    </div>
                  </div>

                  <!-- Center Content Block -->
                  <div class="flex-1 min-w-0 max-w-[200px]">
                    <h4 class="text-[14px] font-semibold text-noble-black truncate mb-0.5">
                      {{ transaction.item.name }}
                    </h4>
                    <div class="text-[13px] text-noble-black/40 font-medium truncate">
                      {{ formatShortDate(transaction.endDate) }} ·
                      {{ computeDuration(transaction.startDate, transaction.endDate) }}
                    </div>
                  </div>

                  <!-- Action Button -->
                  <div class="shrink-0 ml-auto flex flex-col gap-[6px]">
                    <button
                      v-for="action in transaction.reviewState.actions.filter(
                        (entry) => entry.canSubmit,
                      )"
                      :key="`${transaction.id}-${action.reviewType}`"
                      type="button"
                      class="h-8 px-3 rounded-[8px] bg-burning-orange text-white text-[12px] font-semibold transition-all hover:brightness-110 active:scale-95 shadow-sm shadow-burning-orange/20"
                      @click="openReviewModal(transaction, action.reviewType)"
                    >
                      {{ action.label }}
                    </button>
                  </div>
                </div>
              </article>
            </div>

            <div v-else-if="activeTab === 'DRAFTS'">
              <div v-if="filteredDrafts.length === 0" class="py-16 text-center">
                <p class="text-[14px] font-medium text-noble-black/30">No drafts saved.</p>
              </div>
              <article
                v-for="draft in filteredDrafts"
                :key="draft.id"
                class="block bg-white rounded-[16px] border border-cinnamon-ice/20 p-5 shadow-sm hover:shadow-md transition-all duration-200 mb-4 last:mb-0"
              >
                <div class="flex items-start gap-4">
                  <img
                    v-if="draft.item?.thumbnailImage"
                    :src="draft.item.thumbnailImage"
                    class="w-14 h-14 rounded-[10px] object-cover border border-noble-black/5"
                  />
                  <div
                    v-else
                    class="w-14 h-14 rounded-[10px] bg-noble-black/5 flex items-center justify-center text-noble-black/20"
                  >
                    <Icon name="ph:package" class="w-6 h-6" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <h4 class="text-[15px] font-bold text-noble-black truncate">
                        {{ draft.item?.name ?? "Item unavailable" }}
                      </h4>
                      <span
                        class="px-2 py-0.5 rounded-full bg-blue-estate/[0.08] text-blue-estate text-[10px] font-bold uppercase tracking-wider border border-blue-estate/20"
                        >{{ draft.typeLabel }}</span
                      >
                    </div>
                    <p class="text-[12px] text-noble-black/40 mb-3 uppercase tracking-widest">
                      {{ formatRoleLabel(draft.role) }} · with {{ draft.counterpartName }}
                    </p>
                    <p
                      class="text-[13px] leading-relaxed text-noble-black/70 italic line-clamp-1 mb-3"
                    >
                      "{{ draft.reviewText || "No text yet..." }}"
                    </p>
                    <button
                      type="button"
                      class="h-8 px-4 rounded-full border-[1.5px] border-burning-orange text-burning-orange text-[12px] font-bold transition-all hover:bg-burning-orange/5 active:scale-95"
                      @click="continueDraft(draft)"
                    >
                      Continue Draft
                    </button>
                  </div>
                </div>
              </article>
            </div>

            <div v-else>
              <div v-if="filteredHistory.length === 0" class="py-16 text-center">
                <p class="text-[14px] font-medium text-noble-black/30">No history available yet.</p>
              </div>
              <article
                v-for="review in filteredHistory"
                :key="review.id"
                class="block bg-white rounded-[16px] border border-cinnamon-ice/20 p-5 shadow-sm hover:shadow-md transition-all duration-200 mb-4 last:mb-0"
              >
                <div class="flex items-start gap-4">
                  <img
                    v-if="review.item?.thumbnailImage"
                    :src="review.item.thumbnailImage"
                    class="w-12 h-12 rounded-[8px] object-cover border border-noble-black/5"
                  />
                  <div
                    v-else
                    class="w-12 h-12 rounded-[8px] bg-noble-black/5 flex items-center justify-center text-noble-black/20"
                  >
                    <Icon name="ph:package" class="w-5 h-5" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2 mb-1">
                      <h4 class="text-[15px] font-bold text-noble-black truncate">
                        {{ review.item?.name ?? review.revieweeName }}
                      </h4>
                      <div class="flex items-center gap-0.5 text-burning-orange">
                        <Icon
                          v-for="star in 5"
                          :key="star"
                          name="ph:star-fill"
                          class="h-3.5 w-3.5 -translate-y-[0.5px]"
                          :class="star <= review.rating ? 'opacity-100' : 'opacity-20'"
                        />
                      </div>
                    </div>
                    <p class="text-[12px] text-noble-black/40 mb-3 uppercase tracking-widest">
                      {{ formatRoleLabel(review.role) }} · with {{ review.counterpartName }} ·
                      {{ formatShortDate(review.createdAt) }}
                    </p>
                    <p
                      class="text-[13px] leading-relaxed text-noble-black/70 italic border-l-2 border-cinnamon-ice/30 pl-3"
                    >
                      "{{ review.reviewText }}"
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <aside class="space-y-6 lg:sticky lg:top-24 self-start">
        <!-- Checklist Card -->
        <article class="rounded-[16px] border border-cinnamon-ice/30 bg-white p-5 shadow-sm">
          <div class="flex items-center gap-2 text-noble-black/80 mb-5">
            <Icon name="ph:check-square-offset" class="w-[18px] h-[18px] text-burning-orange" />
            <h2 class="text-[14px] font-bold">Your checklist</h2>
          </div>
          <div class="space-y-3.5">
            <div
              v-for="item in [
                'Quick reminders before you post.',
                'Mention communication and timing.',
                'Describe condition accurately.',
                'Avoid private info or insults.',
              ]"
              :key="item"
              class="flex items-start gap-3"
            >
              <div
                class="w-4 h-4 rounded-full bg-success-green flex items-center justify-center text-white shrink-0 mt-0.5"
              >
                <Icon name="ph:check" class="w-2.5 h-2.5" />
              </div>
              <p class="text-[13px] font-medium text-noble-black/50 leading-tight">{{ item }}</p>
            </div>
          </div>
        </article>

        <!-- Tip Box -->
        <div
          class="rounded-[12px] border border-blue-estate/20 bg-blue-estate/[0.04] p-4 flex gap-3"
        >
          <Icon name="ph:lightbulb" class="text-blue-estate shrink-0 mt-0.5 w-[18px] h-[18px]" />
          <p class="text-[13px] leading-relaxed text-noble-black/60">
            <span class="text-[12px] font-black uppercase text-blue-estate mr-1">Tip</span>
            Save a draft if you’re busy, then come back when you’re ready to submit.
          </p>
        </div>
      </aside>
    </div>

    <!-- Leaderboards -->
    <section class="mt-16 pt-12 border-t border-cinnamon-ice/20 space-y-8">
      <div class="border-l-[3px] border-burning-orange pl-4">
        <h2 class="text-[20px] font-bold text-noble-black">Community Leaderboards</h2>
        <p class="text-[13px] font-medium text-noble-black/40">
          Top community members ranked by their engagement and quality reviews.
        </p>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Borrowers Leaderboard -->
        <article class="rounded-[20px] border border-cinnamon-ice/30 bg-white p-6 shadow-sm">
          <h3 class="text-[15px] font-bold mb-6 text-noble-black">Top Borrowers</h3>

          <div v-if="leaderboardPending && !leaderboardData" class="space-y-4">
            <div
              v-for="i in 5"
              :key="i"
              class="h-14 animate-pulse rounded-xl bg-noble-black/[0.02]"
            />
          </div>
          <div v-else class="space-y-0.5">
            <div
              v-for="entry in borrowerLeaderboard"
              :key="entry.user.id"
              class="relative flex items-center gap-4 py-3.5 px-3 -mx-3 transition-all rounded-[14px]"
              :class="[
                entry.user.id === user?.id
                  ? 'bg-burning-orange/[0.04] border border-burning-orange/20 ring-1 ring-burning-orange/5'
                  : 'border-b border-noble-black/[0.03] last:border-0',
                entry.rank === 1 ? 'bg-gradient-to-r from-amber-50/40 to-transparent' : '',
                entry.rank === 2 ? 'bg-noble-black/[0.01]' : '',
                entry.rank === 3 ? 'bg-orange-50/10' : '',
              ]"
            >
              <span
                class="w-8 text-[22px] font-black leading-none"
                :class="
                  entry.rank === 1
                    ? 'text-amber-200'
                    : entry.rank === 2
                      ? 'text-noble-black/10'
                      : entry.rank === 3
                        ? 'text-orange-200'
                        : 'text-noble-black/5'
                "
                >#{{ entry.rank }}</span
              >
              <UserAvatar
                :avatar-url="entry.user.avatarUrl"
                :user-name="entry.user.name"
                size="sm"
              />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <p class="text-[14px] font-bold text-noble-black truncate">
                    {{ entry.user.name }}
                  </p>
                  <span
                    v-if="entry.user.id === user?.id"
                    class="px-1.5 py-0.5 rounded bg-burning-orange text-white text-[9px] font-black uppercase tracking-tighter"
                    >You</span
                  >
                </div>
                <p class="text-[11px] font-medium text-noble-black/30 uppercase tracking-widest">
                  {{ formatReviewCount(entry.reviewCount) }}
                </p>
              </div>
              <div class="flex items-center gap-1 font-bold text-[14px]">
                <span class="text-burning-orange leading-none">{{
                  entry.averageRating.toFixed(1)
                }}</span>
                <Icon
                  name="ph:star-fill"
                  :class="entry.rank === 1 ? 'text-amber-400' : 'text-burning-orange/40'"
                  class="w-3 h-3 -translate-y-[0.5px]"
                />
              </div>
            </div>
            <!-- Ghost Rows -->
            <template v-if="borrowerLeaderboard.length < 5">
              <div
                v-for="i in 5 - borrowerLeaderboard.length"
                :key="`ghost-borrower-${i}`"
                class="flex items-center gap-4 py-3.5 px-3 -mx-3 opacity-[0.35]"
              >
                <div class="w-8 h-5 bg-noble-black/10 rounded-md"></div>
                <div class="w-9 h-9 rounded-full bg-noble-black/10"></div>
                <div class="flex-1 space-y-2">
                  <div class="w-20 h-2.5 bg-noble-black/10 rounded-full"></div>
                  <div class="w-12 h-1.5 bg-noble-black/10 rounded-full"></div>
                </div>
                <div class="text-[14px] font-bold text-noble-black/10">--</div>
              </div>
            </template>
          </div>
        </article>

        <!-- Lenders Leaderboard -->
        <article class="rounded-[20px] border border-cinnamon-ice/30 bg-white p-6 shadow-sm">
          <h3 class="text-[15px] font-bold mb-6 text-noble-black">Top Lenders</h3>

          <div v-if="leaderboardPending && !leaderboardData" class="space-y-4">
            <div
              v-for="i in 5"
              :key="i"
              class="h-14 animate-pulse rounded-xl bg-noble-black/[0.02]"
            />
          </div>
          <div v-else class="space-y-0.5">
            <div
              v-for="entry in lenderLeaderboard"
              :key="entry.user.id"
              class="relative flex items-center gap-4 py-3.5 px-3 -mx-3 transition-all rounded-[14px]"
              :class="[
                entry.user.id === user?.id
                  ? 'bg-burning-orange/[0.04] border border-burning-orange/20 ring-1 ring-burning-orange/5'
                  : 'border-b border-noble-black/[0.03] last:border-0',
                entry.rank === 1 ? 'bg-gradient-to-r from-amber-50/40 to-transparent' : '',
                entry.rank === 2 ? 'bg-noble-black/[0.01]' : '',
                entry.rank === 3 ? 'bg-orange-50/10' : '',
              ]"
            >
              <span
                class="w-8 text-[22px] font-black leading-none"
                :class="
                  entry.rank === 1
                    ? 'text-amber-200'
                    : entry.rank === 2
                      ? 'text-noble-black/10'
                      : entry.rank === 3
                        ? 'text-orange-200'
                        : 'text-noble-black/5'
                "
                >#{{ entry.rank }}</span
              >
              <UserAvatar
                :avatar-url="entry.user.avatarUrl"
                :user-name="entry.user.name"
                size="sm"
              />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <p class="text-[14px] font-bold text-noble-black truncate">
                    {{ entry.user.name }}
                  </p>
                  <span
                    v-if="entry.user.id === user?.id"
                    class="px-1.5 py-0.5 rounded bg-burning-orange text-white text-[9px] font-black uppercase tracking-tighter"
                    >You</span
                  >
                </div>
                <p class="text-[11px] font-medium text-noble-black/30 uppercase tracking-widest">
                  {{ formatReviewCount(entry.reviewCount) }}
                </p>
              </div>
              <div class="flex items-center gap-1 font-bold text-[14px]">
                <span class="text-burning-orange leading-none">{{
                  entry.averageRating.toFixed(1)
                }}</span>
                <Icon
                  name="ph:star-fill"
                  :class="entry.rank === 1 ? 'text-amber-400' : 'text-burning-orange/40'"
                  class="w-3 h-3 -translate-y-[0.5px]"
                />
              </div>
            </div>
            <!-- Ghost Rows -->
            <template v-if="lenderLeaderboard.length < 5">
              <div
                v-for="i in 5 - lenderLeaderboard.length"
                :key="`ghost-lender-${i}`"
                class="flex items-center gap-4 py-3.5 px-3 -mx-3 opacity-[0.35]"
              >
                <div class="w-8 h-5 bg-noble-black/10 rounded-md"></div>
                <div class="w-9 h-9 rounded-full bg-noble-black/10"></div>
                <div class="flex-1 space-y-2">
                  <div class="w-20 h-2.5 bg-noble-black/10 rounded-full"></div>
                  <div class="w-12 h-1.5 bg-noble-black/10 rounded-full"></div>
                </div>
                <div class="text-[14px] font-bold text-noble-black/10">--</div>
              </div>
            </template>
          </div>
        </article>
      </div>
    </section>

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
          <p class="text-3xl font-black tracking-tight">+{{ rewardPopupPoints }} points</p>
          <p class="text-sm font-medium text-white/90">Review bonus earned</p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: theme("colors.noble-black / 10%");
  border-radius: 20px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: theme("colors.noble-black / 20%");
}
</style>
