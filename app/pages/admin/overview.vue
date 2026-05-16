<script setup lang="ts">
import { computed, onMounted } from "vue"
import { useAdminOverview } from "~/composables/use-admin-overview"

definePageMeta({
  layout: "admin",
  middleware: "admin-auth",
})

const { overview, isLoading, refresh, hasFetched, hasFreshCache } = useAdminOverview()

const summaryGroups = computed(() => {
  const summary = overview.value?.summary
  if (!summary) return []

  return [
    {
      group: "Users",
      items: [
        { label: "Total Accounts", value: formatCount(summary.totalUsers) },
        { label: "Active Today", value: formatCount(summary.activeUsers) },
      ],
    },
    {
      group: "Transactions",
      items: [
        { label: "Global", value: formatCount(summary.totalTransactions) },
        { label: "In Flight", value: formatCount(summary.activeTransactions) },
        { label: "Completed", value: formatCount(summary.completedTransactions) },
        { label: "Disputed", value: formatCount(summary.disputedTransactions) },
      ],
    },
    {
      group: "Listings",
      items: [
        { label: "Registry", value: formatCount(summary.totalListings) },
        { label: "Marketplace", value: formatCount(summary.activeListings) },
      ],
    },
    {
      group: "Revenue",
      items: [
        { label: "Gross Tax", value: formatMoney(summary.totalCommissionCollected) },
        { label: "System Wallet", value: formatMoney(summary.currentSystemWalletBalance) },
      ],
    },
  ]
})

const ratings = computed(() => overview.value?.ratings ?? null)
const topItems = computed(() => overview.value?.topItems ?? [])
const previews = computed(() => overview.value?.previews ?? null)

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: overview.value?.summary.currency || "PHP",
    minimumFractionDigits: 2,
  }).format(value)
}

function formatCount(value: number) {
  return value.toLocaleString()
}

function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

onMounted(() => {
  if (!hasFetched.value || !hasFreshCache.value) {
    void refresh()
  }
})
</script>

<template>
  <div class="space-y-10 font-geist">
    <!-- Standardized Executive Header -->
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="space-y-3">
        <div class="space-y-2">
          <h1 class="font-montravia text-[36px] font-medium text-noble-black">Platform Overview</h1>
          <div class="w-10 h-0.5 bg-burning-orange"></div>
        </div>
        <p class="text-[16px] font-light leading-relaxed text-noble-black/50">
          Track platform usage, transaction flow, and marketplace health from your executive
          dashboard.
        </p>
      </div>
    </header>

    <!-- Grouped KPI Grid (2x2) -->
    <section v-if="overview" class="grid gap-5 md:grid-cols-2">
      <div
        v-for="group in summaryGroups"
        :key="group.group"
        class="bg-white border border-cinnamon-ice/15 rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col transition-all hover:shadow-md hover:border-cinnamon-ice/30"
      >
        <div
          class="px-5 py-2 bg-gray-50/40 border-b border-gray-100 flex items-center justify-between"
        >
          <span class="text-[9px] font-black uppercase tracking-[3px] text-noble-black/25">{{
            group.group
          }}</span>
          <div class="w-1 h-1 rounded-full bg-burning-orange/20"></div>
        </div>
        <div class="flex divide-x divide-gray-100 h-full">
          <div
            v-for="item in group.items"
            :key="item.label"
            class="flex-1 p-4 group hover:bg-cream/5 transition-all text-center flex flex-col justify-center min-h-[90px]"
          >
            <p
              class="text-[26px] font-black text-noble-black tracking-tighter leading-none mb-2 group-hover:text-burning-orange transition-colors"
            >
              {{ item.value }}
            </p>
            <p
              class="text-[9px] font-bold uppercase tracking-widest text-noble-black/35 leading-none"
            >
              {{ item.label }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Skeleton for KPI Grid -->
    <section v-else-if="isLoading" class="grid gap-5 md:grid-cols-2">
      <div
        v-for="i in 4"
        :key="i"
        class="h-[120px] animate-pulse bg-gray-50/50 rounded-[20px] border border-gray-100"
      ></div>
    </section>

    <!-- Needs Attention Alert Strip -->
    <section
      v-if="overview?.summary.disputedTransactions && overview.summary.disputedTransactions > 0"
      class="animate-in fade-in slide-in-from-top-2 duration-700"
    >
      <div
        class="bg-amber-50 border border-amber-200/60 rounded-[14px] px-6 py-3 flex items-center justify-between shadow-sm"
      >
        <div class="flex items-center gap-4">
          <div
            class="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center border-2 border-white shadow-sm"
          >
            <Icon name="ph:warning-fill" class="w-4.5 h-4.5 text-amber-600" />
          </div>
          <p class="text-[14px] font-bold text-amber-900">
            {{ overview.summary.disputedTransactions }} disputes need your attention ·
            <span class="text-amber-900/60 font-medium"
              >Immediate administrative triage required</span
            >
          </p>
        </div>
        <NuxtLink
          to="/admin/disputes"
          class="text-[13px] font-black text-burning-orange hover:text-burning-orange/80 flex items-center gap-1 transition-colors"
        >
          Review All <Icon name="ph:arrow-right-bold" class="w-3.5 h-3.5" />
        </NuxtLink>
      </div>
    </section>

    <!-- Priority Zone 1: Recent Disputes (Full Width Table) -->
    <section
      v-if="overview"
      class="bg-white border border-cinnamon-ice/20 rounded-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.02)] overflow-hidden"
    >
      <div class="p-8 border-b border-gray-50 flex items-center justify-between">
        <div class="border-l-[3px] border-burning-orange pl-4">
          <h2 class="text-[20px] font-semibold text-noble-black">Recent Disputes</h2>
          <p class="mt-0.5 text-[13px] font-light text-noble-black/50">
            Latest concerns raised against active transactions.
          </p>
        </div>
        <NuxtLink
          to="/admin/disputes"
          class="h-10 px-6 rounded-full bg-gray-50 flex items-center justify-center text-[12px] font-black uppercase tracking-widest text-noble-black/30 hover:bg-burning-orange hover:text-white transition-all shadow-inner"
        >
          View All
        </NuxtLink>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="bg-gray-50/50 border-b border-gray-100">
              <th
                class="px-8 py-4 text-[10px] font-black uppercase tracking-[2px] text-noble-black/30"
              >
                Item
              </th>
              <th
                class="px-8 py-4 text-[10px] font-black uppercase tracking-[2px] text-noble-black/30"
              >
                Reason
              </th>
              <th
                class="px-8 py-4 text-[10px] font-black uppercase tracking-[2px] text-noble-black/30"
              >
                Raised By
              </th>
              <th
                class="px-8 py-4 text-[10px] font-black uppercase tracking-[2px] text-noble-black/30"
              >
                Status
              </th>
              <th
                class="px-8 py-4 text-[10px] font-black uppercase tracking-[2px] text-noble-black/30"
              >
                Date Raised
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            <tr
              v-for="dispute in previews?.recentDisputes ?? []"
              :key="dispute.id"
              class="group relative h-[72px] transition-colors"
            >
              <td class="px-8 py-5">
                <p class="text-[14px] font-black text-noble-black truncate max-w-[200px]">
                  {{ dispute.itemName || "Unnamed Item" }}
                </p>
              </td>
              <td class="px-8 py-5">
                <p class="text-[14px] font-medium text-noble-black/60 italic">
                  "{{ dispute.reason }}"
                </p>
              </td>
              <td class="px-8 py-5">
                <p class="text-[13px] font-bold text-noble-black/70">
                  {{ dispute.raisedByName || "System" }}
                </p>
              </td>
              <td class="px-8 py-5">
                <span
                  class="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm inline-block"
                  :class="
                    dispute.status === 'OPEN'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-amber-100 text-amber-700'
                  "
                >
                  {{ dispute.status }}
                </span>
              </td>
              <td class="px-8 py-5">
                <p class="text-[13px] font-bold text-noble-black/30">
                  {{ formatDateTime(dispute.createdAt) }}
                </p>
              </td>

              <!-- Dark Overlay with Review Button -->
              <td
                class="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none"
              >
                <div class="absolute inset-0 bg-noble-black/40"></div>
                <NuxtLink
                  :to="`/admin/disputes?id=${dispute.id}`"
                  class="relative h-11 px-8 bg-burning-orange text-white text-[13px] font-black uppercase tracking-widest rounded-full shadow-2xl active:scale-95 flex items-center gap-2 pointer-events-auto hover:brightness-110 transition-all"
                >
                  <Icon name="ph:eye-bold" class="w-4 h-4" />
                  Review Case
                </NuxtLink>
              </td>
            </tr>
            <tr v-if="!previews?.recentDisputes.length">
              <td colspan="5" class="px-8 py-20 text-center">
                <p class="text-[14px] font-bold text-noble-black/20 uppercase tracking-widest">
                  No active disputes detected
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Zone 2: Context Grid (2 Columns) -->
    <section class="grid gap-10 lg:grid-cols-2">
      <!-- Left Column: Top Rated + Recent Flow -->
      <div class="space-y-10">
        <!-- Top Rated Items -->
        <div class="bg-white border border-cinnamon-ice/20 rounded-[32px] p-8 shadow-sm">
          <div class="flex items-start justify-between mb-8">
            <div class="border-l-[3px] border-burning-orange pl-4">
              <h2 class="text-[20px] font-semibold text-noble-black">Top Rated Items</h2>
              <p class="mt-0.5 text-[13px] font-light text-noble-black/50">
                Highest-rated marketplace listings based on existing item ratings.
              </p>
            </div>
            <NuxtLink
              to="/admin/listings"
              class="shrink-0 rounded-[12px] bg-noble-black/[0.03] px-4 py-2 text-[13px] font-bold text-noble-black/60 transition-all hover:bg-burning-orange hover:text-white"
              >View All</NuxtLink
            >
          </div>
          <div class="space-y-4">
            <div
              v-for="item in topItems.slice(0, 5)"
              :key="item.id"
              class="flex items-center gap-4 group"
            >
              <div
                class="w-11 h-11 shrink-0 rounded-[14px] bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden"
              >
                <img
                  v-if="item.thumbnailImage"
                  :src="item.thumbnailImage"
                  class="w-full h-full object-cover transition-transform group-hover:scale-110"
                />
                <Icon v-else name="ph:package" class="w-5 h-5 text-noble-black/10" />
              </div>
              <div class="min-w-0 flex-1">
                <p
                  class="truncate text-[15px] font-bold text-noble-black group-hover:text-burning-orange transition-colors"
                >
                  {{ item.name }}
                </p>
                <p class="text-[13px] font-medium text-noble-black/40">
                  {{ item.reviewCount }} reviews · {{ item.bookingCount }} bookings
                </p>
              </div>
              <div class="text-right">
                <div class="flex items-center justify-end gap-1">
                  <span class="text-[16px] font-black text-burning-orange tracking-tighter">{{
                    item.averageRating.toFixed(1)
                  }}</span>
                  <Icon name="ph:star-fill" class="w-3.5 h-3.5 text-burning-orange" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Transactions -->
        <div class="bg-white border border-cinnamon-ice/20 rounded-[32px] p-8 shadow-sm">
          <div class="flex items-start justify-between mb-8">
            <div class="border-l-[3px] border-burning-orange pl-4">
              <h2 class="text-[20px] font-semibold text-noble-black">Recent Transactions</h2>
              <p class="mt-0.5 text-[13px] font-light text-noble-black/50">
                Quick visibility into the latest platform bookings and rentals.
              </p>
            </div>
            <NuxtLink
              to="/admin/transactions"
              class="shrink-0 rounded-[12px] bg-noble-black/[0.03] px-4 py-2 text-[13px] font-bold text-noble-black/60 transition-all hover:bg-burning-orange hover:text-white"
              >View All</NuxtLink
            >
          </div>
          <div class="overflow-hidden border-t border-gray-50">
            <div
              v-for="transaction in previews?.recentTransactions.slice(0, 5) ?? []"
              :key="transaction.id"
              class="flex items-center justify-between h-[64px] border-b border-gray-50 group px-2 -mx-2 hover:bg-cream/10 transition-colors"
            >
              <div class="min-w-0 flex-1 pr-6">
                <p
                  class="truncate text-[14px] font-bold text-noble-black group-hover:text-burning-orange transition-colors"
                >
                  {{ transaction.itemName }}
                </p>
                <p class="text-[11px] font-medium text-noble-black/35 truncate">
                  {{ transaction.borrowerName || "Guest" }} →
                  {{ transaction.lenderName || "Lender" }}
                </p>
              </div>
              <div class="text-right shrink-0">
                <p class="text-[14px] font-black text-noble-black mb-0.5">
                  {{ formatMoney(transaction.totalAmount) }}
                </p>
                <TransactionStatusBadge
                  :status="transaction.status"
                  context="admin"
                  class="!text-[8px] !px-1.5 !py-0.5 !tracking-widest !shadow-none !border-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Reputation + Recent Listings -->
      <div class="space-y-10">
        <!-- Ratings Summary -->
        <div class="bg-white border border-cinnamon-ice/20 rounded-[32px] p-8 shadow-sm">
          <div class="border-l-[3px] border-burning-orange pl-4 mb-8">
            <h2 class="text-[20px] font-semibold text-noble-black">Ratings Summary</h2>
            <p class="mt-0.5 text-[13px] font-light text-noble-black/50">
              Current borrower and lender reputation averages across existing ratings.
            </p>
          </div>
          <div class="grid gap-6 sm:grid-cols-2">
            <div
              class="p-6 rounded-[24px] bg-gray-50/50 border border-gray-100 transition-all hover:bg-white hover:border-cinnamon-ice/20 hover:shadow-lg"
            >
              <p class="text-[9px] font-black uppercase tracking-widest text-noble-black/30 mb-4">
                Borrower Rating
              </p>
              <div class="flex items-baseline gap-2">
                <span class="text-[32px] font-black text-burning-orange tracking-tighter">{{
                  ratings?.averageBorrowerRating ? ratings.averageBorrowerRating.toFixed(2) : "0.00"
                }}</span>
                <Icon name="ph:star-fill" class="w-4 h-4 text-burning-orange" />
              </div>
              <p class="text-[11px] font-bold text-noble-black/40 mt-2 uppercase tracking-tight">
                {{ formatCount(ratings?.ratedBorrowerCount ?? 0) }} verified borrower accounts
              </p>
            </div>
            <div
              class="p-6 rounded-[24px] bg-gray-50/50 border border-gray-100 transition-all hover:bg-white hover:border-cinnamon-ice/20 hover:shadow-lg"
            >
              <p class="text-[9px] font-black uppercase tracking-widest text-noble-black/30 mb-4">
                Lender Rating
              </p>
              <div class="flex items-baseline gap-2">
                <span class="text-[32px] font-black text-burning-orange tracking-tighter">{{
                  ratings?.averageLenderRating ? ratings.averageLenderRating.toFixed(2) : "0.00"
                }}</span>
                <Icon name="ph:star-fill" class="w-4 h-4 text-burning-orange" />
              </div>
              <p class="text-[11px] font-bold text-noble-black/40 mt-2 uppercase tracking-tight">
                {{ formatCount(ratings?.ratedLenderCount ?? 0) }} verified lender accounts
              </p>
            </div>
          </div>
        </div>

        <div class="bg-white border border-cinnamon-ice/20 rounded-[32px] p-8 shadow-sm">
          <div class="flex items-start justify-between mb-8">
            <div class="border-l-[3px] border-burning-orange pl-4">
              <h2 class="text-[20px] font-semibold text-noble-black">Recent Listings</h2>
              <p class="mt-0.5 text-[13px] font-light text-noble-black/50">
                Latest marketplace inventory added to the platform.
              </p>
            </div>
            <NuxtLink
              to="/admin/listings"
              class="shrink-0 rounded-[12px] bg-noble-black/[0.03] px-4 py-2 text-[13px] font-bold text-noble-black/60 transition-all hover:bg-burning-orange hover:text-white"
              >View All</NuxtLink
            >
          </div>
          <div class="space-y-6">
            <div
              v-for="listing in previews?.recentListings.slice(0, 5) ?? []"
              :key="listing.id"
              class="flex items-center gap-4 group"
            >
              <div
                class="w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center"
              >
                <img
                  v-if="listing.thumbnailImage"
                  :src="listing.thumbnailImage"
                  :alt="listing.name"
                  class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <Icon v-else name="ph:package" class="w-4 h-4 text-noble-black/10" />
              </div>
              <div class="min-w-0 flex-1">
                <p
                  class="truncate text-[14px] font-black text-noble-black group-hover:text-burning-orange transition-colors leading-tight"
                >
                  {{ listing.name || "Unnamed Item" }}
                </p>
                <div class="flex items-center gap-2 mt-1">
                  <span
                    class="text-[10px] font-black uppercase tracking-tighter text-noble-black/30 leading-none"
                    >{{ listing.status }}</span
                  >
                </div>
              </div>
              <div class="text-right shrink-0">
                <span class="block text-[11px] font-bold text-noble-black/20">{{
                  formatDateTime(listing.createdAt)
                }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
