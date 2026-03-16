<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue"
import type { TransactionStatus } from "../../../shared/schemas/transaction"
import { useTransactions } from "../../composables/use-transactions"

definePageMeta({
  layout: "account",
})

type ActiveRole = "BORROWER" | "LENDER"

const activeRole = ref<ActiveRole>("BORROWER")
const activeStatus = ref<TransactionStatus | null>(null)
const searchQuery = ref("")

const { filteredTransactions, isLoading, error, hasMore, loadMore, refresh, fetchPage } =
  useTransactions({
    role: activeRole,
    status: activeStatus,
    searchQuery,
  })

onMounted(() => fetchPage())

const setRole = (role: ActiveRole) => {
  if (activeRole.value === role) return
  activeRole.value = role
  activeStatus.value = null
  searchQuery.value = ""
}

const setStatus = (status: TransactionStatus | null) => {
  activeStatus.value = status
}

type StatusChip = {
  label: string
  value: TransactionStatus | null
}

const statusChips = computed<StatusChip[]>(() => [
  { label: "All", value: null },
  { label: activeRole.value === "BORROWER" ? "To Receive" : "To Deliver", value: "PENDING" },
  { label: "In Use", value: "ACTIVE" },
  { label: "Completed", value: "COMPLETED" },
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
</script>

<template>
  <div class="font-geist">
    <!-- Page header -->
    <h1 class="text-neutral-800 text-xl sm:text-2xl font-bold">My Transactions</h1>
    <p class="text-neutral-800 text-base sm:text-lg font-normal tracking-wide mt-1 mb-4 sm:mb-6">
      Review your borrowing and lending history
    </p>

    <!-- Search bar -->
    <div
      class="flex items-center gap-2 sm:gap-3 bg-white rounded-[20px] border-[0.50px] border-red-300 h-12 sm:h-16 px-4 sm:px-5 mb-3 sm:mb-4"
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
        placeholder="Search by name or order ID"
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
      class="flex items-center rounded-[20px] bg-orange-50 border border-red-300 h-12 sm:h-16 overflow-hidden mb-3 sm:mb-4"
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
    <div class="bg-orange-50 rounded-[20px] border border-red-300 p-4 sm:p-6">
      <!-- Section title -->
      <h2 class="text-neutral-800 text-lg sm:text-xl font-semibold">{{ sectionTitle }}</h2>
      <p class="text-neutral-800/80 text-sm sm:text-base font-normal tracking-wide mt-1 mb-4 sm:mb-5">
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
      <template v-if="isLoading && filteredTransactions.length === 0">
        <div
          v-for="i in 3"
          :key="i"
          class="animate-pulse bg-cinnamon-ice/40 rounded-2xl h-32 sm:h-40 mb-3 sm:mb-4"
        />
      </template>

      <!-- Error state -->
      <div
        v-else-if="error && filteredTransactions.length === 0"
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
        <p class="text-neutral-800/80 text-sm sm:text-base mb-4">{{ error }}</p>
        <button
          class="bg-burning-orange text-white rounded-xl px-5 sm:px-6 py-2 text-sm sm:text-base font-normal hover:bg-cinnabar-red transition-colors"
          @click="refresh"
        >
          Retry
        </button>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="!isLoading && filteredTransactions.length === 0"
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
        <p class="text-neutral-800 text-sm sm:text-base font-semibold mb-1">
          {{
            activeRole === "BORROWER"
              ? "No borrowing transactions yet"
              : "No lending transactions yet"
          }}
        </p>
        <p class="text-neutral-800/60 text-xs sm:text-sm">
          {{
            activeRole === "BORROWER"
              ? "Items you borrow will appear here."
              : "Items you lend to others will appear here."
          }}
        </p>
      </div>

      <!-- Transaction list -->
      <div v-else class="flex flex-col gap-3 sm:gap-4">
        <TransactionCard
          v-for="tx in filteredTransactions"
          :key="tx.id"
          :transaction="tx"
          :active-role="activeRole"
        />
      </div>

      <!-- Load More -->
      <div
        v-if="hasMore || (isLoading && filteredTransactions.length > 0)"
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
  </div>
</template>
