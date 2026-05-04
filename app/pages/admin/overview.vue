<script setup lang="ts">
import { computed } from "vue"
import { useAdminOverview } from "~/composables/use-admin-overview"

definePageMeta({
  layout: "admin",
  middleware: "admin-auth",
})

const { overview, isLoading, error, refresh } = useAdminOverview()

const summaryCards = computed(() => {
  const summary = overview.value?.summary
  if (!summary) return []

  return [
    { label: "Total Users", value: formatCount(summary.totalUsers), detail: "Registered accounts" },
    {
      label: "Active Users",
      value: formatCount(summary.activeUsers),
      detail: `Past ${summary.activeUsersWindowDays} days`,
    },
    {
      label: "Total Transactions",
      value: formatCount(summary.totalTransactions),
      detail: "Platform-wide records",
    },
    {
      label: "Active Transactions",
      value: formatCount(summary.activeTransactions),
      detail: "Currently in progress",
    },
    {
      label: "Completed Transactions",
      value: formatCount(summary.completedTransactions),
      detail: "Completed rental flow",
    },
    {
      label: "Disputed Transactions",
      value: formatCount(summary.disputedTransactions),
      detail: "Need attention or review",
    },
    {
      label: "Total Listings",
      value: formatCount(summary.totalListings),
      detail: "Non-deleted inventory",
    },
    {
      label: "Active Listings",
      value: formatCount(summary.activeListings),
      detail: "Visible in marketplace",
    },
    {
      label: "Total Commission",
      value: formatMoney(summary.totalCommissionCollected),
      detail: "Collected platform revenue",
    },
    {
      label: "System Wallet Balance",
      value: formatMoney(summary.currentSystemWalletBalance),
      detail: "Current commission balance",
    },
  ]
})

const ratings = computed(() => overview.value?.ratings ?? null)
const topItems = computed(() => overview.value?.topItems ?? [])
const previews = computed(() => overview.value?.previews ?? null)
const lastUpdated = computed(() =>
  overview.value
    ? new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(overview.value.generatedAt))
    : null,
)

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

function formatRating(value: number | null) {
  return value === null ? "No ratings yet" : value.toFixed(2)
}
</script>

<template>
  <div class="space-y-5 font-geist">
    <section class="space-y-3">
      <div class="space-y-2">
        <h1 class="text-[28px] font-semibold text-noble-black">Platform Overview</h1>
        <div class="h-0.5 w-10 bg-burning-orange"></div>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <p class="max-w-3xl text-[16px] font-medium leading-relaxed text-noble-black/50">
          Track platform usage, transaction flow, marketplace health, and commission performance
          from one admin entry point.
        </p>
        <p v-if="lastUpdated" class="text-[12px] font-bold uppercase text-noble-black/35">
          Updated {{ lastUpdated }}
        </p>
      </div>
    </section>

    <template v-if="isLoading && !overview">
      <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div
          v-for="index in 10"
          :key="index"
          class="h-32 animate-pulse rounded-[18px] bg-cinnamon-ice/20"
        />
      </section>
      <section class="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div class="h-80 animate-pulse rounded-[24px] bg-cinnamon-ice/20"></div>
        <div class="h-80 animate-pulse rounded-[24px] bg-cinnamon-ice/20"></div>
      </section>
      <section class="grid gap-5 xl:grid-cols-3">
        <div
          v-for="index in 3"
          :key="`preview-${index}`"
          class="h-72 animate-pulse rounded-[24px] bg-cinnamon-ice/20"
        />
      </section>
    </template>

    <section
      v-else-if="error && !overview"
      class="flex flex-col items-center justify-center rounded-[24px] border border-cinnamon-ice/20 bg-cream px-6 py-14 text-center shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
    >
      <p class="text-[16px] font-semibold text-noble-black">Overview unavailable</p>
      <p class="mt-2 max-w-md text-[14px] font-medium text-noble-black/45">{{ error }}</p>
      <button
        class="mt-6 rounded-[12px] bg-burning-orange px-6 py-2.5 text-[14px] font-bold text-white shadow-lg shadow-burning-orange/20 transition-all hover:brightness-110"
        @click="refresh"
      >
        Retry
      </button>
    </section>

    <template v-else-if="overview">
      <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div
          v-for="card in summaryCards"
          :key="card.label"
          class="rounded-[18px] border border-cinnamon-ice/20 bg-cream p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
        >
          <p class="text-[12px] font-bold uppercase text-noble-black/40">{{ card.label }}</p>
          <p class="mt-2 text-[25px] font-extrabold leading-tight text-noble-black">
            {{ card.value }}
          </p>
          <p class="mt-1 text-[13px] font-medium text-noble-black/45">{{ card.detail }}</p>
        </div>
      </section>

      <section class="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div
          class="rounded-[24px] border border-cinnamon-ice/20 bg-cream p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] sm:p-8"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-[18px] font-bold text-noble-black">Top Rated Items</h2>
              <p class="mt-1 text-[14px] font-medium leading-relaxed text-noble-black/50">
                Highest-rated marketplace listings based on existing item ratings.
              </p>
            </div>
            <NuxtLink
              to="/admin/listings"
              class="shrink-0 rounded-[12px] border border-gray-200 bg-white px-4 py-2 text-[13px] font-bold text-noble-black/70 transition-all hover:border-gray-300 hover:text-noble-black"
            >
              View Listings
            </NuxtLink>
          </div>

          <div v-if="topItems.length" class="mt-6 space-y-4">
            <div
              v-for="(item, index) in topItems"
              :key="item.id"
              class="flex items-center gap-4 rounded-[18px] bg-white px-4 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            >
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-burning-orange/[0.12] text-[14px] font-extrabold text-burning-orange"
              >
                #{{ index + 1 }}
              </div>
              <img
                v-if="item.thumbnailImage"
                :src="item.thumbnailImage"
                :alt="item.name"
                class="h-14 w-14 rounded-[12px] border border-gray-100 object-cover"
              />
              <div
                v-else
                class="flex h-14 w-14 shrink-0 items-center justify-center rounded-[12px] border border-gray-100 bg-cinnamon-ice/10 text-cinnamon-ice/40"
              >
                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1.5" />
                  <circle cx="8.5" cy="8.5" r="1.5" stroke-width="1.5" />
                  <path d="m21 15-5-5L5 21" stroke-width="1.5" />
                </svg>
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-[15px] font-semibold text-noble-black">{{ item.name }}</p>
                <p class="mt-1 text-[13px] font-medium text-noble-black/45">
                  {{ item.reviewCount }} reviews · {{ item.bookingCount }} bookings
                </p>
              </div>
              <div class="text-right">
                <p class="text-[18px] font-extrabold text-noble-black">
                  {{ item.averageRating.toFixed(1) }}
                </p>
                <p class="text-[12px] font-bold uppercase text-noble-black/35">Avg. rating</p>
              </div>
            </div>
          </div>

          <div
            v-else
            class="mt-6 rounded-[18px] border border-dashed border-cinnamon-ice/40 bg-white px-5 py-10 text-center text-[14px] font-medium text-noble-black/40"
          >
            No rated public listings are available yet.
          </div>
        </div>

        <div class="space-y-5">
          <section
            class="rounded-[24px] border border-cinnamon-ice/20 bg-cream p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] sm:p-8"
          >
            <h2 class="text-[18px] font-bold text-noble-black">Ratings Summary</h2>
            <p class="mt-1 text-[14px] font-medium leading-relaxed text-noble-black/50">
              Current borrower and lender reputation averages across existing ratings.
            </p>

            <div class="mt-6 space-y-4">
              <div class="rounded-[18px] bg-white px-5 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                <p class="text-[12px] font-bold uppercase text-noble-black/35">Borrower Rating</p>
                <p class="mt-2 text-[26px] font-extrabold text-noble-black">
                  {{ formatRating(ratings?.averageBorrowerRating ?? null) }}
                </p>
                <p class="mt-1 text-[13px] font-medium text-noble-black/45">
                  {{ formatCount(ratings?.ratedBorrowerCount ?? 0) }} rated borrower accounts
                </p>
              </div>
              <div class="rounded-[18px] bg-white px-5 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                <p class="text-[12px] font-bold uppercase text-noble-black/35">Lender Rating</p>
                <p class="mt-2 text-[26px] font-extrabold text-noble-black">
                  {{ formatRating(ratings?.averageLenderRating ?? null) }}
                </p>
                <p class="mt-1 text-[13px] font-medium text-noble-black/45">
                  {{ formatCount(ratings?.ratedLenderCount ?? 0) }} rated lender accounts
                </p>
              </div>
            </div>
          </section>

          <section
            class="rounded-[24px] border border-cinnamon-ice/20 bg-cream p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
          >
            <h2 class="text-[18px] font-bold text-noble-black">Active User Rule</h2>
            <p class="mt-3 text-[14px] font-medium leading-relaxed text-noble-black/50">
              {{ overview.summary.activeUsersDefinition }}
            </p>
          </section>
        </div>
      </section>

      <section class="grid gap-5 xl:grid-cols-3">
        <div
          class="rounded-[24px] border border-cinnamon-ice/20 bg-cream p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] sm:p-8"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-[18px] font-bold text-noble-black">Recent Transactions</h2>
              <p class="mt-1 text-[14px] font-medium leading-relaxed text-noble-black/50">
                Quick visibility into the latest platform bookings and rentals.
              </p>
            </div>
            <NuxtLink
              to="/admin/transactions"
              class="shrink-0 rounded-[12px] border border-gray-200 bg-white px-4 py-2 text-[13px] font-bold text-noble-black/70 transition-all hover:border-gray-300 hover:text-noble-black"
            >
              View All
            </NuxtLink>
          </div>

          <div class="mt-6 space-y-3">
            <div
              v-for="transaction in previews?.recentTransactions ?? []"
              :key="transaction.id"
              class="rounded-[18px] bg-white px-4 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <p class="truncate text-[15px] font-semibold text-noble-black">
                    {{ transaction.itemName }}
                  </p>
                  <p class="mt-1 text-[13px] font-medium text-noble-black/45">
                    {{ transaction.borrowerName || "Former borrower" }} to
                    {{ transaction.lenderName || "Former lender" }}
                  </p>
                </div>
                <TransactionStatusBadge :status="transaction.status" context="admin" />
              </div>
              <div
                class="mt-3 flex items-center justify-between gap-4 text-[13px] font-medium text-noble-black/45"
              >
                <span>{{ formatMoney(transaction.totalAmount) }}</span>
                <span>{{ formatDateTime(transaction.createdAt) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div
          class="rounded-[24px] border border-cinnamon-ice/20 bg-cream p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] sm:p-8"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-[18px] font-bold text-noble-black">Recent Disputes</h2>
              <p class="mt-1 text-[14px] font-medium leading-relaxed text-noble-black/50">
                Latest concerns raised against active transactions.
              </p>
            </div>
            <NuxtLink
              to="/admin/disputes"
              class="shrink-0 rounded-[12px] border border-gray-200 bg-white px-4 py-2 text-[13px] font-bold text-noble-black/70 transition-all hover:border-gray-300 hover:text-noble-black"
            >
              View All
            </NuxtLink>
          </div>

          <div class="mt-6 space-y-3">
            <div
              v-for="dispute in previews?.recentDisputes ?? []"
              :key="dispute.id"
              class="rounded-[18px] bg-white px-4 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <p class="truncate text-[15px] font-semibold text-noble-black">
                    {{ dispute.itemName }}
                  </p>
                  <p class="mt-1 line-clamp-2 text-[13px] font-medium text-noble-black/45">
                    {{ dispute.reason }}
                  </p>
                </div>
                <span
                  class="shrink-0 rounded-full border border-cinnamon-ice/30 bg-burning-orange/[0.08] px-2.5 py-1 text-[11px] font-bold uppercase text-burning-orange"
                >
                  {{ dispute.status.replaceAll("_", " ") }}
                </span>
              </div>
              <div
                class="mt-3 flex items-center justify-between gap-4 text-[13px] font-medium text-noble-black/45"
              >
                <span>{{ dispute.raisedByName || "Unknown reporter" }}</span>
                <span>{{ formatDateTime(dispute.createdAt) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div
          class="rounded-[24px] border border-cinnamon-ice/20 bg-cream p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] sm:p-8"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-[18px] font-bold text-noble-black">Recent Listings</h2>
              <p class="mt-1 text-[14px] font-medium leading-relaxed text-noble-black/50">
                Latest marketplace inventory added to the platform.
              </p>
            </div>
            <NuxtLink
              to="/admin/listings"
              class="shrink-0 rounded-[12px] border border-gray-200 bg-white px-4 py-2 text-[13px] font-bold text-noble-black/70 transition-all hover:border-gray-300 hover:text-noble-black"
            >
              View All
            </NuxtLink>
          </div>

          <div class="mt-6 space-y-3">
            <div
              v-for="listing in previews?.recentListings ?? []"
              :key="listing.id"
              class="flex items-center gap-4 rounded-[18px] bg-white px-4 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            >
              <img
                v-if="listing.thumbnailImage"
                :src="listing.thumbnailImage"
                :alt="listing.name"
                class="h-14 w-14 rounded-[12px] border border-gray-100 object-cover"
              />
              <div
                v-else
                class="flex h-14 w-14 shrink-0 items-center justify-center rounded-[12px] border border-gray-100 bg-cinnamon-ice/10 text-cinnamon-ice/40"
              >
                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1.5" />
                  <circle cx="8.5" cy="8.5" r="1.5" stroke-width="1.5" />
                  <path d="m21 15-5-5L5 21" stroke-width="1.5" />
                </svg>
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-[15px] font-semibold text-noble-black">
                  {{ listing.name }}
                </p>
                <p class="mt-1 text-[13px] font-medium text-noble-black/45">
                  {{ listing.rating > 0 ? listing.rating.toFixed(1) : "No rating" }} ·
                  {{ listing.bookingCount }} bookings
                </p>
              </div>
              <div class="text-right">
                <p class="text-[11px] font-bold uppercase text-noble-black/35">
                  {{ listing.status }}
                </p>
                <p class="mt-1 text-[13px] font-medium text-noble-black/45">
                  {{ formatDateTime(listing.createdAt) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
