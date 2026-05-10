<script setup lang="ts">
import { computed, ref } from "vue"
import type { TransactionStatus } from "../../../shared/schemas/transaction"
import { useAdminCommissions } from "~/composables/use-admin-commissions"
import type { AdminCommissionRecord } from "~/types/admin-commission"

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
const collectedAtFrom = ref("")
const collectedAtTo = ref("")

const { summary, records, isLoading, error, hasMore, loadMore, refresh } = useAdminCommissions({
  status: activeStatus,
  searchQuery,
  collectedAtFrom,
  collectedAtTo,
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

const isInitialLoading = computed(() => !records.value.length && isLoading.value)
const hasInitialError = computed(
  () => !records.value.length && !isLoading.value && Boolean(error.value),
)
const hasEmptyState = computed(() => !records.value.length && !isLoading.value && !error.value)
const hasActiveFilters = computed(() =>
  Boolean(
    activeStatus.value || searchQuery.value.trim() || collectedAtFrom.value || collectedAtTo.value,
  ),
)

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: summary.value.currency || "PHP",
    minimumFractionDigits: 2,
  }).format(value)

const formatDateTime = (value: string | Date) =>
  new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))

const shortId = (value: string | null) => {
  if (!value) return "Not linked"
  return value.length > 18 ? value.slice(0, 18).toUpperCase() : value.toUpperCase()
}

const summaryItems = computed(() => [
  {
    label: "Total Commission",
    value: formatMoney(summary.value.totalCommissionCollected),
    detail: "Collected platform revenue",
  },
  {
    label: "System Balance",
    value: formatMoney(summary.value.currentCommissionBalance),
    detail: "Current commission wallet balance",
  },
  {
    label: "Commission Transactions",
    value: summary.value.commissionTransactionCount.toLocaleString(),
    detail: "Completed commission records",
  },
])

const resetFilters = async () => {
  activeStatus.value = null
  searchQuery.value = ""
  collectedAtFrom.value = ""
  collectedAtTo.value = ""
  await refresh()
}

const getRecordTitle = (record: AdminCommissionRecord) =>
  record.itemName || `Commission ${shortId(record.id)}`
</script>

<template>
  <div class="space-y-5 font-geist">
    <section class="space-y-3">
      <div class="space-y-2">
        <h1 class="text-[28px] font-semibold text-noble-black">Commission Earnings</h1>
        <div class="h-0.5 w-10 bg-burning-orange"></div>
      </div>
      <p class="max-w-3xl text-[16px] font-medium leading-relaxed text-noble-black/50">
        Track collected platform commission, current system wallet balance, and the transaction
        source behind each commission record.
      </p>
    </section>

    <section class="grid gap-4 md:grid-cols-3">
      <div
        v-for="item in summaryItems"
        :key="item.label"
        class="rounded-[18px] border border-cinnamon-ice/20 bg-cream p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
      >
        <p class="text-[12px] font-bold uppercase text-noble-black/40">{{ item.label }}</p>
        <p class="mt-2 text-[26px] font-extrabold leading-tight text-noble-black">
          {{ item.value }}
        </p>
        <p class="mt-1 text-[13px] font-medium text-noble-black/45">{{ item.detail }}</p>
      </div>
    </section>

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
            placeholder="Search by transaction, booking, or commission ID"
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
        <span class="mb-2 block text-[12px] font-bold text-noble-black/50">Collected From</span>
        <input
          v-model="collectedAtFrom"
          type="date"
          class="h-12 w-full rounded-[12px] border-[1.5px] border-gray-200 bg-white px-4 text-[14px] font-medium text-noble-black outline-none transition-all focus:border-burning-orange focus:shadow-[0_0_0_3px_rgba(232,101,10,0.05)]"
        />
      </label>

      <label>
        <span class="mb-2 block text-[12px] font-bold text-noble-black/50">Collected To</span>
        <input
          v-model="collectedAtTo"
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
          <h2 class="text-[18px] font-bold text-noble-black">Commission Ledger</h2>
          <p class="mt-1 max-w-2xl text-[14px] font-medium leading-relaxed text-noble-black/50">
            Every entry is tied back to the booking or transaction that generated platform revenue.
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
          class="mt-4 h-36 animate-pulse rounded-2xl bg-cinnamon-ice/20"
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
          <Icon name="ph:receipt" class="h-10 w-10" />
        </div>
        <p class="mb-1 text-[18px] font-bold text-noble-black">
          No commission records matched your filters
        </p>
        <p class="max-w-xs text-[14px] font-medium text-noble-black/40">
          Try a different status, date range, or transaction reference.
        </p>
      </div>

      <div v-else class="mt-5 flex flex-col gap-4">
        <article
          v-for="record in records"
          :key="record.id"
          class="rounded-[16px] border border-cinnamon-ice/20 bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
        >
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="truncate text-[17px] font-bold text-noble-black">
                  {{ getRecordTitle(record) }}
                </h3>
                <TransactionStatusBadge
                  v-if="record.transactionStatus"
                  :status="record.transactionStatus"
                  context="admin"
                />
                <span
                  v-else
                  class="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-bold text-noble-black/45"
                >
                  Unlinked
                </span>
              </div>
              <div
                class="mt-3 grid gap-2 text-[12px] font-semibold text-noble-black/45 sm:grid-cols-2 xl:grid-cols-4"
              >
                <p>
                  <span class="block text-noble-black/30">Commission ID</span>
                  <span class="font-mono text-noble-black/60">{{ shortId(record.id) }}</span>
                </p>
                <p>
                  <span class="block text-noble-black/30">Transaction</span>
                  <span class="font-mono text-noble-black/60">
                    {{ shortId(record.sourceTransactionId) }}
                  </span>
                </p>
                <p>
                  <span class="block text-noble-black/30">Booking</span>
                  <span class="font-mono text-noble-black/60">{{ shortId(record.bookingId) }}</span>
                </p>
                <p>
                  <span class="block text-noble-black/30">Collected</span>
                  <span class="text-noble-black/60">{{ formatDateTime(record.collectedAt) }}</span>
                </p>
              </div>
            </div>

            <div class="grid shrink-0 grid-cols-3 gap-3 text-right sm:min-w-[360px]">
              <div>
                <p class="text-[11px] font-bold uppercase text-noble-black/30">Gross</p>
                <p class="mt-1 text-[15px] font-extrabold text-noble-black">
                  {{ formatMoney(record.grossAmount) }}
                </p>
              </div>
              <div>
                <p class="text-[11px] font-bold uppercase text-noble-black/30">Commission</p>
                <p class="mt-1 text-[15px] font-extrabold text-success-green">
                  {{ formatMoney(record.commissionAmount) }}
                </p>
              </div>
              <div>
                <p class="text-[11px] font-bold uppercase text-noble-black/30">Net</p>
                <p class="mt-1 text-[15px] font-extrabold text-noble-black">
                  {{ formatMoney(record.netReleasedToLender) }}
                </p>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div v-if="hasMore || (isLoading && records.length > 0)" class="mt-6 flex justify-center">
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
