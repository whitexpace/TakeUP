<script setup lang="ts">
import { computed, onMounted } from "vue"
import type { ListingAnalyticsRange } from "../../../composables/use-listing-analytics"
import { buildItemDetailPath } from "~/utils/item-detail-route"

const {
  selectedRange,
  summary,
  topViewedItems,
  topRequestedItems,
  topBookedItems,
  itemRatings,
  error,
  hasFetched,
  hasListings,
  hasActivity,
  fetchAnalytics,
  refresh,
  setRange,
} = useListingAnalytics()

definePageMeta({
  layout: "account",
  middleware: "account-auth",
})

const numberFormatter = new Intl.NumberFormat("en-US")
const formatNumber = (value: number) => numberFormatter.format(value)
const formatPrice = (fee: number, free: boolean) => (free ? "Free" : `₱${formatNumber(fee)}`)

const rangeOptions: Array<{ label: string; value: ListingAnalyticsRange }> = [
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "All Time", value: "all" },
]

const summaryCards = computed(() => {
  const s = summary.value
  return [
    { label: "TOTAL BOOKINGS", value: formatNumber(s?.totalBookings ?? 0) },
    { label: "TOTAL VIEWS", value: formatNumber(s?.totalViews ?? 0) },
    { label: "TOTAL BOOKING REQUESTS", value: formatNumber(s?.totalBookingRequests ?? 0) },
    { label: "OVERALL ITEM RATING", value: (s?.overallItemRating ?? 0).toFixed(1) },
  ]
})

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("") || "IT"

const handleRangeChange = (range: ListingAnalyticsRange) => {
  void setRange(range)
}

onMounted(() => {
  void fetchAnalytics()
})
</script>

<template>
  <div class="space-y-8 font-geist text-noble-black">
    <!-- Page Header -->
    <header>
      <h1 class="text-2xl font-bold text-noble-black">My Listing Analytics</h1>
      <p class="mt-2 text-lg font-normal tracking-wide text-noble-black">
        Track your listing performance and insights.
      </p>
    </header>

    <!-- Range Selector -->
    <div class="flex justify-end">
      <div
        class="inline-flex rounded-[20px] border border-cinnamon-ice bg-cream p-1.5"
        aria-label="Analytics date range"
      >
        <button
          v-for="option in rangeOptions"
          :key="option.value"
          class="rounded-[20px] px-6 py-2.5 text-xl font-bold transition"
          :class="
            selectedRange === option.value
              ? 'bg-burning-orange text-white'
              : 'text-noble-black hover:bg-white/70'
          "
          type="button"
          @click="handleRangeChange(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <section v-if="!hasFetched && !error" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="index in 4"
        :key="index"
        class="h-32 animate-pulse rounded-2xl border border-cinnamon-ice bg-cream"
      />
    </section>

    <!-- Error State -->
    <section v-else-if="error" class="rounded-2xl border border-cinnamon-ice bg-cream p-6 sm:p-8">
      <h2 class="text-xl font-bold text-noble-black">Unable to load analytics</h2>
      <p class="mt-2 text-sm text-noble-black/70">{{ error }}</p>
      <button
        class="mt-5 rounded-2xl bg-burning-orange px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-estate"
        type="button"
        @click="refresh"
      >
        Retry
      </button>
    </section>

    <template v-else>
      <!-- Summary Cards -->
      <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article
          v-for="card in summaryCards"
          :key="card.label"
          class="rounded-2xl border-[0.5px] border-cinnamon-ice bg-white p-5"
        >
          <p class="text-xs font-semibold text-noble-black/60">{{ card.label }}</p>
          <p class="mt-3 text-lg font-bold text-burning-orange">{{ card.value }}</p>
          <p class="mt-3 flex items-center gap-1 text-xs font-semibold text-blue-estate">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="shrink-0">
              <path
                d="M4.38 4.38L7.5 4.38"
                stroke="currentColor"
                stroke-width="1"
                stroke-linecap="round"
              />
              <path
                d="M7.5 4.38L7.5 7.5"
                stroke="currentColor"
                stroke-width="1"
                stroke-linecap="round"
              />
            </svg>
            15% from last month
          </p>
        </article>
      </section>

      <!-- No listings state -->
      <section
        v-if="hasFetched && !hasListings"
        class="rounded-2xl border border-cinnamon-ice bg-cream p-8 text-center"
      >
        <p class="text-xl font-bold text-noble-black">No listings yet</p>
        <p class="mt-2 text-sm text-noble-black/70">
          Publish an item first, then analytics for views, bookings, and ratings will appear here.
        </p>
        <NuxtLink
          class="mt-5 inline-flex rounded-2xl bg-burning-orange px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-estate"
          to="/account/listings"
        >
          Go to My Listings
        </NuxtLink>
      </section>

      <!-- No activity state -->
      <section
        v-else-if="hasFetched && hasListings && !hasActivity"
        class="rounded-2xl border border-cinnamon-ice bg-cream p-5"
      >
        <p class="text-lg font-bold text-noble-black">No data yet</p>
        <p class="mt-1 text-sm text-noble-black/70">
          Your listings are ready, but they don't have views, bookings, or completed transactions
          yet.
        </p>
      </section>

      <!-- Ranked Sections (2×2 grid) -->
      <section v-if="hasListings" class="grid gap-6 lg:grid-cols-2">
        <!-- Top Viewed Items -->
        <article class="rounded-2xl border border-cinnamon-ice bg-cream p-5 sm:p-6">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold text-noble-black">Top viewed items</h2>
            <NuxtLink
              class="text-xs font-semibold text-burning-orange"
              to="/account/analytics/top-viewed"
            >
              View All
            </NuxtLink>
          </div>
          <div v-if="topViewedItems.length" class="mt-5 space-y-3">
            <NuxtLink
              v-for="(item, index) in topViewedItems"
              :key="item.itemId"
              :to="buildItemDetailPath({ id: item.itemId, name: item.name })"
              class="flex items-center gap-3 rounded-[5px] border-[0.5px] border-cinnamon-ice bg-white p-2.5 transition-colors hover:bg-gray-50"
            >
              <span class="w-7 text-center text-xl font-semibold text-blue-estate">{{
                index + 1
              }}</span>
              <img
                v-if="item.thumbnailImage"
                :alt="item.name"
                class="h-10 w-14 rounded-[3px] object-cover"
                :src="item.thumbnailImage"
              />
              <div
                v-else
                class="flex h-10 w-14 items-center justify-center rounded-[3px] bg-cinnamon-ice text-xs font-bold text-white"
              >
                {{ getInitials(item.name) }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-semibold text-noble-black">{{ item.name }}</p>
                <p class="text-xs font-normal text-noble-black/60">
                  {{ item.bookingCount }} bookings •
                  {{ formatPrice(item.rentalFee, item.freeToBorrow) }}
                </p>
              </div>
              <span class="text-xs font-semibold text-burning-orange">{{
                formatNumber(item.viewCount)
              }}</span>
            </NuxtLink>
          </div>
          <p v-else class="mt-5 text-sm text-noble-black/65">No view data yet.</p>
        </article>

        <!-- Top Booked Items -->
        <article class="rounded-2xl border border-cinnamon-ice bg-cream p-5 sm:p-6">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold text-noble-black">Top booked items</h2>
            <NuxtLink
              class="text-xs font-semibold text-burning-orange"
              to="/account/analytics/top-booked"
            >
              View All
            </NuxtLink>
          </div>
          <div v-if="topBookedItems.length" class="mt-5 space-y-3">
            <NuxtLink
              v-for="(item, index) in topBookedItems"
              :key="item.itemId"
              :to="buildItemDetailPath({ id: item.itemId, name: item.name })"
              class="flex items-center gap-3 rounded-[5px] border-[0.5px] border-cinnamon-ice bg-white p-2.5 transition-colors hover:bg-gray-50"
            >
              <span class="w-7 text-center text-xl font-semibold text-blue-estate">{{
                index + 1
              }}</span>
              <img
                v-if="item.thumbnailImage"
                :alt="item.name"
                class="h-10 w-14 rounded-[3px] object-cover"
                :src="item.thumbnailImage"
              />
              <div
                v-else
                class="flex h-10 w-14 items-center justify-center rounded-[3px] bg-cinnamon-ice text-xs font-bold text-white"
              >
                {{ getInitials(item.name) }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-semibold text-noble-black">{{ item.name }}</p>
                <p class="text-xs font-normal text-noble-black/60">
                  {{ item.bookingCount }} bookings •
                  {{ formatPrice(item.rentalFee, item.freeToBorrow) }}
                </p>
              </div>
              <span class="text-xs font-semibold text-burning-orange">{{
                formatNumber(item.bookingCount)
              }}</span>
            </NuxtLink>
          </div>
          <p v-else class="mt-5 text-sm text-noble-black/65">No booking data yet.</p>
        </article>

        <!-- Top Requested Items -->
        <article class="rounded-2xl border border-cinnamon-ice bg-cream p-5 sm:p-6">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold text-noble-black">Top requested items</h2>
            <NuxtLink
              class="text-xs font-semibold text-burning-orange"
              to="/account/analytics/top-requested"
            >
              View All
            </NuxtLink>
          </div>
          <div v-if="topRequestedItems.length" class="mt-5 space-y-3">
            <NuxtLink
              v-for="(item, index) in topRequestedItems"
              :key="item.itemId"
              :to="buildItemDetailPath({ id: item.itemId, name: item.name })"
              class="flex items-center gap-3 rounded-[5px] border-[0.5px] border-cinnamon-ice bg-white p-2.5 transition-colors hover:bg-gray-50"
            >
              <span class="w-7 text-center text-xl font-semibold text-blue-estate">{{
                index + 1
              }}</span>
              <img
                v-if="item.thumbnailImage"
                :alt="item.name"
                class="h-10 w-14 rounded-[3px] object-cover"
                :src="item.thumbnailImage"
              />
              <div
                v-else
                class="flex h-10 w-14 items-center justify-center rounded-[3px] bg-cinnamon-ice text-xs font-bold text-white"
              >
                {{ getInitials(item.name) }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-semibold text-noble-black">{{ item.name }}</p>
                <p class="text-xs font-normal text-noble-black/60">
                  {{ item.bookingCount }} bookings •
                  {{ formatPrice(item.rentalFee, item.freeToBorrow) }}
                </p>
              </div>
              <span class="text-xs font-semibold text-burning-orange">{{
                formatNumber(item.requestCount)
              }}</span>
            </NuxtLink>
          </div>
          <p v-else class="mt-5 text-sm text-noble-black/65">No request data yet.</p>
        </article>

        <!-- Item Ratings -->
        <article class="rounded-2xl border border-cinnamon-ice bg-cream p-5 sm:p-6">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold text-noble-black">Item ratings</h2>
            <NuxtLink
              class="text-xs font-semibold text-burning-orange"
              to="/account/analytics/item-ratings"
            >
              View All
            </NuxtLink>
          </div>
          <div v-if="itemRatings.length" class="mt-5 space-y-3">
            <NuxtLink
              v-for="(item, index) in itemRatings"
              :key="item.itemId"
              :to="buildItemDetailPath({ id: item.itemId, name: item.name })"
              class="flex items-center gap-3 rounded-[5px] border-[0.5px] border-cinnamon-ice bg-white p-2.5 transition-colors hover:bg-gray-50"
            >
              <span class="w-7 text-center text-xl font-semibold text-blue-estate">{{
                index + 1
              }}</span>
              <img
                v-if="item.thumbnailImage"
                :alt="item.name"
                class="h-10 w-14 rounded-[3px] object-cover"
                :src="item.thumbnailImage"
              />
              <div
                v-else
                class="flex h-10 w-14 items-center justify-center rounded-[3px] bg-cinnamon-ice text-xs font-bold text-white"
              >
                {{ getInitials(item.name) }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-semibold text-noble-black">{{ item.name }}</p>
                <p class="text-xs font-normal text-noble-black/60">
                  {{ item.bookingCount }} bookings •
                  {{ formatPrice(item.rentalFee, item.freeToBorrow) }}
                </p>
              </div>
              <span class="text-xs font-normal text-noble-black/60">{{
                item.rating.toFixed(1)
              }}</span>
            </NuxtLink>
          </div>
          <p v-else class="mt-5 text-sm text-noble-black/65">No rating data yet.</p>
        </article>
      </section>
    </template>
  </div>
</template>
