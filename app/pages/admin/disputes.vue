<script setup lang="ts">
import type { inferRouterOutputs } from "@trpc/server"
import type { inferRouterProxyClient } from "@trpc/client"
import type { AppRouter } from "../../../server/trpc/routers"

type TrpcClient = inferRouterProxyClient<AppRouter>

definePageMeta({
  layout: "admin",
  middleware: "admin-auth",
})

type RouterOutputs = inferRouterOutputs<AppRouter>
type AdminDisputeDetail = RouterOutputs["dispute"]["byId"]
type AdminStatusFilter = "OPEN" | "SUBMITTED" | "APPEALED" | "REJECTED" | "CLOSED"
type FinalDecision = NonNullable<AdminDisputeDetail["finalDecision"]>
type ResolutionActionType = AdminDisputeDetail["actions"][number]["type"]

const route = useRoute()
const router = useRouter()

const statusFilters: Array<{ value: AdminStatusFilter; label: string; description: string }> = [
  { value: "SUBMITTED", label: "Submitted", description: "New concerns awaiting intake review" },
  { value: "OPEN", label: "Open", description: "Ready for final resolution" },
  { value: "APPEALED", label: "Appealed", description: "Rejected concerns sent back for review" },
  { value: "REJECTED", label: "Rejected", description: "Concerns not opened as formal disputes" },
  { value: "CLOSED", label: "Closed", description: "Resolved and finalized disputes" },
]

const defaultStatusFilter: AdminStatusFilter = "SUBMITTED"

const activeStatus = computed<AdminStatusFilter>(() => {
  const raw = route.query.status
  return statusFilters.some((filter) => filter.value === raw)
    ? (raw as AdminStatusFilter)
    : defaultStatusFilter
})

const formatDateTime = (date: Date | string | null | undefined) => {
  if (!date) return "Not recorded"

  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

const statusClasses = (status: AdminDisputeDetail["status"]) => {
  switch (status) {
    case "SUBMITTED":
      return "bg-burning-orange/10 text-burning-orange border border-burning-orange/20"
    case "OPEN":
      return "bg-cinnabar-red/10 text-cinnabar-red border border-cinnabar-red/20"
    case "REJECTED":
      return "bg-noble-black/5 text-noble-black/70 border border-cinnamon-ice"
    case "APPEALED":
      return "bg-blue-estate/10 text-blue-estate border border-blue-estate/20"
    case "CLOSED":
      return "bg-green-100 text-green-700 border border-green-200"
  }
}

const finalDecisionLabel = (decision: FinalDecision | null) => {
  if (decision === "APPROVED") return "Dispute approved"
  if (decision === "REJECTED") return "Dispute rejected"
  return "Pending final judgment"
}

const actionLabel = (type: ResolutionActionType) => {
  switch (type) {
    case "WARNING":
      return "Warning"
    case "POINT_DEDUCTION":
      return "Reduce points"
    case "SUSPENSION":
      return "Suspend account"
    case "BAN":
      return "Ban account"
  }
}

const requestFetch = useRequestFetch()

const {
  data: queueData,
  pending,
  refresh,
} = useLazyAsyncData(
  () => `admin:disputes:${activeStatus.value}`,
  () =>
    requestFetch<RouterOutputs["dispute"]["list"]>("/api/disputes", {
      query: { status: activeStatus.value },
    }),
  {
    watch: [activeStatus],
  },
)

const selectedDisputeId = ref<string | null>(
  typeof route.query.dispute === "string" ? route.query.dispute : null,
)
const selectedDispute = ref<AdminDisputeDetail | null>(null)
const detailPending = ref(false)
const actionErrorMessage = ref("")
const actionSuccessMessage = ref("")
const isReviewing = ref(false)
const isResolving = ref(false)
const isClosing = ref(false)
const isActingOnUser = ref(false)
const userActionError = ref("")
const userActionSuccess = ref("")

const showSuspendModal = ref(false)
const suspendTargetId = ref("")
const suspendTargetName = ref("")
const suspendReason = ref("")
const suspendDays = ref(7)

const showBanModal = ref(false)
const banModalTargetId = ref("")
const banTargetName = ref("")
const banReason = ref("")

const openSuspendModal = (userId: string, displayName: string) => {
  suspendTargetId.value = userId
  suspendTargetName.value = displayName
  suspendReason.value = ""
  suspendDays.value = 7
  userActionError.value = ""
  showSuspendModal.value = true
}

const openBanModal = (userId: string, displayName: string) => {
  banModalTargetId.value = userId
  banTargetName.value = displayName
  banReason.value = ""
  userActionError.value = ""
  showBanModal.value = true
}

const { $trpc } = useNuxtApp() as unknown as { $trpc: TrpcClient }

const suspendUser = async () => {
  if (!suspendTargetId.value || !suspendReason.value.trim()) return
  isActingOnUser.value = true
  userActionError.value = ""
  try {
    await $trpc.admin.actions.suspendUser.mutate({
      userId: suspendTargetId.value,
      reason: suspendReason.value.trim(),
      durationDays: suspendDays.value,
    })
    userActionSuccess.value = `${suspendTargetName.value} has been suspended for ${suspendDays.value} day(s).`
    showSuspendModal.value = false
    if (selectedDisputeId.value) await loadDisputeDetail(selectedDisputeId.value)
  } catch (err: unknown) {
    userActionError.value =
      (err as { message?: string })?.message ?? "Unable to suspend user right now."
  } finally {
    isActingOnUser.value = false
  }
}

const banUser = async () => {
  if (!banModalTargetId.value || !banReason.value.trim()) return
  isActingOnUser.value = true
  userActionError.value = ""
  try {
    await $trpc.admin.actions.banUser.mutate({
      userId: banModalTargetId.value,
      reason: banReason.value.trim(),
    })
    userActionSuccess.value = `${banTargetName.value} has been banned.`
    showBanModal.value = false
    if (selectedDisputeId.value) await loadDisputeDetail(selectedDisputeId.value)
  } catch (err: unknown) {
    userActionError.value =
      (err as { message?: string })?.message ?? "Unable to ban user right now."
  } finally {
    isActingOnUser.value = false
  }
}

const queue = computed(() => queueData.value?.disputes ?? [])

const resetResolutionForm = (dispute: AdminDisputeDetail | null) => {
  const defaultTargetId = dispute?.resolutionTargets[0]?.id ?? ""

  resolutionDecision.value = "APPROVED"
  resolutionNotes.value = ""
  noActionSelected.value = true
  warningEnabled.value = false
  warningTargetId.value = defaultTargetId
  warningNote.value = ""
  pointDeductionEnabled.value = false
  pointDeductionTargetId.value = defaultTargetId
  pointDeductionPoints.value = 1
  pointDeductionNote.value = ""
  suspensionEnabled.value = false
  suspensionTargetId.value = defaultTargetId
  suspensionDurationDays.value = 7
  suspensionNote.value = ""
  banEnabled.value = false
  banTargetId.value = defaultTargetId
  banNote.value = ""
}

watch(
  queue,
  (disputes) => {
    if (!disputes.length) {
      selectedDisputeId.value = null
      selectedDispute.value = null
      return
    }

    if (
      !selectedDisputeId.value ||
      !disputes.some((entry) => entry.id === selectedDisputeId.value)
    ) {
      selectedDisputeId.value = disputes[0]?.id ?? null
    }
  },
  { immediate: true },
)

const updateRouteQuery = async (status: AdminStatusFilter, disputeId?: string | null) => {
  await router.replace({
    query: {
      ...route.query,
      status,
      dispute: disputeId ?? undefined,
    },
  })
}

const loadDisputeDetail = async (id: string) => {
  detailPending.value = true

  try {
    selectedDispute.value = await $fetch<AdminDisputeDetail>(`/api/disputes/${id}`)
    resetResolutionForm(selectedDispute.value)
  } finally {
    detailPending.value = false
  }
}

watch(
  selectedDisputeId,
  async (id) => {
    await updateRouteQuery(activeStatus.value, id)

    if (!id) {
      selectedDispute.value = null
      resetResolutionForm(null)
      return
    }

    await loadDisputeDetail(id)
  },
  { immediate: true },
)

watch(activeStatus, async (status) => {
  await updateRouteQuery(status, selectedDisputeId.value)
})

const resolutionDecision = ref<FinalDecision>("APPROVED")
const resolutionNotes = ref("")
const noActionSelected = ref(true)
const warningEnabled = ref(false)
const warningTargetId = ref("")
const warningNote = ref("")
const pointDeductionEnabled = ref(false)
const pointDeductionTargetId = ref("")
const pointDeductionPoints = ref(1)
const pointDeductionNote = ref("")
const suspensionEnabled = ref(false)
const suspensionTargetId = ref("")
const suspensionDurationDays = ref(7)
const suspensionNote = ref("")
const banEnabled = ref(false)
const banTargetId = ref("")
const banNote = ref("")

watch(
  [warningEnabled, pointDeductionEnabled, suspensionEnabled, banEnabled],
  ([warning, points, suspension, ban]) => {
    if (warning || points || suspension || ban) {
      noActionSelected.value = false
    }
  },
)

watch(noActionSelected, (selected) => {
  if (!selected) return

  warningEnabled.value = false
  pointDeductionEnabled.value = false
  suspensionEnabled.value = false
  banEnabled.value = false
})

const actionTargets = computed(() => selectedDispute.value?.resolutionTargets ?? [])

const buildResolutionActions = () => {
  if (noActionSelected.value) {
    return []
  }

  const actions: Array<{
    type: ResolutionActionType
    targetUserId: string
    note?: string
    points?: number
    durationDays?: number
  }> = []

  if (warningEnabled.value && warningTargetId.value) {
    actions.push({
      type: "WARNING",
      targetUserId: warningTargetId.value,
      note: warningNote.value.trim() || undefined,
    })
  }

  if (pointDeductionEnabled.value && pointDeductionTargetId.value) {
    actions.push({
      type: "POINT_DEDUCTION",
      targetUserId: pointDeductionTargetId.value,
      points: pointDeductionPoints.value,
      note: pointDeductionNote.value.trim() || undefined,
    })
  }

  if (suspensionEnabled.value && suspensionTargetId.value) {
    actions.push({
      type: "SUSPENSION",
      targetUserId: suspensionTargetId.value,
      durationDays: suspensionDurationDays.value,
      note: suspensionNote.value.trim() || undefined,
    })
  }

  if (banEnabled.value && banTargetId.value) {
    actions.push({
      type: "BAN",
      targetUserId: banTargetId.value,
      note: banNote.value.trim() || undefined,
    })
  }

  return actions
}

const timelineEntries = computed(() => {
  if (!selectedDispute.value) return []

  return [
    {
      label: "Concern submitted",
      value: formatDateTime(selectedDispute.value.createdAt),
    },
    {
      label: "Formal review opened",
      value:
        selectedDispute.value.status === "OPEN" || selectedDispute.value.status === "CLOSED"
          ? formatDateTime(selectedDispute.value.reviewedAt)
          : "Not opened",
    },
    {
      label: "Rebuttal submitted",
      value: formatDateTime(selectedDispute.value.rebuttalSubmittedAt),
    },
    {
      label: "Final judgment recorded",
      value: formatDateTime(selectedDispute.value.finalDecisionAt),
    },
    {
      label: "Dispute closed",
      value: formatDateTime(selectedDispute.value.closedAt),
    },
  ]
})

const reviewDispute = async (decision: "APPROVE" | "REJECT") => {
  if (!selectedDisputeId.value || !selectedDispute.value?.canReview) return

  isReviewing.value = true
  actionErrorMessage.value = ""
  actionSuccessMessage.value = ""

  try {
    await $fetch(`/api/disputes/${selectedDisputeId.value}/review`, {
      method: "PATCH",
      body: { decision },
    })

    if (decision === "APPROVE") {
      actionSuccessMessage.value = "The concern was approved and moved to the open dispute queue."
      await updateRouteQuery("OPEN", selectedDisputeId.value)
    } else {
      actionSuccessMessage.value = "The concern was rejected at intake review."
      await updateRouteQuery("REJECTED", selectedDisputeId.value)
    }

    await refresh()
    if (selectedDisputeId.value) {
      await loadDisputeDetail(selectedDisputeId.value)
    }
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
      "Unable to review this dispute right now."
  } finally {
    isReviewing.value = false
  }
}

const resolveAndCloseDispute = async () => {
  if (!selectedDisputeId.value || !selectedDispute.value?.canResolve) return

  isResolving.value = true
  actionErrorMessage.value = ""
  actionSuccessMessage.value = ""

  try {
    await $fetch(`/api/disputes/${selectedDisputeId.value}/judgment`, {
      method: "PATCH",
      body: {
        decision: resolutionDecision.value,
        decisionNotes: resolutionNotes.value.trim(),
        actions: buildResolutionActions(),
      },
    })

    await $fetch(`/api/disputes/${selectedDisputeId.value}/close`, {
      method: "POST",
    })

    actionSuccessMessage.value =
      "Final judgment recorded, disciplinary actions applied, notifications sent, and dispute closed."
    await updateRouteQuery("CLOSED", selectedDisputeId.value)
    await refresh()
    if (selectedDisputeId.value) {
      await loadDisputeDetail(selectedDisputeId.value)
    }
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
      "Unable to finalize this dispute right now."
  } finally {
    isResolving.value = false
  }
}

const closeResolvedDispute = async () => {
  if (!selectedDisputeId.value || !selectedDispute.value?.canClose) return

  isClosing.value = true
  actionErrorMessage.value = ""
  actionSuccessMessage.value = ""

  try {
    await $fetch(`/api/disputes/${selectedDisputeId.value}/close`, {
      method: "POST",
    })

    actionSuccessMessage.value = "The dispute was closed successfully."
    await updateRouteQuery("CLOSED", selectedDisputeId.value)
    await refresh()
    if (selectedDisputeId.value) {
      await loadDisputeDetail(selectedDisputeId.value)
    }
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
      "Unable to close this dispute right now."
  } finally {
    isClosing.value = false
  }
}
</script>

<template>
  <div class="font-geist">
    <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <h1 class="text-[28px] font-bold text-gray-900">Dispute Queue</h1>

      <NuxtLink
        to="/account"
        class="inline-flex items-center gap-2 rounded-[8px] border-[1.5px] border-gray-200 px-4 py-2 text-[13px] font-semibold text-gray-700 transition-all hover:bg-gray-50 active:scale-95"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="m12 19-7-7 7-7" />
          <path d="M19 12H5" />
        </svg>
        Back to My Account
      </NuxtLink>
    </div>

    <!-- Status Tabs -->
    <div class="mb-8 border-b border-gray-100">
      <div class="flex gap-8">
        <button
          v-for="filter in statusFilters"
          :key="filter.value"
          type="button"
          class="relative flex items-center gap-2 pb-4 text-[14px] font-medium transition-all"
          :class="
            activeStatus === filter.value ? 'text-orange-600' : 'text-gray-400 hover:text-gray-600'
          "
          @click="updateRouteQuery(filter.value, selectedDisputeId)"
        >
          {{ filter.label }}
          <span
            class="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-100 px-1.5 text-[10px] font-bold text-gray-500 transition-colors"
            :class="{ 'bg-orange-100 text-orange-600': activeStatus === filter.value }"
          >
            {{ filter.value === activeStatus ? queue.length : "0" }}
          </span>
          <span
            v-if="activeStatus === filter.value"
            class="absolute bottom-0 left-0 h-[2px] w-full bg-orange-600"
          />
        </button>
      </div>
    </div>

    <div
      class="grid gap-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm xl:grid-cols-[40%_60%] h-[calc(100vh-220px)]"
    >
      <!-- Left Panel: List -->
      <section class="flex flex-col border-r border-gray-100 bg-white min-h-0">
        <div class="border-b border-gray-100 p-4">
          <h2 class="text-[16px] font-bold text-gray-900">
            {{ queue.length }} {{ queue.length === 1 ? "Dispute" : "Disputes" }}
          </h2>
        </div>

        <div class="flex-1 overflow-y-auto custom-admin-main-scrollbar">
          <div v-if="pending" class="space-y-0">
            <div
              v-for="index in 5"
              :key="index"
              class="h-[72px] animate-pulse border-b border-gray-50 bg-white/50"
            ></div>
          </div>

          <div
            v-else-if="!queue.length"
            class="flex h-full flex-col items-center justify-center p-8 text-center"
          >
            <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#E5E7EB"
                stroke-width="1.5"
              >
                <path d="M22 12h-6l-2 3h-4l-2-3H2" />
                <path
                  d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
                />
              </svg>
            </div>
            <p class="text-[16px] font-semibold text-gray-400">No disputes in this queue</p>
            <p class="mt-1 text-[13px] text-gray-400">
              Change the status filter to inspect a different part of the workflow.
            </p>
          </div>

          <div v-else class="divide-y divide-gray-50">
            <button
              v-for="dispute in queue"
              :key="dispute.id"
              type="button"
              class="flex w-full h-[84px] flex-col justify-center px-5 transition-colors text-left"
              :class="
                selectedDisputeId === dispute.id
                  ? 'bg-orange-50/50 border-l-[3px] border-orange-600'
                  : 'hover:bg-gray-50/50'
              "
              @click="selectedDisputeId = dispute.id"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-[13px] font-semibold text-gray-900">
                  {{ dispute.participants.borrower?.displayName || "Unknown User" }}
                </span>
                <span
                  class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  :class="statusClasses(dispute.status)"
                >
                  {{ dispute.status }}
                </span>
              </div>
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[12px] font-medium text-gray-500 truncate max-w-[180px]">
                  {{ dispute.reason }}
                </span>
                <span class="text-[12px] text-gray-300">•</span>
                <span class="text-[11px] font-mono text-gray-400">{{
                  dispute.transactionReference
                }}</span>
              </div>
              <p class="text-[11px] text-gray-400">
                {{ formatDateTime(dispute.createdAt) }}
              </p>
            </button>
          </div>
        </div>
      </section>
      <!-- Right Panel: Detail -->
      <section class="flex flex-col bg-white min-h-0 overflow-hidden">
        <div class="flex-1 overflow-y-auto custom-admin-main-scrollbar">
          <div v-if="detailPending" class="p-8 space-y-6">
            <div class="h-8 w-1/3 animate-pulse rounded-lg bg-gray-50"></div>
            <div class="h-32 animate-pulse rounded-xl bg-gray-50"></div>
            <div class="grid grid-cols-2 gap-4">
              <div class="h-24 animate-pulse rounded-xl bg-gray-50"></div>
              <div class="h-24 animate-pulse rounded-xl bg-gray-50"></div>
            </div>
          </div>

          <div
            v-else-if="!selectedDispute"
            class="flex h-full flex-col items-center justify-center p-12 text-center"
          >
            <div
              class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50 text-gray-300"
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path d="m3 10 2.5 2.5L3 15" />
                <path d="M13 19h8" />
                <path d="M13 14h8" />
                <path d="M13 9h8" />
                <path d="M13 4h8" />
                <path d="M5 19h2" />
                <path d="M5 4h2" />
                <path d="M3 7h4" />
              </svg>
            </div>
            <p class="text-[18px] font-semibold text-gray-400">Select a dispute to review</p>
            <p class="mt-1 text-[14px] text-gray-400">
              Select a dispute from the list on the left to view full details and take action.
            </p>
          </div>

          <div v-else class="p-8 space-y-8">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p class="text-xs font-bold uppercase tracking-[0.14em] text-noble-black/35">
                  Transaction
                </p>
                <h2 class="mt-1 text-2xl font-bold text-noble-black">
                  {{ selectedDispute.transactionReference }}
                </h2>
                <p class="mt-2 text-sm text-noble-black/60">Dispute ID {{ selectedDispute.id }}</p>
              </div>

              <div class="flex flex-col items-start gap-2 sm:items-end">
                <span
                  class="inline-flex w-fit rounded-full px-4 py-2 text-sm font-bold"
                  :class="statusClasses(selectedDispute.status)"
                >
                  {{ selectedDispute.status }}
                </span>
                <span
                  class="rounded-full bg-noble-black/5 px-3 py-1 text-xs font-semibold text-noble-black/70"
                >
                  {{ finalDecisionLabel(selectedDispute.finalDecision) }}
                </span>
              </div>
            </div>

            <div v-if="userActionSuccess" class="rounded-2xl bg-green-50 border border-green-200 px-4 py-3 text-sm font-medium text-green-700">
              {{ userActionSuccess }}
            </div>

            <div class="grid gap-4 lg:grid-cols-2">
              <div class="rounded-3xl bg-cream p-5">
                <p class="text-xs font-bold uppercase tracking-[0.14em] text-noble-black/35">
                  Borrower
                </p>
                <p class="mt-4 text-lg font-bold text-noble-black">
                  {{ selectedDispute.participants.borrower?.displayName ?? "Former user" }}
                </p>
                <p class="mt-2 text-sm text-noble-black/65">
                  Status: {{ selectedDispute.participants.borrower?.status ?? "Unavailable" }}
                </p>
                <p class="mt-1 text-sm text-noble-black/65">
                  Points: {{ selectedDispute.participants.borrower?.points ?? "Unavailable" }}
                </p>
                <div
                  v-if="selectedDispute.participants.borrower && selectedDispute.participants.borrower.status !== 'BANNED'"
                  class="mt-4 flex gap-2"
                >
                  <button
                    v-if="selectedDispute.participants.borrower.status !== 'SUSPENDED'"
                    type="button"
                    class="rounded-xl bg-burning-orange/10 px-3 py-1.5 text-xs font-bold text-burning-orange hover:bg-burning-orange/20 transition-colors"
                    @click="openSuspendModal(selectedDispute.participants.borrower.id, selectedDispute.participants.borrower.displayName)"
                  >
                    Suspend
                  </button>
                  <button
                    type="button"
                    class="rounded-xl bg-cinnabar-red/10 px-3 py-1.5 text-xs font-bold text-cinnabar-red hover:bg-cinnabar-red/20 transition-colors"
                    @click="openBanModal(selectedDispute.participants.borrower.id, selectedDispute.participants.borrower.displayName)"
                  >
                    Ban
                  </button>
                </div>
              </div>

              <div class="rounded-3xl bg-cream p-5">
                <p class="text-xs font-bold uppercase tracking-[0.14em] text-noble-black/35">
                  Lender
                </p>
                <p class="mt-4 text-lg font-bold text-noble-black">
                  {{ selectedDispute.participants.lender?.displayName ?? "Former user" }}
                </p>
                <p class="mt-2 text-sm text-noble-black/65">
                  Status: {{ selectedDispute.participants.lender?.status ?? "Unavailable" }}
                </p>
                <p class="mt-1 text-sm text-noble-black/65">
                  Points: {{ selectedDispute.participants.lender?.points ?? "Unavailable" }}
                </p>
                <div
                  v-if="selectedDispute.participants.lender && selectedDispute.participants.lender.status !== 'BANNED'"
                  class="mt-4 flex gap-2"
                >
                  <button
                    v-if="selectedDispute.participants.lender.status !== 'SUSPENDED'"
                    type="button"
                    class="rounded-xl bg-burning-orange/10 px-3 py-1.5 text-xs font-bold text-burning-orange hover:bg-burning-orange/20 transition-colors"
                    @click="openSuspendModal(selectedDispute.participants.lender.id, selectedDispute.participants.lender.displayName)"
                  >
                    Suspend
                  </button>
                  <button
                    type="button"
                    class="rounded-xl bg-cinnabar-red/10 px-3 py-1.5 text-xs font-bold text-cinnabar-red hover:bg-cinnabar-red/20 transition-colors"
                    @click="openBanModal(selectedDispute.participants.lender.id, selectedDispute.participants.lender.displayName)"
                  >
                    Ban
                  </button>
                </div>
              </div>
            </div>

            <div class="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div class="rounded-3xl border border-cinnamon-ice bg-cream/50 p-5">
                <p class="text-xs font-bold uppercase tracking-[0.14em] text-noble-black/35">
                  Original concern
                </p>
                <p class="mt-4 text-lg font-bold text-noble-black">{{ selectedDispute.reason }}</p>
                <p class="mt-2 text-sm text-noble-black/65">
                  Raised by {{ selectedDispute.raisedBy?.displayName ?? "Former user" }}
                </p>
                <p class="mt-4 whitespace-pre-line text-sm leading-relaxed text-noble-black/75">
                  {{ selectedDispute.description || "No additional description was provided." }}
                </p>
              </div>

              <div class="rounded-3xl border border-cinnamon-ice bg-cream/50 p-5">
                <p class="text-xs font-bold uppercase tracking-[0.14em] text-noble-black/35">
                  Timeline
                </p>
                <div class="mt-4 space-y-3">
                  <div v-for="entry in timelineEntries" :key="entry.label">
                    <p class="text-sm font-semibold text-noble-black">{{ entry.label }}</p>
                    <p class="mt-1 text-sm text-noble-black/60">{{ entry.value }}</p>
                  </div>
                </div>
              </div>
            </div>

            <div
              v-if="selectedDispute.item?.thumbnailImage"
              class="rounded-3xl border border-cinnamon-ice bg-cream/50 p-5"
            >
              <p class="text-xs font-bold uppercase tracking-[0.14em] text-noble-black/35">
                Item
              </p>
              <p class="mt-3 text-sm font-semibold text-noble-black">{{ selectedDispute.item.name }}</p>
              <img
                :src="selectedDispute.item.thumbnailImage"
                :alt="selectedDispute.item.name"
                class="mt-3 max-h-48 w-full rounded-2xl object-cover border border-cinnamon-ice"
              />
            </div>

            <div
              v-if="selectedDispute.hasRebuttal"
              class="rounded-3xl border border-blue-estate/15 bg-blue-estate/5 p-5"
            >
              <p class="text-xs font-bold uppercase tracking-[0.14em] text-blue-estate/70">
                Counterparty rebuttal
              </p>
              <p class="mt-3 text-sm font-semibold text-noble-black">
                {{ selectedDispute.rebuttalBy?.displayName ?? "Transaction participant" }}
              </p>
              <p class="mt-1 text-sm text-noble-black/60">
                Submitted {{ formatDateTime(selectedDispute.rebuttalSubmittedAt) }}
              </p>
              <p class="mt-4 whitespace-pre-line text-sm leading-relaxed text-noble-black/80">
                {{ selectedDispute.rebuttalText }}
              </p>
              <p
                v-if="selectedDispute.rebuttalNotes"
                class="mt-3 whitespace-pre-line text-sm leading-relaxed text-noble-black/65"
              >
                Additional notes: {{ selectedDispute.rebuttalNotes }}
              </p>
              <div v-if="selectedDispute.rebuttalImageUrl" class="mt-4">
                <p class="text-xs font-bold uppercase tracking-[0.14em] text-blue-estate/70 mb-2">
                  Evidence Image
                </p>
                <img
                  :src="selectedDispute.rebuttalImageUrl"
                  alt="Rebuttal evidence"
                  class="max-h-64 w-full rounded-2xl object-cover border border-blue-estate/20 cursor-pointer"
                  @click="navigateTo(selectedDispute.rebuttalImageUrl!, { open: { target: '_blank' } })"
                />
              </div>
              <div v-if="(selectedDispute as any).rebuttalImageUrl" class="mt-4">
                <p class="text-xs font-bold uppercase tracking-[0.14em] text-blue-estate/70 mb-2">Evidence Image</p>
                <img
                  :src="(selectedDispute as any).rebuttalImageUrl"
                  alt="Rebuttal evidence"
                  class="max-h-64 w-full rounded-2xl object-cover border border-blue-estate/20 cursor-pointer"
                  @click="(selectedDispute as any).rebuttalImageUrl && navigateTo((selectedDispute as any).rebuttalImageUrl, { open: { target: '_blank' } })"
                />
              </div>
            </div>

            <div
              v-if="selectedDispute.finalDecision"
              class="rounded-3xl border border-green-200 bg-green-50/70 p-5"
            >
              <p class="text-xs font-bold uppercase tracking-[0.14em] text-green-700">
                Final judgment
              </p>
              <p class="mt-3 text-lg font-bold text-noble-black">
                {{ finalDecisionLabel(selectedDispute.finalDecision) }}
              </p>
              <p class="mt-1 text-sm text-noble-black/60">
                Recorded {{ formatDateTime(selectedDispute.finalDecisionAt) }}
              </p>
              <p class="mt-4 whitespace-pre-line text-sm leading-relaxed text-noble-black/75">
                {{ selectedDispute.finalDecisionNotes || "No decision notes were recorded." }}
              </p>
            </div>

            <div
              v-if="selectedDispute.actions.length"
              class="rounded-3xl border border-cinnamon-ice bg-cream/50 p-5"
            >
              <p class="text-xs font-bold uppercase tracking-[0.14em] text-noble-black/35">
                Applied actions
              </p>
              <div class="mt-4 space-y-3">
                <div
                  v-for="action in selectedDispute.actions"
                  :key="action.id"
                  class="rounded-2xl bg-white px-4 py-3"
                >
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p class="text-sm font-bold text-noble-black">
                        {{ actionLabel(action.type) }}
                      </p>
                      <p class="mt-1 text-sm text-noble-black/60">
                        Target: {{ action.targetUser?.displayName ?? "Unavailable" }}
                      </p>
                      <p v-if="action.pointsDelta" class="mt-1 text-sm text-noble-black/60">
                        Points delta: {{ action.pointsDelta }}
                      </p>
                      <p v-if="action.note" class="mt-1 text-sm text-noble-black/60">
                        {{ action.note }}
                      </p>
                    </div>
                    <p class="text-xs text-noble-black/45">
                      Applied {{ formatDateTime(action.appliedAt) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div
              v-if="selectedDispute.canReview"
              class="rounded-3xl border border-cinnamon-ice bg-white p-5"
            >
              <p class="text-xs font-bold uppercase tracking-[0.14em] text-noble-black/35">
                Intake Review
              </p>
              <h3 class="mt-3 text-xl font-bold text-noble-black">Approve or reject the concern</h3>
              <p class="mt-2 text-sm text-noble-black/60">
                Approving moves this case into the formal dispute stage. Rejecting keeps it out of
                the formal dispute workflow.
              </p>

              <div class="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  :disabled="isReviewing"
                  class="flex-1 rounded-2xl bg-cinnabar-red px-6 py-4 font-bold text-white transition-colors hover:bg-cinnabar-red/90 disabled:opacity-50"
                  @click="reviewDispute('APPROVE')"
                >
                  {{ isReviewing ? "Processing..." : "Approve & Open Dispute" }}
                </button>
                <button
                  :disabled="isReviewing"
                  class="flex-1 rounded-2xl border border-cinnamon-ice bg-cream px-6 py-4 font-bold text-noble-black transition-colors hover:bg-pale-cashmere disabled:opacity-50"
                  @click="reviewDispute('REJECT')"
                >
                  Reject Concern
                </button>
              </div>
            </div>

            <div
              v-if="selectedDispute.canResolve"
              class="rounded-3xl border border-cinnamon-ice bg-white p-5"
            >
              <p class="text-xs font-bold uppercase tracking-[0.14em] text-noble-black/35">
                Final Resolution
              </p>
              <h3 class="mt-3 text-xl font-bold text-noble-black">Issue final judgment</h3>
              <p class="mt-2 text-sm text-noble-black/60">
                The case will only close after the final judgment is saved and every selected action
                is applied successfully.
              </p>

              <div class="mt-6 grid gap-4 lg:grid-cols-2">
                <button
                  type="button"
                  class="rounded-3xl border px-5 py-4 text-left transition-colors"
                  :class="
                    resolutionDecision === 'APPROVED'
                      ? 'border-green-200 bg-green-50'
                      : 'border-cinnamon-ice bg-cream/50'
                  "
                  @click="resolutionDecision = 'APPROVED'"
                >
                  <p class="text-sm font-bold text-noble-black">Approve dispute</p>
                  <p class="mt-2 text-sm text-noble-black/60">
                    The concern is upheld and any selected sanctions will be enforced.
                  </p>
                </button>

                <button
                  type="button"
                  class="rounded-3xl border px-5 py-4 text-left transition-colors"
                  :class="
                    resolutionDecision === 'REJECTED'
                      ? 'border-cinnamon-ice bg-noble-black/5'
                      : 'border-cinnamon-ice bg-cream/50'
                  "
                  @click="resolutionDecision = 'REJECTED'"
                >
                  <p class="text-sm font-bold text-noble-black">Reject dispute</p>
                  <p class="mt-2 text-sm text-noble-black/60">
                    The concern is denied, but you may still apply a policy action if warranted.
                  </p>
                </button>
              </div>

              <label class="mt-6 block">
                <span class="text-sm font-bold text-noble-black">Judgment notes</span>
                <textarea
                  v-model="resolutionNotes"
                  rows="5"
                  maxlength="2000"
                  placeholder="Summarize the final reasoning that both parties should see."
                  class="mt-2 w-full rounded-2xl border border-cinnamon-ice bg-cream px-4 py-3 text-sm text-noble-black outline-none transition-colors focus:border-burning-orange"
                ></textarea>
              </label>

              <div class="mt-6 rounded-3xl bg-cream/70 p-5">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <p class="text-sm font-bold text-noble-black">Disciplinary actions</p>
                    <p class="mt-1 text-sm text-noble-black/60">
                      Leave the case on “No disciplinary action” if closure should happen without a
                      sanction.
                    </p>
                  </div>

                  <label
                    class="inline-flex items-center gap-2 text-sm font-semibold text-noble-black"
                  >
                    <input
                      v-model="noActionSelected"
                      type="checkbox"
                      class="h-4 w-4 rounded border-cinnamon-ice text-burning-orange focus:ring-burning-orange"
                    />
                    No disciplinary action
                  </label>
                </div>

                <div class="mt-5 grid gap-4 xl:grid-cols-2">
                  <div class="rounded-2xl bg-white p-4">
                    <label class="flex items-center justify-between gap-3">
                      <span class="text-sm font-bold text-noble-black">Warning</span>
                      <input
                        v-model="warningEnabled"
                        type="checkbox"
                        :disabled="noActionSelected"
                        class="h-4 w-4 rounded border-cinnamon-ice text-burning-orange focus:ring-burning-orange disabled:opacity-40"
                      />
                    </label>
                    <div
                      class="mt-4 space-y-3"
                      :class="{ 'opacity-40': !warningEnabled || noActionSelected }"
                    >
                      <select
                        v-model="warningTargetId"
                        :disabled="!warningEnabled || noActionSelected"
                        class="w-full rounded-2xl border border-cinnamon-ice bg-cream px-4 py-3 text-sm text-noble-black outline-none"
                      >
                        <option v-for="target in actionTargets" :key="target.id" :value="target.id">
                          {{ target.displayName }} • {{ target.status }} • {{ target.points }} pts
                        </option>
                      </select>
                      <input
                        v-model="warningNote"
                        :disabled="!warningEnabled || noActionSelected"
                        type="text"
                        maxlength="500"
                        placeholder="Optional warning note"
                        class="w-full rounded-2xl border border-cinnamon-ice bg-cream px-4 py-3 text-sm text-noble-black outline-none"
                      />
                    </div>
                  </div>

                  <div class="rounded-2xl bg-white p-4">
                    <label class="flex items-center justify-between gap-3">
                      <span class="text-sm font-bold text-noble-black">Reduce points</span>
                      <input
                        v-model="pointDeductionEnabled"
                        type="checkbox"
                        :disabled="noActionSelected"
                        class="h-4 w-4 rounded border-cinnamon-ice text-burning-orange focus:ring-burning-orange disabled:opacity-40"
                      />
                    </label>
                    <div
                      class="mt-4 space-y-3"
                      :class="{ 'opacity-40': !pointDeductionEnabled || noActionSelected }"
                    >
                      <select
                        v-model="pointDeductionTargetId"
                        :disabled="!pointDeductionEnabled || noActionSelected"
                        class="w-full rounded-2xl border border-cinnamon-ice bg-cream px-4 py-3 text-sm text-noble-black outline-none"
                      >
                        <option v-for="target in actionTargets" :key="target.id" :value="target.id">
                          {{ target.displayName }} • {{ target.status }} • {{ target.points }} pts
                        </option>
                      </select>
                      <input
                        v-model.number="pointDeductionPoints"
                        :disabled="!pointDeductionEnabled || noActionSelected"
                        type="number"
                        min="1"
                        max="10000"
                        class="w-full rounded-2xl border border-cinnamon-ice bg-cream px-4 py-3 text-sm text-noble-black outline-none"
                      />
                      <input
                        v-model="pointDeductionNote"
                        :disabled="!pointDeductionEnabled || noActionSelected"
                        type="text"
                        maxlength="500"
                        placeholder="Optional points note"
                        class="w-full rounded-2xl border border-cinnamon-ice bg-cream px-4 py-3 text-sm text-noble-black outline-none"
                      />
                    </div>
                  </div>

                  <div class="rounded-2xl bg-white p-4">
                    <label class="flex items-center justify-between gap-3">
                      <span class="text-sm font-bold text-noble-black">Suspend account</span>
                      <input
                        v-model="suspensionEnabled"
                        type="checkbox"
                        :disabled="noActionSelected"
                        class="h-4 w-4 rounded border-cinnamon-ice text-burning-orange focus:ring-burning-orange disabled:opacity-40"
                      />
                    </label>
                    <div
                      class="mt-4 space-y-3"
                      :class="{ 'opacity-40': !suspensionEnabled || noActionSelected }"
                    >
                      <select
                        v-model="suspensionTargetId"
                        :disabled="!suspensionEnabled || noActionSelected"
                        class="w-full rounded-2xl border border-cinnamon-ice bg-cream px-4 py-3 text-sm text-noble-black outline-none"
                      >
                        <option v-for="target in actionTargets" :key="target.id" :value="target.id">
                          {{ target.displayName }} • {{ target.status }} • {{ target.points }} pts
                        </option>
                      </select>
                      <input
                        v-model.number="suspensionDurationDays"
                        :disabled="!suspensionEnabled || noActionSelected"
                        type="number"
                        min="1"
                        max="365"
                        placeholder="Duration in days"
                        class="w-full rounded-2xl border border-cinnamon-ice bg-cream px-4 py-3 text-sm text-noble-black outline-none"
                      />
                      <input
                        v-model="suspensionNote"
                        :disabled="!suspensionEnabled || noActionSelected"
                        type="text"
                        maxlength="500"
                        placeholder="Optional suspension note"
                        class="w-full rounded-2xl border border-cinnamon-ice bg-cream px-4 py-3 text-sm text-noble-black outline-none"
                      />
                    </div>
                  </div>

                  <div class="rounded-2xl bg-white p-4">
                    <label class="flex items-center justify-between gap-3">
                      <span class="text-sm font-bold text-noble-black">Ban account</span>
                      <input
                        v-model="banEnabled"
                        type="checkbox"
                        :disabled="noActionSelected"
                        class="h-4 w-4 rounded border-cinnamon-ice text-burning-orange focus:ring-burning-orange disabled:opacity-40"
                      />
                    </label>
                    <div
                      class="mt-4 space-y-3"
                      :class="{ 'opacity-40': !banEnabled || noActionSelected }"
                    >
                      <select
                        v-model="banTargetId"
                        :disabled="!banEnabled || noActionSelected"
                        class="w-full rounded-2xl border border-cinnamon-ice bg-cream px-4 py-3 text-sm text-noble-black outline-none"
                      >
                        <option v-for="target in actionTargets" :key="target.id" :value="target.id">
                          {{ target.displayName }} • {{ target.status }} • {{ target.points }} pts
                        </option>
                      </select>
                      <input
                        v-model="banNote"
                        :disabled="!banEnabled || noActionSelected"
                        type="text"
                        maxlength="500"
                        placeholder="Optional ban note"
                        class="w-full rounded-2xl border border-cinnamon-ice bg-cream px-4 py-3 text-sm text-noble-black outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div class="mt-6 flex justify-end">
                <button
                  :disabled="isResolving || !resolutionNotes.trim()"
                  class="rounded-2xl bg-cinnabar-red px-8 py-4 font-bold text-white transition-colors hover:bg-cinnabar-red/90 disabled:opacity-50"
                  @click="resolveAndCloseDispute"
                >
                  {{
                    isResolving ? "Finalizing..." : "Issue Final Judgment, Apply Actions, and Close"
                  }}
                </button>
              </div>
            </div>

            <div
              v-else-if="selectedDispute.canClose"
              class="rounded-3xl border border-cinnamon-ice bg-white p-5"
            >
              <p class="text-xs font-bold uppercase tracking-[0.14em] text-noble-black/35">
                Pending Closure
              </p>
              <h3 class="mt-3 text-xl font-bold text-noble-black">Ready to close dispute</h3>
              <p class="mt-2 text-sm text-noble-black/60">
                Final judgment and action records already exist. Closing will finalize the case and
                notify both parties.
              </p>

              <div class="mt-5 flex justify-end">
                <button
                  :disabled="isClosing"
                  class="rounded-2xl bg-blue-estate px-8 py-4 font-bold text-white transition-colors hover:bg-indigo-900 disabled:opacity-50"
                  @click="closeResolvedDispute"
                >
                  {{ isClosing ? "Closing..." : "Close Dispute" }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>

  <!-- Suspend User Modal -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="showSuspendModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm" @click="showSuspendModal = false" />
        <div class="relative w-full max-w-md rounded-[20px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.18)] p-8">
          <h3 class="text-[20px] font-bold text-noble-black">Suspend Account</h3>
          <p class="mt-1 text-sm text-noble-black/55">Suspending <span class="font-semibold">{{ suspendTargetName }}</span></p>

          <div class="mt-6 space-y-4">
            <label class="block">
              <span class="text-sm font-bold text-noble-black">Duration (days)</span>
              <input
                v-model.number="suspendDays"
                type="number"
                min="1"
                max="365"
                class="mt-2 w-full rounded-2xl border border-cinnamon-ice bg-cream px-4 py-3 text-sm text-noble-black outline-none focus:border-burning-orange"
              />
            </label>
            <label class="block">
              <span class="text-sm font-bold text-noble-black">Reason <span class="text-cinnabar-red">*</span></span>
              <textarea
                v-model="suspendReason"
                rows="3"
                maxlength="500"
                placeholder="State the reason for suspension."
                class="mt-2 w-full rounded-2xl border border-cinnamon-ice bg-cream px-4 py-3 text-sm text-noble-black outline-none focus:border-burning-orange"
              ></textarea>
            </label>
            <p v-if="userActionError" class="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-600">
              {{ userActionError }}
            </p>
          </div>

          <div class="mt-6 flex gap-3">
            <button
              type="button"
              class="flex-1 rounded-2xl border border-cinnamon-ice bg-cream px-5 py-3 font-bold text-noble-black hover:bg-pale-cashmere transition-colors"
              @click="showSuspendModal = false"
            >
              Cancel
            </button>
            <button
              :disabled="isActingOnUser || !suspendReason.trim()"
              class="flex-1 rounded-2xl bg-burning-orange px-5 py-3 font-bold text-white hover:bg-burning-orange/90 transition-colors disabled:opacity-50"
              @click="suspendUser"
            >
              {{ isActingOnUser ? "Suspending..." : "Confirm Suspension" }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Ban User Modal -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="showBanModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm" @click="showBanModal = false" />
        <div class="relative w-full max-w-md rounded-[20px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.18)] p-8">
          <h3 class="text-[20px] font-bold text-noble-black">Ban Account</h3>
          <p class="mt-1 text-sm text-noble-black/55">Banning <span class="font-semibold">{{ banTargetName }}</span>. This prevents them from accessing the system.</p>

          <div class="mt-6 space-y-4">
            <label class="block">
              <span class="text-sm font-bold text-noble-black">Reason <span class="text-cinnabar-red">*</span></span>
              <textarea
                v-model="banReason"
                rows="3"
                maxlength="500"
                placeholder="State the reason for the ban."
                class="mt-2 w-full rounded-2xl border border-cinnamon-ice bg-cream px-4 py-3 text-sm text-noble-black outline-none focus:border-burning-orange"
              ></textarea>
            </label>
            <p v-if="userActionError" class="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-600">
              {{ userActionError }}
            </p>
          </div>

          <div class="mt-6 flex gap-3">
            <button
              type="button"
              class="flex-1 rounded-2xl border border-cinnamon-ice bg-cream px-5 py-3 font-bold text-noble-black hover:bg-pale-cashmere transition-colors"
              @click="showBanModal = false"
            >
              Cancel
            </button>
            <button
              :disabled="isActingOnUser || !banReason.trim()"
              class="flex-1 rounded-2xl bg-cinnabar-red px-5 py-3 font-bold text-white hover:bg-cinnabar-red/90 transition-colors disabled:opacity-50"
              @click="banUser"
            >
              {{ isActingOnUser ? "Banning..." : "Confirm Ban" }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
