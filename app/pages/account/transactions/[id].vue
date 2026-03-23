<script setup lang="ts">
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../../../server/trpc/routers"
import { buildItemDetailPath } from "../../../utils/item-detail-route"
import { ref, computed, onMounted } from "vue"
import type { TransactionListItem } from "../../../composables/use-transactions"


definePageMeta({
  layout: "account",
  middleware: "account-auth",
  hideAccountSidebar: true,
})

type RouterOutputs = inferRouterOutputs<AppRouter>
type BookingDetail = NonNullable<RouterOutputs["booking"]["byId"]>
type AuthMeResponse = {
  user: {
    id: string
    email: string
    name: string
  }
}

const route = useRoute()

const bookingId = computed(() => {
  const id = route.params.id
  return Array.isArray(id) ? (id[0] ?? "") : (id ?? "")
})

const { data: authData } = await useAsyncData("auth:me", () =>
  $fetch<AuthMeResponse>("/api/auth/me"),
)

const { data, pending, error, refresh } = await useAsyncData(
  () => `booking:${bookingId.value || "missing"}`,
  async () => {
    if (!bookingId.value) {
      throw createError({
        statusCode: 404,
        statusMessage: "Booking request not found.",
      })
    }

    return await $fetch<BookingDetail | null>(`/api/bookings/${bookingId.value}`)
  },
  { watch: [bookingId] },
)

if (error.value) {
  throw error.value
}

const booking = computed(() => {
  if (!data.value) {
    throw createError({
      statusCode: 404,
      statusMessage: "Booking request not found.",
    })
  }

  return data.value
})

const isActing = ref(false)
const actionErrorMessage = ref("")
const actionSuccessMessage = ref("")

const formatCurrency = (value: number) =>
  `P${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(value)}`

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")

const formatDate = (value: Date | string, options?: Intl.DateTimeFormatOptions) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  })

const formatDateTime = (value: Date | string) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

const formatRelativeTime = (value: Date | string) => {
  const targetTime = new Date(value).getTime()
  const diffMs = targetTime - Date.now()
  const diffMinutes = Math.round(diffMs / (60 * 1000))
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, "minute")
  }

  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, "hour")
  }

  const diffDays = Math.round(diffHours / 24)
  return rtf.format(diffDays, "day")
}

const computeDurationLabel = (startDate: Date | string, endDate: Date | string, unit: string) => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffMs = end.getTime() - start.getTime()

  if (unit === "PER_HOUR") {
    const hours = Math.max(1, Math.ceil(diffMs / (60 * 60 * 1000)))
    return `${hours} ${hours === 1 ? "hour" : "hours"}`
  }

  const days = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)))
  return `${days} ${days === 1 ? "day" : "days"}`
}

const bookingBadge = computed(() => {
  switch (booking.value.status) {
    case "CONFIRMED":
      return {
        label: "REQUEST APPROVED",
        className: "bg-indigo-900 text-white",
      }
    case "CANCELLED":
      return {
        label: "REQUEST DECLINED",
        className: "bg-red-300 text-white",
      }
    case "COMPLETED":
      return {
        label: "REQUEST COMPLETED",
        className: "bg-orange-500 text-white",
      }
    case "IN_DISPUTE":
      return {
        label: "REQUEST IN DISPUTE",
        className: "bg-red-300 text-white",
      }
    case "PENDING":
    default:
      return {
        label: "NEW RENTAL REQUEST",
        className: "bg-red-300 text-white",
      }
  }
})

const currentUserId = computed(() => authData.value?.user.id ?? null)
const isLender = computed(() => booking.value.lenderId === currentUserId.value)
const canRespond = computed(() => isLender.value && booking.value.status === "PENDING")

const requesterInitial = computed(() =>
  booking.value.borrower.user.firstName.charAt(0).toUpperCase(),
)
const requesterName = computed(() =>
  `${booking.value.borrower.user.firstName} ${booking.value.borrower.user.lastName}`.trim(),
)
const requesterRating = computed(() =>
  Number(booking.value.borrower.borrowerRating ?? 0).toFixed(1),
)
const requesterRentals = computed(() => booking.value.borrower._count?.bookings ?? 0)

const primaryCategory = computed(() => {
  const firstCategory = booking.value.item.categories?.[0]?.category
  return firstCategory ? titleCase(firstCategory) : "Uncategorized"
})

const itemDetailPath = computed(() =>
  buildItemDetailPath({
    id: booking.value.item.id,
    name: booking.value.item.name,
  }),
)

const durationLabel = computed(() =>
  computeDurationLabel(
    booking.value.startDate,
    booking.value.endDate,
    booking.value.item.rateOption,
  ),
)
const rateLabel = computed(() => {
  if (booking.value.item.freeToBorrow) return "Free"
  const unit = booking.value.item.rateOption === "PER_HOUR" ? "/hour" : "/day"
  return `${formatCurrency(booking.value.item.rentalFee)}${unit}`
})
const serviceFeeLabel = computed(() => formatCurrency(booking.value.platformCommission))
const rentalAmountLabel = computed(() =>
  formatCurrency(Math.max(0, booking.value.totalFee - booking.value.platformCommission)),
)
const totalEarningsLabel = computed(() =>
  formatCurrency(Math.max(0, booking.value.totalFee - booking.value.platformCommission)),
)

const contactHref = computed(() => {
  const email = booking.value.borrower.user.email
  const subject = encodeURIComponent(`TakeUP booking request for ${booking.value.item.name}`)
  return `mailto:${email}?subject=${subject}`
})

const respondToBooking = async (status: "CONFIRMED" | "CANCELLED") => {
  isActing.value = true
  actionErrorMessage.value = ""
  actionSuccessMessage.value = ""

  try {
    await $fetch(`/api/bookings/${booking.value.id}`, {
      method: "PATCH",
      body: { status },
    })
    await refresh()
    actionSuccessMessage.value =
      status === "CONFIRMED"
        ? "Booking request approved. The listing status was updated."
        : "Booking request declined."
  } catch (err: unknown) {
    actionErrorMessage.value =
      (err as { data?: { error?: { message?: string }; statusMessage?: string } })?.data?.error
        ?.message ??
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      (err as { statusMessage?: string })?.statusMessage ??
      (err as { message?: string })?.message ??
      "Unable to update the request right now."
  } finally {
    isActing.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-[1180px] space-y-6 font-geist">
    <template v-if="pending">
      <div class="space-y-4">
        <div class="h-6 w-44 rounded bg-orange-50 animate-pulse" />
        <div class="h-8 w-72 rounded bg-orange-50 animate-pulse" />
        <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div class="space-y-6">
            <div class="h-40 rounded-2xl bg-orange-50 animate-pulse" />
            <div class="h-64 rounded-2xl bg-orange-50 animate-pulse" />
            <div class="h-64 rounded-2xl bg-orange-50 animate-pulse" />
          </div>
          <div class="h-72 rounded-2xl bg-orange-50 animate-pulse" />
        </div>
      </div>
    </template>

    <template v-else>
      <div class="flex flex-col items-start gap-5">
        <NuxtLink
          to="/account/transactions"
          class="inline-flex items-center gap-2 text-sm font-medium tracking-wide text-neutral-800/80 hover:text-neutral-800 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M15 18l-6-6 6-6"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Back to Requested Items
        </NuxtLink>

        <div
          class="flex w-max rounded-full px-4 py-2 text-xs sm:text-sm font-medium tracking-wide"
          :class="bookingBadge.className"
        >
          {{ bookingBadge.label }}
        </div>
      </div>

      <div class="space-y-2 pt-1">
        <h1 class="text-3xl font-semibold tracking-wide text-neutral-800 sm:text-4xl">
          {{ booking.item.name }}
        </h1>
        <p class="text-xs font-medium tracking-tight text-neutral-800/50">
          Requested {{ formatRelativeTime(booking.requestedAt) }}
        </p>
      </div>

      <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div class="space-y-6">
          <section class="rounded-2xl border border-red-300 bg-orange-50 p-6">
            <h2 class="text-xl font-semibold text-neutral-800">Requester Information</h2>
            <div class="mt-5 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div class="flex items-center gap-4">
                <div
                  class="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500 text-3xl text-white"
                >
                  {{ requesterInitial }}
                </div>
                <div class="space-y-1">
                  <p class="text-xl font-semibold text-neutral-800">{{ requesterName }}</p>
                  <p class="text-base tracking-wide text-neutral-800/80">
                    {{ booking.borrower.user.email }}
                  </p>
                  <div class="flex items-center gap-3 text-sm text-neutral-800/80">
                    <span class="inline-flex items-center gap-1">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        class="text-orange-500"
                      >
                        <path
                          d="M12 2l2.93 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 7.07-1.01L12 2Z"
                        />
                      </svg>
                      {{ requesterRating }}
                    </span>
                    <span class="h-4 w-px bg-red-300" />
                    <span>{{ requesterRentals }} rentals</span>
                  </div>
                </div>
              </div>

              <a
                :href="contactHref"
                class="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-900 px-5 py-2.5 text-sm font-medium tracking-wide text-white hover:bg-indigo-800 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                Contact
              </a>
            </div>
          </section>

          <section class="rounded-2xl border border-red-300 bg-orange-50 p-6">
            <div class="flex flex-col gap-5 md:flex-row">
              <img
                v-if="booking.item.thumbnailImage"
                :src="booking.item.thumbnailImage"
                :alt="booking.item.name"
                class="h-44 w-44 rounded-xl object-cover"
              />
              <div
                v-else
                class="flex h-44 w-44 items-center justify-center rounded-xl bg-white text-neutral-800/40"
              >
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M4 16l4.59-4.59a2 2 0 0 1 2.82 0L16 16m-2-2 1.59-1.59a2 2 0 0 1 2.82 0L20 14m-6-6h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>

              <div class="min-w-0 flex-1">
                <p class="text-base font-medium text-orange-500">{{ primaryCategory }}</p>
                <h2 class="mt-1 text-2xl font-semibold text-indigo-950">{{ booking.item.name }}</h2>
                <p class="mt-4 text-base leading-6 tracking-wide text-neutral-800/80">
                  {{
                    booking.item.description?.trim() ||
                    "No item description was provided for this request."
                  }}
                </p>
                <NuxtLink
                  :to="itemDetailPath"
                  class="mt-5 inline-flex text-base font-medium text-orange-500 hover:text-orange-600 transition-colors"
                >
                  View Full Listing
                </NuxtLink>
              </div>
            </div>
          </section>

          <section class="rounded-2xl border border-red-300 bg-orange-50 p-6">
            <h2 class="text-xl font-semibold text-neutral-800">Rental Details</h2>
            <div class="mt-5 grid gap-4 md:grid-cols-2">
              <div class="rounded-2xl border border-red-300 bg-white px-4 py-3">
                <p class="text-sm tracking-wide text-neutral-800/50">START DATE</p>
                <p class="mt-1 text-base font-medium tracking-wide text-neutral-800">
                  {{ formatDate(booking.startDate) }}
                </p>
              </div>
              <div class="rounded-2xl border border-red-300 bg-white px-4 py-3">
                <p class="text-sm tracking-wide text-neutral-800/50">END DATE</p>
                <p class="mt-1 text-base font-medium tracking-wide text-neutral-800">
                  {{ formatDate(booking.endDate) }}
                </p>
              </div>
              <div class="rounded-2xl border border-red-300 bg-white px-4 py-3">
                <p class="text-sm tracking-wide text-neutral-800/50">DURATION</p>
                <p class="mt-1 text-base font-medium tracking-wide text-neutral-800">
                  {{ durationLabel }}
                </p>
              </div>
              <div class="rounded-2xl border border-red-300 bg-white px-4 py-3">
                <p class="text-sm tracking-wide text-neutral-800/50">RATE</p>
                <p class="mt-1 text-base font-medium tracking-wide text-neutral-800">
                  {{ rateLabel }}
                </p>
              </div>
            </div>
          </section>

          <section class="rounded-2xl border border-red-300 bg-orange-50 p-6">
            <h2 class="text-xl font-semibold text-neutral-800">Meetup Details</h2>
            <div class="mt-5 grid gap-4 md:grid-cols-2">
              <div class="rounded-2xl border border-red-300 bg-white px-4 py-3">
                <p class="text-sm tracking-wide text-neutral-800/50">LOCATION</p>
                <p class="mt-1 text-base font-medium tracking-wide text-neutral-800">
                  To be coordinated with the requester
                </p>
              </div>
              <div class="rounded-2xl border border-red-300 bg-white px-4 py-3">
                <p class="text-sm tracking-wide text-neutral-800/50">PICKUP DATE &amp; TIME</p>
                <p class="mt-1 text-base font-medium tracking-wide text-neutral-800">
                  {{ formatDateTime(booking.startDate) }}
                </p>
              </div>
              <div class="rounded-2xl border border-red-300 bg-white px-4 py-3 md:col-span-2">
                <p class="text-sm tracking-wide text-neutral-800/50">RETURN DATE &amp; TIME</p>
                <p class="mt-1 text-base font-medium tracking-wide text-neutral-800">
                  {{ formatDateTime(booking.endDate) }}
                </p>
              </div>
            </div>

            <div
              class="mt-6 flex items-start gap-3 rounded-xl border border-orange-200 bg-white px-4 py-3"
            >
              <svg
})

const route = useRoute()
const transactionId = route.params.id as string
const orderId = computed(() => transactionId.slice(0, 16).toUpperCase())

const user = useSupabaseUser()
const transaction = ref<TransactionListItem | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const isReturned = ref(false)

const userRole = computed(() => {
  if (!transaction.value || !user.value) return "BORROWER"
  return transaction.value.lenderId === user.value.id ? "LENDER" : "BORROWER"
})

const fetchTransaction = async () => {
  isLoading.value = true
  try {
    const response = await $fetch<{ transactions: TransactionListItem[] }>("/api/transactions", {
      query: { limit: 100 },
    })

    const found = response.transactions.find((t) => t.id === transactionId)
    if (found) {
      transaction.value = found
    } else {
      error.value = "Transaction not found."
    }
  } catch {
    error.value = "Unable to load transaction details."
  } finally {
    isLoading.value = false
  }
}
onMounted(() => {
  fetchTransaction()
})

const formatDate = (date: Date | string) =>
  new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

const formatDateTime = (date: Date | string) => {
  const d = new Date(date)
  const formattedDate = formatDate(d)
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
  return `${formattedDate} at ${time}`
}

const computeDuration = (startDate: Date | string, endDate: Date | string): string => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

  if (totalDays <= 0) return "1 day"
  if (totalDays === 1) return "1 day"
  if (totalDays < 7) return `${totalDays} days`

  const weeks = Math.floor(totalDays / 7)
  const remainingDays = totalDays % 7

  if (remainingDays === 0) return weeks === 1 ? "1 week" : `${weeks} weeks`

  const weekPart = weeks === 1 ? "1 week" : `${weeks} weeks`
  const dayPart = remainingDays === 1 ? "1 day" : `${remainingDays} days`
  return `${weekPart} and ${dayPart}`
}

// Mock timeline - as requested, this remains mock for now
const timeline = computed(() => [
  {
    label: "Order Placed",
    description: "You placed this order",
    date: formatDate(transaction.value?.createdAt || new Date()),
    status: "completed",
  },
  {
    label: "Payment Confirmed",
    description: `Payment of ${formatPeso(transaction.value?.totalAmount || 0)} received`,
    date: formatDate(transaction.value?.createdAt || new Date()),
    status: "completed",
  },
  {
    label: "Item Ready",
    description: "Lender prepared the item for pickup",
    date: "Oct 4, 2026",
    status: "completed",
  },
  {
    label: "Picked Up",
    description: "Item picked up at designated location",
    date: "Oct 5, 2026",
    status: "completed",
  },
  {
    label: "In Use",
    description: "Rental period started",
    date: formatDate(transaction.value?.startDate || new Date()),
    status: isReturned.value ? "completed" : "current",
  },
  {
    label: "Return Item",
    description: isReturned.value
      ? "Item returned successfully"
      : "Return by the end of rental period",
    date: formatDate(transaction.value?.endDate || new Date()),
    status: isReturned.value ? "current" : "upcoming",
  },
  {
    label: "Completed",
    description: "Deposit refunded after inspection",
    date: "--",
    status: "upcoming",
  },
])

const isReturnModalOpen = ref(false)
const isSuccessModalOpen = ref(false)
const isSubmittingReturn = ref(false)

const handleReturn = () => {
  isReturnModalOpen.value = true
}

const confirmReturn = async () => {
  isSubmittingReturn.value = true
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 1500))
  isSubmittingReturn.value = false
  isReturnModalOpen.value = false
  isReturned.value = true
  isSuccessModalOpen.value = true
}

const copyOrderId = () => {
  navigator.clipboard.writeText(transactionId)
}

const formatPeso = (value: number) =>
  `₱${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(value)}`
</script>

<template>
  <div class="font-geist pb-20">
    <!-- Header with Back Button -->
    <NuxtLink
      to="/account/transactions"
      class="flex items-center gap-2 text-noble-black hover:text-burning-orange transition-colors mb-6 group"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="transition-transform group-hover:-translate-x-1"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      <span class="text-lg font-medium">Back to My Transactions</span>
    </NuxtLink>

    <div v-if="isLoading" class="flex flex-col gap-6 animate-pulse">
      <div class="h-10 w-48 bg-cream rounded-xl"></div>
      <div class="h-6 w-96 bg-cream rounded-xl"></div>
      <div class="h-64 bg-cream rounded-3xl"></div>
    </div>

    <div v-else-if="error" class="text-center py-20">
      <p class="text-noble-black/60 mb-4">{{ error }}</p>
      <NuxtLink to="/account/transactions" class="text-burning-orange font-bold"
        >Return to Transactions</NuxtLink
      >
    </div>

    <div v-else-if="transaction">
      <!-- Page Title -->
      <h1 class="text-[25px] font-bold text-noble-black mb-2">Order Details</h1>

      <!-- Order Info Bar -->
      <div class="flex items-center justify-between mb-8">
        <div class="flex items-center gap-3 text-[15px] text-noble-black/80">
          <div class="flex items-center gap-2">
            <span class="font-normal uppercase tracking-wide">ORDER ID. {{ orderId }}</span>
            <button
              class="text-stone-400 hover:text-noble-black transition-colors"
              @click="copyOrderId"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
            </button>
          </div>
          <div class="w-px h-4 bg-stone-300"></div>
          <span class="font-normal">Placed on {{ formatDateTime(transaction.createdAt) }}</span>
        </div>

        <TransactionStatusBadge
          :status="isReturned ? 'RETURNED' : transaction.status"
          :role="userRole"
        />
      </div>

      <!-- Main Content Grid -->
      <div class="space-y-6">
        <!-- Section 1: Item Details -->
        <section class="bg-cream border border-cinnamon-ice rounded-3xl p-6">
          <h2 class="text-lg font-bold text-noble-black mb-4">Item Details</h2>
          <div class="flex gap-6">
            <img
              v-if="transaction.item.thumbnailImage"
              :src="transaction.item.thumbnailImage"
              :alt="transaction.item.name"
              class="w-32 h-32 object-cover rounded-2xl shrink-0"
            />
            <div
              v-else
              class="w-32 h-32 bg-cinnamon-ice/40 rounded-2xl shrink-0 flex items-center justify-center"
            >
              <svg
                class="w-12 h-12 text-cinnamon-ice"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div class="flex flex-col justify-center gap-1">
              <h3 class="text-xl font-bold text-noble-black">{{ transaction.item.name }}</h3>
              <p class="text-sm text-noble-black/70 line-clamp-2 max-w-xl">
                Ready for pick-up. Coordination with lender recommended for smooth handover.
              </p>
              <div class="flex items-center gap-2 mt-2 text-sm font-medium text-noble-black/80">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
                {{ formatDate(transaction.startDate) }} - {{ formatDate(transaction.endDate) }}
              </div>
            </div>
          </div>
        </section>

        <!-- Section 2: Order Timeline -->
        <section class="bg-cream border border-cinnamon-ice rounded-3xl p-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg font-bold text-noble-black">Order Timeline</h2>
            <!-- Return Action Button -->
            <button
              v-if="!isReturned"
              class="bg-burning-orange text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-estate transition-colors"
              @click="handleReturn"
            >
              Return Item
            </button>
          </div>
          <div class="space-y-0 ml-2">
            <div
              v-for="(step, index) in timeline"
              :key="index"
              class="relative flex gap-6 pb-8 last:pb-0"
            >
              <!-- Timeline Line -->
              <div
                v-if="index !== timeline.length - 1"
                class="absolute left-[11px] top-6 bottom-0 w-0.5 bg-cinnamon-ice/30"
              ></div>

              <!-- Timeline Icon/Circle -->
              <div class="relative z-10 mt-1">
                <div
                  v-if="step.status === 'completed'"
                  class="w-6 h-6 rounded-full bg-blue-estate flex items-center justify-center"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    stroke-width="4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div
                  v-else-if="step.status === 'current'"
                  class="w-6 h-6 rounded-full bg-burning-orange flex items-center justify-center"
                >
                  <div
                    class="w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center"
                  >
                    <div class="w-1 h-1 rounded-full bg-white"></div>
                  </div>
                </div>
                <div
                  v-else
                  class="w-6 h-6 rounded-full bg-cinnamon-ice flex items-center justify-center"
                >
                  <div class="w-1.5 h-1.5 rounded-full bg-burning-orange"></div>
                </div>
              </div>

              <!-- Step Content -->
              <div class="flex-1 flex justify-between items-start">
                <div>
                  <h4
                    class="font-bold text-noble-black"
                    :class="{ 'text-noble-black/40': step.status === 'upcoming' }"
                  >
                    {{ step.label }}
                  </h4>
                  <p class="text-sm text-noble-black/60">{{ step.description }}</p>
                </div>
                <span class="text-sm text-noble-black/40">{{ step.date }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Section 3: Payment Summary -->
        <section class="bg-cream border border-cinnamon-ice rounded-3xl p-6">
          <h2 class="text-lg font-bold text-noble-black mb-4">Payment Summary</h2>
          <div class="space-y-3 mb-6">
            <div class="flex justify-between items-center text-noble-black/80">
              <span
                >Rental Fee ({{
                  computeDuration(transaction.startDate, transaction.endDate)
                }})</span
              >
              <span class="font-bold">{{ formatPeso(transaction.totalAmount) }}</span>
            </div>
            <div class="flex justify-between items-center pt-3 border-t border-cinnamon-ice/30">
              <span class="text-lg font-bold text-noble-black">Total Paid</span>
              <span class="text-2xl font-bold text-burning-orange">{{
                formatPeso(transaction.totalAmount)
              }}</span>
            </div>
          </div>

          <!-- TakeUP Guarantee Box -->
          <div class="bg-blue-estate rounded-2xl p-4 flex gap-4 items-start text-white">
            <div class="p-2 rounded-xl border border-white/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"

                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                class="mt-0.5 shrink-0 text-orange-500"
              >
                <path
                  d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                  stroke-width="1.5"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h4 class="font-bold">TakeUP Guarantee</h4>
              <p class="text-xs text-white/80 leading-relaxed mt-0.5">
                Your deposit is held securely and will be refunded after successful item return and
                inspection
              </p>
            </div>
          </div>
        </section>

        <!-- Section 4: Lender Information -->
        <section class="bg-cream border border-cinnamon-ice rounded-3xl p-6">
          <h2 class="text-lg font-bold text-noble-black mb-4">Lender Information</h2>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <!-- Avatar -->
              <UserAvatar
                :user-name="`${transaction.lender.user.firstName} ${transaction.lender.user.lastName}`"
                size="lg"
              />
              <div>
                <div class="flex items-center gap-1.5">
                  <h3 class="font-bold text-noble-black">
                    {{ transaction.lender.user.firstName }} {{ transaction.lender.user.lastName }}
                  </h3>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="#34A853"
                    stroke="white"
                    stroke-width="1.5"
                  >
                    <path
                      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    />
                  </svg>
                </div>
                <div class="flex items-center gap-3 mt-1 text-sm">
                  <div class="flex items-center gap-1 text-burning-orange font-bold">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <polygon
                        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                      />
                    </svg>
                    4.9
                  </div>
                  <span class="text-noble-black/40">(124 bookings)</span>
                </div>
              </div>
            </div>
            <button
              class="w-10 h-10 shrink-0 rounded-full bg-blue-estate flex items-center justify-center hover:opacity-90 transition-opacity shadow-sm"
            >
              <svg
                class="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
                  stroke="white"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <p class="text-xs tracking-tight text-neutral-800">
                <span class="font-bold">Safety Reminder:</span>
                Always meet in public places on campus. Verify the requester&apos;s UP ID before
                handing over items.
              </p>
            </div>
          </section>
        </div>

        <aside class="h-max rounded-2xl border border-red-300 bg-orange-50 p-6 xl:sticky xl:top-24">
          <h2 class="text-2xl font-bold leading-7 tracking-tight text-black">Payment Summary</h2>
          <div class="mt-6 space-y-3 text-sm text-neutral-800/80">
            <div class="flex items-center justify-between gap-4">
              <span>Rental ({{ durationLabel }})</span>
              <span>{{ rentalAmountLabel }}</span>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span>Service Fee</span>
              <span>{{ serviceFeeLabel }}</span>
            </div>
          </div>
          <div class="my-5 h-px bg-red-300" />
          <div class="flex items-center justify-between gap-4">
            <span class="text-base font-semibold text-neutral-800">Total Earnings</span>
            <span class="text-2xl font-semibold tracking-tight text-orange-500">
              {{ totalEarningsLabel }}
            </span>
          </div>

          <div class="mt-6 space-y-3">
            <button
              v-if="canRespond"
              :disabled="isActing"
              class="w-full rounded-md bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              @click="respondToBooking('CONFIRMED')"
            >
              {{ isActing ? "Updating..." : "Approve Request" }}
            </button>
            <button
              v-if="canRespond"
              :disabled="isActing"
              class="w-full rounded-md border border-orange-500 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
              @click="respondToBooking('CANCELLED')"
            >
              {{ isActing ? "Updating..." : "Decline" }}
            </button>

            <p v-if="actionSuccessMessage" class="text-sm text-green-700">
              {{ actionSuccessMessage }}
            </p>
            <p v-if="actionErrorMessage" class="text-sm text-red-600">{{ actionErrorMessage }}</p>

            <p v-if="!canRespond" class="text-sm text-neutral-800/70">
              This request is currently {{ titleCase(booking.status) }}.
            </p>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>
            </button>
          </div>
        </section>

        <!-- File Dispute Button -->
        <button
          class="w-full flex items-center justify-center gap-2 bg-cinnabar-red text-white font-bold py-4 hover:bg-cinnabar-red/90 rounded-2xl transition-colors mt-4"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" x2="12" y1="9" y2="13" />
            <line x1="12" x2="12.01" y1="17" y2="17" />
          </svg>
          File Dispute
        </button>
      </div>
    </div>

    <!-- Return Confirmation UI (Modal) -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isReturnModalOpen"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm"
          @click="isReturnModalOpen = false"
        ></div>

        <!-- Modal -->
        <div
          class="relative bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-300"
        >
          <div class="text-center">
            <div
              class="w-20 h-20 bg-burning-orange/10 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ff7124"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m15 10-4 4 6 6" />
                <path d="M4 18V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v7" />
                <path d="M11 22a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
              </svg>
            </div>
            <h3 class="text-2xl font-bold text-noble-black mb-2">Confirm Return</h3>
            <p class="text-noble-black/60 mb-8 leading-relaxed">
              Are you sure you want to mark this item as returned? Make sure you have coordinated
              with the lender for the handover.
            </p>

            <div class="flex flex-col gap-3">
              <button
                :disabled="isSubmittingReturn"
                class="w-full bg-burning-orange text-white py-4 rounded-2xl font-bold hover:bg-blue-estate transition-colors flex items-center justify-center"
                @click="confirmReturn"
              >
                <span v-if="isSubmittingReturn" class="animate-spin mr-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                </span>
                {{ isSubmittingReturn ? "Processing..." : "Yes, I've returned it" }}
              </button>
              <button
                class="w-full bg-cream text-noble-black py-4 rounded-2xl font-bold hover:bg-pale-cashmere transition-colors"
                @click="isReturnModalOpen = false"
              >
                Not yet
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Success Modal -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isSuccessModalOpen"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm"
          @click="isSuccessModalOpen = false"
        ></div>

        <!-- Modal -->
        <div
          class="relative bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-300"
        >
          <div class="text-center">
            <div
              class="w-20 h-20 bg-success-green/10 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#34A853"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 class="text-2xl font-bold text-noble-black mb-2">Success!</h3>
            <p class="text-noble-black/60 mb-8 leading-relaxed">
              Your return request has been submitted. The lender will be notified to confirm the
              receipt of the item.
            </p>

            <button
              class="w-full bg-blue-estate text-white py-4 rounded-2xl font-bold hover:bg-indigo-900 transition-colors"
              @click="isSuccessModalOpen = false"
            >
              Great, thanks!
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.custom-time-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-time-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-time-scrollbar::-webkit-scrollbar-thumb {
  background: #dbbba7;
  border-radius: 10px;
}
</style>

