<script setup lang="ts">
import { ref, computed, watch } from "vue"
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
const supabase = useSupabaseClient()
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

const { refresh: _refreshReviewState } = await useAsyncData(
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
const isDisputeDescriptionExpanded = ref(false)
const actionErrorMessage = ref("")
const actionSuccessMessage = ref("")
const proofUploadErrorMessage = ref("")

const currentUserId = computed(() => authData.value?.user.id ?? null)
const isLender = computed(() => booking.value.lenderId === currentUserId.value)
const userRole = computed<"LENDER" | "BORROWER">(() => (isLender.value ? "LENDER" : "BORROWER"))
const canRespond = computed(() => isLender.value && booking.value.status === "PENDING")
const canConfirmReceipt = computed(() => isLender.value && booking.value.status === "RETURNED")
const canUploadHandoffProof = computed(
  () =>
    isLender.value &&
    booking.value.status === "CONFIRMED" &&
    !booking.value.lenderHandoffProofUploadedAt,
)
const canOpenChat = computed(
  () =>
    Boolean(booking.value.transactionId) && isChatAvailableForBookingStatus(booking.value.status),
)
const isPendingRequest = computed(() => booking.value.status === "PENDING")
const canCancelRequest = computed(() => !isLender.value && booking.value.status === "PENDING")
const canBorrowerReturnItem = computed(
  () =>
    !isLender.value &&
    booking.value.status === "CONFIRMED" &&
    Boolean(booking.value.lenderHandoffProofUploadedAt),
)
const requestStageMessage = computed(() =>
  isLender.value
    ? "Requested - waiting for you to accept the booking"
    : "Requested - waiting for lender to accept the booking",
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

const finalDecisionLabel = (
  decision: NonNullable<BookingDetail["latestDispute"]>["finalDecision"],
) => {
  if (decision === "APPROVED") return "Dispute approved"
  if (decision === "REJECTED") return "Dispute rejected"
  return "Pending final judgment"
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

const duration = computed(() => computeDuration(booking.value.startDate, booking.value.endDate))

const itemDetailPath = computed(() =>
  buildItemDetailPath({
    id: booking.value.item.id,
    name: booking.value.item.name,
  }),
)

const backToTransactionsPath = computed(() => {
  return `/account/transactions?role=${userRole.value}`
})

const timeline = computed(() => {
  const entries = booking.value.timeline ?? []
  return entries.map((entry, index) => {
    let description = entry.description

    // Deduplicate and refine descriptions
    if (entry.label === "In use") {
      description = "Item picked up by borrower"
    } else if (entry.label === "Returned" && booking.value.refundAmount > 0) {
      description = `Early return initiated · Refund of ₱${booking.value.refundAmount} triggered`
    }

    return {
      ...entry,
      description,
      date: formatDateTime(entry.occurredAt),
      status: index === entries.length - 1 ? "current" : "completed",
    }
  })
})

const isReturnModalOpen = ref(false)
const isHandoffProofModalOpen = ref(false)
const isSuccessModalOpen = ref(false)
const isSubmittingReturn = ref(false)
const isSubmittingHandoffProof = ref(false)
const isReviewModalOpen = ref(false)
const selectedReviewType = ref<ReviewType | null>(null)
const isRebuttalModalOpen = ref(false)
const rebuttalModalStep = ref<"form" | "confirm">("form")
const isSubmittingRebuttal = ref(false)
const rebuttalText = ref("")
const rebuttalNotes = ref("")
const rebuttalValidationMessage = ref("")

const parsedDisputeDescription = computed(() => {
  if (!latestDispute.value?.description) return null
  const desc = latestDispute.value.description

  const extract = (label: string) => {
    const regex = new RegExp(`${label}:\\s*([^\\n]+)`, "i")
    const match = desc.match(regex)
    return match && match[1] ? match[1].trim() : null
  }

  let summary = null
  const summaryIndex = desc.indexOf("Summary:")
  if (summaryIndex !== -1) {
    const summaryText = desc.substring(summaryIndex + 8).trim()
    const evidenceIndex = summaryText.indexOf("Evidence filenames:")
    summary = evidenceIndex !== -1 ? summaryText.substring(0, evidenceIndex).trim() : summaryText
  }

  const fullTransaction = extract("Transaction")
  let transactionRef = null
  let itemName = null
  if (fullTransaction) {
    const parts = fullTransaction.split("•").map((s) => s.trim())
    transactionRef = parts[0]
    itemName = parts[1]
  }

  return {
    resolution: extract("Requested resolution"),
    transactionRef,
    itemName,
    otherParty: extract("Other party"),
    summary,
    evidence: extract("Evidence filenames"),
  }
})

const handoffProofFile = ref<File | null>(null)
const returnProofFile = ref<File | null>(null)
const earlyReturnProofFile = ref<File | null>(null)

type ProofUploadType = "HANDOFF" | "RETURN"
type ProofUploadUrlResponse = {
  token: string
  path: string
  publicUrl: string
  bucket: string
}

const getFetchErrorMessage = (err: unknown, fallback: string) => {
  const errorData = (
    err as {
      data?: {
        error?: { message?: string }
        statusMessage?: string
      }
    }
  )?.data

  return errorData?.error?.message ?? errorData?.statusMessage ?? fallback
}

const setProofFile = (
  event: Event,
  target: typeof handoffProofFile | typeof returnProofFile | typeof earlyReturnProofFile,
) => {
  proofUploadErrorMessage.value = ""
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null

  if (file && !file.type.startsWith("image/")) {
    target.value = null
    input.value = ""
    proofUploadErrorMessage.value = "Please upload an image file as proof."
    return
  }

  target.value = file
}

const setHandoffProofFile = (event: Event) => setProofFile(event, handoffProofFile)
const setReturnProofFile = (event: Event) => setProofFile(event, returnProofFile)

const uploadProofImage = async (file: File, proofType: ProofUploadType) => {
  const signedUpload = await $fetch<ProofUploadUrlResponse>("/api/bookings/proof-upload-url", {
    method: "POST",
    body: {
      bookingId: booking.value.id,
      proofType,
      fileName: file.name,
    },
  })

  const { error: uploadError } = await supabase.storage
    .from(signedUpload.bucket)
    .uploadToSignedUrl(signedUpload.path, signedUpload.token, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    })

  if (uploadError) {
    throw new Error(uploadError.message || "Unable to upload proof image.")
  }

  return signedUpload.publicUrl
}

const handleReturn = () => {
  actionErrorMessage.value = ""
  proofUploadErrorMessage.value = ""
  returnProofFile.value = null
  isReturnModalOpen.value = true
}

const handleHandoffProof = () => {
  actionErrorMessage.value = ""
  proofUploadErrorMessage.value = ""
  handoffProofFile.value = null
  isHandoffProofModalOpen.value = true
}

const isEarlyReturnEligible = computed(() => {
  if (isLender.value || booking.value.status !== "CONFIRMED") return false
  const now = new Date()
  const end = new Date(booking.value.endDate)
  return now < end
})

interface EarlyReturnPreviewData {
  refund: {
    eligible: boolean
    totalPaidAmount: number
    nonRefundableFees: number
    refundableRentalAmount: number
    usedDurationMs: number
    unusedDurationMs: number
    totalDurationMs: number
    usagePercentage: number
    unusedRentalValue: number
    penaltyAmount: number
    refundAmount: number
    currency: string
    reason?: string
  }
  actualReturnTime: string | Date
}

const isEarlyReturnModalOpen = ref(false)
const earlyReturnPreviewData = ref<EarlyReturnPreviewData | null>(null)
const isFetchingPreview = ref(false)

const handleEarlyReturn = async () => {
  actionErrorMessage.value = ""
  proofUploadErrorMessage.value = ""
  earlyReturnProofFile.value = null
  isFetchingPreview.value = true
  try {
    const data = await $fetch<EarlyReturnPreviewData>(
      `/api/bookings/${booking.value.id}/early-return-preview`,
    )
    earlyReturnPreviewData.value = data
    isEarlyReturnModalOpen.value = true
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
      "Unable to fetch early return preview."
  } finally {
    isFetchingPreview.value = false
  }
}

const confirmReturn = async () => {
  if (!returnProofFile.value) {
    proofUploadErrorMessage.value = "Upload proof of return before submitting."
    return
  }

  isSubmittingReturn.value = true
  actionErrorMessage.value = ""
  actionSuccessMessage.value = ""
  proofUploadErrorMessage.value = ""
  try {
    const proofImageUrl = await uploadProofImage(returnProofFile.value, "RETURN")
    await $fetch(`/api/bookings/${booking.value.id}/return`, {
      method: "POST",
      body: { proofImageUrl },
    })
    isReturnModalOpen.value = false
    isSuccessModalOpen.value = true
    actionSuccessMessage.value = "Return submitted. The lender was notified to confirm receipt."
    await refresh()
  } catch (err: unknown) {
    actionErrorMessage.value =
      err instanceof Error
        ? err.message
        : getFetchErrorMessage(err, "Unable to submit the return right now.")
  } finally {
    isSubmittingReturn.value = false
  }
}

const confirmHandoffProof = async () => {
  if (!handoffProofFile.value) {
    proofUploadErrorMessage.value = "Upload proof of handoff before marking the item in use."
    return
  }

  isSubmittingHandoffProof.value = true
  actionErrorMessage.value = ""
  actionSuccessMessage.value = ""
  proofUploadErrorMessage.value = ""

  try {
    const proofImageUrl = await uploadProofImage(handoffProofFile.value, "HANDOFF")
    await $fetch(`/api/bookings/${booking.value.id}/handoff-proof`, {
      method: "POST",
      body: { proofImageUrl },
    })
    isHandoffProofModalOpen.value = false
    actionSuccessMessage.value = "Handoff proof uploaded. The item is now marked as in use."
    await refresh()
  } catch (err: unknown) {
    actionErrorMessage.value =
      err instanceof Error
        ? err.message
        : getFetchErrorMessage(err, "Unable to upload handoff proof right now.")
  } finally {
    isSubmittingHandoffProof.value = false
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

const cancelRequest = async () => {
  isActing.value = true
  actionErrorMessage.value = ""
  actionSuccessMessage.value = ""

  try {
    await $fetch(`/api/bookings/${booking.value.id}`, {
      method: "PATCH",
      body: {
        status: "CANCELLED",
        cancellationReason: "Cancelled by borrower.",
      },
    })
    await refresh()
    actionSuccessMessage.value = "Booking request cancelled."
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
      "Unable to cancel this request right now."
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

const latestDispute = computed(() => booking.value.latestDispute)
const canRaiseDispute = computed(() => booking.value.canRaiseDispute)
const canSubmitRebuttal = computed(() => Boolean(latestDispute.value?.canSubmitRebuttal))
const isLatestDisputeRaisedByCurrentUser = computed(
  () => latestDispute.value?.raisedById === currentUserId.value,
)
const isReviewBlockedByDispute = computed(
  () => booking.value.status === "COMPLETED" && !booking.value.reviewState.isCompleted,
)
const showReviewBonusSection = computed(
  () => booking.value.status === "COMPLETED" && booking.value.reviewState.isCompleted,
)
const disputeReportPath = computed(() =>
  booking.value.transactionId
    ? {
        path: "/account/disputes",
        query: {
          tab: "report",
          transaction: booking.value.transactionId,
        },
      }
    : {
        path: "/account/disputes",
        query: {
          tab: "report",
        },
      },
)

const disputeStatusLabel = computed(() => {
  switch (latestDispute.value?.status) {
    case "SUBMITTED":
      return "Dispute under review"
    case "OPEN":
      return "Dispute open"
    case "REJECTED":
      return "Dispute rejected"
    case "APPEALED":
      return "Dispute appealed"
    case "CLOSED":
      return "Dispute closed"
    default:
      return "No dispute"
  }
})

const disputeStatusToneClasses = computed(() => {
  switch (latestDispute.value?.status) {
    case "SUBMITTED":
      return "bg-burning-orange/[0.08] text-burning-orange border-burning-orange/20"
    case "OPEN":
      return "bg-cinnabar-red/[0.08] text-cinnabar-red border-cinnabar-red/20"
    case "REJECTED":
      return "bg-noble-black/5 text-noble-black/70 border-cinnamon-ice"
    case "APPEALED":
      return "bg-blue-estate/[0.08] text-blue-estate border-blue-estate/20"
    case "CLOSED":
      return "bg-success-green/[0.08] text-success-green border-success-green/20"
    default:
      return "bg-cream text-noble-black/60 border-cinnamon-ice"
  }
})

const disputeStatusDescription = computed(() => {
  switch (latestDispute.value?.status) {
    case "SUBMITTED":
      return isLatestDisputeRaisedByCurrentUser.value
        ? "Your concern was recorded and is being prepared for response."
        : "A concern was recorded for this transaction."
    case "OPEN":
      return canSubmitRebuttal.value
        ? "A dispute has been opened for this transaction. You may submit one rebuttal while review is in progress."
        : "A dispute has been opened for this transaction."
    case "REJECTED":
      return isLatestDisputeRaisedByCurrentUser.value
        ? "Your concern was reviewed and the dispute was not opened."
        : "This concern was reviewed and the dispute was not opened."
    case "APPEALED":
      return "Your appeal was submitted and is waiting for the next admin review."
    case "CLOSED":
      return latestDispute.value?.finalDecision === "APPROVED"
        ? "This dispute was upheld, enforced, and closed by admin."
        : "This dispute was closed after review."
    default:
      return "Raise a concern if this transaction needs dispute review."
  }
})

const disputeRaisedByName = computed(() => {
  if (!latestDispute.value) return null
  const user =
    latestDispute.value.raisedById === booking.value.borrowerId
      ? booking.value.borrower.user
      : booking.value.lender.user
  return `${user.firstName} ${user.lastName[0]}.`
})

const rebuttalSubmittedByName = computed(() => {
  if (!latestDispute.value?.rebuttalBy) return null
  return `${latestDispute.value.rebuttalBy.firstName} ${latestDispute.value.rebuttalBy.lastName[0]}.`
})

const handleDispute = async () => {
  if (!canRaiseDispute.value) return
  actionErrorMessage.value = ""
  await navigateTo(disputeReportPath.value)
}

const resetRebuttalForm = () => {
  rebuttalText.value = ""
  rebuttalNotes.value = ""
  rebuttalValidationMessage.value = ""
  rebuttalModalStep.value = "form"
}

const openRebuttalModal = () => {
  if (!canSubmitRebuttal.value) return
  actionErrorMessage.value = ""
  resetRebuttalForm()
  isRebuttalModalOpen.value = true
}

const closeRebuttalModal = () => {
  if (isSubmittingRebuttal.value) return
  isRebuttalModalOpen.value = false
  resetRebuttalForm()
}

const continueRebuttalReview = () => {
  if (!rebuttalText.value.trim()) {
    rebuttalValidationMessage.value = "Please provide your rebuttal statement."
    return
  }

  rebuttalValidationMessage.value = ""
  rebuttalModalStep.value = "confirm"
}

const submitRebuttal = async () => {
  if (!latestDispute.value?.id) {
    rebuttalValidationMessage.value = "This dispute is no longer available."
    rebuttalModalStep.value = "form"
    return
  }

  isSubmittingRebuttal.value = true
  actionErrorMessage.value = ""
  actionSuccessMessage.value = ""

  try {
    await $fetch(`/api/disputes/${latestDispute.value.id}/rebuttal`, {
      method: "POST",
      body: {
        rebuttalText: rebuttalText.value.trim(),
        rebuttalNotes: rebuttalNotes.value.trim() || undefined,
      },
    })

    closeRebuttalModal()
    actionSuccessMessage.value = "Your rebuttal has been submitted."
    await refresh()
  } catch (err: unknown) {
    const errorData = (
      err as {
        data?: {
          error?: { message?: string }
          statusMessage?: string
        }
      }
    )?.data

    rebuttalValidationMessage.value =
      errorData?.error?.message ??
      errorData?.statusMessage ??
      "Unable to submit your rebuttal right now."
    rebuttalModalStep.value = "form"
  } finally {
    isSubmittingRebuttal.value = false
  }
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

const clearRouteActionQuery = async () => {
  const { action, ...remainingQuery } = route.query
  if (action === undefined) return

  await router.replace({
    query: remainingQuery,
  })
}

watch(
  [() => route.query.action, latestDispute, canSubmitRebuttal],
  async ([action, dispute, canRebut]) => {
    if (action !== "rebuttal" || pending.value) return

    if (!dispute) {
      await clearRouteActionQuery()
      return
    }

    if (canRebut) {
      if (!isRebuttalModalOpen.value) {
        openRebuttalModal()
      }
      await clearRouteActionQuery()
      return
    }

    actionErrorMessage.value =
      dispute.status === "OPEN"
        ? "You cannot submit a rebuttal for this dispute."
        : "Rebuttal is no longer available for this dispute."
    await clearRouteActionQuery()
  },
  { immediate: true },
)

const handleReviewSubmitted = async () => {
  await refresh()
  actionSuccessMessage.value = "Thanks for your feedback. Your review is now visible here."
}
</script>

<template>
  <div class="mx-auto max-w-[1180px] font-geist pb-20 lg:px-16 xl:px-24">
    <!-- Header with Back Button -->
    <NuxtLink
      :to="backToTransactionsPath"
      class="flex items-center gap-2 text-noble-black hover:text-burning-orange transition-colors mb-8 group w-fit"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="transition-transform group-hover:-translate-x-1"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      <span class="text-[15px] font-bold">Back to My Transactions</span>
    </NuxtLink>

    <template v-if="pending">
      <div class="flex flex-col gap-8 animate-pulse">
        <div class="h-10 w-48 bg-cream rounded-xl"></div>
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div class="lg:col-span-3 space-y-6">
            <div class="h-64 bg-cream rounded-[24px]"></div>
            <div class="h-96 bg-cream rounded-[24px]"></div>
          </div>
          <div class="lg:col-span-2 space-y-6">
            <div class="h-80 bg-cream rounded-[24px]"></div>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="booking">
      <!-- Redesigned Page Header Strip -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div class="space-y-1.5">
          <h1 class="text-[24px] font-bold text-noble-black leading-tight">Order Details</h1>
          <div class="flex flex-wrap items-center gap-2.5 text-[13px] text-gray-500 font-medium">
            <div
              class="flex items-center gap-1.5 font-mono text-[11px] text-noble-black/40 bg-gray-50 px-2 py-0.5 rounded border border-gray-100"
            >
              <span>ORDER ID. {{ orderIdForDisplay }}</span>
              <button
                class="hover:text-burning-orange transition-colors"
                title="Copy Order ID"
                @click="copyOrderId"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
              </button>
            </div>
            <span class="opacity-30 select-none">·</span>
            <span>Placed on {{ formatDateTime(booking.requestedAt) }}</span>
          </div>
        </div>

        <div class="shrink-0">
          <span
            v-if="isPendingRequest"
            class="inline-flex items-center rounded-full bg-burning-orange/[0.08] text-burning-orange border border-burning-orange/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
          >
            Requested
          </span>
          <TransactionStatusBadge
            v-else
            :status="mappedStatus"
            :role="userRole"
            class="!rounded-full !px-3 !py-1 !text-[11px] !font-bold !uppercase !tracking-wider"
          />
        </div>
      </div>

      <!-- Two-Column Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <!-- Left Column (60%) -->
        <div class="lg:col-span-3 space-y-8">
          <div
            v-if="isPendingRequest"
            class="rounded-[20px] border border-burning-orange/10 bg-burning-orange/[0.03] px-5 py-4 text-[14px] font-bold text-noble-black flex items-start gap-3"
          >
            <svg
              class="text-burning-orange mt-0.5 shrink-0"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            {{ requestStageMessage }}
          </div>

          <!-- Section 1: Item Details -->
          <div
            class="bg-white border border-[#F0EDE8] rounded-[24px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] relative group"
          >
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-[18px] font-bold text-noble-black">Item Details</h2>
              <NuxtLink
                :to="itemDetailPath"
                class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-burning-orange font-bold text-[13px] hover:bg-burning-orange/5 transition-all"
              >
                View Full Listing
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"
                  />
                </svg>
              </NuxtLink>
            </div>
            <div class="flex flex-col sm:flex-row gap-6">
              <div class="shrink-0 relative">
                <img
                  v-if="booking.item.thumbnailImage"
                  :src="booking.item.thumbnailImage"
                  :alt="booking.item.name"
                  class="w-24 h-24 object-cover rounded-[12px] border border-gray-100 shadow-sm"
                />
                <div
                  v-else
                  class="w-24 h-24 bg-cinnamon-ice/10 rounded-[12px] border border-gray-100 flex items-center justify-center"
                >
                  <svg
                    class="w-8 h-8 text-cinnamon-ice/40"
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
              <div class="flex flex-col justify-center min-w-0">
                <h3 class="text-[18px] font-semibold text-noble-black leading-tight mb-1 truncate">
                  {{ booking.item.name }}
                </h3>
                <p class="text-[13px] text-gray-500 font-medium mb-4">
                  Condition:
                  {{
                    booking.item.condition
                      ?.replace("_", " ")
                      .toLowerCase()
                      .replace(/\b\w/g, (l) => l.toUpperCase())
                  }}
                </p>
                <div
                  class="flex items-center gap-2.5 text-[12px] font-bold text-gray-600 bg-gray-100 w-fit px-4 py-2 rounded-full border border-gray-200/50 shadow-sm"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="text-gray-400"
                  >
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                    <line x1="16" x2="16" y1="2" y2="6" />
                    <line x1="8" x2="8" y1="2" y2="6" />
                    <line x1="3" x2="21" y1="10" y2="10" />
                  </svg>
                  <span
                    >{{ formatDate(booking.startDate) }} - {{ formatDate(booking.endDate) }}</span
                  >
                </div>
              </div>
            </div>
          </div>

          <!-- Section 2: Order Timeline -->
          <section
            class="bg-cream border border-cinnamon-ice/20 rounded-[24px] p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
          >
            <div class="border-l-[3px] border-burning-orange pl-4 mb-8">
              <h2 class="text-[20px] font-bold text-noble-black">Order Timeline</h2>
            </div>

            <div
              v-if="actionSuccessMessage"
              class="mb-6 flex items-center gap-3 text-[13px] font-bold text-success-green bg-success-green/5 border border-success-green/10 p-4 rounded-[14px]"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {{ actionSuccessMessage }}
            </div>

            <div
              v-if="actionErrorMessage"
              class="mb-6 flex items-center gap-3 text-[13px] font-bold text-cinnabar-red bg-cinnabar-red/5 border border-cinnabar-red/10 p-4 rounded-[14px]"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {{ actionErrorMessage }}
            </div>

            <div class="space-y-0 relative pl-1">
              <div
                v-for="(step, index) in timeline"
                :key="index"
                class="relative flex gap-6 pb-12 last:pb-0"
              >
                <!-- Timeline Line -->
                <div
                  v-if="index !== timeline.length - 1"
                  class="absolute left-[15px] top-8 bottom-0 w-[2px]"
                  :class="step.status === 'completed' ? 'bg-success-green/30' : 'bg-gray-100'"
                ></div>

                <!-- Timeline Icon (Hollow Precision Style) -->
                <div class="relative z-10">
                  <div
                    v-if="step.status === 'completed'"
                    class="w-8 h-8 rounded-full bg-white border-2 border-success-green flex items-center justify-center shadow-sm"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#22C55E"
                      stroke-width="4"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div
                    v-else-if="step.status === 'current'"
                    class="w-8 h-8 rounded-full bg-white border-2 border-burning-orange flex items-center justify-center shadow-sm"
                  >
                    <div
                      class="w-2.5 h-2.5 rounded-full bg-burning-orange shadow-[0_0_8px_rgba(232,101,10,0.4)]"
                    ></div>
                  </div>
                  <div
                    v-else
                    class="w-8 h-8 rounded-full bg-white border-2 border-gray-100 flex items-center justify-center"
                  >
                    <div class="w-1.5 h-1.5 rounded-full bg-gray-200"></div>
                  </div>
                </div>

                <!-- Step Content -->
                <div
                  class="flex-1 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4"
                >
                  <div class="min-w-0">
                    <h4 class="text-[14px] font-bold text-noble-black leading-tight">
                      {{ step.label }}
                    </h4>
                    <p
                      class="mt-1 text-[13px] text-noble-black/45 leading-relaxed max-w-lg font-medium"
                    >
                      {{ step.description }}
                    </p>
                  </div>
                  <span
                    class="text-[11px] font-mono text-noble-black/30 whitespace-nowrap pt-1 uppercase tracking-tighter"
                  >
                    {{ step.date }}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <!-- Section 5: Feedback & Reviews -->
          <section
            class="bg-cream border border-cinnamon-ice/20 rounded-[24px] p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
          >
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <div class="border-l-[3px] border-burning-orange pl-4">
                <h2 class="text-[20px] font-bold text-noble-black">Your Reviews</h2>
                <p class="text-[13px] font-medium text-noble-black/40 mt-0.5">
                  Reviews help maintain trust in the TakeUP community.
                </p>
              </div>

              <div class="flex flex-wrap gap-2">
                <button
                  v-for="action in booking.reviewState.actions.filter((entry) => entry.canSubmit)"
                  :key="action.reviewType"
                  class="bg-burning-orange text-white px-5 py-2 rounded-[12px] text-[13px] font-bold hover:brightness-110 shadow-sm shadow-burning-orange/20 transition-all"
                  @click="openReviewModal(action.reviewType)"
                >
                  {{ action.label }}
                </button>
              </div>
            </div>

            <TransactionReviewList
              title="Transaction Reviews"
              :reviews="booking.reviews as any"
              empty-message="No reviews have been submitted for this transaction yet."
            />

            <!-- Review Bonus Section -->
            <div
              v-if="showReviewBonusSection"
              class="mt-8 rounded-[18px] border border-burning-orange/10 bg-burning-orange/[0.03] p-5 flex items-center justify-between"
            >
              <div>
                <p class="text-[14px] font-bold text-noble-black">Reviews Completed</p>
                <p class="text-[12px] text-noble-black/50 font-medium mt-0.5">
                  Your +5 reward points have been processed.
                </p>
              </div>
              <div
                class="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-burning-orange/20 shadow-sm"
              >
                <svg
                  class="text-burning-orange"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="8" r="7" />
                  <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                </svg>
              </div>
            </div>
          </section>

          <!-- Section 6: Concerns & Disputes -->
          <section
            v-if="booking.transactionId || latestDispute"
            class="bg-cream border border-cinnamon-ice/20 rounded-[24px] p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
          >
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
              <div class="border-l-[3px] border-burning-orange pl-4">
                <h2 class="text-[20px] font-bold text-noble-black">Concerns & Disputes</h2>
                <p
                  class="mt-1 text-[13px] font-medium text-noble-black/50 leading-relaxed max-w-sm"
                >
                  {{
                    latestDispute
                      ? disputeStatusDescription
                      : isReviewBlockedByDispute
                        ? "Review actions are unavailable while a dispute is in progress."
                        : "Raise a concern if this transaction needs dispute review."
                  }}
                </p>
              </div>

              <span
                v-if="latestDispute"
                class="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider border shadow-sm"
                :class="disputeStatusToneClasses"
              >
                {{ disputeStatusLabel }}
              </span>
            </div>

            <!-- Redesigned Dispute Metadata Grid -->
            <div v-if="latestDispute" class="space-y-6">
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-6 mb-8">
                <div>
                  <p
                    class="text-[11px] font-bold uppercase tracking-[0.1em] text-noble-black/30 mb-1.5"
                  >
                    Reason
                  </p>
                  <p class="text-[14px] font-semibold text-noble-black">
                    {{ latestDispute.reason }}
                  </p>
                </div>
                <div>
                  <p
                    class="text-[11px] font-bold uppercase tracking-[0.1em] text-noble-black/30 mb-1.5"
                  >
                    Submitted
                  </p>
                  <p class="text-[14px] font-semibold text-noble-black">
                    {{ formatDate(latestDispute.createdAt) }}
                  </p>
                </div>
                <div>
                  <p
                    class="text-[11px] font-bold uppercase tracking-[0.1em] text-noble-black/30 mb-1.5"
                  >
                    Raised By
                  </p>
                  <p class="text-[14px] font-semibold text-noble-black">
                    {{ disputeRaisedByName ?? "Participant" }}
                  </p>
                </div>
              </div>

              <!-- Truncated Description -->
              <div v-if="latestDispute.description" class="relative">
                <p
                  class="text-[11px] font-bold uppercase tracking-[0.1em] text-noble-black/30 mb-2"
                >
                  Description
                </p>
                <div
                  class="text-[14px] leading-relaxed text-noble-black/70 overflow-hidden transition-all duration-300"
                  :class="!isDisputeDescriptionExpanded ? 'max-h-24' : 'max-h-none'"
                >
                  {{ latestDispute.description }}
                </div>
                <button
                  v-if="latestDispute.description.length > 200"
                  class="mt-2 text-burning-orange text-[13px] font-bold hover:underline"
                  @click="isDisputeDescriptionExpanded = !isDisputeDescriptionExpanded"
                >
                  {{ isDisputeDescriptionExpanded ? "Show less" : "Show more" }}
                </button>
              </div>

              <!-- Decisions -->
              <div
                v-if="latestDispute.finalDecision"
                class="rounded-[16px] border border-success-green/20 bg-success-green/[0.04] p-5"
              >
                <div class="flex items-center gap-2 text-success-green mb-2">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <p class="text-[14px] font-bold">
                    {{ finalDecisionLabel(latestDispute.finalDecision) }}
                  </p>
                </div>
                <p class="text-[12px] font-medium text-noble-black/40">
                  Final judgment on {{ formatDate(latestDispute.finalDecisionAt!) }}
                </p>
                <p
                  v-if="latestDispute.finalDecisionNotes"
                  class="mt-3 text-[13px] text-noble-black/70 leading-relaxed italic border-l-2 border-success-green/20 pl-4"
                >
                  {{ latestDispute.finalDecisionNotes }}
                </p>
              </div>

              <!-- Rebuttal Box -->
              <div
                v-if="latestDispute.hasRebuttal"
                class="rounded-[12px] border border-gray-100 bg-white p-5 shadow-sm"
              >
                <div class="flex items-center justify-between gap-4 mb-3">
                  <p class="text-[13px] font-bold text-noble-black">
                    Rebuttal by {{ rebuttalSubmittedByName }}
                  </p>
                  <span class="text-[11px] font-mono text-noble-black/30">{{
                    formatDate(latestDispute.rebuttalSubmittedAt!)
                  }}</span>
                </div>
                <p class="text-[13px] text-noble-black/70 leading-relaxed">
                  {{ latestDispute.rebuttalText }}
                </p>
              </div>
            </div>

            <!-- Dispute Actions -->
            <div class="mt-8 flex flex-wrap gap-3">
              <button
                v-if="canSubmitRebuttal"
                class="flex-1 min-w-[160px] h-11 inline-flex items-center justify-center gap-2 rounded-[12px] bg-blue-estate text-white text-[14px] font-bold hover:brightness-110 shadow-sm transition-all"
                @click="openRebuttalModal"
              >
                Submit Rebuttal
              </button>

              <button
                v-if="canRaiseDispute"
                class="flex-1 min-w-[160px] h-11 inline-flex items-center justify-center gap-2 rounded-[12px] border-2 border-cinnabar-red text-cinnabar-red text-[14px] font-bold hover:bg-cinnabar-red hover:text-white transition-all"
                @click="handleDispute"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
                  />
                  <line x1="12" x2="12" y1="9" y2="13" />
                  <line x1="12" x2="12.01" y1="17" y2="17" />
                </svg>
                Report Issue
              </button>
            </div>

            <!-- Minimal Status Footer Text -->
            <div
              v-if="latestDispute?.status === 'OPEN' || latestDispute?.status === 'SUBMITTED'"
              class="mt-6 flex items-center justify-center px-4"
            >
              <span class="text-[13px] font-bold text-noble-black/40 italic">
                {{
                  latestDispute.hasRebuttal
                    ? "Rebuttal submitted. This dispute is still under review."
                    : disputeStatusDescription
                }}
              </span>
            </div>
          </section>
        </div>

        <!-- Right Column (40%, Sticky) -->
        <aside class="lg:col-span-2 space-y-6 lg:sticky lg:top-8">
          <!-- Quick Action Buttons -->
          <div
            v-if="
              canRespond ||
              canCancelRequest ||
              canUploadHandoffProof ||
              canBorrowerReturnItem ||
              canConfirmReceipt
            "
            class="space-y-3"
          >
            <div v-if="canRespond" class="grid grid-cols-2 gap-3">
              <button
                :disabled="isActing"
                class="h-12 bg-gradient-to-br from-burning-orange to-orange-500 text-white rounded-[12px] font-bold text-[14px] hover:brightness-105 shadow-lg shadow-burning-orange/20 transition-all disabled:opacity-50"
                @click="respondToBooking('CONFIRMED')"
              >
                Approve
              </button>
              <button
                :disabled="isActing"
                class="h-12 bg-white border-2 border-gray-200 text-noble-black/60 rounded-[12px] font-bold text-[14px] hover:bg-gray-50 transition-all disabled:opacity-50"
                @click="respondToBooking('CANCELLED')"
              >
                Decline
              </button>
            </div>

            <button
              v-if="canUploadHandoffProof"
              :disabled="isSubmittingHandoffProof"
              class="w-full h-12 flex items-center justify-center gap-2 bg-blue-estate text-white rounded-[12px] font-bold text-[14px] hover:brightness-110 shadow-lg shadow-blue-estate/20 transition-all disabled:opacity-50"
              @click="handleHandoffProof"
            >
              <svg
                v-if="isSubmittingHandoffProof"
                class="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Upload Handoff Proof
            </button>

            <button
              v-if="canBorrowerReturnItem"
              :disabled="isFetchingPreview"
              class="w-full h-12 flex items-center justify-center gap-2 bg-burning-orange text-white rounded-[12px] font-bold text-[14px] hover:brightness-110 shadow-lg shadow-burning-orange/20 transition-all disabled:opacity-50"
              @click="isEarlyReturnEligible ? handleEarlyReturn() : handleReturn()"
            >
              <svg
                v-if="isFetchingPreview"
                class="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              {{ isEarlyReturnEligible ? "Confirm Early Return" : "Return Item Now" }}
            </button>

            <button
              v-if="canConfirmReceipt"
              :disabled="isActing"
              class="w-full h-12 bg-blue-estate text-white rounded-[12px] font-bold text-[14px] hover:brightness-110 shadow-lg shadow-blue-estate/20 transition-all disabled:opacity-50"
              @click="confirmReceipt"
            >
              Confirm Item Receipt
            </button>

            <button
              v-if="canCancelRequest"
              :disabled="isActing"
              class="w-full h-12 bg-white border-2 border-cinnabar-red text-cinnabar-red rounded-[12px] font-bold text-[14px] hover:bg-cinnabar-red/5 transition-all disabled:opacity-50"
              @click="cancelRequest"
            >
              Cancel My Request
            </button>
          </div>

          <!-- Section 3: Payment Summary (Receipt Card) -->
          <section
            class="bg-white border border-[#F0EDE8] rounded-[16px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
          >
            <h2 class="text-[16px] font-bold text-noble-black mb-6">Payment Summary</h2>
            <div class="space-y-4">
              <div class="flex justify-between items-center text-[14px]">
                <span class="text-gray-500 font-medium">Rental ({{ duration }})</span>
                <span class="text-[#111] font-semibold">{{
                  formatPeso(booking.totalFee - booking.platformCommission)
                }}</span>
              </div>
              <div class="flex justify-between items-center text-[14px]">
                <span class="text-gray-500 font-medium">Service Fee</span>
                <span class="text-[#111] font-semibold">{{
                  formatPeso(booking.platformCommission)
                }}</span>
              </div>

              <div
                v-if="booking.refundAmount > 0"
                class="flex justify-between items-center text-[14px]"
              >
                <div class="flex items-center gap-2">
                  <span class="text-[#059669] font-bold">Early Return Refund</span>
                  <span
                    class="text-[10px] bg-[#D1FAE5] px-1.5 py-0.5 rounded-full text-[#065F46] font-black uppercase"
                    >PROCESSED</span
                  >
                </div>
                <span class="text-[#059669] font-bold"
                  >-{{ formatPeso(booking.refundAmount) }}</span
                >
              </div>

              <!-- Dashed Separator -->
              <div
                class="border-t border-dashed border-gray-200 pt-5 mt-2 flex justify-between items-baseline"
              >
                <span class="text-[18px] font-bold text-[#111]">Total Paid</span>
                <span class="text-[20px] font-bold text-burning-orange">
                  {{ formatPeso(booking.totalFee - (booking.refundAmount || 0)) }}
                </span>
              </div>

              <div
                v-if="booking.status === 'CANCELLED' && booking.paymentStatus === 'REFUNDED'"
                class="flex justify-between items-center text-[14px] mt-1"
              >
                <div class="flex items-center gap-2">
                  <span class="text-[#059669] font-semibold">Refunded to Wallet</span>
                  <span
                    class="text-[10px] bg-[#D1FAE5] px-1.5 py-0.5 rounded-full text-[#065F46] font-black uppercase"
                    >PROCESSED</span
                  >
                </div>
                <span class="text-[16px] font-bold text-[#059669]"
                  >+{{ formatPeso(booking.totalFee) }}</span
                >
              </div>
            </div>

            <!-- TakeUP Secure Guarantee (Slim Style) -->
            <div class="mt-8 pt-6 border-t border-gray-50">
              <div
                class="bg-blue-estate/[0.03] border border-blue-estate/10 rounded-[12px] p-4 flex gap-3 items-start"
              >
                <div class="shrink-0 text-blue-estate">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <p class="text-[12px] text-blue-estate font-medium leading-relaxed">
                  <span class="font-bold">TakeUP Secure.</span> Funds are held safely until the
                  transaction is fully complete.
                </p>
              </div>
            </div>
          </section>

          <!-- Section 4: Counterpart Information -->
          <section class="bg-white border border-[#F0EDE8] rounded-[12px] p-5 shadow-sm">
            <p class="text-[11px] font-bold text-noble-black/30 uppercase tracking-[0.1em] mb-4">
              {{ isLender ? "Borrower" : "Lender" }}
            </p>
            <div class="flex flex-col gap-5">
              <div class="flex items-center gap-4 min-w-0">
                <UserAvatar
                  :user-name="
                    isLender
                      ? `${booking.borrower.user.firstName} ${booking.borrower.user.lastName}`
                      : `${booking.lender.user.firstName} ${booking.lender.user.lastName}`
                  "
                  size="lg"
                  class="shrink-0 ring-4 ring-gray-50"
                />
                <div class="min-w-0 flex-1">
                  <h3 class="font-semibold text-noble-black text-[15px] truncate">
                    {{
                      isLender
                        ? `${booking.borrower.user.firstName} ${booking.borrower.user.lastName}`
                        : `${booking.lender.user.firstName} ${booking.lender.user.lastName}`
                    }}
                  </h3>
                  <div class="flex items-center gap-2 mt-1">
                    <div
                      class="flex items-center gap-0.5 text-burning-orange font-bold text-[13px]"
                    >
                      <span>{{
                        isLender
                          ? booking.borrower.borrowerRating?.toFixed(1) || "5.0"
                          : booking.lender.lenderRating?.toFixed(1) || "5.0"
                      }}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <polygon
                          points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                        />
                      </svg>
                    </div>
                    <span class="text-noble-black/30 text-[12px] font-medium"
                      >•
                      {{ isLender ? booking.borrower._count?.bookings || 0 : 124 }} bookings</span
                    >
                  </div>
                </div>
              </div>

              <button
                v-if="canOpenChat"
                class="w-full h-10 flex items-center justify-center gap-2 rounded-[10px] bg-burning-orange/[0.08] text-burning-orange hover:bg-burning-orange/[0.12] font-bold text-[13px] transition-all"
                @click="openChat"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Message {{ isLender ? "Borrower" : "Lender" }}
              </button>
            </div>
          </section>
        </aside>
      </div>
    </template>

    <div v-else-if="error" class="py-20 text-center">
      <div
        class="w-20 h-20 bg-cinnabar-red/10 rounded-full flex items-center justify-center mx-auto mb-6"
      >
        <svg
          class="text-cinnabar-red"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h2 class="text-2xl font-bold text-noble-black mb-4">Transaction Not Found</h2>
      <p class="text-noble-black/50 mb-8 max-w-sm mx-auto">
        This order might have been removed or you may not have permission to view it.
      </p>
      <NuxtLink
        :to="backToTransactionsPath"
        class="bg-burning-orange text-white px-8 py-3 rounded-[12px] font-bold hover:brightness-110 shadow-lg shadow-burning-orange/20 transition-all"
      >
        Return to Transactions
      </NuxtLink>
    </div>

    <!-- Modals (Preserved original functionality) -->
    <TransactionReviewModal
      :open="isReviewModalOpen"
      :context="reviewContext"
      @close="closeReviewModal"
      @submitted="handleReviewSubmitted"
    />

    <!-- Handoff Proof Modal -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <Teleport to="body">
        <div
          v-if="isHandoffProofModalOpen"
          class="fixed inset-0 z-[1300] flex items-center justify-center p-4"
        >
          <div
            class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm"
            @click="isHandoffProofModalOpen = false"
          ></div>

          <div
            class="relative bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-300"
          >
            <div class="text-center">
              <div
                class="w-20 h-20 bg-blue-estate/10 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#1f3a5f"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" x2="12" y1="3" y2="15" />
                </svg>
              </div>
              <h3 class="text-2xl font-bold text-noble-black mb-2">Upload Handoff Proof</h3>
              <p class="text-noble-black/60 mb-6 leading-relaxed">
                Upload proof that you have given the item to the borrower. This will mark the
                transaction as in use.
              </p>

              <label
                class="block w-full rounded-2xl border border-dashed border-cinnamon-ice bg-cream p-4 text-left cursor-pointer hover:border-burning-orange transition-colors"
              >
                <span class="block text-sm font-bold text-noble-black">Proof image</span>
                <span class="mt-1 block text-xs text-noble-black/50 truncate">
                  {{ handoffProofFile?.name || "Choose an image file" }}
                </span>
                <input type="file" accept="image/*" class="sr-only" @change="setHandoffProofFile" />
              </label>

              <p v-if="proofUploadErrorMessage" class="mt-3 text-sm text-red-600">
                {{ proofUploadErrorMessage }}
              </p>

              <div class="flex flex-col gap-3 mt-6">
                <button
                  :disabled="isSubmittingHandoffProof"
                  class="w-full bg-blue-estate text-white py-4 rounded-2xl font-bold hover:bg-burning-orange transition-colors flex items-center justify-center disabled:opacity-50"
                  @click="confirmHandoffProof"
                >
                  <span v-if="isSubmittingHandoffProof" class="animate-spin mr-2">
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
                  {{ isSubmittingHandoffProof ? "Uploading..." : "Upload proof and mark in use" }}
                </button>
                <button
                  class="w-full bg-cream text-noble-black py-4 rounded-2xl font-bold hover:bg-pale-cashmere transition-colors"
                  @click="isHandoffProofModalOpen = false"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </Teleport>
    </Transition>

    <!-- Return Confirmation UI (Modal) -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <Teleport to="body">
        <div
          v-if="isReturnModalOpen"
          class="fixed inset-0 z-[1300] flex items-center justify-center p-4"
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
                Upload proof that the item has been returned. The return timestamp will be recorded
                when this proof is submitted.
              </p>

              <label
                class="mb-4 block w-full rounded-2xl border border-dashed border-cinnamon-ice bg-cream p-4 text-left cursor-pointer hover:border-burning-orange transition-colors"
              >
                <span class="block text-sm font-bold text-noble-black">Return proof image</span>
                <span class="mt-1 block text-xs text-noble-black/50 truncate">
                  {{ returnProofFile?.name || "Choose an image file" }}
                </span>
                <input type="file" accept="image/*" class="sr-only" @change="setReturnProofFile" />
              </label>

              <p v-if="proofUploadErrorMessage" class="mb-4 text-sm text-red-600">
                {{ proofUploadErrorMessage }}
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
                  {{ isSubmittingReturn ? "Uploading..." : "Upload proof and submit return" }}
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
      </Teleport>
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
      <Teleport to="body">
        <div
          v-if="isSuccessModalOpen"
          class="fixed inset-0 z-[1300] flex items-center justify-center p-4"
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
      </Teleport>
    </Transition>

    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <Teleport to="body">
        <div
          v-if="isRebuttalModalOpen"
          class="fixed inset-0 z-[1300] flex items-center justify-center p-4 font-geist"
        >
          <div
            class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm"
            @click="closeRebuttalModal"
          />

          <div
            class="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-[20px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.18)] animate-in zoom-in-95 duration-300 overflow-hidden"
          >
            <!-- Modal Header -->
            <div class="px-6 pt-8 pb-4 flex items-start justify-between gap-4 shrink-0 relative">
              <div>
                <h3 class="text-[24px] font-bold text-noble-black">
                  {{ rebuttalModalStep === "form" ? "Submit Rebuttal" : "Confirm Rebuttal" }}
                </h3>
                <p class="mt-1 text-[13px] font-medium text-noble-black/40">
                  {{
                    rebuttalModalStep === "form"
                      ? "Review the dispute details below, then explain your side."
                      : "Confirm the dispute details and your rebuttal before final submission."
                  }}
                </p>
              </div>
              <button
                type="button"
                class="flex h-10 w-10 items-center justify-center rounded-full text-noble-black transition hover:bg-gray-100"
                @click="closeRebuttalModal"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>

            <div class="flex-1 overflow-y-auto custom-modal-scrollbar px-6 py-4">
              <div v-if="rebuttalModalStep === 'form'">
                <div class="space-y-6">
                  <!-- Dispute Details Card -->
                  <div
                    v-if="latestDispute"
                    class="rounded-[14px] border border-[#FEE2E2] bg-white p-5 border-l-[4px] border-l-[#DC2626] shadow-sm"
                  >
                    <!-- 3-Column Metadata Grid -->
                    <div class="grid grid-cols-3 gap-4 mb-6">
                      <div>
                        <p
                          class="text-[10px] font-bold uppercase tracking-wider text-noble-black/40 mb-1"
                        >
                          Reason
                        </p>
                        <p class="text-[13px] font-semibold text-noble-black leading-tight">
                          {{ latestDispute.reason }}
                        </p>
                      </div>
                      <div>
                        <p
                          class="text-[10px] font-bold uppercase tracking-wider text-noble-black/40 mb-1"
                        >
                          Raised By
                        </p>
                        <p class="text-[13px] font-semibold text-noble-black leading-tight">
                          {{ disputeRaisedByName ?? "Participant" }}
                        </p>
                      </div>
                      <div>
                        <p
                          class="text-[10px] font-bold uppercase tracking-wider text-noble-black/40 mb-1"
                        >
                          Submitted
                        </p>
                        <p class="text-[13px] font-semibold text-noble-black leading-tight">
                          {{ formatDate(latestDispute.createdAt) }}
                        </p>
                      </div>
                    </div>

                    <!-- Parsed Description List -->
                    <div class="pt-5 border-t border-[#F5F5F5] space-y-3">
                      <div
                        v-if="parsedDisputeDescription?.resolution"
                        class="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4"
                      >
                        <span class="text-[11px] font-bold text-noble-black/40 w-32 shrink-0"
                          >Requested Resolution</span
                        >
                        <span class="text-[12px] font-medium text-noble-black/70">{{
                          parsedDisputeDescription.resolution
                        }}</span>
                      </div>
                      <div
                        v-if="parsedDisputeDescription?.transactionRef"
                        class="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4"
                      >
                        <span class="text-[11px] font-bold text-noble-black/40 w-32 shrink-0"
                          >Transaction ID</span
                        >
                        <span class="text-[12px] font-mono font-medium text-noble-black/70">{{
                          parsedDisputeDescription.transactionRef
                        }}</span>
                      </div>
                      <div
                        v-if="parsedDisputeDescription?.itemName"
                        class="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4"
                      >
                        <span class="text-[11px] font-bold text-noble-black/40 w-32 shrink-0"
                          >Item</span
                        >
                        <span class="text-[12px] font-medium text-noble-black/70">{{
                          parsedDisputeDescription.itemName
                        }}</span>
                      </div>
                      <div
                        v-if="parsedDisputeDescription?.otherParty"
                        class="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4"
                      >
                        <span class="text-[11px] font-bold text-noble-black/40 w-32 shrink-0"
                          >Other Party</span
                        >
                        <span class="text-[12px] font-medium text-noble-black/70">{{
                          parsedDisputeDescription.otherParty
                        }}</span>
                      </div>

                      <div v-if="parsedDisputeDescription?.summary" class="pt-2">
                        <p class="text-[11px] font-bold text-noble-black/40 mb-1">Details</p>
                        <p class="text-[12px] text-noble-black/70 leading-relaxed line-clamp-4">
                          {{ parsedDisputeDescription.summary }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div class="space-y-4">
                    <label class="block">
                      <span class="text-[13px] font-semibold text-[#374151]"
                        >Rebuttal Statement <span class="text-red-500">*</span></span
                      >
                      <div class="relative mt-2">
                        <textarea
                          v-model="rebuttalText"
                          rows="5"
                          maxlength="800"
                          placeholder="Explain your side of the transaction."
                          class="w-full min-h-[120px] rounded-[10px] border-[1.5px] border-gray-200 bg-white px-4 py-3 text-[14px] text-noble-black outline-none transition-all focus:border-burning-orange focus:shadow-[0_0_0_3px_rgba(232,101,10,0.1)]"
                        ></textarea>
                        <div
                          class="absolute bottom-3 right-3 text-[11px] font-bold text-noble-black/40"
                        >
                          {{ rebuttalText.length }} / 800
                        </div>
                      </div>
                    </label>

                    <label class="block">
                      <span class="text-[13px] font-semibold text-[#374151]">Additional Notes</span>
                      <div class="relative mt-2">
                        <textarea
                          v-model="rebuttalNotes"
                          rows="4"
                          maxlength="500"
                          placeholder="Optional context for the admin."
                          class="w-full min-h-[100px] rounded-[10px] border-[1.5px] border-gray-200 bg-white px-4 py-3 text-[14px] text-noble-black outline-none transition-all focus:border-burning-orange focus:shadow-[0_0_0_3px_rgba(232,101,10,0.1)]"
                        ></textarea>
                        <div
                          class="absolute bottom-3 right-3 text-[11px] font-bold text-noble-black/40"
                        >
                          {{ rebuttalNotes.length }} / 500
                        </div>
                      </div>
                      <p class="mt-2 text-[12px] text-noble-black/40 font-medium italic ml-1">
                        This is optional and only visible to the moderation team.
                      </p>
                    </label>
                  </div>

                  <p
                    v-if="rebuttalValidationMessage"
                    class="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600"
                  >
                    {{ rebuttalValidationMessage }}
                  </p>
                </div>
              </div>

              <div v-else class="space-y-6">
                <div
                  v-if="latestDispute"
                  class="rounded-[14px] border border-gray-100 bg-[#F9FAFB] p-5"
                >
                  <p
                    class="text-[12px] font-bold uppercase tracking-wider text-noble-black/40 mb-3"
                  >
                    Dispute Summary
                  </p>
                  <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p class="text-[11px] font-bold text-noble-black/40">Reason</p>
                      <p class="text-[13px] font-semibold text-noble-black">
                        {{ latestDispute.reason }}
                      </p>
                    </div>
                    <div>
                      <p class="text-[11px] font-bold text-noble-black/40">Submitted</p>
                      <p class="text-[13px] font-semibold text-noble-black">
                        {{ formatDateTime(latestDispute.createdAt) }}
                      </p>
                    </div>
                  </div>
                </div>

                <div class="rounded-[14px] border border-gray-200 bg-white p-6 space-y-6 shadow-sm">
                  <div>
                    <p
                      class="text-[11px] font-bold uppercase tracking-wider text-noble-black/40 mb-2"
                    >
                      Your Rebuttal
                    </p>
                    <p class="text-[14px] leading-relaxed text-noble-black font-medium">
                      {{ rebuttalText.trim() }}
                    </p>
                  </div>

                  <div v-if="rebuttalNotes.trim()" class="pt-4 border-t border-gray-100">
                    <p
                      class="text-[11px] font-bold uppercase tracking-wider text-noble-black/40 mb-2"
                    >
                      Additional Notes
                    </p>
                    <p class="text-[14px] leading-relaxed text-noble-black/70 font-medium italic">
                      {{ rebuttalNotes.trim() }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="px-6 pt-4 pb-8 shrink-0 flex flex-col sm:flex-row gap-3 w-full">
              <button
                :disabled="isSubmittingRebuttal"
                type="button"
                class="flex-1 h-12 rounded-[10px] border-[1.5px] border-burning-orange bg-white text-[15px] font-bold text-burning-orange transition-all duration-200 hover:bg-burning-orange/5 disabled:opacity-50 disabled:cursor-not-allowed"
                @click="
                  rebuttalModalStep === 'form' ? closeRebuttalModal() : (rebuttalModalStep = 'form')
                "
              >
                {{ rebuttalModalStep === "form" ? "Cancel" : "Back" }}
              </button>
              <button
                :disabled="isSubmittingRebuttal"
                class="flex-1 h-12 rounded-[10px] bg-gradient-to-br from-burning-orange to-orange-500 text-[15px] font-bold text-white transition-all duration-300 shadow-lg shadow-burning-orange/35 hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                @click="rebuttalModalStep === 'form' ? continueRebuttalReview() : submitRebuttal()"
              >
                <span v-if="isSubmittingRebuttal" class="flex items-center justify-center gap-2">
                  <svg
                    class="animate-spin"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Processing...
                </span>
                <span v-else>
                  {{ rebuttalModalStep === "form" ? "Submit Rebuttal" : "Confirm & Submit" }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </Transition>
  </div>
</template>

<style scoped>
.custom-modal-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-modal-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-modal-scrollbar::-webkit-scrollbar-thumb {
  background: theme("colors.cinnamon-ice / 40%");
  border-radius: 20px;
}
</style>
