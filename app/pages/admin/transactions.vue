<script setup lang="ts">
import { computed, ref } from "vue"
import type { TransactionStatus } from "../../../shared/schemas/transaction"
import { useAdminTransactions } from "~/composables/use-admin-transactions"

definePageMeta({
  layout: "admin",
  middleware: "admin-auth",
})

type StatusChip = {
  label: string
  value: TransactionStatus | null
}

const activeStatus = ref<TransactionStatus | null>(null)
const searchQuery = ref("")
const createdAtFrom = ref("")
const createdAtTo = ref("")

const { transactions, isLoading, error, hasMore, loadMore, refresh } = useAdminTransactions({
  status: activeStatus,
  searchQuery,
  createdAtFrom,
  createdAtTo,
  limit: 10,
})

const groupedTransactions = computed(() => {
  const groups: Array<{ title: string; transactions: AdminTransactionListItem[] }> = []
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

  // Start of this week (Monday)
  const day = now.getDay() || 7
  const startOfWeek = today - (day - 1) * 24 * 60 * 60 * 1000

  transactions.value.forEach((transaction) => {
    const entryDate = new Date(transaction.createdAt)
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
      existingGroup.transactions.push(transaction)
    } else {
      groups.push({ title: groupTitle, transactions: [transaction] })
    }
  })

  return groups
})

const statusChips: StatusChip[] = [
  { label: "All", value: null },
  { label: "Pending", value: "PENDING" },
  { label: "Active", value: "ACTIVE" },
  { label: "Returned", value: "RETURNED" },
  { label: "Completed", value: "COMPLETED" },
  { label: "In Dispute", value: "IN_DISPUTE" },
  { label: "Cancelled", value: "CANCELLED" },
]

const isInitialLoading = computed(() => !transactions.value.length && isLoading.value)
const hasInitialError = computed(
  () => !transactions.value.length && !isLoading.value && Boolean(error.value),
)
const hasEmptyState = computed(() => !transactions.value.length && !isLoading.value && !error.value)
const hasActiveFilters = computed(() =>
  Boolean(
    activeStatus.value || searchQuery.value.trim() || createdAtFrom.value || createdAtTo.value,
  ),
)

const resetFilters = async () => {
  activeStatus.value = null
  searchQuery.value = ""
  createdAtFrom.value = ""
  createdAtTo.value = ""
  await refresh()
}
</script>

<template>
  <div class="font-geist space-y-6">
    <!-- Elegant Executive Header -->
    <header class="space-y-3">
      <div class="space-y-2">
        <h1 class="font-geist text-[36px] font-medium text-noble-black tracking-tight">
          Platform Transactions
        </h1>
        <div class="w-10 h-0.5 bg-burning-orange"></div>
      </div>
      <p class="text-[16px] font-light leading-relaxed text-noble-black/50">
        Monitor borrower and lender activity, commission flow, and payment status.
      </p>
    </header>

    <!-- Refined Multi-Filter Grid -->
    <div
      class="bg-white p-6 rounded-[24px] border border-cinnamon-ice/20 shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
    >
      <div class="grid gap-6 lg:grid-cols-[1fr_200px_200px_auto] lg:items-end">
        <div>
          <label
            class="mb-2 block text-[10px] font-black uppercase tracking-[2px] text-noble-black/30"
            >Search Records</label
          >
          <div class="relative w-full">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Transaction ID or item name..."
              class="h-12 w-full rounded-[14px] border-[1.5px] border-gray-100 bg-gray-50/50 px-12 text-[14px] font-bold text-noble-black outline-none transition-all focus:border-burning-orange/30 focus:bg-white focus:ring-4 focus:ring-burning-orange/5 placeholder:text-gray-400 placeholder:font-medium"
            />
            <div
              class="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5"
            >
              <button
                v-if="searchQuery"
                class="text-gray-400 hover:text-burning-orange transition-colors flex items-center justify-center"
                @click="searchQuery = ''"
              >
                <Icon name="ph:x" class="w-5 h-5" />
              </button>
              <Icon v-else name="ph:magnifying-glass" class="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>

        <div>
          <label
            class="mb-2 block text-[10px] font-black uppercase tracking-[2px] text-noble-black/30"
            >From Date</label
          >
          <CustomCalendar v-model="createdAtFrom" placeholder="Pick date" />
        </div>

        <div>
          <label
            class="mb-2 block text-[10px] font-black uppercase tracking-[2px] text-noble-black/30"
            >To Date</label
          >
          <CustomCalendar v-model="createdAtTo" placeholder="Pick date" />
        </div>

        <button
          v-if="hasActiveFilters"
          class="h-12 px-6 text-[13px] font-bold text-burning-orange hover:bg-burning-orange/5 rounded-[14px] transition-all"
          @click="resetFilters"
        >
          Reset
        </button>
      </div>
    </div>

    <!-- Status Chips -->
    <div class="flex items-center gap-2 overflow-x-auto py-1 hide-scrollbar">
      <button
        v-for="chip in statusChips"
        :key="chip.label"
        class="px-[14px] py-1.5 rounded-full text-[13px] font-bold transition-all duration-200 shrink-0 border-[1.5px]"
        :class="
          activeStatus === chip.value
            ? 'bg-burning-orange/[0.12] border-burning-orange/30 text-burning-orange'
            : 'bg-white border-gray-200 text-noble-black/40 hover:border-gray-300 hover:text-noble-black/60'
        "
        @click="activeStatus = chip.value"
      >
        {{ chip.label }}
      </button>
    </div>

    <!-- Main List Elevation -->
    <div
      class="bg-white rounded-[24px] border border-cinnamon-ice/20 p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
    >
      <div class="flex items-center justify-between mb-8">
        <div class="border-l-[3px] border-burning-orange pl-4">
          <h2 class="text-[20px] font-semibold text-noble-black tracking-tight">Activity Log</h2>
          <p class="mt-0.5 text-[13px] font-light text-noble-black/50">
            Platform-wide transaction history and status tracking.
          </p>
        </div>
      </div>

      <template v-if="isInitialLoading">
        <div class="space-y-4">
          <TransactionCardSkeleton v-for="i in 3" :key="i" />
        </div>
      </template>

      <div
        v-else-if="hasInitialError"
        class="flex flex-col items-center justify-center py-20 text-center"
      >
        <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
          <Icon name="ph:warning-circle" class="h-8 w-8 text-cinnabar-red" />
        </div>
        <p class="text-[18px] font-bold text-noble-black">Data Fetch Error</p>
        <p class="mt-2 text-[14px] font-medium text-noble-black/40 mb-8">{{ error }}</p>
        <button
          class="rounded-[14px] bg-burning-orange px-8 py-3 text-[15px] font-bold text-white shadow-lg shadow-burning-orange/20 transition-all hover:brightness-110"
          @click="refresh"
        >
          Retry
        </button>
      </div>

      <div
        v-else-if="hasEmptyState"
        class="flex flex-col items-center justify-center py-20 text-center"
      >
        <div
          class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gray-50 text-gray-200"
        >
          <Icon name="ph:arrows-left-right" class="h-10 w-10" />
        </div>
        <p class="text-[18px] font-bold text-noble-black">No matches found</p>
        <p class="mt-2 max-w-xs text-[14px] font-medium text-noble-black/40">
          Try adjusting your search query, date range, or status filters.
        </p>
      </div>

      <!-- Transaction list (Grouped & Internal Scroll) -->
      <div v-else class="max-h-[700px] overflow-y-auto pr-4 -mr-4 custom-scrollbar space-y-10">
        <div v-for="group in groupedTransactions" :key="group.title" class="space-y-5">
          <div class="flex items-center gap-4 px-2 sticky top-0 bg-white z-20 py-2">
            <span
              class="text-[12px] font-bold text-noble-black/30 uppercase tracking-[0.2em] shrink-0"
            >
              {{ group.title }}
            </span>
            <div class="h-[1px] w-full bg-cinnamon-ice/10"></div>
          </div>

          <div class="flex flex-col gap-4">
            <TransactionCard
              v-for="transaction in group.transactions"
              :key="transaction.id"
              :transaction="transaction"
              variant="admin"
            />
          </div>
        </div>

        <!-- Load More Records -->
        <div
          v-if="hasMore || (isLoading && transactions.length > 0)"
          class="flex justify-center mt-10"
        >
          <button
            :disabled="isLoading"
            class="bg-white border-[1.5px] border-burning-orange text-burning-orange rounded-[12px] px-8 py-2.5 text-[15px] font-bold hover:bg-burning-orange/5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            @click="loadMore"
          >
            <span v-if="isLoading" class="flex items-center gap-2">
              <Icon name="ph:spinner-gap" class="animate-spin w-4 h-4" />
              Loading…
            </span>
            <span v-else>Load More Records</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
