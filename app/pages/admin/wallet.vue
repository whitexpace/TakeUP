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
  <div class="space-y-10 font-geist">
    <!-- Elegant Executive Header -->
    <header class="space-y-3">
      <div class="space-y-2">
        <h1 class="font-montravia text-[36px] font-medium text-noble-black">Commission Earnings</h1>
        <div class="w-10 h-0.5 bg-burning-orange"></div>
      </div>
      <p class="text-[16px] font-light leading-relaxed text-noble-black/50">
        Track platform revenue flow and audit granular transaction commissions.
      </p>
    </header>

    <!-- Premium Summary Cards -->
    <section v-if="isLoading && !records.length" class="grid gap-6 md:grid-cols-3">
      <AdminKpiCardSkeleton v-for="i in 3" :key="i" />
    </section>
    <section v-else class="grid gap-6 md:grid-cols-3">
      <div
        v-for="item in summaryItems"
        :key="item.label"
        class="group relative overflow-hidden rounded-[24px] border border-cinnamon-ice/20 bg-white p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-500 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] hover:-translate-y-1"
      >
        <div class="relative z-10">
          <p class="text-[11px] font-bold uppercase tracking-wider text-noble-black/30 mb-4">
            {{ item.label }}
          </p>
          <p class="text-[32px] font-extrabold leading-tight text-noble-black tracking-tighter">
            {{ item.value }}
          </p>
          <p class="mt-2 text-[13px] font-medium text-noble-black/40 leading-relaxed">
            {{ item.detail }}
          </p>
        </div>
        <div
          class="absolute -right-4 -bottom-4 w-24 h-24 bg-burning-orange/[0.03] rounded-full transition-transform duration-700 group-hover:scale-150"
        ></div>
      </div>
    </section>

    <!-- Refined Multi-Filter Grid -->
    <div
      class="bg-white p-6 rounded-[24px] border border-cinnamon-ice/20 shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
    >
      <div class="grid gap-6 lg:grid-cols-[1fr_200px_200px_auto] lg:items-end">
        <div>
          <label
            class="mb-2 block text-[10px] font-black uppercase tracking-[2px] text-noble-black/30"
            >Search</label
          >
          <div class="relative w-full">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Transaction ID, booking ID..."
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
          <CustomCalendar v-model="collectedAtFrom" placeholder="Pick date" />
        </div>

        <div>
          <label
            class="mb-2 block text-[10px] font-black uppercase tracking-[2px] text-noble-black/30"
            >To Date</label
          >
          <CustomCalendar v-model="collectedAtTo" placeholder="Pick date" />
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

    <!-- Main Ledger Elevation -->
    <section
      class="rounded-[32px] border border-cinnamon-ice/20 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
    >
      <div class="flex items-center justify-between mb-8">
        <div class="border-l-[3px] border-burning-orange pl-4">
          <h2 class="text-[20px] font-semibold text-noble-black tracking-tight">
            Commission Ledger
          </h2>
          <p class="mt-0.5 text-[13px] font-light text-noble-black/50">
            Chronological history of all platform-wide commission events.
          </p>
        </div>
      </div>

      <template v-if="isInitialLoading">
        <div class="space-y-6">
          <AdminListRecordSkeleton v-for="index in 4" :key="index" />
        </div>
      </template>

      <div
        v-else-if="hasInitialError"
        class="flex flex-col items-center justify-center py-20 text-center"
      >
        <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
          <Icon name="ph:warning-circle" class="h-8 w-8 text-cinnabar-red" />
        </div>
        <p class="text-[18px] font-bold text-noble-black">Sync Failure</p>
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
          <Icon name="ph:receipt" class="h-10 w-10" />
        </div>
        <p class="text-[18px] font-bold text-noble-black">No records matched</p>
        <p class="mt-2 max-w-sm text-[14px] font-medium text-noble-black/40">
          Try adjusting your search query, date range, or status filters.
        </p>
      </div>

      <div v-else class="max-h-[800px] overflow-y-auto pr-4 -mr-4 custom-scrollbar space-y-6">
        <article
          v-for="record in records"
          :key="record.id"
          class="group rounded-[24px] bg-white border border-cinnamon-ice/20 p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all duration-300 hover:border-cinnamon-ice/30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
        >
          <!-- Top Full Width Row -->
          <div class="flex items-center gap-3 mb-6 w-full pb-4 border-b border-gray-50">
            <h3
              class="text-[18px] font-semibold text-noble-black group-hover:text-burning-orange transition-colors"
            >
              {{ getRecordTitle(record) }}
            </h3>
            <TransactionStatusBadge
              v-if="record.transactionStatus"
              :status="record.transactionStatus"
              context="admin"
              class="!px-3 !py-1 !text-[10px]"
            />
            <span
              v-else
              class="rounded-full border border-gray-100 bg-white px-3 py-1 text-[10px] font-bold tracking-widest uppercase text-noble-black/30 shadow-sm"
            >
              Unlinked
            </span>
          </div>

          <div class="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <!-- Left/Main Column -->
            <div class="min-w-0 flex-1">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8 text-[14px]">
                <div class="space-y-1">
                  <p class="text-[11px] font-bold uppercase tracking-widest text-noble-black/30">
                    Commission ID
                  </p>
                  <p class="font-mono font-medium text-noble-black truncate">
                    {{ record.id }}
                  </p>
                </div>

                <div class="space-y-1 relative">
                  <div
                    class="absolute -left-4 top-0 bottom-0 w-px bg-gray-100 hidden sm:block"
                  ></div>
                  <p class="text-[11px] font-bold uppercase tracking-widest text-noble-black/30">
                    Booking Ref
                  </p>
                  <p class="font-mono font-medium text-noble-black truncate">
                    {{ record.bookingId || "N/A" }}
                  </p>
                </div>

                <div class="space-y-1">
                  <p class="text-[11px] font-bold uppercase tracking-widest text-noble-black/30">
                    Transaction Ref
                  </p>
                  <p class="font-mono font-medium text-noble-black truncate">
                    {{ record.sourceTransactionId || "N/A" }}
                  </p>
                </div>

                <div class="space-y-1 relative">
                  <div
                    class="absolute -left-4 top-0 bottom-0 w-px bg-gray-100 hidden sm:block"
                  ></div>
                  <p class="text-[11px] font-bold uppercase tracking-widest text-noble-black/30">
                    Collected
                  </p>
                  <p class="font-medium text-noble-black">
                    {{ formatDateTime(record.collectedAt) }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Right Column (35%) - Financial Breakdown -->
            <div
              class="w-full lg:w-auto shrink-0 grid grid-cols-3 gap-4 lg:gap-6 text-right bg-gray-50/50 p-6 rounded-[24px] border border-gray-100/50"
            >
              <div class="space-y-1 text-left">
                <p class="text-[10px] font-bold uppercase tracking-widest text-noble-black/40">
                  Gross Flow
                </p>
                <p class="text-[16px] font-semibold text-noble-black tracking-tight">
                  {{ formatMoney(record.grossAmount) }}
                </p>
              </div>
              <div class="space-y-1 text-center px-4 border-x border-gray-200/50">
                <p class="text-[10px] font-bold uppercase tracking-widest text-burning-orange/60">
                  Platform Cut
                </p>
                <p class="text-[16px] font-semibold text-burning-orange tracking-tight">
                  {{ formatMoney(record.commissionAmount) }}
                </p>
              </div>
              <div class="space-y-1 text-right">
                <p class="text-[10px] font-bold uppercase tracking-widest text-noble-black/40">
                  Net Release
                </p>
                <p class="text-[16px] font-semibold text-noble-black tracking-tight">
                  {{ formatMoney(record.netReleasedToLender) }}
                </p>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div
        v-if="hasMore || (isLoading && records.length > 0)"
        class="mt-8 flex justify-center border-t border-gray-50 pt-6"
      >
        <button
          :disabled="isLoading"
          class="text-[13px] font-bold text-noble-black/40 hover:text-burning-orange transition-colors disabled:opacity-50"
          @click="loadMore"
        >
          <span v-if="isLoading" class="flex items-center gap-2">
            <Icon name="ph:spinner-gap" class="animate-spin w-4 h-4" />
            Loading...
          </span>
          <span v-else>Load More</span>
        </button>
      </div>
    </section>
  </div>
</template>
