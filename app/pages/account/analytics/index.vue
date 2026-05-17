<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import type {
  ListingAnalyticsItem,
  ListingAnalyticsPreviewItem,
  ListingAnalyticsRange,
} from "../../../composables/use-listing-analytics"
import { buildItemDetailPath } from "~/utils/item-detail-route"

const {
  selectedRange,
  summary,
  listingCount,
  listings,
  previewChartItems,
  previewTopItems,
  categoryBreakdown,
  error,
  hasFetched,
  hasTopFetched,
  hasFreshCache,
  hasFreshTopCache,
  hasListings,
  hasActivity,
  fetchAnalyticsTop,
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

const getItemDetailPath = (item: ListingAnalyticsItem | ListingAnalyticsPreviewItem) =>
  buildItemDetailPath({
    id: item.listingId,
    name: item.itemName,
  })

const statCards = computed(() => {
  const current = summary.value

  return [
    {
      label: "Listings",
      value: formatNumber(listingCount.value),
      helper: "Total active listings",
      icon: "ph:squares-four",
    },
    {
      label: "Available days",
      value: formatNumber(current?.availabilityDays ?? 0),
      helper: "Total days available",
      icon: "ph:calendar-blank",
    },
    {
      label: "Booked days",
      value: formatNumber(current?.bookedDays ?? 0),
      helper: "Total days booked",
      icon: "ph:calendar-check",
    },
    {
      label: "Total Views",
      value: formatNumber(current?.totalViews ?? 0),
      helper: "All-time listing views",
      icon: "ph:eye",
    },
    {
      label: "Revenue",
      value: formatPeso(current?.totalRevenue ?? 0),
      helper: `${formatNumber(current?.totalCompletedTransactions ?? 0)} completed bookings`,
      icon: "ph:wallet",
    },
    {
      label: "Transactions",
      value: formatNumber(current?.totalCompletedTransactions ?? 0),
      helper: `${formatNumber(current?.totalBookings ?? 0)} accepted bookings`,
      icon: "ph:receipt",
    },
  ]
})

const performanceMetrics = computed(() => [
  {
    label: "Booking Rate",
    value: summary.value?.bookingRate ?? 0,
    helper: "views that became bookings",
  },
  {
    label: "Completion Rate",
    value: summary.value?.completionRate ?? 0,
    helper: "bookings fully completed",
  },
  {
    label: "Utilization Rate",
    value: summary.value?.utilizationRate ?? 0,
    helper: "available days that were booked",
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
  listings.value.length
    ? [...activityItems.value]
        .sort(
          (left, right) =>
            right.totalViews - left.totalViews ||
            right.totalBookings - left.totalBookings ||
            right.totalRevenue - left.totalRevenue,
        )
        .slice(0, 5)
    : previewTopItems.value,
)

const chartItems = computed(() =>
  listings.value.length
    ? [...listings.value]
        .filter((item) => item.totalViews > 0)
        .sort((left, right) => right.totalViews - left.totalViews)
        .slice(0, 6)
    : previewChartItems.value,
)

const hasVisibleListings = computed(() => listingCount.value > 0)

const loadAnalytics = async () => {
  if (!hasTopFetched.value || !hasFreshTopCache.value) {
    await fetchAnalyticsTop()
  }

  if (!hasFetched.value || !hasFreshCache.value) {
    void fetchAnalytics()
  }
}

const refreshAnalytics = () => {
  void refresh()
}

const maxViews = computed(() => Math.max(...chartItems.value.map((item) => item.totalViews), 1))
const maxCategoryCount = computed(() =>
  Math.max(...categoryBreakdown.value.map((category) => category.count), 1),
)

const handleRangeChange = (range: ListingAnalyticsRange) => {
  void setRange(range)
}

const listingHasNoActivity = (listing: ListingAnalyticsItem) =>
  listing.totalViews === 0 &&
  listing.totalBookings === 0 &&
  listing.totalCompletedTransactions === 0 &&
  listing.totalRevenue === 0 &&
  listing.bookedDays === 0

const showAllCategories = ref(false)
const displayedCategories = computed(() => {
  if (showAllCategories.value) return categoryBreakdown.value
  return categoryBreakdown.value.slice(0, 5)
})

type SortColumn =
  | "itemName"
  | "status"
  | "totalViews"
  | "totalBookings"
  | "totalCompletedTransactions"
  | "totalRevenue"
  | "availabilityDays"
  | "bookedDays"
const sortColumn = ref<SortColumn>("totalViews")
const sortDirection = ref<"asc" | "desc">("desc")
const listingSearchQuery = ref("")

const handleSort = (column: SortColumn) => {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc"
  } else {
    sortColumn.value = column
    sortDirection.value = "desc"
  }
}

const filteredAndSortedListings = computed(() => {
  let result = listings.value

  if (listingSearchQuery.value) {
    const query = listingSearchQuery.value.toLowerCase()
    result = result.filter((listing) => listing.itemName.toLowerCase().includes(query))
  }

  return [...result].sort((a, b) => {
    const aVal = a[sortColumn.value]
    const bVal = b[sortColumn.value]

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDirection.value === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    }

    return sortDirection.value === "asc"
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number)
  })
})

onMounted(() => {
  void loadAnalytics()
})
</script>

<template>
  <PersonalAccountPageSkeleton
    v-if="(!hasTopFetched || !hasFetched) && !error"
    has-stats
    has-sidebar
  />

  <div v-else class="mx-auto max-w-[1180px] font-geist pb-20 lg:px-16 xl:px-24 text-noble-black">
    <header class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">
      <section class="space-y-3">
        <div class="space-y-2">
          <h1 class="font-montravia text-[36px] font-medium text-noble-black">
            My Listing Analytics
          </h1>
          <div class="w-10 h-0.5 bg-burning-orange"></div>
        </div>
        <p class="text-[16px] font-light text-noble-black/50">
          Track your listing performance and insights.
        </p>
      </section>

      <!-- Redesigned time range selector -->
      <div
        class="flex items-center rounded-[20px] border-[1.5px] border-cinnamon-ice/40 bg-white p-1 overflow-hidden shrink-0"
      >
        <button
          v-for="option in rangeOptions"
          :key="option.value"
          class="h-[36px] px-4 rounded-[16px] text-[13px] font-semibold transition-colors"
          :class="
            selectedRange === option.value
              ? 'bg-burning-orange text-white shadow-sm'
              : 'text-noble-black/50 hover:text-noble-black hover:bg-gray-50'
          "
          type="button"
          @click="handleRangeChange(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </header>

    <template v-if="error">
      <section class="rounded-[24px] border border-cinnamon-ice/20 bg-cream p-6 sm:p-8 mb-8">
        <h2 class="text-xl font-semibold text-noble-black">Unable to load analytics</h2>
        <p class="mt-2 text-sm text-noble-black/70">{{ error }}</p>
        <button
          class="mt-5 rounded-[12px] bg-burning-orange px-5 py-3 text-[14px] font-bold text-white transition hover:brightness-110 active:scale-95"
          type="button"
          @click="refreshAnalytics"
        >
          Retry
        </button>
      </section>
    </template>

    <template v-else>
      <section class="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mb-8">
        <article
          v-for="card in statCards"
          :key="card.label"
          class="flex flex-col h-full rounded-[14px] border border-cinnamon-ice/20 bg-white px-5 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)]"
        >
          <div class="flex items-center justify-between mb-3">
            <Icon :name="card.icon" class="w-4 h-4 text-noble-black/40" />
          </div>
          <div>
            <p class="text-[11px] font-semibold tracking-widest text-noble-black/40 uppercase mb-1">
              {{ card.label }}
            </p>
            <p class="text-[24px] font-semibold text-noble-black leading-none mb-2">
              {{ card.value }}
            </p>
            <p class="text-[12px] font-light text-noble-black/40 leading-snug">
              {{ card.helper }}
            </p>
          </div>
        </article>
      </section>

      <section
        v-if="(hasTopFetched || hasFetched) && !hasVisibleListings"
        class="rounded-[24px] border border-cinnamon-ice/20 bg-cream p-8 text-center mb-8"
      >
        <div
          class="w-20 h-20 bg-cinnamon-ice/10 rounded-full flex items-center justify-center mx-auto mb-6 text-cinnamon-ice/40"
        >
          <Icon name="ph:squares-four" class="w-10 h-10" />
        </div>
        <p class="text-[18px] font-semibold text-noble-black">No listings yet</p>
        <p class="mt-2 text-[14px] font-light text-noble-black/50 max-w-sm mx-auto">
          Publish an item first, then analytics for views, bookings, and utilization will appear
          here.
        </p>
        <NuxtLink
          class="mt-6 inline-flex h-12 items-center justify-center rounded-[12px] bg-burning-orange px-8 text-[15px] font-bold text-white transition-all hover:brightness-110 active:scale-95 shadow-[0_4px_14px_rgba(232,101,10,0.3)]"
          to="/account/listings"
        >
          Go to My Listings
        </NuxtLink>
      </section>

      <!-- Tier 2: Middle section (2 columns) -->
      <section v-else class="flex flex-col lg:flex-row gap-6 mb-8 items-start">
        <!-- Left 65%: Main charts -->
        <div class="w-full lg:w-[65%] space-y-6">
          <div
            v-if="(hasTopFetched || hasFetched) && !hasActivity"
            class="rounded-[24px] border border-cinnamon-ice/20 bg-cream p-6"
          >
            <p class="text-[18px] font-semibold text-noble-black">No data yet</p>
            <p class="mt-1 text-[13px] font-light text-noble-black/50">
              Your listings are ready, but they do not have views, bookings, or completed
              transactions yet.
            </p>
          </div>

          <article
            class="rounded-[24px] border border-cinnamon-ice/20 bg-cream p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
          >
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div class="border-l-[3px] border-burning-orange pl-4">
                <h2 class="text-[20px] font-semibold text-noble-black">Views Snapshot</h2>
                <p class="mt-1 text-[13px] font-light text-noble-black/50">
                  Current all-time view counts from your listing records.
                </p>
              </div>
              <span
                class="text-[11px] font-bold uppercase tracking-widest text-burning-orange border border-burning-orange/20 bg-burning-orange/5 px-2.5 py-1 rounded-full"
                >All Time</span
              >
            </div>

            <div v-if="chartItems.length" class="mt-8 space-y-2">
              <div
                v-for="item in chartItems"
                :key="item.listingId"
                class="space-y-2 p-2 -mx-2 rounded-[8px] transition-colors hover:bg-burning-orange/5"
              >
                <div class="flex items-center justify-between gap-3 text-[13px]">
                  <span class="truncate text-noble-black/80">{{ item.itemName }}</span>
                  <span class="font-semibold text-burning-orange">{{
                    formatNumber(item.totalViews)
                  }}</span>
                </div>
                <div class="h-[6px] overflow-hidden rounded-full bg-noble-black/5">
                  <div
                    class="h-full rounded-full bg-burning-orange"
                    :style="{ width: `${(item.totalViews / maxViews) * 100}%` }"
                  />
                </div>
              </div>
            </div>

            <p v-else class="mt-8 text-[13px] font-medium text-noble-black/50">No view data yet.</p>
          </article>

          <article
            class="rounded-[24px] border border-cinnamon-ice/20 bg-cream p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
          >
            <div class="border-l-[3px] border-burning-orange pl-4">
              <h2 class="text-[20px] font-semibold text-noble-black">Performance Metrics</h2>
              <p class="mt-1 text-[13px] font-light text-noble-black/50">
                Revenue, bookings, completed transactions, and utilization use
                {{ activeRangeLabel }}.
              </p>
            </div>

            <div
              class="mt-8 border border-cinnamon-ice/20 bg-white rounded-[16px] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
            >
              <div class="flex flex-col">
                <div v-for="(metric, index) in performanceMetrics" :key="metric.label">
                  <div class="flex items-center justify-between gap-4 mb-2">
                    <span class="text-[13px] font-semibold text-noble-black">{{
                      metric.label
                    }}</span>
                    <span class="text-[14px] font-bold text-burning-orange">{{
                      formatRate(metric.value)
                    }}</span>
                  </div>
                  <div class="h-[6px] overflow-hidden rounded-full bg-cinnamon-ice/20 mb-2">
                    <div
                      class="h-full rounded-full bg-burning-orange"
                      :style="{ width: `${(metric.value / 100) * 100}%` }"
                    />
                  </div>
                  <p class="text-[11px] font-medium text-noble-black/40">{{ metric.helper }}</p>

                  <div
                    v-if="index !== performanceMetrics.length - 1"
                    class="h-[1px] bg-cinnamon-ice/10 w-full my-4"
                  ></div>
                </div>
              </div>
            </div>
          </article>
        </div>

        <!-- Right 35%: Sticky for secondary info -->
        <aside class="w-full lg:w-[35%] space-y-6 lg:sticky lg:top-24">
          <article
            class="rounded-[24px] border border-cinnamon-ice/20 bg-cream p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
          >
            <div class="flex items-center justify-between gap-4 mb-4">
              <div class="border-l-[3px] border-burning-orange pl-4">
                <h2 class="text-[18px] font-semibold text-noble-black">Top Items</h2>
              </div>
              <NuxtLink
                class="text-[12px] font-bold text-burning-orange hover:underline"
                to="/account/listings"
              >
                View All
              </NuxtLink>
            </div>

            <div v-if="topItems.length" class="flex flex-col">
              <NuxtLink
                v-for="(item, index) in topItems"
                :key="item.listingId"
                class="grid grid-cols-[24px_40px_minmax(0,1fr)_auto] items-center gap-3 py-3 transition-colors hover:bg-white/50"
                :class="index !== topItems.length - 1 ? 'border-b border-cinnamon-ice/10' : ''"
                :to="getItemDetailPath(item)"
              >
                <span class="text-center text-[14px] font-bold text-cinnamon-ice/80">{{
                  index + 1
                }}</span>
                <img
                  v-if="item.thumbnailImage"
                  :alt="item.itemName"
                  class="h-10 w-10 rounded-[8px] object-cover border border-cinnamon-ice/10"
                  :src="item.thumbnailImage"
                />
                <div
                  v-else
                  class="flex h-10 w-10 items-center justify-center rounded-[8px] bg-cinnamon-ice/20 text-[11px] font-bold text-noble-black/50"
                >
                  {{ getInitials(item.itemName) }}
                </div>
                <div class="min-w-0">
                  <p class="truncate text-[13px] font-semibold text-noble-black">
                    {{ item.itemName }}
                  </p>
                  <p class="truncate text-[12px] text-noble-black/40 mt-0.5">
                    {{ formatNumber(item.totalBookings) }} bookings •
                    {{ formatPeso(item.totalRevenue) }}
                  </p>
                </div>
                <span class="text-right text-[14px] font-bold text-burning-orange">
                  {{ formatNumber(item.totalViews) }}
                </span>
              </NuxtLink>
            </div>

            <p v-else class="mt-6 text-[13px] font-medium text-noble-black/50">No top items yet.</p>
          </article>

          <article
            class="rounded-[24px] border border-cinnamon-ice/20 bg-cream p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
          >
            <div class="flex items-center justify-between gap-4 mb-4">
              <div class="border-l-[3px] border-burning-orange pl-4">
                <h2 class="text-[18px] font-semibold text-noble-black">Items by Category</h2>
              </div>
              <button
                v-if="categoryBreakdown.length > 5"
                class="text-[12px] font-bold text-burning-orange hover:underline transition-colors"
                @click="showAllCategories = !showAllCategories"
              >
                {{ showAllCategories ? "Show less" : "Show all" }}
              </button>
            </div>

            <div v-if="displayedCategories.length" class="space-y-1">
              <div
                v-for="category in displayedCategories"
                :key="category.category"
                class="space-y-1.5 p-2 -mx-2 rounded-[8px] transition-colors hover:bg-burning-orange/5"
              >
                <div class="flex items-center justify-between gap-3 text-[12px]">
                  <span class="truncate text-noble-black">{{
                    formatCategory(category.category)
                  }}</span>
                  <span class="font-semibold text-noble-black">{{ category.count }}</span>
                </div>
                <div class="h-[4px] overflow-hidden rounded-full bg-cinnamon-ice/20">
                  <div
                    class="h-full rounded-full bg-burning-orange"
                    :style="{ width: `${(category.count / maxCategoryCount) * 100}%` }"
                  />
                </div>
              </div>
            </div>

            <p v-else class="text-[13px] font-medium text-noble-black/50">No category data yet.</p>
          </article>
        </aside>
      </section>

      <!-- Tier 3: Bottom section (Listing Details) -->
      <section
        v-if="hasListings"
        class="rounded-[24px] border border-cinnamon-ice/20 bg-cream p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
      >
        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div class="border-l-[3px] border-burning-orange pl-4">
            <h2 class="text-[20px] font-semibold text-noble-black">Listing Details</h2>
            <p class="mt-1 text-[13px] font-light text-noble-black/50">
              Per-listing views, bookings, revenue, and availability utilization.
            </p>
          </div>
          <span
            class="text-[11px] font-bold uppercase tracking-widest text-burning-orange border border-burning-orange/20 bg-burning-orange/5 px-2.5 py-1 rounded-full"
          >
            {{ listingCount }} listings tracked
          </span>
        </div>

        <div class="mt-6 flex flex-col gap-4">
          <div class="flex items-center">
            <input
              v-model="listingSearchQuery"
              type="text"
              placeholder="Search listings..."
              class="h-[36px] w-full max-w-sm rounded-[10px] border-[1.5px] border-cinnamon-ice/40 bg-white px-4 text-[13px] text-noble-black outline-none focus:border-burning-orange transition-colors placeholder:text-noble-black/30"
            />
          </div>

          <div
            class="overflow-x-auto rounded-[16px] border border-cinnamon-ice/20 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
          >
            <div class="max-h-[500px] overflow-y-auto custom-scrollbar">
              <table class="w-full text-left text-[13px] text-noble-black whitespace-nowrap">
                <thead
                  class="bg-cream/90 backdrop-blur-sm text-[11px] uppercase tracking-[1px] text-noble-black/40 sticky top-0 z-10 shadow-sm"
                >
                  <tr>
                    <th
                      class="px-4 py-3 font-semibold cursor-pointer hover:text-noble-black transition-colors"
                      @click="handleSort('itemName')"
                    >
                      Item Name
                      <span v-if="sortColumn === 'itemName'" class="text-burning-orange">{{
                        sortDirection === "asc" ? "↑" : "↓"
                      }}</span>
                    </th>
                    <th
                      class="px-4 py-3 font-semibold cursor-pointer hover:text-noble-black transition-colors"
                      @click="handleSort('status')"
                    >
                      Status
                      <span v-if="sortColumn === 'status'" class="text-burning-orange">{{
                        sortDirection === "asc" ? "↑" : "↓"
                      }}</span>
                    </th>
                    <th
                      class="px-4 py-3 font-semibold cursor-pointer hover:text-noble-black transition-colors text-right"
                      @click="handleSort('totalViews')"
                    >
                      Views
                      <span v-if="sortColumn === 'totalViews'" class="text-burning-orange">{{
                        sortDirection === "asc" ? "↑" : "↓"
                      }}</span>
                    </th>
                    <th
                      class="px-4 py-3 font-semibold cursor-pointer hover:text-noble-black transition-colors text-right"
                      @click="handleSort('totalBookings')"
                    >
                      Bookings
                      <span v-if="sortColumn === 'totalBookings'" class="text-burning-orange">{{
                        sortDirection === "asc" ? "↑" : "↓"
                      }}</span>
                    </th>
                    <th
                      class="px-4 py-3 font-semibold cursor-pointer hover:text-noble-black transition-colors text-right"
                      @click="handleSort('totalCompletedTransactions')"
                    >
                      Completed
                      <span
                        v-if="sortColumn === 'totalCompletedTransactions'"
                        class="text-burning-orange"
                        >{{ sortDirection === "asc" ? "↑" : "↓" }}</span
                      >
                    </th>
                    <th
                      class="px-4 py-3 font-semibold cursor-pointer hover:text-noble-black transition-colors text-right"
                      @click="handleSort('totalRevenue')"
                    >
                      Revenue
                      <span v-if="sortColumn === 'totalRevenue'" class="text-burning-orange">{{
                        sortDirection === "asc" ? "↑" : "↓"
                      }}</span>
                    </th>
                    <th
                      class="px-4 py-3 font-semibold cursor-pointer hover:text-noble-black transition-colors text-right"
                      @click="handleSort('availabilityDays')"
                    >
                      Available
                      <span v-if="sortColumn === 'availabilityDays'" class="text-burning-orange">{{
                        sortDirection === "asc" ? "↑" : "↓"
                      }}</span>
                    </th>
                    <th
                      class="px-4 py-3 font-semibold cursor-pointer hover:text-noble-black transition-colors text-right"
                      @click="handleSort('bookedDays')"
                    >
                      Booked
                      <span v-if="sortColumn === 'bookedDays'" class="text-burning-orange">{{
                        sortDirection === "asc" ? "↑" : "↓"
                      }}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="listing in filteredAndSortedListings"
                    :key="listing.listingId"
                    class="h-[52px] transition-colors even:bg-cream/50 odd:bg-white hover:bg-burning-orange/5"
                    :class="listingHasNoActivity(listing) ? 'opacity-80' : ''"
                  >
                    <td class="px-4">
                      <div class="flex items-center">
                        <NuxtLink
                          :to="getItemDetailPath(listing)"
                          class="font-semibold text-burning-orange hover:underline truncate max-w-[200px] sm:max-w-xs"
                        >
                          {{ listing.itemName }}
                        </NuxtLink>
                        <span
                          v-if="listingHasNoActivity(listing)"
                          class="inline-flex ml-2 shrink-0 rounded-full bg-cinnamon-ice/10 px-2 py-0.5 text-[11px] font-medium text-noble-black/40"
                          >No data yet</span
                        >
                      </div>
                    </td>
                    <td class="px-4">
                      <span
                        class="inline-flex rounded-full bg-cinnamon-ice/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-noble-black"
                      >
                        {{ formatStatus(listing.status) }}
                      </span>
                    </td>
                    <td class="px-4 text-right">{{ formatNumber(listing.totalViews) }}</td>
                    <td class="px-4 text-right">{{ formatNumber(listing.totalBookings) }}</td>
                    <td class="px-4 text-right">
                      {{ formatNumber(listing.totalCompletedTransactions) }}
                    </td>
                    <td class="px-4 text-right font-semibold text-burning-orange">
                      {{ formatPeso(listing.totalRevenue) }}
                    </td>
                    <td class="px-4 text-right">{{ formatNumber(listing.availabilityDays) }}</td>
                    <td class="px-4 text-right">{{ formatNumber(listing.bookedDays) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
