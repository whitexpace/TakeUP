<script setup lang="ts">
import { ref, computed, watch } from "vue"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../../../server/trpc/routers"
import type { ReviewType } from "#shared/schemas/review"
import { isChatAvailableForBookingStatus } from "#shared/chat-rules"
import { convertImageFileToWebP } from "~/utils/image-upload"
import { buildItemDetailPath } from "../../../utils/item-detail-route"
import {
  clearPrefetchedBookingDetail,
  getPrefetchedBookingDetail,
  prefetchBookingDetail,
  seedPrefetchedBookingDetail,
} from "../../../composables/use-booking-detail-prefetch"
import { useViewerSession } from "../../../composables/use-viewer-session"

definePageMeta({
  layout: "account",
  middleware: "account-auth",
  hideAccountSidebar: false,
})

type RouterOutputs = inferRouterOutputs<AppRouter>
type BookingDetail = NonNullable<RouterOutputs["booking"]["byId"]>

const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()
const { getAuthHeaders } = useViewerSession()
const bookingId = computed(() => {
  const id = route.params.id
  return Array.isArray(id) ? (id[0] ?? "") : (id ?? "")
})

const orderIdForDisplay = computed(() => bookingId.value.slice(0, 16).toUpperCase())

const { authUser } = useAuthUser()
const currentUserId = computed(() => authUser.value?.id ?? null)
const shouldBypassPrefetchedBookingDetail = ref(false)

const { data, pending, error, refresh } = useLazyAsyncData(
  () => `booking:${bookingId.value || "missing"}`,
  async () => {
    if (!bookingId.value) {
      return null
    }

    if (!shouldBypassPrefetchedBookingDetail.value) {
      const prefetched = getPrefetchedBookingDetail<BookingDetail>(bookingId.value)
      if (prefetched) {
        return prefetched
      }

      const prioritizedPrefetch = await prefetchBookingDetail(bookingId.value, {
        immediate: true,
        priority: true,
      }).catch(() => null)
      if (prioritizedPrefetch) {
        return prioritizedPrefetch
      }
    }

    const bookingDetail = await $fetch<BookingDetail | null>(`/api/bookings/${bookingId.value}`)
    if (bookingDetail) {
      seedPrefetchedBookingDetail(bookingId.value, bookingDetail)
    }

    return bookingDetail
  },
  { watch: [bookingId], default: () => null },
)

const booking = computed(() => data.value)

const isActing = ref(false)
const isDisputeDescriptionExpanded = ref(false)
const actionErrorMessage = ref("")
const actionSuccessMessage = ref("")
const proofUploadErrorMessage = ref("")

const refreshBookingDetail = async () => {
  if (bookingId.value) {
    clearPrefetchedBookingDetail(bookingId.value)
  }

  shouldBypassPrefetchedBookingDetail.value = true
  try {
    await refresh()
  } finally {
    shouldBypassPrefetchedBookingDetail.value = false
  }
}

const isLender = computed(() => booking.value?.lenderId === currentUserId.value)
const userRole = computed<"LENDER" | "BORROWER">(() => (isLender.value ? "LENDER" : "BORROWER"))
const canRespond = computed(() => isLender.value && booking.value?.status === "PENDING")
const canConfirmReceipt = computed(() => isLender.value && booking.value?.status === "RETURNED")
const canUploadHandoffProof = computed(
  () =>
    isLender.value &&
    booking.value?.status === "CONFIRMED" &&
    !booking.value?.lenderHandoffProofUploadedAt,
)
const canOpenChat = computed(
  () =>
    Boolean(booking.value?.transactionId) &&
    booking.value &&
    isChatAvailableForBookingStatus(booking.value.status),
)
const isPendingRequest = computed(() => booking.value?.status === "PENDING")
const canCancelRequest = computed(() => !isLender.value && booking.value?.status === "PENDING")
const canBorrowerReturnItem = computed(
  () =>
    !isLender.value &&
    booking.value?.status === "CONFIRMED" &&
    Boolean(booking.value?.lenderHandoffProofUploadedAt),
)

const mappedStatus = computed(() => {
  if (!booking.value) return "PENDING"
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

const duration = computed(() => {
  if (!booking.value) return ""
  return computeDuration(booking.value.startDate, booking.value.endDate)
})

const itemDetailPath = computed(() => {
  if (!booking.value) return ""
  return buildItemDetailPath({
    id: booking.value.item.id,
    name: booking.value.item.name,
  })
})

const backToTransactionsPath = computed(() => {
  return `/account/transactions?role=${userRole.value}`
})

const timeline = computed(() => {
  if (!booking.value) return []
  const entries = booking.value.timeline ?? []
  return entries.map((entry, index) => {
    let description = entry.description
    let proofUrl: string | null = null
    let proofLabel: string | null = null

    if (entry.label === "In use") {
      description = "Item picked up by borrower"
      if (booking.value?.lenderHandoffProofUrl) {
        proofUrl = booking.value.lenderHandoffProofUrl
        proofLabel = "View lending proof"
      }
    } else if (entry.label === "Returned") {
      if (booking.value && booking.value.refundAmount > 0) {
        description = `Early return initiated · Refund of ₱${booking.value.refundAmount} triggered`
      }
      if (booking.value?.borrowerReturnProofUrl) {
        proofUrl = booking.value.borrowerReturnProofUrl
        proofLabel = "View return proof"
      }
    }

    return {
      ...entry,
      description,
      date: formatDateTime(entry.occurredAt),
      status: index === entries.length - 1 ? "current" : "completed",
      proofUrl,
      proofLabel,
    }
  })
})

const isReturnModalOpen = ref(false)
const isHandoffProofModalOpen = ref(false)
const proofImageUrl = ref<string | null>(null)
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
const rebuttalImageFile = ref<File | null>(null)
const rebuttalImagePreview = ref<string | null>(null)
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
const handoffProofPreview = ref<string | null>(null)
const returnProofFile = ref<File | null>(null)
const returnProofPreview = ref<string | null>(null)
const earlyReturnProofFile = ref<File | null>(null)
const earlyReturnProofPreview = ref<string | null>(null)

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
  previewTarget:
    | typeof handoffProofPreview
    | typeof returnProofPreview
    | typeof earlyReturnProofPreview,
) => {
  proofUploadErrorMessage.value = ""
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null

  if (file && !file.type.startsWith("image/")) {
    target.value = null
    previewTarget.value = null
    input.value = ""
    proofUploadErrorMessage.value = "Please upload an image file as proof."
    return
  }

  target.value = file
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      previewTarget.value = (e.target?.result as string) ?? null
    }
    reader.readAsDataURL(file)
  } else {
    previewTarget.value = null
  }
}

const setHandoffProofFile = (event: Event) =>
  setProofFile(event, handoffProofFile, handoffProofPreview)
const setReturnProofFile = (event: Event) =>
  setProofFile(event, returnProofFile, returnProofPreview)
const setEarlyReturnProofFile = (event: Event) =>
  setProofFile(event, earlyReturnProofFile, earlyReturnProofPreview)

const clearHandoffProof = () => {
  handoffProofFile.value = null
  handoffProofPreview.value = null
}

const clearReturnProof = () => {
  returnProofFile.value = null
  returnProofPreview.value = null
}

const clearEarlyReturnProof = () => {
  earlyReturnProofFile.value = null
  earlyReturnProofPreview.value = null
}

const uploadProofImage = async (file: File, proofType: ProofUploadType) => {
  if (!booking.value) throw new Error("Booking data missing.")
  const uploadFile = await convertImageFileToWebP(file)
  const headers = await getAuthHeaders()
  const signedUpload = await $fetch<ProofUploadUrlResponse>("/api/bookings/proof-upload-url", {
    method: "POST",
    ...(headers ? { headers } : {}),
    body: {
      bookingId: booking.value.id,
      proofType,
      fileName: uploadFile.name,
    },
  })

  const { error: uploadError } = await supabase.storage
    .from(signedUpload.bucket)
    .uploadToSignedUrl(signedUpload.path, signedUpload.token, uploadFile, {
      contentType: uploadFile.type || "image/jpeg",
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
  clearReturnProof()
  isReturnModalOpen.value = true
}

const handleHandoffProof = () => {
  actionErrorMessage.value = ""
  proofUploadErrorMessage.value = ""
  clearHandoffProof()
  if (!isRentalPeriodStarted.value) {
    isTooEarlyForHandoffOpen.value = true
    return
  }
  isHandoffProofModalOpen.value = true
}

const isRentalPeriodStarted = computed(() => {
  if (!booking.value) return false
  const now = new Date()
  const start = new Date(booking.value.transactionStartDate ?? booking.value.startDate)
  return now >= start
})

const isTooEarlyForHandoffOpen = ref(false)

const isEarlyReturnEligible = computed(() => {
  if (!booking.value || isLender.value || booking.value.status !== "CONFIRMED") return false
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
  if (!booking.value) return
  actionErrorMessage.value = ""
  proofUploadErrorMessage.value = ""
  clearEarlyReturnProof()
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

const confirmEarlyReturn = async () => {
  if (!booking.value) return
  if (!earlyReturnProofFile.value) {
    proofUploadErrorMessage.value = "Upload proof of return before submitting."
    return
  }

  isSubmittingReturn.value = true
  actionErrorMessage.value = ""
  actionSuccessMessage.value = ""
  proofUploadErrorMessage.value = ""

  try {
    const proofImageUrl = await uploadProofImage(earlyReturnProofFile.value, "RETURN")
    await $fetch(`/api/bookings/${booking.value.id}/early-return`, {
      method: "POST",
      body: { proofImageUrl },
    })
    isEarlyReturnModalOpen.value = false
    isSuccessModalOpen.value = true
    actionSuccessMessage.value =
      "Early return submitted. The lender was notified to confirm receipt."
    await refreshBookingDetail()
  } catch (err: unknown) {
    proofUploadErrorMessage.value =
      err instanceof Error
        ? err.message
        : getFetchErrorMessage(err, "Unable to submit the early return right now.")
  } finally {
    isSubmittingReturn.value = false
  }
}

const confirmReturn = async () => {
  if (!booking.value) return
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
    await refreshBookingDetail()
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
  if (!booking.value) return
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
    await refreshBookingDetail()
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
  if (!booking.value) return
  isActing.value = true
  actionErrorMessage.value = ""
  actionSuccessMessage.value = ""

  try {
    await $fetch(`/api/bookings/${booking.value.id}`, {
      method: "PATCH",
      body: { status: "COMPLETED" },
    })
    await refreshBookingDetail()
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
  if (!booking.value) return
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
    await refreshBookingDetail()
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

const actingStatus = ref<"CONFIRMED" | "CANCELLED" | null>(null)

const respondToBooking = async (status: "CONFIRMED" | "CANCELLED") => {
  if (!booking.value) return
  isActing.value = true
  actingStatus.value = status
  actionErrorMessage.value = ""
  actionSuccessMessage.value = ""

  try {
    await $fetch(`/api/bookings/${booking.value.id}`, {
      method: "PATCH",
      body: { status },
    })
    await refreshBookingDetail()
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
    actingStatus.value = null
  }
}

const latestDispute = computed(() => booking.value?.latestDispute ?? null)
const canRaiseDispute = computed(() => booking.value?.canRaiseDispute ?? false)
const canSubmitRebuttal = computed(() => Boolean(latestDispute.value?.canSubmitRebuttal))
const isLatestDisputeRaisedByCurrentUser = computed(
  () => latestDispute.value?.raisedById === currentUserId.value,
)
const isReviewBlockedByDispute = computed(
  () => booking.value?.status === "COMPLETED" && !booking.value?.reviewState.isCompleted,
)
const showReviewBonusSection = computed(
  () => booking.value?.status === "COMPLETED" && booking.value?.reviewState.isCompleted,
)
const disputeReportPath = computed(() =>
  booking.value?.transactionId
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

const disputeRaiser = computed(() => {
  if (!latestDispute.value || !booking.value) return null
  return latestDispute.value.raisedById === booking.value.borrowerId
    ? booking.value.borrower.user
    : booking.value.lender.user
})

const disputeRaisedByName = computed(() => {
  if (!disputeRaiser.value) return null
  return `${disputeRaiser.value.firstName} ${disputeRaiser.value.lastName[0]}.`
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
  rebuttalImageFile.value = null
  rebuttalImagePreview.value = null
  rebuttalValidationMessage.value = ""
  rebuttalModalStep.value = "form"
}

const setRebuttalImageFile = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  if (file && !file.type.startsWith("image/")) {
    rebuttalValidationMessage.value = "Please upload an image file."
    return
  }
  rebuttalImageFile.value = file
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      rebuttalImagePreview.value = (e.target?.result as string) ?? null
    }
    reader.readAsDataURL(file)
  } else {
    rebuttalImagePreview.value = null
  }
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
    let rebuttalImageUrl: string | undefined

    if (rebuttalImageFile.value) {
      const uploadFile = await convertImageFileToWebP(rebuttalImageFile.value)
      type UploadUrlResponse = { token: string; path: string; publicUrl: string; bucket: string }
      const uploadData = await $fetch<UploadUrlResponse>(
        `/api/disputes/${latestDispute.value.id}/rebuttal-upload-url`,
        {
          method: "POST",
          body: { fileName: uploadFile.name },
        },
      )

      const { error: uploadError } = await supabase.storage
        .from(uploadData.bucket)
        .uploadToSignedUrl(uploadData.path, uploadData.token, uploadFile, {
          contentType: uploadFile.type || "image/jpeg",
          upsert: false,
        })

      if (uploadError) {
        throw new Error(uploadError.message || "Unable to upload rebuttal image.")
      }

      rebuttalImageUrl = uploadData.publicUrl
    }

    await $fetch(`/api/disputes/${latestDispute.value.id}/rebuttal`, {
      method: "POST",
      body: {
        rebuttalText: rebuttalText.value.trim(),
        rebuttalNotes: rebuttalNotes.value.trim() || undefined,
        rebuttalImageUrl,
      },
    })

    // Directly close without guard since we're still in submitting state
    isRebuttalModalOpen.value = false
    resetRebuttalForm()
    actionSuccessMessage.value = "Your rebuttal has been submitted."
    await refreshBookingDetail()
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
  if (!booking.value?.transactionId || !canOpenChat.value) return

  await router.push({
    path: "/chat",
    query: { transactionId: booking.value.transactionId },
  })
}

const reviewCounterpartName = computed(() => {
  if (!booking.value) return ""
  const user = isLender.value ? booking.value.borrower.user : booking.value.lender.user
  return `${user.firstName} ${user.lastName[0]}.`
})

const reviewContext = computed(() => {
  if (!booking.value?.transactionId || !selectedReviewType.value || !booking.value) return null

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
  const action = booking.value?.reviewState.actions.find((entry) => entry.reviewType === reviewType)
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
  await refreshBookingDetail()
  actionSuccessMessage.value = "Thanks for your feedback. Your review is now visible here."
}
</script>

<template>
  <div class="mx-auto max-w-[1180px] font-geist pb-20 px-4 sm:px-6 lg:px-16 xl:px-24">
    <!-- Header with Back Button -->
    <div class="relative group/tooltip w-fit mb-6 sm:mb-8">
      <NuxtLink
        :to="backToTransactionsPath"
        class="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center text-noble-black hover:text-burning-orange border border-noble-black/10 rounded-full transition-all group shadow-sm bg-white"
      >
        <Icon
          name="ph:caret-left"
          class="w-4 h-4 sm:w-5 sm:h-5 shrink-0 transition-transform group-hover:-translate-x-0.5"
        />
      </NuxtLink>
      <div class="custom-tooltip">
        Back to My Transactions
        <div class="tooltip-arrow"></div>
      </div>
    </div>

    <template v-if="pending && !booking">
      <div class="flex flex-col gap-6 sm:gap-8 animate-pulse">
        <!-- Header Skeleton -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="space-y-4">
            <div class="h-8 sm:h-10 w-48 sm:w-64 bg-noble-black/20 rounded-xl"></div>
            <div class="h-4 w-32 sm:w-40 bg-noble-black/10 rounded-lg"></div>
          </div>
          <div class="h-7 w-20 sm:h-8 sm:w-24 bg-noble-black/10 rounded-full"></div>
        </div>

        <!-- Content Grid Skeleton -->
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-6 sm:gap-8">
          <!-- Left Column Skeletons -->
          <div class="lg:col-span-3 space-y-6 sm:space-y-8">
            <!-- Item Detail Card Skeleton -->
            <div class="bg-white border border-cinnamon-ice/10 rounded-[24px] p-5 sm:p-6 shadow-sm">
              <div class="h-5 sm:h-6 w-28 sm:w-32 bg-noble-black/20 rounded mb-6"></div>
              <div class="flex flex-col sm:flex-row gap-4 sm:gap-6">
                <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-noble-black/10 shrink-0"></div>
                <div class="space-y-3 flex-1">
                  <div class="h-5 w-3/4 bg-noble-black/20 rounded"></div>
                  <div class="h-4 w-24 bg-noble-black/10 rounded"></div>
                  <div class="h-8 w-40 bg-noble-black/5 rounded-full mt-2"></div>
                </div>
              </div>
            </div>

            <!-- Timeline Section Skeleton -->
            <div
              class="bg-cream/50 border border-cinnamon-ice/15 rounded-[24px] p-6 sm:p-8 h-[350px] sm:h-[400px]"
            >
              <div class="h-5 sm:h-6 w-32 sm:w-40 bg-noble-black/20 rounded mb-8 sm:mb-10"></div>
              <div class="space-y-6 sm:space-y-8">
                <div v-for="i in 3" :key="i" class="flex gap-4 sm:gap-6">
                  <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-noble-black/10 shrink-0"></div>
                  <div class="space-y-2 flex-1 pt-1">
                    <div class="h-3.5 w-28 sm:h-4 sm:w-32 bg-noble-black/20 rounded"></div>
                    <div class="h-3 w-40 sm:w-48 bg-noble-black/10 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column Skeletons -->
          <div class="lg:col-span-2 space-y-6 sm:space-y-8">
            <!-- Payment Summary Skeleton -->
            <div
              class="bg-white border border-cinnamon-ice/10 rounded-[16px] p-5 sm:p-6 shadow-sm space-y-5 sm:space-y-6"
            >
              <div class="h-4 sm:h-5 w-28 sm:w-32 bg-noble-black/20 rounded"></div>
              <div class="space-y-3 sm:space-y-4">
                <div v-for="i in 2" :key="i" class="flex justify-between">
                  <div class="h-3.5 w-20 sm:h-4 sm:w-24 bg-noble-black/10 rounded"></div>
                  <div class="h-3.5 w-12 sm:h-4 sm:w-16 bg-noble-black/10 rounded"></div>
                </div>
                <div
                  class="pt-4 sm:pt-5 border-t border-dashed border-gray-100 flex justify-between"
                >
                  <div class="h-5 sm:h-6 w-16 sm:w-20 bg-noble-black/20 rounded"></div>
                  <div class="h-5 sm:h-6 w-20 sm:w-24 bg-noble-black/20 rounded"></div>
                </div>
              </div>
            </div>

            <!-- Counterpart Info Skeleton -->
            <div
              class="bg-white border border-cinnamon-ice/10 rounded-[12px] p-4 sm:p-5 shadow-sm space-y-4"
            >
              <div class="h-3 w-14 sm:w-16 bg-noble-black/10 rounded mb-4"></div>
              <div class="flex items-center gap-3 sm:gap-4">
                <div
                  class="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-noble-black/10 shrink-0"
                ></div>
                <div class="space-y-2 flex-1">
                  <div class="h-3.5 sm:h-4 w-28 sm:w-32 bg-noble-black/20 rounded"></div>
                  <div class="h-2.5 sm:h-3 w-20 sm:w-24 bg-noble-black/10 rounded"></div>
                </div>
              </div>
              <div class="h-9 sm:h-10 w-full bg-noble-black/5 rounded-[10px] mt-2"></div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="booking">
      <!-- Redesigned Page Header Strip -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div class="space-y-1.5">
          <div class="space-y-2 mb-2">
            <h1
              class="font-geist text-[28px] sm:text-[36px] font-medium text-noble-black leading-tight tracking-tight"
            >
              Order Details
            </h1>
            <div class="w-10 h-0.5 bg-burning-orange"></div>
          </div>
          <div
            class="flex flex-wrap items-center gap-2 text-[12px] sm:text-[13px] text-gray-500 font-medium"
          >
            <div
              class="flex items-center gap-2 font-mono text-[10px] sm:text-[11px] text-noble-black/40 bg-gray-50 px-2 py-0.5 rounded border border-gray-100"
            >
              <span class="leading-none">ORDER ID. {{ orderIdForDisplay }}</span>
              <button
                class="hover:text-burning-orange transition-colors flex items-center justify-center shrink-0 -translate-y-[0.5px]"
                title="Copy Order ID"
                @click="copyOrderId"
              >
                <Icon name="ph:copy" class="w-3 h-3 shrink-0" />
              </button>
            </div>
          </div>
        </div>

        <div class="shrink-0">
          <span
            v-if="isPendingRequest"
            class="inline-flex items-center gap-2 rounded-full bg-burning-orange/[0.08] text-burning-orange border border-burning-orange/20 px-2.5 py-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider"
          >
            Requested
          </span>
          <TransactionStatusBadge
            v-else
            :status="mappedStatus"
            :role="userRole"
            class="!rounded-full !px-2.5 !py-1 !text-[10px] sm:!text-[11px] !font-bold !uppercase !tracking-wider"
          />
        </div>
      </div>

      <!-- Two-Column Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-6 sm:gap-8 items-start">
        <!-- Left Column (60%) -->
        <div class="lg:col-span-3 space-y-6 sm:space-y-8">
          <!-- Section 1: Item Details -->
          <div
            class="bg-white border border-[#F0EDE8] rounded-[24px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] relative group"
          >
            <div class="flex items-center justify-between mb-5 sm:mb-6">
              <h2 class="text-[16px] sm:text-[18px] font-bold text-noble-black">Item Details</h2>
              <NuxtLink
                :to="itemDetailPath"
                class="inline-flex items-center gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-burning-orange font-bold text-[12px] sm:text-[13px] hover:bg-burning-orange/5 transition-all"
              >
                <span class="leading-none">View Listing</span>
                <Icon
                  name="ph:arrow-square-out"
                  class="w-3 h-3 sm:w-3.5 sm:h-3.5 -translate-y-[0.5px]"
                />
              </NuxtLink>
            </div>
            <div class="flex flex-row gap-4 sm:gap-6">
              <div class="shrink-0 relative">
                <img
                  v-if="booking.item?.thumbnailImage"
                  :src="booking.item.thumbnailImage"
                  :alt="booking.item.name"
                  class="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-[10px] sm:rounded-[12px] border border-gray-100 shadow-sm"
                />
                <div
                  v-else
                  class="w-20 h-20 sm:w-24 sm:h-24 bg-cinnamon-ice/10 rounded-[10px] sm:rounded-[12px] border border-gray-100 flex items-center justify-center"
                >
                  <Icon name="ph:image" class="w-7 h-7 sm:w-8 sm:h-8 text-cinnamon-ice/40" />
                </div>
              </div>
              <div class="flex flex-col justify-center min-w-0 flex-1">
                <h3
                  class="text-[16px] sm:text-[18px] font-semibold text-noble-black leading-tight mb-1 truncate"
                >
                  {{ booking.item?.name }}
                </h3>
                <p class="text-[12px] sm:text-[13px] text-gray-500 font-medium mb-3 sm:mb-4">
                  Condition:
                  {{
                    booking.item?.condition
                      ?.replace("_", " ")
                      .toLowerCase()
                      .replace(/\b\w/g, (l) => l.toUpperCase())
                  }}
                </p>
                <div
                  class="flex items-center gap-2 text-[11px] sm:text-[12px] font-bold text-gray-600 bg-gray-100 w-fit px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-gray-200/50 shadow-sm"
                >
                  <Icon
                    name="ph:calendar-blank"
                    class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400 -translate-y-[0.5px] shrink-0"
                  />
                  <span class="leading-none truncate max-w-[200px] sm:max-w-none"
                    >{{ formatDate(booking.startDate) }} – {{ formatDate(booking.endDate) }}</span
                  >
                </div>
              </div>
            </div>
          </div>

          <!-- Section 2: Order Timeline -->
          <section
            class="bg-cream border border-cinnamon-ice/20 rounded-[24px] p-5 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
          >
            <div class="border-l-[3px] border-burning-orange pl-3 sm:pl-4 mb-6 sm:mb-8">
              <h2 class="text-[18px] sm:text-[20px] font-bold text-noble-black">Order Timeline</h2>
            </div>

            <div
              v-if="actionSuccessMessage"
              class="mb-6 flex items-center gap-3 text-[12px] sm:text-[13px] font-bold text-success-green bg-success-green/5 border border-success-green/10 p-3 sm:p-4 rounded-[14px]"
            >
              <Icon name="ph:check" class="w-[18px] h-[18px] shrink-0 -translate-y-[0.5px]" />
              <span class="leading-none">{{ actionSuccessMessage }}</span>
            </div>

            <div
              v-if="actionErrorMessage"
              class="mb-6 flex items-center gap-3 text-[12px] sm:text-[13px] font-bold text-cinnabar-red bg-cinnabar-red/5 border border-cinnabar-red/10 p-3 sm:p-4 rounded-[14px]"
            >
              <Icon
                name="ph:warning-circle"
                class="w-[18px] h-[18px] shrink-0 -translate-y-[0.5px]"
              />
              <span class="leading-none">{{ actionErrorMessage }}</span>
            </div>

            <div class="space-y-0 relative pl-0.5 sm:pl-1">
              <div
                v-for="(step, index) in timeline"
                :key="index"
                class="relative flex gap-4 sm:gap-6 pb-8 sm:pb-12 last:pb-0"
              >
                <!-- Timeline Line -->
                <div
                  v-if="index !== timeline.length - 1"
                  class="absolute left-[11px] sm:left-[15px] top-6 sm:top-8 bottom-0 w-[1.5px] sm:w-[2px]"
                  :class="step.status === 'completed' ? 'bg-success-green/30' : 'bg-gray-100'"
                ></div>

                <!-- Timeline Icon (Hollow Precision Style) -->
                <div class="relative z-10">
                  <div
                    v-if="step.status === 'completed'"
                    class="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white border-2 border-success-green flex items-center justify-center shadow-sm"
                  >
                    <Icon name="ph:check" class="w-3 h-3 sm:w-4 sm:h-4 text-[#22C55E]" />
                  </div>
                  <div
                    v-else-if="step.status === 'current'"
                    class="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white border-2 border-burning-orange flex items-center justify-center shadow-sm"
                  >
                    <div
                      class="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-burning-orange shadow-[0_0_8px_rgba(232,101,10,0.4)]"
                    ></div>
                  </div>
                  <div
                    v-else
                    class="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white border-2 border-gray-100 flex items-center justify-center"
                  >
                    <div class="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-gray-200"></div>
                  </div>
                </div>

                <!-- Step Content -->
                <div
                  class="flex-1 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-4 min-w-0"
                >
                  <div class="min-w-0">
                    <h4 class="text-[13px] sm:text-[14px] font-bold text-noble-black leading-tight">
                      {{ step.label }}
                    </h4>
                    <p
                      class="mt-1 text-[12px] sm:text-[13px] text-noble-black/45 leading-relaxed max-w-lg font-medium"
                    >
                      {{ step.description }}
                    </p>
                    <button
                      v-if="step.proofUrl"
                      type="button"
                      class="mt-2 inline-flex items-center gap-1.5 text-[11px] sm:text-[12px] font-bold text-blue-estate hover:text-burning-orange transition-colors underline underline-offset-2"
                      @click.stop="proofImageUrl = step.proofUrl"
                    >
                      <Icon
                        name="ph:image"
                        class="w-[12px] h-[12px] shrink-0 -translate-y-[0.5px]"
                      />
                      <span class="leading-none">{{ step.proofLabel }}</span>
                    </button>
                  </div>
                  <span
                    class="text-[9px] sm:text-[11px] font-mono text-noble-black/30 whitespace-nowrap pt-0.5 sm:pt-1 uppercase tracking-tighter"
                  >
                    {{ step.date }}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <!-- Section 5: Feedback & Reviews -->
          <section
            class="bg-cream border border-cinnamon-ice/20 rounded-[24px] p-5 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
          >
            <div
              class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8"
            >
              <div class="border-l-[3px] border-burning-orange pl-3 sm:pl-4">
                <h2 class="text-[18px] sm:text-[20px] font-bold text-noble-black">Your Reviews</h2>
                <p class="text-[12px] sm:text-[13px] font-medium text-noble-black/40 mt-0.5">
                  Reviews help maintain trust in the TakeUP community.
                </p>
              </div>

              <div class="flex flex-wrap gap-2">
                <button
                  v-for="action in booking.reviewState.actions.filter((entry) => entry.canSubmit)"
                  :key="action.reviewType"
                  class="bg-burning-orange text-white px-4 py-2 sm:px-5 rounded-[10px] sm:rounded-[12px] text-[12px] sm:text-[13px] font-bold hover:brightness-110 shadow-sm shadow-burning-orange/20 transition-all"
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
              class="mt-6 sm:mt-8 rounded-[18px] border border-burning-orange/10 bg-burning-orange/[0.03] p-4 sm:p-5 flex items-center justify-between"
            >
              <div class="min-w-0">
                <p class="text-[13px] sm:text-[14px] font-bold text-noble-black">
                  Reviews Completed
                </p>
                <p class="text-[11px] sm:text-[12px] text-noble-black/50 font-medium mt-0.5">
                  Your +5 reward points have been processed.
                </p>
              </div>
              <div
                class="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center border border-burning-orange/20 shadow-sm shrink-0 ml-4"
              >
                <Icon name="ph:seal-check" class="w-5 h-5 sm:w-6 sm:h-6 text-burning-orange" />
              </div>
            </div>
          </section>

          <!-- Section 6: Concerns & Disputes -->
          <section
            v-if="booking.transactionId || latestDispute"
            class="bg-cream border border-cinnamon-ice/20 rounded-[24px] p-5 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
          >
            <div
              class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6 sm:mb-8"
            >
              <div class="border-l-[3px] border-burning-orange pl-3 sm:pl-4">
                <h2 class="text-[18px] sm:text-[20px] font-bold text-noble-black">
                  Concerns & Disputes
                </h2>
                <p
                  class="mt-1 text-[12px] sm:text-[13px] font-medium text-noble-black/50 leading-relaxed max-w-sm"
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
                class="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider border shadow-sm w-fit"
                :class="disputeStatusToneClasses"
              >
                {{ disputeStatusLabel }}
              </span>
            </div>

            <!-- Empty State Message -->
            <div v-if="!latestDispute" class="mb-4">
              <p class="text-[13px] sm:text-[14px] text-noble-black/40 italic">
                No concerns or disputes have been raised for this transaction yet.
              </p>
            </div>

            <!-- Redesigned Dispute Metadata Grid -->
            <div v-if="latestDispute" class="space-y-6">
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
                <div class="min-w-0">
                  <p
                    class="text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.1em] text-noble-black/30 mb-1.5"
                  >
                    Reason
                  </p>
                  <p class="text-[13px] sm:text-[14px] font-semibold text-noble-black truncate">
                    {{ latestDispute.reason }}
                  </p>
                </div>
                <div class="min-w-0">
                  <p
                    class="text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.1em] text-noble-black/30 mb-1.5"
                  >
                    Submitted
                  </p>
                  <p class="text-[13px] sm:text-[14px] font-semibold text-noble-black truncate">
                    {{ formatDate(latestDispute.createdAt) }}
                  </p>
                </div>
                <div class="min-w-0">
                  <p
                    class="text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.1em] text-noble-black/30 mb-1.5"
                  >
                    Raised By
                  </p>
                  <p class="text-[13px] sm:text-[14px] font-semibold text-noble-black truncate">
                    {{ disputeRaisedByName ?? "Participant" }}
                  </p>
                </div>
              </div>

              <!-- Truncated Description -->
              <div v-if="latestDispute.description" class="relative">
                <p
                  class="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.1em] text-noble-black/30 mb-2"
                >
                  Description
                </p>
                <div
                  class="text-[13px] sm:text-[14px] leading-relaxed text-noble-black/70 overflow-hidden transition-all duration-300"
                  :class="!isDisputeDescriptionExpanded ? 'max-h-24' : 'max-h-none'"
                >
                  {{ latestDispute.description }}
                </div>
                <button
                  v-if="latestDispute.description.length > 200"
                  class="mt-2 text-burning-orange text-[12px] sm:text-[13px] font-bold hover:underline"
                  @click="isDisputeDescriptionExpanded = !isDisputeDescriptionExpanded"
                >
                  {{ isDisputeDescriptionExpanded ? "Show less" : "Show more" }}
                </button>
              </div>

              <!-- Decisions -->
              <div
                v-if="latestDispute.finalDecision"
                class="rounded-[16px] border border-success-green/20 bg-success-green/[0.04] p-4 sm:p-5"
              >
                <div class="flex items-center gap-2 text-success-green mb-2">
                  <Icon name="ph:check" class="w-[18px] h-[18px]" />
                  <p class="text-[13px] sm:text-[14px] font-bold">
                    {{ finalDecisionLabel(latestDispute.finalDecision) }}
                  </p>
                </div>
                <p class="text-[11px] sm:text-[12px] font-medium text-noble-black/40">
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
                class="rounded-[12px] border border-gray-100 bg-white p-4 sm:p-5 shadow-sm"
              >
                <div class="flex items-center justify-between gap-4 mb-3">
                  <p class="text-[12px] sm:text-[13px] font-bold text-noble-black">
                    Rebuttal by {{ rebuttalSubmittedByName }}
                  </p>
                  <span class="text-[10px] font-mono text-noble-black/30">{{
                    formatDate(latestDispute.rebuttalSubmittedAt!)
                  }}</span>
                </div>
                <p class="text-[12px] sm:text-[13px] text-noble-black/70 leading-relaxed">
                  {{ latestDispute.rebuttalText }}
                </p>
              </div>
            </div>

            <!-- Dispute Actions -->
            <div class="mt-6 sm:mt-8 flex flex-wrap gap-3">
              <button
                v-if="canSubmitRebuttal"
                class="flex-1 min-w-[140px] h-10 sm:h-11 inline-flex items-center justify-center gap-2 rounded-[10px] sm:rounded-[12px] bg-blue-estate text-white text-[13px] sm:text-[14px] font-bold hover:brightness-110 shadow-sm transition-all"
                @click="openRebuttalModal"
              >
                Submit Rebuttal
              </button>

              <button
                v-if="canRaiseDispute"
                class="flex-1 min-w-[140px] h-10 sm:h-11 inline-flex items-center justify-center gap-2 rounded-[10px] sm:rounded-[12px] border-2 border-cinnabar-red text-cinnabar-red text-[13px] sm:text-[14px] font-bold hover:bg-cinnabar-red hover:text-white transition-all"
                @click="handleDispute"
              >
                <Icon name="ph:warning" class="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                Report Issue
              </button>
            </div>

            <!-- Minimal Status Footer Text -->
            <div
              v-if="latestDispute?.status === 'OPEN' || latestDispute?.status === 'SUBMITTED'"
              class="mt-5 sm:mt-6 flex items-center justify-center px-2"
            >
              <span
                class="text-[12px] sm:text-[13px] font-bold text-noble-black/40 italic text-center"
              >
                {{
                  latestDispute.hasRebuttal
                    ? "Rebuttal submitted. Dispute still under review."
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
                class="h-11 sm:h-12 bg-gradient-to-br from-burning-orange to-orange-500 text-white rounded-[10px] sm:rounded-[12px] font-bold text-[13px] sm:text-[14px] hover:brightness-105 shadow-lg shadow-burning-orange/20 transition-all disabled:opacity-50"
                @click="respondToBooking('CONFIRMED')"
              >
                {{ actingStatus === "CONFIRMED" ? "Approving..." : "Approve" }}
              </button>
              <button
                :disabled="isActing"
                class="h-11 sm:h-12 bg-white border-2 border-burning-orange text-burning-orange rounded-[10px] sm:rounded-[12px] font-bold text-[13px] sm:text-[14px] hover:bg-burning-orange/5 transition-all disabled:opacity-50"
                @click="respondToBooking('CANCELLED')"
              >
                {{ actingStatus === "CANCELLED" ? "Declining..." : "Decline" }}
              </button>
            </div>

            <button
              v-if="canUploadHandoffProof"
              :disabled="isSubmittingHandoffProof"
              class="w-full h-11 sm:h-12 flex items-center justify-center gap-2 bg-blue-estate text-white rounded-[10px] sm:rounded-[12px] font-bold text-[13px] sm:text-[14px] hover:brightness-110 shadow-lg shadow-blue-estate/20 transition-all disabled:opacity-50"
              @click="handleHandoffProof"
            >
              <Icon
                v-if="isSubmittingHandoffProof"
                name="ph:circle-notch"
                class="animate-spin w-4 h-4"
              />
              Upload Handoff Proof
            </button>

            <button
              v-if="canBorrowerReturnItem"
              :disabled="isFetchingPreview"
              class="w-full h-11 sm:h-12 flex items-center justify-center gap-2 bg-burning-orange text-white rounded-[10px] sm:rounded-[12px] font-bold text-[13px] sm:text-[14px] hover:brightness-110 shadow-lg shadow-burning-orange/20 transition-all disabled:opacity-50"
              @click="isEarlyReturnEligible ? handleEarlyReturn() : handleReturn()"
            >
              <Icon v-if="isFetchingPreview" name="ph:circle-notch" class="animate-spin w-4 h-4" />
              {{ isEarlyReturnEligible ? "Confirm Early Return" : "Return Item Now" }}
            </button>

            <button
              v-if="canConfirmReceipt"
              :disabled="isActing"
              class="w-full h-11 sm:h-12 bg-blue-estate text-white rounded-[10px] sm:rounded-[12px] font-bold text-[13px] sm:text-[14px] hover:brightness-110 shadow-lg shadow-blue-estate/20 transition-all disabled:opacity-50"
              @click="confirmReceipt"
            >
              Confirm Item Receipt
            </button>

            <button
              v-if="canCancelRequest"
              :disabled="isActing"
              class="w-full h-11 sm:h-12 bg-white border-2 border-cinnabar-red text-cinnabar-red rounded-[10px] sm:rounded-[12px] font-bold text-[13px] sm:text-[14px] hover:bg-cinnabar-red/5 transition-all disabled:opacity-50"
              @click="cancelRequest"
            >
              Cancel My Request
            </button>
          </div>

          <!-- Section 3: Payment Summary (Receipt Card) -->
          <section
            class="bg-white border border-[#F0EDE8] rounded-[16px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
          >
            <h2 class="text-[15px] sm:text-[16px] font-bold text-noble-black mb-5 sm:mb-6">
              Payment Summary
            </h2>
            <div class="space-y-3 sm:space-y-4">
              <div class="flex justify-between items-center text-[13px] sm:text-[14px]">
                <span class="text-gray-500 font-medium">Rental ({{ duration }})</span>
                <span class="text-[#111] font-semibold">{{
                  formatPeso(booking.totalFee - booking.platformCommission)
                }}</span>
              </div>
              <div class="flex justify-between items-center text-[13px] sm:text-[14px]">
                <span class="text-gray-500 font-medium">Service Fee</span>
                <span class="text-[#111] font-semibold">{{
                  formatPeso(booking.platformCommission)
                }}</span>
              </div>

              <div
                v-if="booking.refundAmount > 0"
                class="flex justify-between items-center text-[13px] sm:text-[14px]"
              >
                <div class="flex items-center gap-1.5 sm:gap-2">
                  <span class="text-[#059669] font-bold">Refund</span>
                  <span
                    class="text-[9px] bg-[#D1FAE5] px-1.5 py-0.5 rounded-full text-[#065F46] font-black uppercase"
                    >PROCESSED</span
                  >
                </div>
                <span class="text-[#059669] font-bold"
                  >-{{ formatPeso(booking.refundAmount) }}</span
                >
              </div>

              <!-- Dashed Separator -->
              <div
                class="border-t border-dashed border-gray-200 pt-4 sm:pt-5 mt-1 sm:mt-2 flex justify-between items-baseline"
              >
                <span class="text-[16px] sm:text-[18px] font-bold text-[#111]">Total Paid</span>
                <span class="text-[18px] sm:text-[20px] font-bold text-burning-orange">
                  {{ formatPeso(booking.totalFee - (booking.refundAmount || 0)) }}
                </span>
              </div>

              <div
                v-if="booking.status === 'CANCELLED' && booking.paymentStatus === 'REFUNDED'"
                class="flex justify-between items-center text-[13px] sm:text-[14px] mt-1"
              >
                <div class="flex items-center gap-1.5 sm:gap-2">
                  <span class="text-[#059669] font-semibold">Refunded</span>
                  <span
                    class="text-[9px] bg-[#D1FAE5] px-1.5 py-0.5 rounded-full text-[#065F46] font-black uppercase"
                    >PROCESSED</span
                  >
                </div>
                <span class="text-[14px] sm:text-[16px] font-bold text-[#059669]"
                  >+{{ formatPeso(booking.totalFee) }}</span
                >
              </div>
            </div>

            <!-- TakeUP Secure Guarantee (Slim Style) -->
            <div class="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-gray-50">
              <div
                class="bg-blue-estate/[0.03] border border-blue-estate/10 rounded-[12px] p-3 sm:p-4 flex gap-3 items-start"
              >
                <div
                  class="shrink-0 text-blue-estate flex items-center justify-center -translate-y-[0.5px]"
                >
                  <Icon name="ph:shield-check" class="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0" />
                </div>
                <p class="text-[11px] sm:text-[12px] text-blue-estate font-medium leading-snug">
                  <span class="font-bold">TakeUP Secure.</span> Funds are held safely until
                  completion.
                </p>
              </div>
            </div>
          </section>

          <!-- Section 4: Counterpart Information -->
          <section class="bg-white border border-[#F0EDE8] rounded-[12px] p-4 sm:p-5 shadow-sm">
            <p
              class="text-[10px] sm:text-[11px] font-bold text-noble-black/30 uppercase tracking-[0.1em] mb-4"
            >
              {{ isLender ? "Borrower" : "Lender" }}
            </p>
            <div class="flex flex-col gap-4 sm:gap-5">
              <NuxtLink
                :to="`/profile/${
                  isLender ? booking.borrower.user.username : booking.lender.user.username
                }`"
                class="flex items-center gap-3 sm:gap-4 min-w-0 group/counterpart"
              >
                <UserAvatar
                  :user-name="
                    isLender
                      ? `${booking.borrower.user.firstName} ${booking.borrower.user.lastName}`
                      : `${booking.lender.user.firstName} ${booking.lender.user.lastName}`
                  "
                  :avatar-url="
                    isLender
                      ? (booking.borrower.user as any).avatarUrl
                      : (booking.lender.user as any).avatarUrl
                  "
                  size="md"
                  class="shrink-0 ring-4 ring-gray-50 transition-transform group-hover/counterpart:scale-105 sm:size-lg"
                />
                <div class="min-w-0 flex-1">
                  <h3
                    class="font-semibold text-noble-black text-[14px] sm:text-[15px] truncate group-hover/counterpart:text-burning-orange transition-colors"
                  >
                    {{
                      isLender
                        ? `${booking.borrower.user.firstName} ${booking.borrower.user.lastName}`
                        : `${booking.lender.user.firstName} ${booking.lender.user.lastName}`
                    }}
                  </h3>
                  <div class="flex items-center gap-2 mt-0.5 sm:mt-1">
                    <div
                      class="flex items-center gap-0.5 text-burning-orange font-bold text-[12px] sm:text-[13px]"
                    >
                      <span class="leading-none">{{
                        isLender
                          ? booking.borrower.borrowerRating?.toFixed(1) || "5.0"
                          : booking.lender.lenderRating?.toFixed(1) || "5.0"
                      }}</span>
                      <Icon
                        name="ph:star-fill"
                        class="w-2.5 h-2.5 sm:w-3 sm:h-3 -translate-y-[0.5px]"
                      />
                    </div>
                    <span class="text-noble-black/30 text-[11px] sm:text-[12px] font-medium"
                      >•
                      {{ isLender ? booking.borrower._count?.bookings || 0 : 124 }} bookings</span
                    >
                  </div>
                </div>
              </NuxtLink>

              <button
                v-if="canOpenChat"
                class="w-full h-9 sm:h-10 flex items-center justify-center gap-2 rounded-[10px] bg-burning-orange/[0.08] text-burning-orange hover:bg-burning-orange/[0.12] font-bold text-[12px] sm:text-[13px] transition-all"
                @click="openChat"
              >
                <Icon
                  name="ph:chat-teardrop-text"
                  class="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 -translate-y-[0.5px]"
                />
                <span class="leading-none">Message {{ isLender ? "Borrower" : "Lender" }}</span>
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
        <Icon name="ph:warning-circle" class="w-10 h-10 text-cinnabar-red" />
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
          class="fixed inset-0 z-[1300] flex items-center justify-center p-4 font-geist"
        >
          <div
            class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm"
            @click="isHandoffProofModalOpen = false"
          ></div>

          <div
            class="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-[20px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.15)] overflow-hidden"
          >
            <!-- Header -->
            <div class="px-6 pt-8 pb-4 flex items-start justify-between gap-4 shrink-0">
              <div>
                <h2 class="text-[24px] font-bold text-noble-black">Upload Handoff Proof</h2>
                <p class="mt-1 text-[13px] font-medium text-noble-black/40">
                  Show the item handoff to update the status to "In Use".
                </p>
              </div>
              <button
                type="button"
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-noble-black transition hover:bg-gray-100"
                @click="isHandoffProofModalOpen = false"
              >
                <Icon name="ph:x" class="w-5 h-5" />
              </button>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto custom-modal-scrollbar px-6">
              <div class="py-6">
                <!-- Unified Dropzone -->
                <div class="relative group">
                  <label
                    class="block w-full aspect-square max-w-[140px] mx-auto rounded-[20px] border-2 border-dashed border-cinnamon-ice bg-cream/50 overflow-hidden cursor-pointer hover:border-burning-orange hover:bg-burning-orange/[0.02] transition-all duration-300"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      class="sr-only"
                      @change="setHandoffProofFile"
                    />

                    <!-- Empty State -->
                    <div
                      v-if="!handoffProofPreview"
                      class="h-full w-full flex flex-col items-center justify-center gap-2 p-4 text-center"
                    >
                      <div
                        class="w-9 h-9 rounded-full bg-noble-black/5 flex items-center justify-center text-noble-black/20 group-hover:text-burning-orange group-hover:bg-burning-orange/10 transition-colors"
                      >
                        <Icon name="ph:plus" class="w-5 h-5" />
                      </div>
                      <span
                        class="text-[12px] font-bold text-noble-black/40 group-hover:text-burning-orange/70 transition-colors"
                        >Add image</span
                      >
                    </div>

                    <!-- Selected State (Preview) -->
                    <div v-else class="relative h-full w-full group/preview">
                      <img
                        :src="handoffProofPreview"
                        class="h-full w-full object-cover"
                        alt="Handoff proof"
                      />
                      <div
                        class="absolute inset-0 bg-noble-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <div
                          class="flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 text-noble-black text-[12px] font-bold shadow-lg"
                        >
                          <Icon name="ph:arrows-clockwise" class="w-4 h-4" />
                          Replace Image
                        </div>
                      </div>
                    </div>
                  </label>

                  <!-- Remove Button (Corner) -->
                  <button
                    v-if="handoffProofPreview"
                    type="button"
                    class="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white border border-gray-100 shadow-md flex items-center justify-center text-cinnabar-red hover:scale-110 transition-transform z-10"
                    title="Remove Image"
                    @click.prevent="clearHandoffProof"
                  >
                    <Icon name="ph:trash" class="w-4 h-4" />
                  </button>
                </div>

                <p
                  v-if="proofUploadErrorMessage"
                  class="mt-6 text-sm text-red-600 font-medium text-center"
                >
                  {{ proofUploadErrorMessage }}
                </p>
              </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-5 border-t border-cinnamon-ice/10 bg-white flex gap-3 shrink-0">
              <button
                type="button"
                class="flex-1 h-12 items-center justify-center rounded-[10px] border-[1.5px] border-burning-orange bg-white text-[15px] font-bold text-burning-orange transition-all duration-200 hover:bg-burning-orange/5"
                @click="isHandoffProofModalOpen = false"
              >
                Cancel
              </button>
              <button
                type="button"
                class="flex-1 h-12 items-center justify-center rounded-[10px] bg-gradient-to-br from-burning-orange to-orange-500 text-[15px] font-bold text-white transition-all duration-300 shadow-lg shadow-burning-orange/35 hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                :disabled="isSubmittingHandoffProof || !handoffProofFile"
                @click="confirmHandoffProof"
              >
                <span
                  v-if="isSubmittingHandoffProof"
                  class="flex items-center justify-center gap-2"
                >
                  <Icon name="ph:circle-notch" class="w-4 h-4 animate-spin" />
                  Confirming...
                </span>
                <span v-else>Confirm Handoff</span>
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </Transition>

    <!-- Too Early to Upload Handoff Proof Modal -->
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
          v-if="isTooEarlyForHandoffOpen"
          class="fixed inset-0 z-[1300] flex items-center justify-center p-4"
        >
          <div
            class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm"
            @click="isTooEarlyForHandoffOpen = false"
          ></div>

          <div
            class="relative bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-300"
          >
            <div class="text-center">
              <div
                class="w-20 h-20 bg-burning-orange/10 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <Icon name="ph:warning-circle" class="w-10 h-10" style="color: #e8650a" />
              </div>
              <h3 class="text-2xl font-bold text-noble-black mb-2">Not Yet Time to Lend</h3>
              <p class="text-noble-black/60 mb-2 leading-relaxed">
                You can only lend the item within the agreed rental period.
              </p>
              <p v-if="booking" class="text-[13px] text-noble-black/40 font-medium mb-8">
                Rental period:
                <span class="font-bold text-noble-black/60">{{
                  formatDateTime(booking.transactionStartDate ?? booking.startDate)
                }}</span>
                –
                <span class="font-bold text-noble-black/60">{{
                  formatDateTime(booking.transactionEndDate ?? booking.endDate)
                }}</span
                >.
              </p>
              <button
                class="w-full bg-burning-orange text-white py-4 rounded-2xl font-bold hover:brightness-110 transition-all"
                @click="isTooEarlyForHandoffOpen = false"
              >
                Got it
              </button>
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
          class="fixed inset-0 z-[1300] flex items-center justify-center p-4 font-geist"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm"
            @click="isReturnModalOpen = false"
          ></div>

          <!-- Modal -->
          <div
            class="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-[20px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.15)] overflow-hidden"
          >
            <!-- Header -->
            <div class="px-6 pt-8 pb-4 flex items-start justify-between gap-4 shrink-0">
              <div>
                <h2 class="text-[24px] font-bold text-noble-black">Confirm Item Return</h2>
                <p class="mt-1 text-[13px] font-medium text-noble-black/40">
                  Provide proof that you have returned the item to the lender.
                </p>
              </div>
              <button
                type="button"
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-noble-black transition hover:bg-gray-100"
                @click="isReturnModalOpen = false"
              >
                <Icon name="ph:x" class="w-5 h-5" />
              </button>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto custom-modal-scrollbar px-6">
              <div class="py-6">
                <!-- Unified Dropzone -->
                <div class="relative group">
                  <label
                    class="block w-full aspect-square max-w-[140px] mx-auto rounded-[20px] border-2 border-dashed border-cinnamon-ice bg-cream/50 overflow-hidden cursor-pointer hover:border-burning-orange hover:bg-burning-orange/[0.02] transition-all duration-300"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      class="sr-only"
                      @change="setReturnProofFile"
                    />

                    <!-- Empty State -->
                    <div
                      v-if="!returnProofPreview"
                      class="h-full w-full flex flex-col items-center justify-center gap-2 p-4 text-center"
                    >
                      <div
                        class="w-9 h-9 rounded-full bg-noble-black/5 flex items-center justify-center text-noble-black/20 group-hover:text-burning-orange group-hover:bg-burning-orange/10 transition-colors"
                      >
                        <Icon name="ph:plus" class="w-5 h-5" />
                      </div>
                      <span
                        class="text-[12px] font-bold text-noble-black/40 group-hover:text-burning-orange/70 transition-colors"
                        >Add image</span
                      >
                    </div>

                    <!-- Selected State (Preview) -->
                    <div v-else class="relative h-full w-full group/preview">
                      <img
                        :src="returnProofPreview"
                        class="h-full w-full object-cover"
                        alt="Return proof"
                      />
                      <div
                        class="absolute inset-0 bg-noble-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <div
                          class="flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 text-noble-black text-[12px] font-bold shadow-lg"
                        >
                          <Icon name="ph:arrows-clockwise" class="w-4 h-4" />
                          Replace Image
                        </div>
                      </div>
                    </div>
                  </label>

                  <!-- Remove Button (Corner) -->
                  <button
                    v-if="returnProofPreview"
                    type="button"
                    class="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white border border-gray-100 shadow-md flex items-center justify-center text-cinnabar-red hover:scale-110 transition-transform z-10"
                    title="Remove Image"
                    @click.prevent="clearReturnProof"
                  >
                    <Icon name="ph:trash" class="w-4 h-4" />
                  </button>
                </div>

                <p
                  v-if="proofUploadErrorMessage"
                  class="mt-6 text-sm text-red-600 font-medium text-center"
                >
                  {{ proofUploadErrorMessage }}
                </p>
              </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-5 border-t border-cinnamon-ice/10 bg-white flex gap-3 shrink-0">
              <button
                type="button"
                class="flex-1 h-12 items-center justify-center rounded-[10px] border-[1.5px] border-burning-orange bg-white text-[15px] font-bold text-burning-orange transition-all duration-200 hover:bg-burning-orange/5"
                @click="isReturnModalOpen = false"
              >
                Cancel
              </button>
              <button
                type="button"
                class="flex-1 h-12 items-center justify-center rounded-[10px] bg-gradient-to-br from-burning-orange to-orange-500 text-[15px] font-bold text-white transition-all duration-300 shadow-lg shadow-burning-orange/35 hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                :disabled="isSubmittingReturn || !returnProofFile"
                @click="confirmReturn"
              >
                <span v-if="isSubmittingReturn" class="flex items-center justify-center gap-2">
                  <Icon name="ph:circle-notch" class="w-4 h-4 animate-spin" />
                  Confirming...
                </span>
                <span v-else>Confirm Return</span>
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </Transition>

    <!-- Early Return Modal -->
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
          v-if="isEarlyReturnModalOpen"
          class="fixed inset-0 z-[1300] flex items-center justify-center p-4 font-geist"
        >
          <div
            class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm"
            @click="isEarlyReturnModalOpen = false"
          ></div>

          <div
            class="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-[20px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.15)] overflow-hidden"
          >
            <!-- Header -->
            <div class="px-6 pt-8 pb-4 flex items-start justify-between gap-4 shrink-0">
              <div>
                <h2 class="text-[24px] font-bold text-noble-black">Confirm Early Return</h2>
                <p class="mt-1 text-[13px] font-medium text-noble-black/40">
                  Submit proof to finalize your early return and refund.
                </p>
              </div>
              <button
                type="button"
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-noble-black transition hover:bg-gray-100"
                @click="isEarlyReturnModalOpen = false"
              >
                <Icon name="ph:x" class="w-5 h-5" />
              </button>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto custom-modal-scrollbar px-6">
              <div class="py-6 space-y-6">
                <div
                  class="w-16 h-16 bg-burning-orange/10 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <Icon name="ph:package" class="w-8 h-8" style="color: #e8650a" />
                </div>

                <!-- Refund breakdown -->
                <div
                  v-if="earlyReturnPreviewData"
                  class="rounded-[16px] border border-cinnamon-ice/30 bg-cream/50 p-5 space-y-3"
                >
                  <p class="text-[11px] font-bold uppercase tracking-[0.1em] text-noble-black/40">
                    Refund Breakdown
                  </p>

                  <div class="space-y-2">
                    <div class="flex justify-between text-[13px]">
                      <span class="text-noble-black/60 font-medium">Usage</span>
                      <span class="font-bold text-noble-black">
                        {{ Math.round(earlyReturnPreviewData.refund.usagePercentage * 100) }}%
                      </span>
                    </div>
                    <div class="flex justify-between text-[13px]">
                      <span class="text-noble-black/60 font-medium">Unused rental value</span>
                      <span class="font-semibold text-noble-black">
                        {{ formatPeso(earlyReturnPreviewData.refund.unusedRentalValue) }}
                      </span>
                    </div>
                    <div class="flex justify-between text-[13px]">
                      <span class="text-noble-black/60 font-medium"
                        >Early return penalty (30%)</span
                      >
                      <span class="font-semibold text-cinnabar-red">
                        -{{ formatPeso(earlyReturnPreviewData.refund.penaltyAmount) }}
                      </span>
                    </div>
                  </div>

                  <div
                    class="border-t border-cinnamon-ice/50 pt-3 flex justify-between items-center"
                  >
                    <span class="text-[14px] font-bold text-noble-black">
                      {{ earlyReturnPreviewData.refund.eligible ? "Refund Amount" : "No Refund" }}
                    </span>
                    <span
                      class="text-[16px] font-bold"
                      :class="
                        earlyReturnPreviewData.refund.eligible
                          ? 'text-success-green'
                          : 'text-noble-black/40'
                      "
                    >
                      {{
                        earlyReturnPreviewData.refund.eligible
                          ? formatPeso(earlyReturnPreviewData.refund.refundAmount)
                          : "₱0"
                      }}
                    </span>
                  </div>
                </div>

                <!-- Unified Dropzone -->
                <div class="relative group">
                  <label
                    class="block w-full aspect-square max-w-[140px] mx-auto rounded-[20px] border-2 border-dashed border-cinnamon-ice bg-cream/50 overflow-hidden cursor-pointer hover:border-burning-orange hover:bg-burning-orange/[0.02] transition-all duration-300"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      class="sr-only"
                      @change="setEarlyReturnProofFile"
                    />

                    <!-- Empty State -->
                    <div
                      v-if="!earlyReturnProofPreview"
                      class="h-full w-full flex flex-col items-center justify-center gap-2 p-4 text-center"
                    >
                      <div
                        class="w-9 h-9 rounded-full bg-noble-black/5 flex items-center justify-center text-noble-black/20 group-hover:text-burning-orange group-hover:bg-burning-orange/10 transition-colors"
                      >
                        <Icon name="ph:plus" class="w-5 h-5" />
                      </div>
                      <span
                        class="text-[12px] font-bold text-noble-black/40 group-hover:text-burning-orange/70 transition-colors"
                        >Add image</span
                      >
                    </div>

                    <!-- Selected State (Preview) -->
                    <div v-else class="relative h-full w-full group/preview">
                      <img
                        :src="earlyReturnProofPreview"
                        class="h-full w-full object-cover"
                        alt="Early return proof"
                      />
                      <div
                        class="absolute inset-0 bg-noble-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <div
                          class="flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 text-noble-black text-[12px] font-bold shadow-lg"
                        >
                          <Icon name="ph:arrows-clockwise" class="w-4 h-4" />
                          Replace Image
                        </div>
                      </div>
                    </div>
                  </label>

                  <!-- Remove Button (Corner) -->
                  <button
                    v-if="earlyReturnProofPreview"
                    type="button"
                    class="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white border border-gray-100 shadow-md flex items-center justify-center text-cinnabar-red hover:scale-110 transition-transform z-10"
                    title="Remove Image"
                    @click.prevent="clearEarlyReturnProof"
                  >
                    <Icon name="ph:trash" class="w-4 h-4" />
                  </button>
                </div>

                <p
                  v-if="proofUploadErrorMessage"
                  class="mt-2 text-sm text-red-600 font-medium text-center"
                >
                  {{ proofUploadErrorMessage }}
                </p>
              </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-5 border-t border-cinnamon-ice/10 bg-white flex gap-3 shrink-0">
              <button
                type="button"
                class="flex-1 h-12 items-center justify-center rounded-[10px] border-[1.5px] border-burning-orange bg-white text-[15px] font-bold text-burning-orange transition-all duration-200 hover:bg-burning-orange/5"
                @click="isEarlyReturnModalOpen = false"
              >
                Cancel
              </button>
              <button
                type="button"
                class="flex-1 h-12 items-center justify-center rounded-[10px] bg-gradient-to-br from-burning-orange to-orange-500 text-[15px] font-bold text-white transition-all duration-300 shadow-lg shadow-burning-orange/35 hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                :disabled="isSubmittingReturn || !earlyReturnProofFile"
                @click="confirmEarlyReturn"
              >
                <span v-if="isSubmittingReturn" class="flex items-center justify-center gap-2">
                  <Icon name="ph:circle-notch" class="w-4 h-4 animate-spin" />
                  Confirming...
                </span>
                <span v-else>Confirm & Refund</span>
              </button>
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
                <Icon name="ph:check" class="w-10 h-10" style="color: #34a853" />
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
                <Icon name="ph:x" class="w-[18px] h-[18px]" />
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

                    <div class="block">
                      <span class="text-[13px] font-semibold text-[#374151]">Evidence Image</span>
                      <p class="mt-1 text-[12px] text-noble-black/40 font-medium italic">
                        Optional. Attach one image as supporting evidence.
                      </p>
                      <label
                        class="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center transition hover:border-burning-orange hover:bg-burning-orange/5"
                      >
                        <input
                          type="file"
                          accept="image/*"
                          class="hidden"
                          @change="setRebuttalImageFile"
                        />
                        <Icon name="ph:image" class="w-5 h-5 text-noble-black/30" />
                        <span
                          v-if="!rebuttalImageFile"
                          class="text-[12px] text-noble-black/40 font-medium"
                        >
                          Click to upload an image
                        </span>
                        <span v-else class="text-[12px] font-semibold text-burning-orange">
                          {{ rebuttalImageFile.name }}
                        </span>
                      </label>
                      <img
                        v-if="rebuttalImagePreview"
                        :src="rebuttalImagePreview"
                        alt="Rebuttal evidence preview"
                        class="mt-3 max-h-40 w-full rounded-[10px] object-cover border border-gray-200"
                      />
                    </div>
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

                  <div v-if="rebuttalImagePreview" class="pt-4 border-t border-gray-100">
                    <p
                      class="text-[11px] font-bold uppercase tracking-wider text-noble-black/40 mb-2"
                    >
                      Evidence Image
                    </p>
                    <img
                      :src="rebuttalImagePreview"
                      alt="Rebuttal evidence"
                      class="max-h-48 w-full rounded-[10px] object-cover border border-gray-200"
                    />
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
                  <Icon name="ph:circle-notch" class="w-4 h-4 animate-spin" />
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

    <!-- Proof Image Modal -->
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
          v-if="proofImageUrl"
          class="fixed inset-0 z-[1400] flex items-center justify-center p-4"
        >
          <div
            class="absolute inset-0 bg-noble-black/70 backdrop-blur-sm"
            @click="proofImageUrl = null"
          />
          <div class="relative max-w-2xl w-full animate-in zoom-in-95 duration-300">
            <button
              class="absolute -top-4 -right-4 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-noble-black/60 hover:text-noble-black transition-colors"
              @click="proofImageUrl = null"
            >
              <Icon name="ph:x" class="w-[18px] h-[18px]" />
            </button>
            <img
              :src="proofImageUrl"
              alt="Proof image"
              class="w-full rounded-[20px] shadow-2xl object-contain max-h-[85vh]"
            />
          </div>
        </div>
      </Teleport>
    </Transition>
  </div>
</template>

<style scoped>
/* Custom Tooltip Styling matching Header.vue */
.custom-tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(10px);
  background-color: theme("colors.cream");
  color: theme("colors.noble-black");
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid theme("colors.cinnamon-ice / 30%");
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease,
    visibility 0.2s;
  z-index: 1200;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.tooltip-arrow {
  position: absolute;
  top: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 5px solid theme("colors.cinnamon-ice / 30%");
}

.tooltip-arrow::after {
  content: "";
  position: absolute;
  top: 1px;
  left: -5px;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 5px solid theme("colors.cream");
}

.group\/tooltip:hover .custom-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(14px);
}

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
