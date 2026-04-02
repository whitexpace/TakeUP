<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import type { BookingStatus } from "../../../../shared/schemas/booking"
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

const { filteredBookings, isLoading, error, hasMore, loadMore, refresh, fetchPage } = useBookings({
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
  if (status === "PENDING") return "bg-amber-100 text-amber-700"
  if (status === "CONFIRMED") return "bg-emerald-100 text-emerald-700"
  if (status === "CANCELLED") return "bg-rose-100 text-rose-700"
  if (status === "COMPLETED") return "bg-sky-100 text-sky-700"
  return "bg-orange-100 text-orange-700"
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
  <div class="font-geist space-y-6">
    <div>
      <h1 class="text-neutral-800 text-xl sm:text-2xl font-bold">{{ pageTitle }}</h1>
      <p class="text-neutral-800 text-base sm:text-lg font-normal tracking-wide mt-1">
        {{ pageSubtitle }}
      </p>
    </div>

    <div
      class="flex items-center gap-3 bg-white rounded-[20px] border-[0.5px] border-cinnamon-ice h-12 sm:h-16 px-4 sm:px-5"
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
        placeholder="Search by item, borrower, or request ID"
        class="flex-1 bg-transparent outline-none text-stone-500 text-sm sm:text-lg placeholder:text-stone-400"
      />
    </div>

    <div class="bg-cream rounded-[20px] border border-cinnamon-ice p-4 sm:p-6 space-y-5">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="chip in statusChips"
          :key="chip.value"
          class="px-4 py-2 rounded-xl text-sm sm:text-base transition-colors"
          :class="
            activeStatus === chip.value
              ? 'bg-burning-orange text-white'
              : 'bg-white border border-orange-500 text-neutral-800'
          "
          @click="activeStatus = chip.value"
        >
          {{ chip.label }}
        </button>
      </div>

      <p v-if="actionError" class="text-sm text-cinnabar-red">
        {{ actionError }}
      </p>

      <template v-if="isLoading && filteredBookings.length === 0">
        <div v-for="i in 3" :key="i" class="animate-pulse h-44 rounded-2xl bg-cinnamon-ice/40" />
      </template>

      <div
        v-else-if="error && filteredBookings.length === 0"
        class="bg-white rounded-2xl border border-red-200 p-6 text-center space-y-3"
      >
        <p class="text-red-600">{{ error }}</p>
        <button
          class="px-5 py-2 rounded-xl bg-burning-orange text-white hover:bg-cinnabar-red transition-colors"
          @click="refresh"
        >
          Retry
        </button>
      </div>

      <div
        v-else-if="!isLoading && filteredBookings.length === 0"
        class="bg-white rounded-2xl border border-red-200 p-10 text-center"
      >
        <p class="text-neutral-800 font-semibold">No requests found</p>
        <p class="text-neutral-800/60 text-sm mt-1">
          Requests for your listings will appear here when borrowers submit them.
        </p>
      </div>

      <div v-else class="space-y-4">
        <article
          v-for="booking in filteredBookings"
          :key="booking.id"
          class="bg-white rounded-2xl border border-red-200 p-4 sm:p-5"
        >
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="flex gap-4 min-w-0">
              <img
                :src="booking.item.thumbnailImage || '/images/landing-pic.jpg'"
                :alt="booking.item.name"
                class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover bg-orange-100 shrink-0"
              />

              <div class="min-w-0 space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="text-base sm:text-lg font-semibold text-neutral-800">
                    {{ booking.item.name }}
                  </h2>
                  <span
                    class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                    :class="statusBadgeClass(booking.status)"
                  >
                    {{ booking.status }}
                  </span>
                </div>

                <p class="text-sm text-neutral-800/70">
                  Borrower: {{ formatUserName(booking.borrower.user) }}
                </p>
                <p class="text-sm text-neutral-800/70">
                  Requested on {{ formatDateTime(booking.requestedAt) }}
                </p>
                <p class="text-sm text-neutral-800/70">
                  Rental window: {{ formatDateTime(booking.startDate) }} to
                  {{ formatDateTime(booking.endDate) }}
                </p>
                <p class="text-sm text-neutral-800/70">
                  Total amount:
                  {{
                    booking.item.freeToBorrow
                      ? "Free to borrow"
                      : formatPesoAmount(booking.totalFee)
                  }}
                </p>
                <p class="text-xs text-neutral-800/50">Request ID: {{ booking.id }}</p>
              </div>
            </div>

            <div
              v-if="booking.status === 'PENDING'"
              class="flex flex-col sm:flex-row gap-2 lg:w-auto w-full"
            >
              <button
                :disabled="actingBookingId === booking.id"
                class="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
                @click="handleBookingDecision(booking.id, 'CONFIRMED')"
              >
                {{ actingBookingId === booking.id ? "Updating..." : "Accept Request" }}
              </button>
              <button
                :disabled="actingBookingId === booking.id"
                class="px-4 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors disabled:opacity-60"
                @click="handleBookingDecision(booking.id, 'CANCELLED')"
              >
                {{ actingBookingId === booking.id ? "Updating..." : "Decline Request" }}
              </button>
            </div>
          </div>
        </article>
      </div>

      <div v-if="hasMore || (isLoading && filteredBookings.length > 0)" class="flex justify-center">
        <button
          :disabled="isLoading"
          class="bg-burning-orange text-white rounded-xl px-5 py-2 text-sm sm:text-base disabled:opacity-60 hover:bg-cinnabar-red transition-colors"
          @click="loadMore"
        >
          <span v-if="isLoading">Loading...</span>
          <span v-else>Load More</span>
        </button>
      </div>
    </div>
  </div>
</template>
