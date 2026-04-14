<script setup lang="ts">
import { computed, onMounted } from "vue"
import type {
  ListingAnalyticsItem,
  ListingAnalyticsRange,
} from "../../../composables/use-listing-analytics"
import { buildItemDetailPath } from "../../../utils/item-detail-route"

const {
  selectedRange,
  summary,
  listings,
  categoryBreakdown,
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
const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
})

const formatNumber = (value: number) => numberFormatter.format(value)
const formatPeso = (value: number) => pesoFormatter.format(value)
const formatRate = (value: number) => `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`

const rangeOptions: Array<{ label: string; value: ListingAnalyticsRange }> = [
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "90 Days", value: "90d" },
  { label: "All Time", value: "all" },
]

const activeRangeLabel = computed(
  () => rangeOptions.find((option) => option.value === selectedRange.value)?.label ?? "All Time",
)

const formatCategory = (category: string) =>
  category
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ")

const formatStatus = (status: string) =>
  status.charAt(0) + status.slice(1).toLowerCase().replaceAll("_", " ")

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("") || "IT"

const getItemDetailPath = (item: ListingAnalyticsItem) =>
  buildItemDetailPath({
    id: item.listingId,
    name: item.itemName,
  })

const summaryCards = computed(() => {
  const current = summary.value

  return [
    {
      label: "TOTAL VIEWS",
      value: formatNumber(current?.totalViews ?? 0),
      helper: "All-time listing views",
    },
    {
      label: "REVENUE",
      value: formatPeso(current?.totalRevenue ?? 0),
      helper: `${formatNumber(current?.totalCompletedTransactions ?? 0)} completed in ${activeRangeLabel.value}`,
    },
    {
      label: "TRANSACTIONS",
      value: formatNumber(current?.totalCompletedTransactions ?? 0),
      helper: `${formatNumber(current?.totalBookings ?? 0)} accepted bookings in ${activeRangeLabel.value}`,
    },
  ]
})

const performanceMetrics = computed(() => [
  {
    label: "Booking Rate",
    value: summary.value?.bookingRate ?? 0,
  },
  {
    label: "Completion Rate",
    value: summary.value?.completionRate ?? 0,
  },
  {
    label: "Utilization Rate",
    value: summary.value?.utilizationRate ?? 0,
  },
])

const activityItems = computed(() =>
  listings.value.filter(
    (item) =>
      item.totalViews > 0 ||
      item.totalBookings > 0 ||
      item.totalCompletedTransactions > 0 ||
      item.totalRevenue > 0 ||
      item.bookedDays > 0,
  ),
)

const topItems = computed(() =>
  [...activityItems.value]
    .sort(
      (left, right) =>
        right.totalViews - left.totalViews ||
        right.totalBookings - left.totalBookings ||
        right.totalRevenue - left.totalRevenue,
    )
    .slice(0, 5),
)

const chartItems = computed(() =>
  [...listings.value]
    .filter((item) => item.totalViews > 0)
    .sort((left, right) => right.totalViews - left.totalViews)
    .slice(0, 6),
)
const maxViews = computed(() => Math.max(...chartItems.value.map((item) => item.totalViews), 1))
const maxCategoryCount = computed(() =>
  Math.max(...categoryBreakdown.value.map((category) => category.count), 1),
)

const liveDataChips = computed(() => [
  {
    label: "Listings",
    value: formatNumber(listings.value.length),
  },
  {
    label: "Available days",
    value: formatNumber(summary.value?.availabilityDays ?? 0),
  },
  {
    label: "Booked days",
    value: formatNumber(summary.value?.bookedDays ?? 0),
  },
])

const handleRangeChange = (range: ListingAnalyticsRange) => {
  void setRange(range)
}

const listingHasNoActivity = (listing: ListingAnalyticsItem) =>
  listing.totalViews === 0 &&
  listing.totalBookings === 0 &&
  listing.totalCompletedTransactions === 0 &&
  listing.totalRevenue === 0 &&
  listing.bookedDays === 0

onMounted(() => {
  void fetchAnalytics()
})
</script>

<template>
  <div class="space-y-8 font-geist text-noble-black">
    <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.24em] text-burning-orange">
          Lender dashboard
        </p>
        <h1 class="mt-2 text-2xl font-bold text-noble-black">My Listing Analytics</h1>
        <p class="mt-2 text-base tracking-wide text-noble-black/75 sm:text-lg">
          Track your listing performance and insights.
        </p>
      </div>

      <div class="w-full space-y-3 lg:w-auto">
        <div
          class="grid rounded-[20px] border border-cinnamon-ice bg-cream p-2 text-sm font-bold text-noble-black sm:grid-cols-4"
          aria-label="Analytics date range"
        >
          <button
            v-for="option in rangeOptions"
            :key="option.value"
            class="rounded-2xl px-5 py-2 text-center transition"
            :class="
              selectedRange === option.value
                ? 'bg-burning-orange text-white'
                : 'text-noble-black/65 hover:bg-white/70'
            "
            type="button"
            @click="handleRangeChange(option.value)"
          >
            {{ option.label }}
          </button>
        </div>

        <div
          v-if="hasFetched && !error"
          class="grid w-full gap-2 text-sm font-bold text-noble-black sm:grid-cols-3"
        >
          <div
            v-for="chip in liveDataChips"
            :key="chip.label"
            class="rounded-[20px] border border-cinnamon-ice bg-cream px-4 py-3"
          >
            <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-noble-black/50">
              {{ chip.label }}
            </p>
            <p class="mt-1 text-lg font-bold text-burning-orange">{{ chip.value }}</p>
          </div>
        </div>
        <div v-else class="grid w-full gap-2 sm:grid-cols-3">
          <div
            v-for="index in 3"
            :key="index"
            class="h-[74px] rounded-[20px] border border-cinnamon-ice bg-cream"
            :class="!error ? 'animate-pulse' : ''"
          />
        </div>
      </div>
    </header>

    <section v-if="!hasFetched && !error" class="grid gap-4 md:grid-cols-3">
      <div
        v-for="index in 3"
        :key="index"
        class="h-32 animate-pulse rounded-2xl border border-cinnamon-ice bg-cream"
      />
    </section>

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
      <section class="grid gap-4 md:grid-cols-3">
        <article
          v-for="card in summaryCards"
          :key="card.label"
          class="rounded-2xl border border-cinnamon-ice bg-white p-6 shadow-sm"
        >
          <p class="text-xs font-semibold tracking-[0.18em] text-noble-black/55">
            {{ card.label }}
          </p>
          <p class="mt-3 text-2xl font-bold text-burning-orange">{{ card.value }}</p>
          <p class="mt-5 text-xs font-semibold text-blue-estate">{{ card.helper }}</p>
        </article>
      </section>

      <section
        v-if="hasFetched && !hasListings"
        class="rounded-2xl border border-cinnamon-ice bg-cream p-8 text-center"
      >
        <p class="text-xl font-bold text-noble-black">No listings yet</p>
        <p class="mt-2 text-sm text-noble-black/70">
          Publish an item first, then analytics for views, bookings, and utilization will appear
          here.
        </p>
        <NuxtLink
          class="mt-5 inline-flex rounded-2xl bg-burning-orange px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-estate"
          to="/account/listings"
        >
          Go to My Listings
        </NuxtLink>
      </section>

      <section v-else class="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.9fr)]">
        <div class="space-y-6">
          <div
            v-if="hasFetched && !hasActivity"
            class="rounded-2xl border border-cinnamon-ice bg-cream p-5"
          >
            <p class="text-lg font-bold text-noble-black">No data yet</p>
            <p class="mt-1 text-sm text-noble-black/70">
              Your listings are ready, but they do not have views, bookings, or completed
              transactions yet.
            </p>
          </div>

          <article class="rounded-2xl border border-cinnamon-ice bg-cream p-5 sm:p-8">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 class="text-xl font-bold text-noble-black">Views Snapshot</h2>
                <p class="mt-1 text-sm text-noble-black/65">
                  Current all-time view counts from your listing records.
                </p>
              </div>
              <span class="text-xs font-semibold text-burning-orange">All Time</span>
            </div>

            <div v-if="chartItems.length" class="mt-8 space-y-5">
              <div v-for="item in chartItems" :key="item.listingId" class="space-y-2">
                <div class="flex items-center justify-between gap-3 text-xs font-semibold">
                  <span class="truncate text-noble-black">{{ item.itemName }}</span>
                  <span class="text-burning-orange">{{ formatNumber(item.totalViews) }}</span>
                </div>
                <div class="h-3 overflow-hidden rounded-full bg-cinnamon-ice/50">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-burning-orange via-blue-estate to-wahoo"
                    :style="{ width: `${(item.totalViews / maxViews) * 100}%` }"
                  />
                </div>
              </div>
            </div>

            <p v-else class="mt-8 text-sm text-noble-black/65">No view data yet.</p>
          </article>

          <article class="rounded-2xl border border-cinnamon-ice bg-cream p-5 sm:p-8">
            <h2 class="text-xl font-bold text-noble-black">Performance Metrics</h2>
            <p class="mt-1 text-sm text-noble-black/65">
              Revenue, bookings, completed transactions, and utilization use {{ activeRangeLabel }}.
              Views are all-time because the app stores aggregate listing view counts.
            </p>
            <div class="mt-6 space-y-4">
              <div
                v-for="metric in performanceMetrics"
                :key="metric.label"
                class="rounded-2xl border border-cinnamon-ice bg-white p-5"
              >
                <div class="flex items-center justify-between gap-4 text-sm font-semibold">
                  <span class="text-noble-black">{{ metric.label }}</span>
                  <span class="text-burning-orange">{{ formatRate(metric.value) }}</span>
                </div>
                <div class="mt-4 h-2 overflow-hidden rounded-full bg-cinnamon-ice/50">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-burning-orange via-blue-estate to-wahoo"
                    :style="{ width: `${Math.min(metric.value, 100)}%` }"
                  />
                </div>
              </div>
            </div>
          </article>
        </div>

        <aside class="space-y-6">
          <article class="rounded-2xl border border-cinnamon-ice bg-cream p-5 sm:p-6">
            <div class="flex items-center justify-between gap-4">
              <h2 class="text-xl font-bold text-noble-black">Top Items</h2>
              <NuxtLink class="text-xs font-semibold text-burning-orange" to="/account/listings">
                View All
              </NuxtLink>
            </div>

            <div v-if="topItems.length" class="mt-6 space-y-3">
              <NuxtLink
                v-for="(item, index) in topItems"
                :key="item.listingId"
                class="grid grid-cols-[28px_42px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-cinnamon-ice bg-white p-2.5 transition hover:border-burning-orange hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-burning-orange/40"
                :to="getItemDetailPath(item)"
              >
                <span class="text-center text-lg font-semibold text-blue-estate">{{
                  index + 1
                }}</span>
                <img
                  v-if="item.thumbnailImage"
                  :alt="item.itemName"
                  class="h-10 w-10 rounded object-cover"
                  :src="item.thumbnailImage"
                />
                <div
                  v-else
                  class="flex h-10 w-10 items-center justify-center rounded bg-cinnamon-ice text-xs font-bold text-white"
                >
                  {{ getInitials(item.itemName) }}
                </div>
                <div class="min-w-0">
                  <p class="truncate text-xs font-semibold text-noble-black">{{ item.itemName }}</p>
                  <p class="truncate text-xs text-noble-black/60">
                    {{ formatNumber(item.totalBookings) }} bookings •
                    {{ formatPeso(item.totalRevenue) }}
                  </p>
                </div>
                <span class="text-right text-xs font-semibold text-burning-orange">
                  {{ formatNumber(item.totalViews) }}
                </span>
              </NuxtLink>
            </div>

            <p v-else class="mt-6 text-sm text-noble-black/65">No top items yet.</p>
          </article>

          <article class="rounded-2xl border border-cinnamon-ice bg-cream p-5 sm:p-6">
            <h2 class="text-xl font-bold text-noble-black">Items by Category</h2>

            <div v-if="categoryBreakdown.length" class="mt-6 space-y-5">
              <div v-for="category in categoryBreakdown" :key="category.category" class="space-y-2">
                <div class="flex items-center justify-between gap-4 text-xs font-semibold">
                  <span class="text-noble-black">{{ formatCategory(category.category) }}</span>
                  <span class="text-burning-orange">{{ category.count }}</span>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-cinnamon-ice/50">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-burning-orange via-blue-estate to-wahoo"
                    :style="{ width: `${(category.count / maxCategoryCount) * 100}%` }"
                  />
                </div>
              </div>
            </div>

            <p v-else class="mt-6 text-sm text-noble-black/65">No category data yet.</p>
          </article>
        </aside>
      </section>

      <section
        v-if="hasListings"
        class="rounded-2xl border border-cinnamon-ice bg-cream p-5 sm:p-8"
      >
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 class="text-xl font-bold text-noble-black">Listing Details</h2>
            <p class="mt-1 text-sm text-noble-black/65">
              Per-listing views, bookings, revenue, and availability utilization.
            </p>
          </div>
          <span class="text-xs font-semibold text-burning-orange">
            {{ listings.length }} listings tracked
          </span>
        </div>

        <div class="mt-6 grid gap-4 lg:grid-cols-2">
          <NuxtLink
            v-for="listing in listings"
            :key="listing.listingId"
            class="block rounded-2xl border border-cinnamon-ice bg-white p-5 transition hover:border-burning-orange hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-burning-orange/40"
            :class="listingHasNoActivity(listing) ? 'opacity-80' : ''"
            :to="getItemDetailPath(listing)"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <p class="truncate text-base font-bold text-noble-black">{{ listing.itemName }}</p>
                <p class="mt-1 text-xs font-semibold text-blue-estate">
                  {{ formatStatus(listing.status) }}
                </p>
              </div>
              <span
                v-if="listingHasNoActivity(listing)"
                class="rounded-full bg-cream px-3 py-1 text-[11px] font-semibold text-noble-black/60"
              >
                No data yet
              </span>
            </div>

            <div class="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <p class="text-xs font-semibold text-noble-black/50">Views</p>
                <p class="mt-1 font-bold text-burning-orange">
                  {{ formatNumber(listing.totalViews) }}
                </p>
              </div>
              <div>
                <p class="text-xs font-semibold text-noble-black/50">Bookings</p>
                <p class="mt-1 font-bold text-burning-orange">
                  {{ formatNumber(listing.totalBookings) }}
                </p>
              </div>
              <div>
                <p class="text-xs font-semibold text-noble-black/50">Completed</p>
                <p class="mt-1 font-bold text-burning-orange">
                  {{ formatNumber(listing.totalCompletedTransactions) }}
                </p>
              </div>
              <div>
                <p class="text-xs font-semibold text-noble-black/50">Revenue</p>
                <p class="mt-1 font-bold text-burning-orange">
                  {{ formatPeso(listing.totalRevenue) }}
                </p>
              </div>
              <div>
                <p class="text-xs font-semibold text-noble-black/50">Available</p>
                <p class="mt-1 font-bold text-burning-orange">
                  {{ formatNumber(listing.availabilityDays) }} days
                </p>
              </div>
              <div>
                <p class="text-xs font-semibold text-noble-black/50">Booked</p>
                <p class="mt-1 font-bold text-burning-orange">
                  {{ formatNumber(listing.bookedDays) }} days
                </p>
              </div>
            </div>
          </NuxtLink>
        </div>
      </section>
    </template>
  </div>
</template>
