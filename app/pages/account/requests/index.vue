<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import type { BookingStatus } from "#shared/schemas/booking"
import { useBookings } from "../../../composables/use-bookings"

definePageMeta({
  layout: "account",
  middleware: "account-auth",
})

const activeStatus = ref<BookingStatus | null>("PENDING")
const lenderRole = ref<"LENDER">("LENDER")
const searchQuery = ref("")
const actingBookingId = ref<string | null>(null)
const actionError = ref<string | null>(null)

const { filteredBookings, isLoading, hasMore, loadMore, refresh, fetchPage } = useBookings({
  role: lenderRole,
  status: activeStatus,
  searchQuery,
})

onMounted(() => void fetchPage())

const statusChips = [
  { label: "Pending", value: "PENDING" },
  { label: "Accepted", value: "CONFIRMED" },
  { label: "Declined", value: "CANCELLED" },
  { label: "Completed", value: "COMPLETED" },
] satisfies Array<{ label: string; value: BookingStatus }>

const formatUserName = (user: { firstName: string; middleName: string | null; lastName: string }) =>
  `${user.firstName} ${user.lastName}`

const formatDateTime = (value: string | Date) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

const formatPesoAmount = (value: number) =>
  `PHP ${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(value)}`

const statusBadgeClass = (status: BookingStatus) => {
  if (status === "PENDING")
    return "bg-burning-orange/[0.08] text-burning-orange border-burning-orange/20"
  if (status === "CONFIRMED")
    return "bg-success-green/[0.08] text-success-green border-success-green/20"
  if (status === "CANCELLED")
    return "bg-cinnabar-red/[0.08] text-cinnabar-red border-cinnabar-red/20"
  if (status === "COMPLETED")
    return "bg-success-green/[0.08] text-success-green border-success-green/20"
  return "bg-gray-100 text-gray-500 border-gray-200"
}

const pageTitle = computed(() => {
  if (activeStatus.value === "CONFIRMED") return "Accepted Requests"
  if (activeStatus.value === "CANCELLED") return "Declined Requests"
  if (activeStatus.value === "COMPLETED") return "Completed Requests"
  return "Booking Requests"
})

const pageSubtitle = computed(() => {
  if (activeStatus.value === "CONFIRMED") {
    return "Accepted requests that already created lender transactions"
  }

  if (activeStatus.value === "CANCELLED") {
    return "Requests you declined"
  }

  if (activeStatus.value === "COMPLETED") {
    return "Finished bookings for your listings"
  }

  return "Review incoming borrower requests and decide whether to accept or decline them"
})

const handleBookingDecision = async (
  bookingId: string,
  nextStatus: Extract<BookingStatus, "CONFIRMED" | "CANCELLED">,
) => {
  if (actingBookingId.value) return

  actingBookingId.value = bookingId
  actionError.value = null

  try {
    await $fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      body: { status: nextStatus },
    })

    await refresh()
  } catch (err: unknown) {
    const fetchError = err as {
      data?: { statusMessage?: string; error?: { message?: string } }
      statusMessage?: string
      message?: string
    }

    actionError.value =
      fetchError.data?.statusMessage ??
      fetchError.data?.error?.message ??
      fetchError.statusMessage ??
      fetchError.message ??
      "Unable to update this booking request."
  } finally {
    actingBookingId.value = null
  }
}
</script>

<template>
  <div class="mx-auto max-w-[1180px] font-geist pb-20 lg:px-16 xl:px-24">
    <!-- Header with Back Button -->
    <NuxtLink
      to="/account/listings"
      class="flex items-center gap-2 text-noble-black hover:text-burning-orange transition-colors mb-8 group w-fit"
    >
      <Icon
        name="ph:caret-left"
        class="w-[18px] h-[18px] transition-transform group-hover:-translate-x-1"
      />
      <span class="text-[15px] font-bold">Back to My Listings</span>
    </NuxtLink>

    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
      <section class="space-y-3">
        <div class="space-y-2">
          <h1 class="font-montravia text-[36px] font-medium text-noble-black">{{ pageTitle }}</h1>
          <div class="w-10 h-0.5 bg-burning-orange"></div>
        </div>
        <p class="text-[16px] font-light text-noble-black/50">
          {{ pageSubtitle }}
        </p>
      </section>
    </div>

    <!-- Content Panel -->
    <div
      class="bg-cream rounded-[24px] border border-cinnamon-ice/20 p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
    >
      <div class="border-l-[3px] border-burning-orange pl-4 mb-6">
        <h2 class="text-[20px] font-semibold text-noble-black">Requests</h2>
        <p class="text-[13px] font-light text-noble-black/50">
          Manage your incoming booking requests
        </p>
      </div>

      <!-- Action & Filter Row -->
      <div class="flex items-center mb-8">
        <!-- Status filter chips -->
        <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            v-for="status in statusChips"
            :key="status.value"
            class="px-[14px] py-1.5 rounded-full text-[13px] font-bold transition-all duration-200 shrink-0 border-[1.5px]"
            :class="
              activeStatus === status.value
                ? 'bg-burning-orange/[0.12] border-burning-orange/30 text-burning-orange'
                : 'bg-white border-gray-200 text-noble-black/40 hover:border-gray-300 hover:text-noble-black/60'
            "
            @click="activeStatus = status.value"
          >
            {{ status.label }}
          </button>
        </div>
      </div>

      <!-- Loading skeletons -->
      <template v-if="isLoading && filteredBookings.length === 0">
        <div
          v-for="i in 3"
          :key="i"
          class="animate-pulse bg-cinnamon-ice/20 rounded-2xl h-32 mb-4"
        />
      </template>

      <!-- Empty state -->
      <div
        v-else-if="!isLoading && filteredBookings.length === 0"
        class="flex flex-col items-center justify-center py-16 sm:py-20 text-center"
      >
        <div
          class="w-20 h-20 bg-cinnamon-ice/10 rounded-full flex items-center justify-center mb-6 text-cinnamon-ice/40"
        >
          <Icon name="ph:layout" class="w-10 h-10" />
        </div>
        <p class="text-noble-black text-[18px] font-semibold mb-1">No booking requests found</p>
        <p class="text-noble-black/40 text-[14px] font-light max-w-xs">
          Requests for your listings will appear here when borrowers submit them.
        </p>
      </div>

      <!-- Transaction list (Grouped & Internal Scroll) -->
      <div v-else class="max-h-[600px] overflow-y-auto pr-4 -mr-4 custom-scrollbar space-y-4">
        <article
          v-for="booking in filteredBookings"
          :key="booking.id"
          class="block bg-white rounded-[16px] border border-cinnamon-ice/20 overflow-hidden font-geist shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] transition-all duration-200"
        >
          <!-- Top Zone: Slim Header -->
          <div
            class="flex items-center justify-between px-5 py-3 border-b border-cinnamon-ice/15 bg-white/50"
          >
            <div class="flex items-center gap-3">
              <span class="text-noble-black text-[14px] font-semibold">
                {{ formatUserName(booking.borrower.user) }}
              </span>
            </div>

            <!-- Status Badge -->
            <span
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] shrink-0 border"
              :class="statusBadgeClass(booking.status)"
            >
              {{ booking.status }}
            </span>
          </div>

          <!-- Bottom Zone: Item Row -->
          <div class="p-5 flex items-center gap-4 relative">
            <!-- Thumbnail -->
            <div class="relative shrink-0">
              <img
                v-if="booking.item.thumbnailImage"
                :src="booking.item.thumbnailImage"
                class="w-16 h-16 object-cover rounded-[10px] border border-gray-100"
              />
              <div
                v-else
                class="w-16 h-16 bg-cinnamon-ice/10 rounded-[10px] border border-gray-100 flex items-center justify-center"
              >
                <Icon name="ph:image" class="w-6 h-6 text-cinnamon-ice/40" />
              </div>
            </div>

            <!-- Item Details -->
            <div class="flex-1 min-w-0">
              <h4 class="text-noble-black text-[15px] font-bold truncate leading-tight mb-1">
                {{ booking.item.name }}
              </h4>
              <div
                class="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium leading-none"
              >
                <span class="font-mono tracking-wider">{{
                  booking.id.slice(0, 12).toUpperCase()
                }}</span>
                <span class="opacity-50 select-none">·</span>
                <span
                  >{{ formatDateTime(booking.startDate) }} to
                  {{ formatDateTime(booking.endDate) }}</span
                >
              </div>

              <!-- Inline Review Actions / Accept/Decline -->
              <div
                v-if="booking.status === 'PENDING'"
                class="mt-3 flex flex-wrap gap-2 relative z-10"
              >
                <button
                  class="px-4 py-1.5 rounded-[8px] bg-white border border-burning-orange text-[12px] font-bold text-burning-orange hover:bg-burning-orange/5 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="actingBookingId === booking.id"
                  @click.stop="handleBookingDecision(booking.id, 'CANCELLED')"
                >
                  {{ actingBookingId === booking.id ? "Processing..." : "Decline" }}
                </button>
                <button
                  class="px-4 py-1.5 rounded-[8px] bg-burning-orange text-white text-[12px] font-bold hover:brightness-110 transition-all shadow-sm shadow-burning-orange/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="actingBookingId === booking.id"
                  @click.stop="handleBookingDecision(booking.id, 'CONFIRMED')"
                >
                  {{ actingBookingId === booking.id ? "Processing..." : "Accept Request" }}
                </button>
              </div>
            </div>

            <!-- Pricing Info -->
            <div class="shrink-0 z-10 text-right self-start">
              <div class="flex flex-col items-end">
                <div class="flex items-baseline gap-1.5">
                  <span class="text-[11px] text-gray-400 font-bold uppercase tracking-wider"
                    >Total:</span
                  >
                  <span class="text-[16px] font-bold text-burning-orange leading-none">{{
                    formatPesoAmount(booking.totalFee)
                  }}</span>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>

      <!-- Load More -->
      <div
        v-if="hasMore || (isLoading && filteredBookings.length > 0)"
        class="flex justify-center mt-8 sm:mt-10"
      >
        <button
          :disabled="isLoading"
          class="bg-white border-[1.5px] border-burning-orange text-burning-orange rounded-[12px] px-8 py-2.5 text-[15px] font-bold hover:bg-burning-orange/5 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          @click="loadMore"
        >
          <span v-if="isLoading" class="flex items-center gap-2">
            <Icon name="ph:circle-notch" class="w-4 h-4 animate-spin" />
            Loading…
          </span>
          <span v-else>Load More</span>
        </button>
      </div>
    </div>
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

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: theme("colors.noble-black / 10%");
  border-radius: 20px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: theme("colors.noble-black / 20%");
}
</style>
