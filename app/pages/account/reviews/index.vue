<script setup lang="ts">
import { computed, ref, watch } from "vue"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "~~/server/trpc/routers"
import type { ReviewType } from "~~/shared/schemas/review"
import type { TransactionListItem } from "~/composables/use-transactions"
import { normalizeReviewImageUrl } from "~/utils/review-image"

definePageMeta({
  layout: "account",
  middleware: "account-auth",
})

type RouterOutputs = inferRouterOutputs<AppRouter>
type ReviewDraftListItem = RouterOutputs["transaction"]["listReviewDrafts"][number]
type SubmittedReviewListItem = RouterOutputs["transaction"]["listSubmittedReviews"][number]
type ReviewLeaderboardEntry = RouterOutputs["review"]["borrowerLeaderboard"]["leaderboard"][number]
type ReviewsTab = "PENDING" | "DRAFTS" | "HISTORY"

const activeTab = ref<ReviewsTab>("PENDING")
const searchQuery = ref("")
const user = useSupabaseUser()
const runtimeConfig = useRuntimeConfig()
const reviewImageBucket = runtimeConfig.public.itemImageBucket
const supabaseUrl = runtimeConfig.public.supabase.url

const {
  data: transactionsData,
  pending: transactionsPending,
  error: transactionsError,
  refresh: refreshTransactions,
} = await useAsyncData("account-my-review-transactions", async () => {
  const transactionResponse = await $fetch<RouterOutputs["transaction"]["list"]>(
    "/api/transactions",
    {
      query: {
        status: "COMPLETED",
        limit: 100,
      },
    },
  )

  return transactionResponse.transactions
})

const {
  data: draftsData,
  pending: draftsPending,
  error: draftsError,
  refresh: refreshDrafts,
} = await useAsyncData("account-my-review-drafts", async () => {
  return await $fetch<ReviewDraftListItem[]>("/api/my-reviews/drafts")
})

const {
  data: historyData,
  pending: historyPending,
  error: historyError,
  refresh: refreshHistory,
} = await useAsyncData("account-my-review-history", async () => {
  return await $fetch<SubmittedReviewListItem[]>("/api/my-reviews/submitted")
})

const {
  data: leaderboardData,
  pending: leaderboardPending,
  error: leaderboardError,
  refresh: refreshLeaderboard,
} = await useAsyncData("account-review-leaderboards", async () => {
  const [borrowersResponse, lendersResponse] = await Promise.all([
    $fetch<{ leaderboard: ReviewLeaderboardEntry[] }>("/api/reviews/leaderboard/borrowers"),
    $fetch<{ leaderboard: ReviewLeaderboardEntry[] }>("/api/reviews/leaderboard/lenders"),
  ])

  return {
    borrowers: borrowersResponse.leaderboard,
    lenders: lendersResponse.leaderboard,
  }
})

const allTransactions = computed(() => transactionsData.value ?? [])
const allDrafts = computed(() => draftsData.value ?? [])
const allHistory = computed(() => historyData.value ?? [])
const borrowerLeaderboard = computed(() => leaderboardData.value?.borrowers ?? [])
const lenderLeaderboard = computed(() => leaderboardData.value?.lenders ?? [])

const currentTabPending = computed(() => {
  if (activeTab.value === "DRAFTS") return draftsPending.value
  if (activeTab.value === "HISTORY") return historyPending.value
  return transactionsPending.value
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
  transaction: TransactionListItem,
): "BORROWER" | "LENDER" => {
  if (user.value?.id && transaction.lenderId === user.value.id) {
    return "LENDER"
  }

  return "BORROWER"
}

const getCounterpartNameForTransaction = (transaction: TransactionListItem) => {
  const currentUserRole = getCurrentUserRoleForTransaction(transaction)
  const counterpart =
    currentUserRole === "BORROWER" ? transaction.lender.user : transaction.borrower.user

  return `${counterpart.firstName} ${counterpart.lastName[0]}.`
}

const getReviewImageUrl = (image: string) =>
  normalizeReviewImageUrl(image, {
    supabaseUrl,
    bucket: reviewImageBucket,
  })

const isReviewModalOpen = ref(false)
const selectedTransactionForReview = ref<TransactionListItem | null>(null)
const selectedReviewType = ref<ReviewType | null>(null)
const pageActionError = ref("")

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

const openReviewModal = (transaction: TransactionListItem, reviewType: ReviewType) => {
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

const handleReviewSubmitted = async () => {
  await Promise.all([
    refreshTransactions(),
    refreshDrafts(),
    refreshHistory(),
    refreshLeaderboard(),
  ])
}

const refreshCurrentTab = async () => {
  if (activeTab.value === "DRAFTS") {
    await refreshDrafts()
    return
  }

  if (activeTab.value === "HISTORY") {
    await refreshHistory()
    return
  }

  await refreshTransactions()
}

watch(activeTab, async () => {
  await refreshCurrentTab()
})
</script>

<template>
  <div class="space-y-6 font-geist">
    <NuxtLink
      to="/account/transactions"
      class="inline-flex items-center gap-2 text-sm font-medium tracking-wide text-noble-black/80 transition-colors hover:text-burning-orange"
    >
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          d="M15 18l-6-6 6-6"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      Back to My Transactions
    </NuxtLink>

    <section class="rounded-[20px] border border-cinnamon-ice bg-cream px-5 py-6 sm:px-8 sm:py-8">
      <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div class="max-w-3xl">
          <h1 class="text-2xl font-bold text-noble-black sm:text-[32px]">My Reviews</h1>
          <p class="mt-3 text-base leading-7 text-noble-black/80 sm:text-lg">
            Keep track of what you still need to review, save drafts, and manage your review
            history.
          </p>
        </div>

        <div class="flex flex-wrap gap-3 lg:justify-end">
          <div
            class="rounded-2xl bg-white px-4 py-2.5 text-sm font-medium text-noble-black shadow-sm"
          >
            {{ pendingReviewCount }} pending
          </div>
          <div
            class="rounded-2xl bg-white px-4 py-2.5 text-sm font-medium text-noble-black shadow-sm"
          >
            {{ allDrafts.length }} drafts
          </div>
          <div
            class="rounded-2xl bg-white px-4 py-2.5 text-sm font-medium text-noble-black shadow-sm"
          >
            {{ allHistory.length }} posted
          </div>
        </div>
      </div>
    </section>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
      <div class="space-y-6">
        <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_374px]">
          <div class="grid grid-cols-3 rounded-[20px] border border-cinnamon-ice bg-cream p-2">
            <button
              v-for="tab in tabOptions"
              :key="tab.value"
              type="button"
              class="rounded-2xl px-3 py-3 text-sm font-bold transition-colors sm:text-lg"
              :class="
                activeTab === tab.value
                  ? 'bg-burning-orange text-white'
                  : 'text-noble-black hover:bg-white/80'
              "
              @click="activeTab = tab.value"
            >
              {{ tab.label }}
            </button>
          </div>

          <label
            class="flex items-center gap-3 rounded-[20px] border border-cinnamon-ice bg-white px-4 py-3"
          >
            <svg
              class="h-5 w-5 text-noble-black/50"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <circle cx="11" cy="11" r="7" stroke-width="1.8" />
              <path d="m20 20-3.5-3.5" stroke-width="1.8" stroke-linecap="round" />
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by item or person..."
              class="w-full bg-transparent text-base text-noble-black outline-none placeholder:text-noble-black/45"
            />
          </label>
        </div>

        <section class="rounded-[20px] border border-cinnamon-ice bg-cream p-5 sm:p-6">
          <h2 class="text-xl font-bold text-noble-black sm:text-[25px]">{{ sectionTitle }}</h2>
          <p class="mt-2 text-sm leading-6 text-noble-black/70 sm:text-base">
            {{ sectionSubtitle }}
          </p>

          <p
            v-if="pageActionError"
            class="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
          >
            {{ pageActionError }}
          </p>

          <div v-if="currentTabPending" class="mt-6 space-y-4">
            <div
              v-for="i in 3"
              :key="i"
              class="h-28 animate-pulse rounded-2xl border border-cinnamon-ice/50 bg-white/80"
            />
          </div>

          <div
            v-else-if="currentTabErrorMessage"
            class="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-5 text-sm text-red-600"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p>{{ currentTabErrorMessage }}</p>
              <button
                type="button"
                class="inline-flex w-fit rounded-2xl border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-600 hover:text-white"
                @click="refreshCurrentTab()"
              >
                Retry
              </button>
            </div>
          </div>

          <div v-else-if="activeTab === 'PENDING'" class="mt-6 space-y-4">
            <article
              v-for="transaction in filteredPendingTransactions"
              :key="transaction.id"
              class="rounded-2xl border border-cinnamon-ice bg-white p-4 sm:p-5"
            >
              <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
                <img
                  v-if="transaction.item.thumbnailImage"
                  :src="transaction.item.thumbnailImage"
                  :alt="transaction.item.name"
                  class="h-[85px] w-[85px] rounded-lg object-cover"
                />
                <div
                  v-else
                  class="flex h-[85px] w-[85px] items-center justify-center rounded-lg bg-cinnamon-ice/40"
                >
                  <svg
                    class="h-8 w-8 text-cinnamon-ice"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </div>

                <div class="min-w-0 flex-1">
                  <p class="text-xl font-bold text-noble-black">{{ transaction.item.name }}</p>
                  <p class="mt-2 text-sm text-noble-black/80">
                    {{ formatRoleLabel(getCurrentUserRoleForTransaction(transaction)) }} • with
                    <span class="font-semibold text-blue-estate">
                      {{ getCounterpartNameForTransaction(transaction) }}
                    </span>
                  </p>
                  <p class="mt-1 text-sm text-noble-black/80">
                    Completed: {{ formatShortDate(transaction.endDate) }} •
                    {{ computeDuration(transaction.startDate, transaction.endDate) }}
                  </p>
                  <div class="mt-3 flex flex-wrap gap-2">
                    <span
                      v-for="action in transaction.reviewState.actions.filter(
                        (entry) => entry.canSubmit,
                      )"
                      :key="`${transaction.id}-${action.reviewType}-tag`"
                      class="rounded-full bg-burning-orange/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-burning-orange"
                    >
                      {{ action.label }}
                    </span>
                  </div>
                </div>

                <div class="flex flex-col gap-2 sm:w-[170px]">
                  <button
                    v-for="action in transaction.reviewState.actions.filter(
                      (entry) => entry.canSubmit,
                    )"
                    :key="`${transaction.id}-${action.reviewType}`"
                    type="button"
                    class="rounded-2xl bg-burning-orange px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-cinnabar-red"
                    @click="openReviewModal(transaction, action.reviewType)"
                  >
                    {{ action.label }}
                  </button>
                </div>
              </div>
            </article>

            <div
              v-if="filteredPendingTransactions.length === 0"
              class="rounded-2xl border border-cinnamon-ice/70 bg-white px-5 py-10 text-center text-sm text-noble-black/65"
            >
              No reviews pending.
            </div>
          </div>

          <div v-else-if="activeTab === 'DRAFTS'" class="mt-6 space-y-4">
            <article
              v-for="draft in filteredDrafts"
              :key="draft.id"
              class="rounded-2xl border border-cinnamon-ice bg-white p-4 sm:p-5"
            >
              <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
                <img
                  v-if="draft.item?.thumbnailImage"
                  :src="draft.item.thumbnailImage"
                  :alt="draft.item.name"
                  class="h-[85px] w-[85px] rounded-lg object-cover"
                />
                <div
                  v-else
                  class="flex h-[85px] w-[85px] items-center justify-center rounded-lg bg-cinnamon-ice/40"
                >
                  <svg
                    class="h-8 w-8 text-cinnamon-ice"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </div>

                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="text-xl font-bold text-noble-black">
                      {{ draft.item?.name ?? "Item unavailable" }}
                    </p>
                    <span
                      class="rounded-full bg-blue-estate/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-estate"
                    >
                      {{ draft.typeLabel }}
                    </span>
                  </div>
                  <p class="mt-2 text-sm text-noble-black/80">
                    {{ formatRoleLabel(draft.role) }} • with
                    <span class="font-semibold text-blue-estate">{{ draft.counterpartName }}</span>
                  </p>
                  <p class="mt-1 text-sm text-noble-black/80">
                    Last saved {{ formatShortDate(draft.updatedAt) }} • Ref:
                    {{ draft.transactionReference }}
                  </p>
                  <p class="mt-2 line-clamp-2 text-sm leading-6 text-noble-black/70">
                    {{ draft.reviewText || "No review text saved yet." }}
                  </p>
                </div>

                <button
                  type="button"
                  class="rounded-2xl bg-burning-orange px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-cinnabar-red"
                  @click="continueDraft(draft)"
                >
                  Continue Draft
                </button>
              </div>
            </article>

            <div
              v-if="filteredDrafts.length === 0"
              class="rounded-2xl border border-cinnamon-ice/70 bg-white px-5 py-10 text-center text-sm text-noble-black/65"
            >
              No drafts saved yet.
            </div>
          </div>

          <div v-else class="mt-6 space-y-4">
            <article
              v-for="review in filteredHistory"
              :key="review.id"
              class="rounded-2xl border border-cinnamon-ice bg-white p-4 sm:p-5"
            >
              <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
                <img
                  v-if="review.item?.thumbnailImage"
                  :src="review.item.thumbnailImage"
                  :alt="review.item.name"
                  class="h-[85px] w-[85px] rounded-lg object-cover"
                />
                <div
                  v-else
                  class="flex h-[85px] w-[85px] items-center justify-center rounded-lg bg-cinnamon-ice/40"
                >
                  <svg
                    class="h-8 w-8 text-cinnamon-ice"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </div>

                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="text-xl font-bold text-noble-black">
                      {{ review.item?.name ?? review.revieweeName ?? "Review" }}
                    </p>
                    <span
                      class="rounded-full bg-burning-orange/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-burning-orange"
                    >
                      {{ review.typeLabel }}
                    </span>
                  </div>

                  <p class="mt-2 text-sm text-noble-black/80">
                    {{ formatRoleLabel(review.role) }} • with
                    <span class="font-semibold text-blue-estate">{{ review.counterpartName }}</span>
                  </p>
                  <p class="mt-1 text-sm text-noble-black/80">
                    Posted {{ formatShortDate(review.createdAt) }} • Ref:
                    {{ review.transactionReference }}
                  </p>

                  <div class="mt-3 flex items-center gap-1 text-burning-orange">
                    <svg
                      v-for="star in 5"
                      :key="`${review.id}-${star}`"
                      class="h-4 w-4"
                      viewBox="0 0 24 24"
                      :fill="star <= review.rating ? 'currentColor' : 'none'"
                      :stroke="star <= review.rating ? 'currentColor' : 'currentColor'"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M12 3.75l2.664 5.398 5.958.866-4.311 4.202 1.018 5.934L12 17.348l-5.329 2.802 1.018-5.934-4.311-4.202 5.958-.866L12 3.75z"
                      />
                    </svg>
                  </div>

                  <p class="mt-3 text-sm leading-6 text-noble-black/75">{{ review.reviewText }}</p>

                  <div v-if="(review.images as any[]).length > 0" class="mt-4 flex flex-wrap gap-3">
                    <img
                      v-for="image in review.images as any[]"
                      :key="image"
                      :src="getReviewImageUrl(image)"
                      :alt="`${review.typeLabel} image`"
                      class="h-20 w-20 rounded-2xl border border-cinnamon-ice/70 object-cover"
                    />
                  </div>
                </div>
              </div>
            </article>

            <div
              v-if="filteredHistory.length === 0"
              class="rounded-2xl border border-cinnamon-ice/70 bg-white px-5 py-10 text-center text-sm text-noble-black/65"
            >
              No reviews submitted yet.
            </div>
          </div>
        </section>
      </div>

      <aside class="space-y-6">
        <section class="rounded-[20px] border border-cinnamon-ice bg-cream p-6">
          <h2 class="text-lg font-bold text-noble-black">Your checklist</h2>
          <div class="mt-4 space-y-4 text-sm leading-7 text-noble-black/80">
            <p>Quick reminders before you post.</p>
            <p>Mention communication and timing.</p>
            <p>Describe condition accurately.</p>
            <p>Avoid private info or insults.</p>
          </div>

          <div class="mt-6 rounded-2xl bg-white px-4 py-4">
            <p class="text-base font-bold text-noble-black">Tip</p>
            <p class="mt-2 text-sm leading-6 text-noble-black/75">
              Save a draft if you’re busy, then come back when you’re ready to submit.
            </p>
          </div>

          <button
            type="button"
            class="mt-6 w-full rounded-2xl bg-burning-orange px-5 py-3 text-base font-medium text-white transition-colors hover:bg-cinnabar-red"
            @click="activeTab = 'DRAFTS'"
          >
            View Drafts
          </button>
        </section>
      </aside>
    </div>

    <section class="rounded-[20px] border border-cinnamon-ice bg-cream p-5 sm:p-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-xl font-bold text-noble-black sm:text-[25px]">Community Leaderboards</h2>
          <p class="mt-2 text-sm leading-6 text-noble-black/70 sm:text-base">
            Top community members ranked by average star rating from available borrower and lender
            reviews.
          </p>
        </div>

        <button
          v-if="leaderboardError"
          type="button"
          class="inline-flex w-fit rounded-2xl border border-burning-orange px-4 py-2 text-sm font-medium text-burning-orange transition-colors hover:bg-burning-orange hover:text-white"
          @click="refreshLeaderboard()"
        >
          Retry
        </button>
      </div>

      <div class="mt-6 grid gap-6 xl:grid-cols-2">
        <article class="rounded-2xl border border-cinnamon-ice bg-white p-5">
          <h3 class="text-lg font-bold text-noble-black">Top Borrowers</h3>

          <div v-if="leaderboardPending && !leaderboardData" class="mt-5 space-y-3">
            <div
              v-for="index in 5"
              :key="`borrowers-skeleton-${index}`"
              class="h-16 animate-pulse rounded-2xl border border-cinnamon-ice/50 bg-cream"
            />
          </div>

          <div
            v-else-if="leaderboardError"
            class="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-600"
          >
            We couldn't load the borrower rankings right now.
          </div>

          <div
            v-else-if="borrowerLeaderboard.length === 0"
            class="mt-5 text-sm text-noble-black/65"
          >
            No rankings yet.
          </div>

          <div v-else class="mt-5 space-y-3">
            <div
              v-for="entry in borrowerLeaderboard"
              :key="`borrower-${entry.user.id}`"
              class="flex items-center gap-4 rounded-2xl border border-cinnamon-ice/70 bg-cream px-4 py-3"
            >
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-burning-orange/10 text-sm font-bold text-burning-orange"
              >
                #{{ entry.rank }}
              </div>

              <UserAvatar
                :avatar-url="entry.user.avatarUrl"
                :user-name="entry.user.name"
                size="md"
              />

              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-noble-black sm:text-base">
                  {{ entry.user.name }}
                </p>
                <p class="mt-1 text-xs text-noble-black/60 sm:text-sm">
                  {{ formatReviewCount(entry.reviewCount) }}
                </p>
              </div>

              <div class="text-right">
                <p class="text-sm font-bold text-burning-orange sm:text-base">
                  {{ entry.averageRating.toFixed(1) }} ★
                </p>
              </div>
            </div>
          </div>
        </article>

        <article class="rounded-2xl border border-cinnamon-ice bg-white p-5">
          <h3 class="text-lg font-bold text-noble-black">Top Lenders</h3>

          <div v-if="leaderboardPending && !leaderboardData" class="mt-5 space-y-3">
            <div
              v-for="index in 5"
              :key="`lenders-skeleton-${index}`"
              class="h-16 animate-pulse rounded-2xl border border-cinnamon-ice/50 bg-cream"
            />
          </div>

          <div
            v-else-if="leaderboardError"
            class="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-600"
          >
            We couldn't load the lender rankings right now.
          </div>

          <div v-else-if="lenderLeaderboard.length === 0" class="mt-5 text-sm text-noble-black/65">
            No rankings yet.
          </div>

          <div v-else class="mt-5 space-y-3">
            <div
              v-for="entry in lenderLeaderboard"
              :key="`lender-${entry.user.id}`"
              class="flex items-center gap-4 rounded-2xl border border-cinnamon-ice/70 bg-cream px-4 py-3"
            >
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-estate/10 text-sm font-bold text-blue-estate"
              >
                #{{ entry.rank }}
              </div>

              <UserAvatar
                :avatar-url="entry.user.avatarUrl"
                :user-name="entry.user.name"
                size="md"
              />

              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-noble-black sm:text-base">
                  {{ entry.user.name }}
                </p>
                <p class="mt-1 text-xs text-noble-black/60 sm:text-sm">
                  {{ formatReviewCount(entry.reviewCount) }}
                </p>
              </div>

              <div class="text-right">
                <p class="text-sm font-bold text-burning-orange sm:text-base">
                  {{ entry.averageRating.toFixed(1) }} ★
                </p>
              </div>
            </div>
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
  </div>
</template>
