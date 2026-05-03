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
    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <label
        class="flex min-h-12 items-center gap-3 rounded-[16px] border border-cinnamon-ice/45 bg-white px-4 transition-colors focus-within:border-burning-orange"
      >
        <svg
          class="h-4 w-4 shrink-0 text-noble-black/35"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="8" stroke-width="2" />
          <path d="m21 21-4.35-4.35" stroke-width="2" stroke-linecap="round" />
        </svg>
        <span class="sr-only">Search platform transactions</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search by transaction ID or item name"
          class="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-noble-black outline-none placeholder:text-noble-black/40"
        />
      </label>

      <button
        v-if="hasActiveFilters"
        class="inline-flex min-h-12 items-center justify-center rounded-[16px] bg-blue-estate px-5 text-[14px] font-bold text-white transition-colors hover:bg-blue-estate/90"
        @click="resetFilters"
      >
        Clear Filters
      </button>
    </div>

    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      <label
        class="flex flex-col gap-2 rounded-[16px] border border-cinnamon-ice/45 bg-white px-4 py-3 transition-colors focus-within:border-burning-orange"
      >
        <span class="text-[11px] font-bold uppercase tracking-[0.14em] text-noble-black/45">
          Created From
        </span>
        <input
          v-model="createdAtFrom"
          type="date"
          class="bg-transparent text-[14px] font-medium text-noble-black outline-none"
        />
      </label>

      <label
        class="flex flex-col gap-2 rounded-[16px] border border-cinnamon-ice/45 bg-white px-4 py-3 transition-colors focus-within:border-burning-orange"
      >
        <span class="text-[11px] font-bold uppercase tracking-[0.14em] text-noble-black/45">
          Created To
        </span>
        <input
          v-model="createdAtTo"
          type="date"
          class="bg-transparent text-[14px] font-medium text-noble-black outline-none"
        />
      </label>
    </div>

    <div class="mt-5 rounded-[20px] border border-cinnamon-ice/45 bg-cream/70 p-4 sm:p-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 class="text-[18px] font-bold text-noble-black">All Platform Activity</h2>
          <p class="mt-1 max-w-2xl text-[14px] leading-relaxed text-noble-black/60">
            Borrower, lender, item, status, commission, and payment totals are shown together.
          </p>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <button
          v-for="chip in statusChips"
          :key="chip.label"
          class="rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors duration-150"
          :class="
            activeStatus === chip.value
              ? 'border-burning-orange bg-burning-orange text-white'
              : 'border-cinnamon-ice/70 bg-white text-noble-black/70 hover:border-burning-orange/50 hover:text-burning-orange'
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
          class="mt-4 h-36 animate-pulse rounded-[16px] bg-cinnamon-ice/40"
        />
      </template>

      <div
        v-else-if="hasInitialError"
        class="mt-4 flex flex-col items-center justify-center rounded-[16px] border border-cinnamon-ice/45 bg-white px-4 py-12 text-center"
      >
        <p class="mb-4 text-[14px] text-noble-black/70">{{ error }}</p>
        <button
          class="rounded-full bg-burning-orange px-5 py-2 text-[14px] font-bold text-white transition-colors hover:bg-cinnabar-red"
          @click="refresh"
        >
          Retry
        </button>
      </div>

      <div
        v-else-if="hasEmptyState"
        class="mt-4 flex flex-col items-center justify-center rounded-[16px] border border-cinnamon-ice/45 bg-white px-4 py-12 text-center"
      >
        <p class="mb-1 text-[14px] font-bold text-noble-black">
          No transactions matched your filters
        </p>
        <p class="text-[13px] text-noble-black/55">
          Try a different status, date range, or search query.
        </p>
      </div>

      <div v-else class="mt-4 flex flex-col gap-3">
        <TransactionCard
          v-for="transaction in transactions"
          :key="transaction.id"
          :transaction="transaction"
          variant="admin"
        />
      </div>

      <div
        v-if="hasMore || (isLoading && transactions.length > 0)"
        class="mt-5 flex justify-center"
      >
        <button
          :disabled="isLoading"
          class="rounded-full bg-burning-orange px-5 py-2 text-[14px] font-bold text-white transition-colors hover:bg-cinnabar-red disabled:cursor-not-allowed disabled:opacity-60"
          @click="loadMore"
        >
          <span v-if="isLoading">Loading...</span>
          <span v-else>Load More</span>
        </button>
      </div>
    </div>
  </div>
</template>
