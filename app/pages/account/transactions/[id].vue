<script setup lang="ts">
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../../../server/trpc/routers"
import { buildItemDetailPath } from "../../../utils/item-detail-route"

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
