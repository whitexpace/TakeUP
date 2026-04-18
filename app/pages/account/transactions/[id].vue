<script setup lang="ts">
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../../../server/trpc/routers"
import type { ReviewType } from "../../../../shared/schemas/review"
import { isChatAvailableForBookingStatus } from "../../../../shared/chat-rules"
import { buildItemDetailPath } from "../../../utils/item-detail-route"

definePageMeta({
  layout: "account",
  middleware: "account-auth",
  hideAccountSidebar: false,
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
const router = useRouter()
const bookingId = computed(() => {
  const id = route.params.id
  return Array.isArray(id) ? (id[0] ?? "") : (id ?? "")
})

const orderIdForDisplay = computed(() => bookingId.value.slice(0, 16).toUpperCase())

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

const { data: reviewState, refresh: refreshReviewState } = await useAsyncData(
  () => `booking-review:${bookingId.value || "missing"}`,
  async () => {
    if (!bookingId.value) {
      return {
        canSubmit: false,
        review: null,
        transactionId: null,
      }
    }

    return await $fetch<{
      canSubmit: boolean
      transactionId: string | null
      review: null | {
        id: string
        rating: number
        reviewText: string | null
        isAnonymous: boolean
        createdAt: string | Date
      }
    }>(`/api/reviews/booking/${bookingId.value}`)
  },
  { watch: [bookingId] },
)

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

const currentUserId = computed(() => authData.value?.user.id ?? null)
const isLender = computed(() => booking.value.lenderId === currentUserId.value)
const userRole = computed<"LENDER" | "BORROWER">(() => (isLender.value ? "LENDER" : "BORROWER"))
const canRespond = computed(() => isLender.value && booking.value.status === "PENDING")
const canConfirmReceipt = computed(() => isLender.value && booking.value.status === "RETURNED")
const canOpenChat = computed(
  () =>
    Boolean(booking.value.transactionId) && isChatAvailableForBookingStatus(booking.value.status),
)

const mappedStatus = computed(() => {
  switch (booking.value.status) {
    case "PENDING":
      return "PENDING"
    case "CONFIRMED":
      return "ACTIVE"
    case "RETURNED":
      return "RETURNED"
    case "CANCELLED":
      return "CANCELLED"
    case "COMPLETED":
      return "COMPLETED"
    case "IN_DISPUTE":
      return "IN_DISPUTE"
    default:
      return "PENDING"
  }
})

const formatPeso = (value: number) =>
  `₱${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(value)}`

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
  const totalDays = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  )

  if (totalDays === 1) return "1 day"
  if (totalDays < 7) return `${totalDays} days`

  const weeks = Math.floor(totalDays / 7)
  const remainingDays = totalDays % 7

  if (remainingDays === 0) return weeks === 1 ? "1 week" : `${weeks} weeks`

  const weekPart = weeks === 1 ? "1 week" : `${weeks} weeks`
  const dayPart = remainingDays === 1 ? "1 day" : `${remainingDays} days`
  return `${weekPart} and ${dayPart}`
}

const itemDetailPath = computed(() =>
  buildItemDetailPath({
    id: booking.value.item.id,
    name: booking.value.item.name,
  }),
)

const backToTransactionsPath = computed(() => {
  return `/account/transactions?role=${userRole.value}`
})

// Timeline logic
const timeline = computed(() => {
  const steps = [
    {
      label: "Order Placed",
      description: isLender.value ? "Borrower placed this order" : "You placed this order",
      date: formatDate(booking.value.requestedAt),
      status: "completed",
    },
    {
      label: "Request Approved",
      description:
        booking.value.status === "PENDING"
          ? isLender.value
            ? "Waiting for your approval"
            : "Waiting for lender's approval"
          : "Lender approved the request",
      date: booking.value.confirmedAt ? formatDate(booking.value.confirmedAt) : "--",
      status:
        booking.value.status === "PENDING"
          ? "current"
          : ["CONFIRMED", "RETURNED", "COMPLETED", "IN_DISPUTE"].includes(booking.value.status)
            ? "completed"
            : "upcoming",
    },
    {
      label: "Picked Up",
      description: "Item picked up at designated location",
      date: formatDate(booking.value.startDate),
      status: ["CONFIRMED", "RETURNED", "COMPLETED", "IN_DISPUTE"].includes(booking.value.status)
        ? "completed"
        : "upcoming",
    },
    {
      label: "In Use",
      description: "Rental period started",
      date: formatDate(booking.value.startDate),
      status: ["CONFIRMED", "RETURNED", "COMPLETED", "IN_DISPUTE"].includes(booking.value.status)
        ? booking.value.status === "CONFIRMED"
          ? "current"
          : "completed"
        : "upcoming",
    },
    {
      label: "Return Item",
      description: ["RETURNED", "COMPLETED"].includes(booking.value.status)
        ? "Item returned successfully"
        : "Return by the end of rental period",
      date: booking.value.returnedAt
        ? formatDate(booking.value.returnedAt)
        : formatDate(booking.value.endDate),
      status:
        booking.value.status === "RETURNED"
          ? "current"
          : booking.value.status === "COMPLETED"
            ? "completed"
            : "upcoming",
    },
    {
      label: "Completed",
      description: "Transaction completed after inspection",
      date: booking.value.completedAt ? formatDate(booking.value.completedAt) : "--",
      status: booking.value.status === "COMPLETED" ? "current" : "upcoming",
    },
  ]
  return steps
})

const isReturnModalOpen = ref(false)
const isSuccessModalOpen = ref(false)
const isSubmittingReturn = ref(false)
const isReviewModalOpen = ref(false)
const selectedReviewType = ref<ReviewType | null>(null)
const isSubmittingReview = ref(false)
const reviewErrorMessage = ref("")
const reviewSuccessMessage = ref("")
const reviewForm = reactive({
  rating: 5,
  reviewText: "",
  isAnonymous: false,
})
const canSubmitReview = computed(() => reviewState.value?.canSubmit ?? false)
const currentUserReview = computed(() => reviewState.value?.review ?? null)

const handleReturn = () => {
  actionErrorMessage.value = ""
  isReturnModalOpen.value = true
}

const confirmReturn = async () => {
  isSubmittingReturn.value = true
  actionErrorMessage.value = ""
  actionSuccessMessage.value = ""
  try {
    await $fetch(`/api/bookings/${booking.value.id}/return`, {
      method: "POST",
    })
    await refresh()
    isReturnModalOpen.value = false
    isSuccessModalOpen.value = true
    actionSuccessMessage.value = "Return submitted. The lender was notified to confirm receipt."
  } catch (err: unknown) {
    const errorData = (
      err as {
        data?: {
          error?: { message?: string }
          statusMessage?: string
        }
      }
    )?.data

    actionErrorMessage.value =
      errorData?.error?.message ??
      errorData?.statusMessage ??
      "Unable to submit the return right now."
  } finally {
    isSubmittingReturn.value = false
  }
}

const confirmReceipt = async () => {
  isActing.value = true
  actionErrorMessage.value = ""
  actionSuccessMessage.value = ""

  try {
    await $fetch(`/api/bookings/${booking.value.id}`, {
      method: "PATCH",
      body: { status: "COMPLETED" },
    })
    await refresh()
    actionSuccessMessage.value = "Return confirmed. The transaction is now complete."
  } catch (err: unknown) {
    const errorData = (
      err as {
        data?: {
          error?: { message?: string }
          statusMessage?: string
        }
      }
    )?.data

    actionErrorMessage.value =
      errorData?.error?.message ??
      errorData?.statusMessage ??
      "Unable to complete this booking right now."
  } finally {
    isActing.value = false
  }
}

const copyOrderId = () => {
  navigator.clipboard.writeText(bookingId.value)
}

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
    const errorData = (
      err as {
        data?: {
          error?: { message?: string }
          statusMessage?: string
        }
      }
    )?.data

    actionErrorMessage.value =
      errorData?.error?.message ??
      errorData?.statusMessage ??
      "Unable to update the request right now."
  } finally {
    isActing.value = false
  }
}

const handleDispute = () => {
  // Placeholder for dispute logic
  alert("Dispute filing will be available soon.")
}

const openChat = async () => {
  if (!booking.value.transactionId || !canOpenChat.value) return

  await router.push({
    path: "/chat",
    query: { transactionId: booking.value.transactionId },
  })
}

const reviewCounterpartName = computed(() => {
  const user = isLender.value ? booking.value.borrower.user : booking.value.lender.user
  return `${user.firstName} ${user.lastName[0]}.`
})

const reviewContext = computed(() => {
  if (!booking.value.transactionId || !selectedReviewType.value) return null

  return {
    transactionId: booking.value.transactionId,
    reviewType: selectedReviewType.value,
    currentUserRole: userRole.value,
    itemName: booking.value.item.name,
    counterpartName: reviewCounterpartName.value,
    itemId: booking.value.item.id,
    targetUserId:
      selectedReviewType.value === "ITEM_REVIEW"
        ? null
        : selectedReviewType.value === "LENDER_REVIEW"
          ? booking.value.lenderId
          : booking.value.borrowerId,
  }
})

const openReviewModal = (reviewType: ReviewType) => {
  selectedReviewType.value = reviewType
  const action = booking.value.reviewState.actions.find((entry) => entry.reviewType === reviewType)
  if (!action?.canSubmit) return
  isReviewModalOpen.value = true
}

const closeReviewModal = () => {
  isReviewModalOpen.value = false
  selectedReviewType.value = null
}

const handleReviewSubmitted = async () => {
  await refresh()
  actionSuccessMessage.value = "Thanks for your feedback. Your review is now visible here."
}

const submitReview = async () => {
  isSubmittingReview.value = true
  reviewErrorMessage.value = ""
  reviewSuccessMessage.value = ""

  try {
    await $fetch("/api/reviews", {
      method: "POST",
      body: {
        bookingId: booking.value.id,
        rating: reviewForm.rating,
        reviewText: reviewForm.reviewText,
        isAnonymous: reviewForm.isAnonymous,
      },
    })

    reviewSuccessMessage.value = "Review submitted. Your rewards bonus has been processed."
    reviewForm.rating = 5
    reviewForm.reviewText = ""
    reviewForm.isAnonymous = false
    await Promise.all([refreshReviewState(), refresh()])
  } catch (err: unknown) {
    const errorData = (
      err as {
        data?: {
          error?: { message?: string }
          statusMessage?: string
          message?: string
        }
      }
    )?.data

    reviewErrorMessage.value =
      errorData?.error?.message ??
      errorData?.statusMessage ??
      errorData?.message ??
      "Unable to submit your review right now."
  } finally {
    isSubmittingReview.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-[1180px] font-geist pb-20 px-4 sm:px-0">
    <!-- Header with Back Button -->
    <NuxtLink
      :to="backToTransactionsPath"
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

    <template v-if="pending">
      <div class="flex flex-col gap-6 animate-pulse">
        <div class="h-10 w-48 bg-cream rounded-xl"></div>
        <div class="h-6 w-96 bg-cream rounded-xl"></div>
        <div class="h-64 bg-cream rounded-3xl"></div>
      </div>
    </template>

    <template v-else-if="booking">
      <!-- Page Title -->
      <h1 class="text-[25px] font-bold text-noble-black mb-2">Order Details</h1>

      <!-- Order Info Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div class="flex flex-wrap items-center gap-3 text-[15px] text-noble-black/80">
          <div class="flex items-center gap-2">
            <span class="font-normal uppercase tracking-wide"
              >ORDER ID. {{ orderIdForDisplay }}</span
            >
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
          <div class="hidden sm:block w-px h-4 bg-stone-300"></div>
          <span class="font-normal">Placed on {{ formatDateTime(booking.requestedAt) }}</span>
        </div>

        <TransactionStatusBadge :status="mappedStatus" :role="userRole" />
      </div>

      <!-- Main Content Grid -->
      <div class="space-y-6">
        <!-- Section 1: Item Details -->
        <NuxtLink
          :to="itemDetailPath"
          class="block bg-cream border border-cinnamon-ice rounded-3xl p-6 group transition-colors hover:border-burning-orange/50"
        >
          <h2 class="text-lg font-bold text-noble-black mb-4">Item Details</h2>
          <div class="flex flex-col sm:flex-row gap-6">
            <div class="shrink-0 block">
              <img
                v-if="booking.item.thumbnailImage"
                :src="booking.item.thumbnailImage"
                :alt="booking.item.name"
                class="w-full sm:w-32 h-48 sm:h-32 object-cover rounded-2xl shrink-0 group-hover:opacity-90 transition-opacity"
              />
              <div
                v-else
                class="w-full sm:w-32 h-48 sm:h-32 bg-cinnamon-ice/40 rounded-2xl shrink-0 flex items-center justify-center group-hover:bg-cinnamon-ice/50 transition-colors"
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
            </div>
            <div class="flex flex-col justify-center gap-1">
              <h3
                class="text-xl font-bold text-noble-black group-hover:text-burning-orange transition-colors"
              >
                {{ booking.item.name }}
              </h3>
              <p class="text-sm text-noble-black/70 line-clamp-2 max-w-xl">
                {{ booking.item.description || "No description provided." }}
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
                {{ formatDate(booking.startDate) }} - {{ formatDate(booking.endDate) }}
              </div>
              <span class="text-burning-orange text-sm font-bold mt-2 group-hover:underline">
                View Full Listing
              </span>
            </div>
          </div>
        </NuxtLink>

        <!-- Section 2: Order Timeline -->
        <section class="bg-cream border border-cinnamon-ice rounded-3xl p-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <h2 class="text-lg font-bold text-noble-black">Order Timeline</h2>

            <!-- Lender Actions -->
            <div v-if="canRespond" class="flex gap-2">
              <button
                :disabled="isActing"
                class="bg-burning-orange text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-estate transition-colors disabled:opacity-50"
                @click="respondToBooking('CONFIRMED')"
              >
                Approve Request
              </button>
              <button
                :disabled="isActing"
                class="bg-cream border border-burning-orange text-burning-orange px-6 py-2 rounded-xl font-bold hover:bg-burning-orange/10 transition-colors disabled:opacity-50"
                @click="respondToBooking('CANCELLED')"
              >
                Decline
              </button>
            </div>

            <!-- Borrower Action: Return Item -->
            <button
              v-else-if="!isLender && booking.status === 'CONFIRMED'"
              class="bg-burning-orange text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-estate transition-colors"
              @click="handleReturn"
            >
              Return Item
            </button>

            <button
              v-else-if="canConfirmReceipt"
              :disabled="isActing"
              class="bg-blue-estate text-white px-6 py-2 rounded-xl font-bold hover:bg-burning-orange transition-colors disabled:opacity-50"
              @click="confirmReceipt"
            >
              Confirm Receipt
            </button>
          </div>

          <p
            v-if="actionSuccessMessage"
            class="mb-4 text-sm text-green-700 bg-green-50 p-3 rounded-lg border border-green-200"
          >
            {{ actionSuccessMessage }}
          </p>
          <p
            v-if="actionErrorMessage"
            class="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200"
          >
            {{ actionErrorMessage }}
          </p>

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
              <span>Rental Fee ({{ computeDuration(booking.startDate, booking.endDate) }})</span>
              <span class="font-bold">{{
                formatPeso(booking.totalFee - booking.platformCommission)
              }}</span>
            </div>
            <div class="flex justify-between items-center text-noble-black/80">
              <span>Service Fee</span>
              <span class="font-bold">{{ formatPeso(booking.platformCommission) }}</span>
            </div>
            <div class="flex justify-between items-center pt-3 border-t border-cinnamon-ice/30">
              <span class="text-lg font-bold text-noble-black">{{
                isLender ? "Total Earnings" : "Total Paid"
              }}</span>
              <span class="text-2xl font-bold text-burning-orange">{{
                formatPeso(
                  isLender ? booking.totalFee - booking.platformCommission : booking.totalFee,
                )
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

        <!-- Section 4: Lender/Borrower Information -->
        <section class="bg-cream border border-cinnamon-ice rounded-3xl p-6">
          <h2 class="text-lg font-bold text-noble-black mb-4">
            {{ isLender ? "Borrower Information" : "Lender Information" }}
          </h2>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <!-- Avatar -->
              <UserAvatar
                :user-name="
                  isLender
                    ? `${booking.borrower.user.firstName} ${booking.borrower.user.lastName}`
                    : `${booking.lender.user.firstName} ${booking.lender.user.lastName}`
                "
                size="lg"
              />
              <div>
                <div class="flex items-center gap-1.5">
                  <h3 class="font-bold text-noble-black">
                    {{
                      isLender
                        ? `${booking.borrower.user.firstName} ${booking.borrower.user.lastName}`
                        : `${booking.lender.user.firstName} ${booking.lender.user.lastName}`
                    }}
                  </h3>
                </div>
                <div class="flex items-center gap-3 mt-1 text-sm">
                  <div class="flex items-center gap-1 text-burning-orange font-bold">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <polygon
                        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                      />
                    </svg>
                    {{
                      isLender
                        ? booking.borrower.borrowerRating || "5.0"
                        : booking.lender.lenderRating || "5.0"
                    }}
                  </div>
                  <span class="text-noble-black/40"
                    >({{ isLender ? booking.borrower._count?.bookings || 0 : 124 }} bookings)</span
                  >
                </div>
              </div>
            </div>
            <button
              v-if="canOpenChat"
              class="inline-flex items-center gap-2 shrink-0 rounded-2xl bg-blue-estate px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-burning-orange transition-colors"
              @click="openChat"
            >
              <svg
                class="w-4 h-4"
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
              Chat
            </button>
          </div>
        </section>

        <section class="bg-cream border border-cinnamon-ice rounded-3xl p-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
            <div>
              <h2 class="text-lg font-bold text-noble-black">Feedback</h2>
              <p class="text-sm text-noble-black/60 mt-1">
                Reviews become available once the transaction is completed.
              </p>
            </div>

            <div class="flex flex-wrap gap-2">
              <button
                v-for="action in booking.reviewState.actions.filter((entry) => entry.canSubmit)"
                :key="action.reviewType"
                class="bg-burning-orange text-white px-5 py-2.5 rounded-xl font-bold hover:bg-cinnabar-red transition-colors"
                @click="openReviewModal(action.reviewType)"
              >
                {{ action.label }}
              </button>
              <span
                v-for="action in booking.reviewState.actions.filter((entry) => entry.hasSubmitted)"
                :key="`${action.reviewType}-submitted`"
                class="inline-flex items-center rounded-xl bg-indigo-900 px-4 py-2 text-sm font-semibold text-white"
              >
                {{ action.submittedLabel }}
              </span>
            </div>
          </div>

          <TransactionReviewList
            title="Transaction Reviews"
            :reviews="booking.reviews"
            empty-message="No reviews have been submitted for this transaction yet."
          />
        </section>

        <!-- File Dispute Button -->
        <button
          class="w-full flex items-center justify-center gap-2 bg-cinnabar-red text-white font-bold py-4 hover:bg-cinnabar-red/90 rounded-2xl transition-colors mt-4"
          @click="handleDispute"
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
    </template>

    <section
      v-if="booking.status === 'COMPLETED'"
      class="mt-6 rounded-[24px] border border-cinnamon-ice bg-cream p-6"
    >
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 class="text-lg font-bold text-noble-black">Review and Bonus</h2>
          <p class="text-sm text-noble-black/60">
            Submitting a review earns bonus points regardless of the star rating.
          </p>
        </div>
      </div>

      <p v-if="reviewSuccessMessage" class="mt-4 text-sm font-medium text-emerald-700">
        {{ reviewSuccessMessage }}
      </p>
      <p v-if="reviewErrorMessage" class="mt-4 text-sm font-medium text-red-600">
        {{ reviewErrorMessage }}
      </p>

      <div v-if="currentUserReview" class="mt-5 rounded-[18px] border border-cinnamon-ice/70 bg-white p-4">
        <p class="text-sm font-semibold text-neutral-800">Your review</p>
        <p class="mt-2 text-sm text-neutral-800/70">Rating: {{ currentUserReview.rating }}/5</p>
        <p v-if="currentUserReview.reviewText" class="mt-2 text-sm text-neutral-800/70">
          {{ currentUserReview.reviewText }}
        </p>
      </div>

      <form v-else-if="canSubmitReview" class="mt-5 space-y-4" @submit.prevent="submitReview">
        <div>
          <label class="mb-2 block text-sm font-semibold text-neutral-800">Your rating</label>
          <select
            v-model="reviewForm.rating"
            class="h-11 w-full rounded-[16px] border border-cinnamon-ice bg-white px-4 text-sm text-neutral-800 focus:border-burning-orange focus:outline-none"
          >
            <option v-for="rating in [5, 4, 3, 2, 1]" :key="rating" :value="rating">
              {{ rating }} star{{ rating === 1 ? "" : "s" }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-neutral-800">Optional review</label>
          <textarea
            v-model="reviewForm.reviewText"
            rows="4"
            class="w-full rounded-[16px] border border-cinnamon-ice bg-white px-4 py-3 text-sm text-neutral-800 focus:border-burning-orange focus:outline-none"
            placeholder="Share what went well, what could improve, or anything future borrowers/lenders should know."
          />
        </div>

        <label class="flex items-center gap-2 text-sm text-neutral-800/70">
          <input v-model="reviewForm.isAnonymous" type="checkbox" class="rounded border-cinnamon-ice" />
          Submit anonymously
        </label>

        <button
          :disabled="isSubmittingReview"
          type="submit"
          class="inline-flex items-center rounded-full bg-burning-orange px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-burning-orange/90 disabled:cursor-not-allowed disabled:bg-burning-orange/40"
        >
          {{ isSubmittingReview ? "Submitting..." : "Submit Review" }}
        </button>
      </form>

      <p v-else class="mt-5 text-sm text-neutral-800/55">
        Review submission is not available for this transaction.
      </p>
    </section>

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

    <TransactionReviewModal
      :open="isReviewModalOpen"
      :context="reviewContext"
      @close="closeReviewModal"
      @submitted="handleReviewSubmitted"
    />
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
