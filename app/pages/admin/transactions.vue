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
  <div class="font-geist space-y-5">
    <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto] lg:items-end">
      <div>
        <label class="mb-2 block text-[12px] font-bold text-noble-black/50">Search</label>
        <div
          class="flex h-12 items-center gap-3 rounded-[12px] border-[1.5px] border-gray-200 bg-white px-5 transition-all focus-within:border-burning-orange focus-within:shadow-[0_0_0_3px_rgba(232,101,10,0.05)]"
        >
          <Icon name="ph:magnifying-glass" class="h-5 w-5 shrink-0 text-gray-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by transaction ID or item name"
            class="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-noble-black outline-none placeholder:text-gray-400"
          />
          <button
            v-if="searchQuery"
            class="text-gray-400 transition-colors hover:text-noble-black"
            title="Clear search"
            aria-label="Clear search"
            @click="searchQuery = ''"
          >
            <Icon name="ph:x" class="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      <label>
        <span class="mb-2 block text-[12px] font-bold text-noble-black/50">Created From</span>
        <input
          v-model="createdAtFrom"
          type="date"
          class="h-12 w-full rounded-[12px] border-[1.5px] border-gray-200 bg-white px-4 text-[14px] font-medium text-noble-black outline-none transition-all focus:border-burning-orange focus:shadow-[0_0_0_3px_rgba(232,101,10,0.05)]"
        />
      </label>

      <label>
        <span class="mb-2 block text-[12px] font-bold text-noble-black/50">Created To</span>
        <input
          v-model="createdAtTo"
          type="date"
          class="h-12 w-full rounded-[12px] border-[1.5px] border-gray-200 bg-white px-4 text-[14px] font-medium text-noble-black outline-none transition-all focus:border-burning-orange focus:shadow-[0_0_0_3px_rgba(232,101,10,0.05)]"
        />
      </label>

      <button
        v-if="hasActiveFilters"
        class="inline-flex h-12 items-center justify-center rounded-[12px] bg-burning-orange px-5 text-[14px] font-bold text-white shadow-lg shadow-burning-orange/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        @click="resetFilters"
      >
        Clear Filters
      </button>
    </div>

    <section
      class="rounded-[24px] border border-cinnamon-ice/20 bg-cream p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] sm:p-8"
    >
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <h2 class="text-[18px] font-bold text-noble-black">All Platform Activity</h2>
          <p class="mt-1 max-w-2xl text-[14px] font-medium leading-relaxed text-noble-black/50">
            Borrower, lender, item, status, commission, and payment totals are shown together.
          </p>
        </div>
      </div>

      <div class="mt-6 flex items-center gap-2 overflow-x-auto py-1">
        <button
          v-for="chip in statusChips"
          :key="chip.label"
          class="shrink-0 rounded-full border-[1.5px] px-[14px] py-1.5 text-[13px] font-bold transition-all duration-200"
          :class="
            activeStatus === chip.value
              ? 'border-burning-orange/30 bg-burning-orange/[0.12] text-burning-orange'
              : 'border-gray-200 bg-white text-noble-black/40 hover:border-gray-300 hover:text-noble-black/60'
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
          class="mt-4 h-32 animate-pulse rounded-2xl bg-cinnamon-ice/20"
        />
      </template>

      <div
        v-else-if="hasInitialError"
        class="flex flex-col items-center justify-center py-12 text-center sm:py-16"
      >
        <Icon name="ph:warning-circle" class="mb-4 h-12 w-12 text-cinnamon-ice" />
        <p class="mb-6 text-[15px] font-medium text-noble-black/50">{{ error }}</p>
        <button
          class="rounded-[12px] bg-burning-orange px-8 py-2.5 text-[15px] font-bold text-white shadow-lg shadow-burning-orange/20 transition-all hover:brightness-110"
          @click="refresh"
        >
          Retry
        </button>
      </div>

      <div
        v-else-if="hasEmptyState"
        class="flex flex-col items-center justify-center py-16 text-center sm:py-20"
      >
        <div
          class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-cinnamon-ice/10 text-cinnamon-ice/40"
        >
          <Icon name="ph:arrows-left-right" class="h-10 w-10" />
        </div>
        <p class="mb-1 text-[18px] font-bold text-noble-black">
          No transactions matched your filters
        </p>
        <p class="max-w-xs text-[14px] font-medium text-noble-black/40">
          Try a different status, date range, or search query.
        </p>
      </div>

      <div v-else class="mt-5 flex flex-col gap-4">
        <TransactionCard
          v-for="transaction in transactions"
          :key="transaction.id"
          :transaction="transaction"
          variant="admin"
        />
      </div>

      <div
        v-if="hasMore || (isLoading && transactions.length > 0)"
        class="mt-6 flex justify-center"
      >
        <button
          :disabled="isLoading"
          class="rounded-[12px] bg-burning-orange px-8 py-2.5 text-[15px] font-bold text-white shadow-lg shadow-burning-orange/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          @click="loadMore"
        >
          <span v-if="isLoading">Loading...</span>
          <span v-else>Load More</span>
        </button>
      </div>
    </section>
  </div>
</template>
