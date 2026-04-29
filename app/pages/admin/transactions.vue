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
  <div class="font-geist">
    <div class="mb-4 flex flex-col gap-4 sm:mb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 class="text-xl font-bold text-neutral-800 sm:text-2xl">Platform Transactions</h1>
        <p class="mt-1 text-base font-normal tracking-wide text-neutral-800 sm:text-lg">
          Review borrower and lender activity across all transactions.
        </p>
      </div>

      <button
        v-if="hasActiveFilters"
        class="inline-flex items-center justify-center self-start rounded-2xl border border-blue-estate/15 bg-blue-estate px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-900 sm:self-auto"
        @click="resetFilters"
      >
        Clear Filters
      </button>
    </div>

    <div
      class="mb-3 flex items-center gap-2 rounded-[20px] border-[0.50px] border-cinnamon-ice bg-white px-4 h-12 sm:mb-4 sm:gap-3 sm:px-5 sm:h-16"
    >
      <svg
        class="w-4 h-4 shrink-0 text-stone-400 sm:w-5 sm:h-5"
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
        placeholder="Search by transaction ID or item name"
        class="flex-1 min-w-0 bg-transparent text-sm font-normal text-stone-400 outline-none placeholder:text-stone-400 sm:text-lg"
      />
    </div>

    <div class="mb-3 grid gap-3 sm:mb-4 sm:grid-cols-2">
      <label
        class="flex flex-col gap-2 rounded-[20px] border border-cinnamon-ice bg-white px-4 py-3"
      >
        <span class="text-xs font-bold uppercase tracking-[0.14em] text-noble-black/45">
          Created From
        </span>
        <input
          v-model="createdAtFrom"
          type="date"
          class="bg-transparent text-sm text-neutral-800 outline-none sm:text-base"
        />
      </label>

      <label
        class="flex flex-col gap-2 rounded-[20px] border border-cinnamon-ice bg-white px-4 py-3"
      >
        <span class="text-xs font-bold uppercase tracking-[0.14em] text-noble-black/45">
          Created To
        </span>
        <input
          v-model="createdAtTo"
          type="date"
          class="bg-transparent text-sm text-neutral-800 outline-none sm:text-base"
        />
      </label>
    </div>

    <div class="rounded-[20px] border border-cinnamon-ice bg-cream p-4 sm:p-6">
      <h2 class="text-lg font-semibold text-neutral-800 sm:text-xl">All Platform Activity</h2>
      <p
        class="mt-1 mb-4 text-sm font-normal tracking-wide text-neutral-800/80 sm:mb-5 sm:text-base"
      >
        Borrower and lender details are shown together for every transaction.
      </p>

      <div class="mb-4 flex flex-wrap gap-1.5 sm:mb-6 sm:gap-2">
        <button
          v-for="chip in statusChips"
          :key="chip.label"
          class="rounded-xl px-3 py-1.5 text-xs font-normal transition-colors duration-150 sm:px-4 sm:text-base"
          :class="
            activeStatus === chip.value
              ? 'bg-burning-orange text-white'
              : 'border-[0.30px] border-orange-500 bg-white text-neutral-800'
          "
          @click="activeStatus = chip.value"
        >
          {{ chip.label }}
        </button>
      </div>

      <template v-if="isInitialLoading">
        <div
          v-for="index in 3"
          :key="index"
          class="mb-3 h-40 animate-pulse rounded-2xl bg-cinnamon-ice/40 sm:mb-4"
        />
      </template>

      <div
        v-else-if="hasInitialError"
        class="flex flex-col items-center justify-center py-12 text-center sm:py-16"
      >
        <p class="mb-4 text-sm text-neutral-800/80 sm:text-base">{{ error }}</p>
        <button
          class="rounded-xl bg-burning-orange px-5 py-2 text-sm font-normal text-white transition-colors hover:bg-cinnabar-red sm:px-6 sm:text-base"
          @click="refresh"
        >
          Retry
        </button>
      </div>

      <div
        v-else-if="hasEmptyState"
        class="flex flex-col items-center justify-center py-12 text-center sm:py-16"
      >
        <p class="mb-1 text-sm font-semibold text-neutral-800 sm:text-base">
          No transactions matched your filters
        </p>
        <p class="text-xs text-neutral-800/60 sm:text-sm">
          Try a different status, date range, or search query.
        </p>
      </div>

      <div v-else class="flex flex-col gap-3 sm:gap-4">
        <TransactionCard
          v-for="transaction in transactions"
          :key="transaction.id"
          :transaction="transaction"
          variant="admin"
        />
      </div>

      <div
        v-if="hasMore || (isLoading && transactions.length > 0)"
        class="mt-4 flex justify-center sm:mt-6"
      >
        <button
          :disabled="isLoading"
          class="rounded-xl bg-burning-orange px-5 py-2 text-sm font-normal text-white transition-colors disabled:opacity-60 hover:bg-cinnabar-red sm:px-6 sm:text-base"
          @click="loadMore"
        >
          <span v-if="isLoading">Loading…</span>
          <span v-else>Load More</span>
        </button>
      </div>
    </div>
  </div>
</template>
