<script setup lang="ts">
import { computed, onMounted } from "vue"
import { buildItemDetailPath } from "~/utils/item-detail-route"

const { listings, error, hasFetched, hasListings, fetchAnalytics } = useListingAnalytics()

definePageMeta({
  layout: "account",
  middleware: "account-auth",
})

const numberFormatter = new Intl.NumberFormat("en-US")
const formatNumber = (value: number) => numberFormatter.format(value)
const formatPrice = (fee: number, free: boolean) => (free ? "Free" : `₱${formatNumber(fee)}`)

const sortedItems = computed(() =>
  [...listings.value].sort((a, b) => b.totalBookingRequests - a.totalBookingRequests),
)

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("") || "IT"

onMounted(() => {
  void fetchAnalytics()
})
</script>

<template>
  <div class="space-y-6 font-geist text-noble-black">
    <div class="flex items-center gap-3">
      <NuxtLink to="/account/analytics" class="text-sm text-burning-orange hover:underline">
        ← Back to Analytics
      </NuxtLink>
    </div>

    <div>
      <h1 class="text-2xl font-bold text-noble-black">Top Requested Items</h1>
      <p class="text-lg text-noble-black tracking-wide">
        All your items ranked by booking requests.
      </p>
    </div>

    <div v-if="!hasFetched && !error" class="flex items-center justify-center py-16">
      <div
        class="h-8 w-8 animate-spin rounded-full border-4 border-burning-orange border-t-transparent"
      />
    </div>

    <div v-else-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
      <p class="text-lg font-semibold text-red-600">Failed to load analytics</p>
      <button
        class="mt-4 rounded-lg bg-burning-orange px-6 py-2 text-sm font-semibold text-white"
        @click="fetchAnalytics()"
      >
        Retry
      </button>
    </div>

    <div
      v-else-if="!hasListings"
      class="rounded-2xl border border-cinnamon-ice bg-cream p-8 text-center"
    >
      <p class="text-lg font-semibold text-noble-black">No listings yet</p>
    </div>

    <div v-else class="space-y-3">
      <NuxtLink
        v-for="(item, index) in sortedItems"
        :key="item.listingId"
        :to="buildItemDetailPath({ id: item.listingId, name: item.itemName })"
        class="flex items-center gap-3 rounded-[5px] border-[0.5px] border-cinnamon-ice bg-white p-2.5 transition-colors hover:bg-gray-50"
      >
        <span class="w-7 text-center text-xl font-semibold text-blue-estate">{{ index + 1 }}</span>
        <img
          v-if="item.thumbnailImage"
          :alt="item.itemName"
          class="h-10 w-14 rounded-[3px] object-cover"
          :src="item.thumbnailImage"
        />
        <div
          v-else
          class="flex h-10 w-14 items-center justify-center rounded-[3px] bg-cinnamon-ice text-xs font-bold text-white"
        >
          {{ getInitials(item.itemName) }}
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-xs font-semibold text-noble-black">{{ item.itemName }}</p>
          <p class="text-xs font-normal text-noble-black/60">
            {{ item.totalBookings }} bookings • {{ formatPrice(item.rentalFee, item.freeToBorrow) }}
          </p>
        </div>
        <span class="text-xs font-semibold text-burning-orange">{{
          formatNumber(item.totalBookingRequests)
        }}</span>
      </NuxtLink>
    </div>
  </div>
</template>
