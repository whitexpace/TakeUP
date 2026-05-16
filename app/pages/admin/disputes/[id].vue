<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import { useRoute } from "vue-router"
import type { inferRouterOutputs } from "@trpc/server"
import type { inferRouterProxyClient } from "@trpc/client"
import type { AppRouter } from "../../../../server/trpc/routers"

type TrpcClient = inferRouterProxyClient<AppRouter>

definePageMeta({
  layout: "admin",
  middleware: "admin-auth",
})

type RouterOutputs = inferRouterOutputs<AppRouter>
type AdminDisputeDetail = RouterOutputs["dispute"]["byId"]
type FinalDecision = NonNullable<AdminDisputeDetail["finalDecision"]>
type ResolutionActionType = AdminDisputeDetail["actions"][number]["type"]

const route = useRoute()
const nuxtApp = useNuxtApp()
const { $trpc } = nuxtApp as unknown as { $trpc: TrpcClient }

const disputeId = route.params.id as string
const selectedDispute = ref<AdminDisputeDetail | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

const isResolving = ref(false)
const isActingOnUser = ref(false)

// Modal States
const showSuspendModal = ref(false)
const suspendTargetId = ref("")
const suspendTargetName = ref("")
const suspendReason = ref("")
const suspendDays = ref(7)

const showBanModal = ref(false)
const banModalTargetId = ref("")
const banTargetName = ref("")
const banReason = ref("")

// Resolution Form
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

const statusClasses = (status: string) => {
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
    default:
      return "bg-gray-100 text-gray-600"
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
    default:
      return type
  }
}

const loadDispute = async () => {
  isLoading.value = true
  error.value = null
  try {
    selectedDispute.value = await $fetch<AdminDisputeDetail>(`/api/disputes/${disputeId}`)
    resetResolutionForm()
  } catch (err: unknown) {
    const errorWithStatus = err as { statusMessage?: string }
    error.value = errorWithStatus.statusMessage || "Unable to load dispute details."
  } finally {
    isLoading.value = false
  }
}

const resetResolutionForm = () => {
  const dispute = selectedDispute.value
  if (!dispute) return

  const defaultTargetId = dispute.resolutionTargets[0]?.id ?? ""
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

const timelineEntries = computed(() => {
  if (!selectedDispute.value) return []
  return [
    { label: "Concern submitted", value: formatDateTime(selectedDispute.value.createdAt) },
    {
      label: "Formal review opened",
      value: selectedDispute.value.reviewedAt
        ? formatDateTime(selectedDispute.value.reviewedAt)
        : "Not opened",
    },
    {
      label: "Rebuttal submitted",
      value: selectedDispute.value.rebuttalSubmittedAt
        ? formatDateTime(selectedDispute.value.rebuttalSubmittedAt)
        : "Not submitted",
    },
    {
      label: "Final judgment recorded",
      value: selectedDispute.value.finalDecisionAt
        ? formatDateTime(selectedDispute.value.finalDecisionAt)
        : "Pending",
    },
    {
      label: "Dispute closed",
      value: selectedDispute.value.closedAt
        ? formatDateTime(selectedDispute.value.closedAt)
        : "Active",
    },
  ]
})

const actionTargets = computed(() => selectedDispute.value?.resolutionTargets ?? [])

// Actions
const buildResolutionActions = () => {
  if (noActionSelected.value) return []
  const actions = []
  if (warningEnabled.value && warningTargetId.value)
    actions.push({ type: "WARNING", targetUserId: warningTargetId.value, note: warningNote.value })
  if (pointDeductionEnabled.value && pointDeductionTargetId.value)
    actions.push({
      type: "POINT_DEDUCTION",
      targetUserId: pointDeductionTargetId.value,
      points: pointDeductionPoints.value,
      note: pointDeductionNote.value,
    })
  if (suspensionEnabled.value && suspensionTargetId.value)
    actions.push({
      type: "SUSPENSION",
      targetUserId: suspensionTargetId.value,
      durationDays: suspensionDurationDays.value,
      note: suspensionNote.value,
    })
  if (banEnabled.value && banTargetId.value)
    actions.push({ type: "BAN", targetUserId: banTargetId.value, note: banNote.value })
  return actions
}

const resolveAndCloseDispute = async () => {
  isResolving.value = true
  try {
    await $fetch(`/api/disputes/${disputeId}/judgment`, {
      method: "PATCH",
      body: {
        decision: resolutionDecision.value,
        decisionNotes: resolutionNotes.value,
        actions: buildResolutionActions(),
      },
    })
    await $fetch(`/api/disputes/${disputeId}/close`, { method: "POST" })
    await loadDispute()
  } finally {
    isResolving.value = false
  }
}

const openSuspendModal = (id: string, name: string) => {
  suspendTargetId.value = id
  suspendTargetName.value = name
  showSuspendModal.value = true
}

const openBanModal = (id: string, name: string) => {
  banModalTargetId.value = id
  banTargetName.value = name
  showBanModal.value = true
}

const suspendUser = async () => {
  isActingOnUser.value = true
  try {
    await $trpc.admin.actions.suspendUser.mutate({
      userId: suspendTargetId.value,
      reason: suspendReason.value,
      durationDays: suspendDays.value,
    })
    showSuspendModal.value = false
    await loadDispute()
  } finally {
    isActingOnUser.value = false
  }
}

const banUser = async () => {
  isActingOnUser.value = true
  try {
    await $trpc.admin.actions.banUser.mutate({
      userId: banModalTargetId.value,
      reason: banReason.value,
    })
    showBanModal.value = false
    await loadDispute()
  } finally {
    isActingOnUser.value = false
  }
}

onMounted(loadDispute)
</script>

<template>
  <div class="font-geist space-y-8 pb-20">
    <!-- Header -->
    <header class="flex flex-col mb-8">
      <NuxtLink
        to="/admin/disputes"
        class="flex items-center text-noble-black/40 hover:text-noble-black transition-colors mb-6 -ml-1 w-fit"
      >
        <Icon name="ph:caret-left-bold" class="w-6 h-6" />
      </NuxtLink>

      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div class="space-y-1">
          <div class="flex items-center gap-3">
            <h1 class="font-montravia text-[36px] font-medium text-noble-black">Dispute Details</h1>
          </div>
          <div class="w-10 h-0.5 bg-burning-orange mb-2"></div>
          <p
            v-if="selectedDispute"
            class="text-[13px] font-semibold text-noble-black/50 tracking-widest uppercase font-mono"
          >
            REF: {{ selectedDispute.transactionReference }}
          </p>
        </div>

        <div v-if="selectedDispute" class="flex items-center gap-3">
          <span
            class="rounded-full px-4 py-1.5 text-[12px] font-bold tracking-wider uppercase shadow-sm"
            :class="statusClasses(selectedDispute.status)"
          >
            {{ selectedDispute.status }}
          </span>
        </div>
      </div>
    </header>

    <div v-if="isLoading" class="space-y-10 w-full py-10 animate-pulse">
      <!-- Dossier Grid Skeleton -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div
          v-for="i in 2"
          :key="i"
          class="bg-white rounded-[24px] border border-cinnamon-ice/20 p-8 shadow-sm"
        >
          <div class="flex items-center justify-between mb-8 pb-4 border-b border-gray-50">
            <div class="h-6 w-32 bg-noble-black/20 rounded"></div>
            <div class="h-5 w-16 bg-noble-black/10 rounded-full"></div>
          </div>
          <div class="flex items-center gap-6 mb-8">
            <div class="w-16 h-16 rounded-full bg-noble-black/10"></div>
            <div class="space-y-2">
              <div class="h-6 w-40 bg-noble-black/20 rounded"></div>
              <div class="h-4 w-24 bg-noble-black/10 rounded"></div>
            </div>
          </div>
          <div class="h-24 bg-gray-50/50 rounded-2xl border border-gray-50 mb-8"></div>
          <div class="flex gap-3">
            <div class="h-10 flex-1 bg-noble-black/5 rounded-xl"></div>
            <div class="h-10 flex-1 bg-noble-black/10 rounded-xl"></div>
          </div>
        </div>
      </div>

      <!-- Content Grid Skeleton -->
      <div class="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
        <div class="bg-white rounded-[24px] border border-cinnamon-ice/20 p-8 shadow-sm h-96">
          <div class="h-6 w-48 bg-noble-black/20 rounded mb-6"></div>
          <div class="h-12 w-3/4 bg-noble-black/10 rounded mb-8"></div>
          <div class="h-40 bg-gray-50/50 rounded-2xl border border-gray-50"></div>
        </div>
        <div class="space-y-8">
          <div
            class="bg-white rounded-[24px] border border-cinnamon-ice/20 p-8 shadow-sm h-64"
          ></div>
          <div
            class="bg-white rounded-[24px] border border-cinnamon-ice/20 p-8 shadow-sm h-48"
          ></div>
        </div>
      </div>
    </div>

    <div v-else-if="selectedDispute" class="w-full space-y-8">
      <!-- Section 1: Parties Overview -->
      <div class="grid gap-8 lg:grid-cols-2">
        <!-- Borrower Dossier -->
        <div
          class="bg-white rounded-[24px] border border-cinnamon-ice/20 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-8"
        >
          <div class="flex items-center justify-between mb-8 pb-4 border-b border-gray-50">
            <div class="border-l-[3px] border-burning-orange pl-4">
              <h2 class="text-[20px] font-semibold text-noble-black">Borrower</h2>
            </div>
            <span
              class="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-gray-50 text-noble-black/40 border border-gray-100"
            >
              {{ selectedDispute.participants.borrower?.status ?? "Inactive" }}
            </span>
          </div>

          <div class="flex items-center gap-6 mb-8">
            <div
              class="w-16 h-16 rounded-full border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 shadow-sm"
            >
              <UserAvatar
                :user-name="selectedDispute.participants.borrower?.displayName ?? 'Borrower'"
                :avatar-url="selectedDispute.participants.borrower?.avatarUrl"
                size="lg"
                class="!rounded-none"
              />
            </div>
            <div class="min-w-0">
              <h3 class="text-[20px] font-semibold text-noble-black truncate">
                {{ selectedDispute.participants.borrower?.displayName ?? "Deleted User" }}
              </h3>
              <p class="text-[14px] font-medium text-noble-black/40">
                @{{ selectedDispute.participants.borrower?.username ?? "anonymous" }}
              </p>
            </div>
          </div>

          <div
            class="grid grid-cols-2 gap-6 p-6 rounded-2xl bg-gray-50/50 border border-gray-50 mb-8"
          >
            <div>
              <p class="text-[11px] font-bold uppercase tracking-widest text-noble-black/40 mb-1">
                Trust Score
              </p>
              <div class="flex items-center gap-2">
                <span class="text-[24px] font-semibold text-noble-black">{{
                  selectedDispute.participants.borrower?.points ?? 0
                }}</span>
                <Icon name="ph:shield-check-fill" class="w-5 h-5 text-burning-orange" />
              </div>
            </div>
            <div class="border-l border-gray-100 pl-6">
              <p class="text-[11px] font-bold uppercase tracking-widest text-noble-black/40 mb-1">
                Platform Rating
              </p>
              <p class="text-[18px] font-medium text-noble-black/80">
                0.0
                <span class="text-burning-orange text-[14px]">★</span>
              </p>
            </div>
          </div>

          <div
            v-if="
              selectedDispute.participants.borrower &&
              selectedDispute.participants.borrower.status !== 'BANNED'
            "
            class="flex gap-3"
          >
            <button
              class="flex-1 h-10 rounded-xl bg-white border border-cinnabar-red text-cinnabar-red text-[12px] font-bold uppercase tracking-wider hover:bg-cinnabar-red/5 transition-colors"
              @click="
                openSuspendModal(
                  selectedDispute.participants.borrower.id,
                  selectedDispute.participants.borrower.displayName,
                )
              "
            >
              Suspend
            </button>
            <button
              class="flex-1 h-10 rounded-xl bg-cinnabar-red text-white text-[12px] font-bold uppercase tracking-wider hover:bg-red-600 transition-colors shadow-sm"
              @click="
                openBanModal(
                  selectedDispute.participants.borrower.id,
                  selectedDispute.participants.borrower.displayName,
                )
              "
            >
              Ban Account
            </button>
          </div>
        </div>

        <!-- Lender Dossier -->
        <div
          class="bg-white rounded-[24px] border border-cinnamon-ice/20 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-8"
        >
          <div class="flex items-center justify-between mb-8 pb-4 border-b border-gray-50">
            <div class="border-l-[3px] border-burning-orange pl-4">
              <h2 class="text-[20px] font-semibold text-noble-black">Lender</h2>
            </div>
            <span
              class="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-gray-50 text-noble-black/40 border border-gray-100"
            >
              {{ selectedDispute.participants.lender?.status ?? "Inactive" }}
            </span>
          </div>

          <div class="flex items-center gap-6 mb-8">
            <div
              class="w-16 h-16 rounded-full border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 shadow-sm"
            >
              <UserAvatar
                :user-name="selectedDispute.participants.lender?.displayName ?? 'Lender'"
                :avatar-url="selectedDispute.participants.lender?.avatarUrl"
                size="lg"
                class="!rounded-none"
              />
            </div>
            <div class="min-w-0">
              <h3 class="text-[20px] font-semibold text-noble-black truncate">
                {{ selectedDispute.participants.lender?.displayName ?? "Deleted User" }}
              </h3>
              <p class="text-[14px] font-medium text-noble-black/40">
                @{{ selectedDispute.participants.lender?.username ?? "anonymous" }}
              </p>
            </div>
          </div>

          <div
            class="grid grid-cols-2 gap-6 p-6 rounded-2xl bg-gray-50/50 border border-gray-50 mb-8"
          >
            <div>
              <p class="text-[11px] font-bold uppercase tracking-widest text-noble-black/40 mb-1">
                Trust Score
              </p>
              <div class="flex items-center gap-2">
                <span class="text-[24px] font-semibold text-noble-black">{{
                  selectedDispute.participants.lender?.points ?? 0
                }}</span>
                <Icon name="ph:shield-check-fill" class="w-5 h-5 text-burning-orange" />
              </div>
            </div>
            <div class="border-l border-gray-100 pl-6">
              <p class="text-[11px] font-bold uppercase tracking-widest text-noble-black/40 mb-1">
                Platform Rating
              </p>
              <p class="text-[18px] font-medium text-noble-black/80">
                0.0
                <span class="text-burning-orange text-[14px]">★</span>
              </p>
            </div>
          </div>

          <div
            v-if="
              selectedDispute.participants.lender &&
              selectedDispute.participants.lender.status !== 'BANNED'
            "
            class="flex gap-3"
          >
            <button
              class="flex-1 h-10 rounded-xl bg-white border border-cinnabar-red text-cinnabar-red text-[12px] font-bold uppercase tracking-wider hover:bg-cinnabar-red/5 transition-colors"
              @click="
                openSuspendModal(
                  selectedDispute.participants.lender.id,
                  selectedDispute.participants.lender.displayName,
                )
              "
            >
              Suspend
            </button>
            <button
              class="flex-1 h-10 rounded-xl bg-cinnabar-red text-white text-[12px] font-bold uppercase tracking-wider hover:bg-red-600 transition-colors shadow-sm"
              @click="
                openBanModal(
                  selectedDispute.participants.lender.id,
                  selectedDispute.participants.lender.displayName,
                )
              "
            >
              Ban Account
            </button>
          </div>
        </div>
      </div>

      <!-- Section 2: Case Merit -->
      <div class="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div class="space-y-8">
          <div
            class="bg-white rounded-[24px] border border-cinnamon-ice/20 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-8"
          >
            <div class="mb-6 border-l-[3px] border-burning-orange pl-4">
              <h3 class="text-[20px] font-semibold text-noble-black">Original Concern</h3>
            </div>

            <p class="text-[20px] font-medium text-noble-black leading-snug mb-6">
              {{ selectedDispute.reason }}
            </p>

            <div class="flex items-center gap-3 mb-8 pb-6 border-b border-gray-50">
              <span class="text-[13px] font-medium text-noble-black/40">Filed by</span>
              <div
                class="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100"
              >
                <UserAvatar
                  :user-name="selectedDispute.raisedBy?.displayName ?? 'User'"
                  :avatar-url="selectedDispute.raisedBy?.avatarUrl"
                  size="sm"
                />
                <span class="text-[12px] font-semibold text-noble-black">{{
                  selectedDispute.raisedBy?.displayName
                }}</span>
              </div>
            </div>

            <div>
              <div class="rounded-2xl bg-gray-50/50 p-6 border border-gray-100">
                <p
                  class="text-[15px] leading-relaxed text-noble-black/70 font-light whitespace-pre-wrap"
                >
                  {{
                    selectedDispute.description ||
                    "The initiator did not provide a detailed narrative for this case."
                  }}
                </p>
              </div>
            </div>
          </div>

          <div
            v-if="selectedDispute.hasRebuttal"
            class="bg-white rounded-[24px] border border-cinnamon-ice/20 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-8"
          >
            <div class="mb-6 border-l-[3px] border-burning-orange pl-4">
              <h3 class="text-[20px] font-semibold text-noble-black">Counterparty Rebuttal</h3>
            </div>

            <div class="space-y-8">
              <div class="flex items-center gap-4 mb-2">
                <UserAvatar
                  :user-name="selectedDispute.rebuttalBy?.displayName ?? 'User'"
                  :avatar-url="selectedDispute.rebuttalBy?.avatarUrl"
                  size="md"
                />
                <div>
                  <p class="text-[15px] font-semibold text-noble-black">
                    {{ selectedDispute.rebuttalBy?.displayName }}
                  </p>
                  <p
                    class="text-[11px] font-medium text-noble-black/40 uppercase tracking-widest mt-0.5"
                  >
                    Submitted {{ formatDateTime(selectedDispute.rebuttalSubmittedAt) }}
                  </p>
                </div>
              </div>

              <div class="rounded-2xl bg-gray-50/50 p-6 border border-gray-100">
                <p
                  class="text-[15px] leading-relaxed text-noble-black/70 font-light whitespace-pre-wrap"
                >
                  "{{ selectedDispute.rebuttalText }}"
                </p>
              </div>

              <div
                v-if="selectedDispute.rebuttalImageUrl"
                class="relative group cursor-pointer w-48 rounded-xl overflow-hidden border border-gray-100 shadow-sm"
                @click="
                  navigateTo(selectedDispute.rebuttalImageUrl!, { open: { target: '_blank' } })
                "
              >
                <img
                  :src="selectedDispute.rebuttalImageUrl"
                  class="w-full h-auto object-cover aspect-square"
                />
                <div
                  class="absolute inset-0 bg-noble-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                >
                  <Icon name="ph:magnifying-glass-plus" class="w-8 h-8 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-8">
          <div
            class="bg-white rounded-[24px] border border-cinnamon-ice/20 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-8"
          >
            <div class="mb-6 pb-4 border-b border-gray-50">
              <div class="border-l-[3px] border-burning-orange pl-4">
                <h3 class="text-[20px] font-semibold text-noble-black">Timeline</h3>
              </div>
            </div>

            <div class="space-y-0">
              <div
                v-for="(entry, idx) in timelineEntries"
                :key="entry.label"
                class="relative pl-6 pb-6 last:pb-0"
              >
                <!-- Line connecting dots -->
                <div
                  v-if="idx !== timelineEntries.length - 1"
                  class="absolute left-[3px] top-2 bottom-[-8px] w-0.5 bg-gray-100"
                ></div>
                <!-- Dot -->
                <div
                  class="absolute left-[-1px] top-1.5 w-2.5 h-2.5 rounded-full bg-burning-orange border-2 border-white shadow-sm ring-1 ring-burning-orange/20 z-10"
                ></div>

                <p class="text-[10px] font-bold uppercase tracking-wider text-noble-black/40 mb-1">
                  {{ entry.label }}
                </p>
                <p class="text-[13px] font-medium text-noble-black">{{ entry.value }}</p>
              </div>
            </div>
          </div>

          <div
            class="bg-white rounded-[24px] border border-cinnamon-ice/20 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-8"
          >
            <div class="mb-6 pb-4 border-b border-gray-50">
              <div class="border-l-[3px] border-burning-orange pl-4">
                <h3 class="text-[20px] font-semibold text-noble-black">Item</h3>
              </div>
            </div>

            <div v-if="selectedDispute.item" class="space-y-4">
              <div
                class="aspect-[4/3] rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 group"
              >
                <img
                  v-if="selectedDispute.item.thumbnailImage"
                  :src="selectedDispute.item.thumbnailImage"
                  class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div>
                <p class="text-[15px] font-semibold text-noble-black leading-tight">
                  {{ selectedDispute.item.name }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 3: Enforcement & Verdict -->
      <div class="pt-8 space-y-8">
        <!-- Resolution Protocol -->
        <div
          v-if="selectedDispute.canResolve"
          class="bg-white rounded-[24px] border border-cinnamon-ice/20 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-8"
        >
          <div class="mb-8 pb-6 border-b border-gray-50">
            <div class="border-l-[3px] border-burning-orange pl-4">
              <h3 class="text-[20px] font-semibold text-noble-black">Final Resolution</h3>
              <p class="mt-0.5 text-[13px] font-light text-noble-black/50">
                The case will only close after the final judgment is saved and every selected option
                is applied successfully.
              </p>
            </div>
          </div>

          <div class="grid gap-6 lg:grid-cols-2 mb-10">
            <button
              class="text-left p-6 rounded-2xl border transition-all"
              :class="
                resolutionDecision === 'APPROVED'
                  ? 'border-burning-orange bg-burning-orange/5 ring-1 ring-burning-orange/20'
                  : 'border-gray-100 bg-white hover:border-gray-300'
              "
              @click="resolutionDecision = 'APPROVED'"
            >
              <div class="flex items-center gap-3 mb-2">
                <Icon
                  name="ph:check-circle-fill"
                  class="w-5 h-5"
                  :class="
                    resolutionDecision === 'APPROVED' ? 'text-burning-orange' : 'text-gray-400'
                  "
                />
                <h4 class="text-[16px] font-semibold text-noble-black">Approve Dispute</h4>
              </div>
              <p class="text-noble-black/50 text-[13px] font-medium leading-relaxed pl-8">
                The concern is upheld and any selected sanctions will be enforced.
              </p>
            </button>
            <button
              class="text-left p-6 rounded-2xl border transition-all"
              :class="
                resolutionDecision === 'REJECTED'
                  ? 'border-noble-black bg-noble-black/5 ring-1 ring-noble-black/20'
                  : 'border-gray-100 bg-white hover:border-gray-300'
              "
              @click="resolutionDecision = 'REJECTED'"
            >
              <div class="flex items-center gap-3 mb-2">
                <Icon
                  name="ph:x-circle-fill"
                  class="w-5 h-5"
                  :class="resolutionDecision === 'REJECTED' ? 'text-noble-black' : 'text-gray-400'"
                />
                <h4 class="text-[16px] font-semibold text-noble-black">Reject Dispute</h4>
              </div>
              <p class="text-noble-black/50 text-[13px] font-medium leading-relaxed pl-8">
                The concern is denied, but you may still apply a policy action if warranted.
              </p>
            </button>
          </div>

          <div class="space-y-3 mb-10">
            <label class="text-[14px] font-semibold text-noble-black">Judgment Notes</label>
            <textarea
              v-model="resolutionNotes"
              rows="5"
              placeholder="Summarize the final reasoning that both parties should see."
              class="w-full rounded-2xl bg-gray-50 border border-gray-100 p-6 text-[14px] font-medium text-noble-black outline-none focus:bg-white focus:border-burning-orange/40 focus:ring-4 focus:ring-burning-orange/10 transition-all resize-none"
            ></textarea>
          </div>

          <!-- Tier Enforcement -->
          <div class="p-8 rounded-2xl bg-gray-50/50 border border-gray-100">
            <div class="flex items-start justify-between mb-8 pb-4 border-b border-gray-200">
              <div class="border-l-[3px] border-burning-orange pl-4">
                <h4 class="text-[20px] font-semibold text-noble-black">Disciplinary Actions</h4>
                <p class="mt-0.5 text-[13px] font-light text-noble-black/50">
                  Leave the case on "No disciplinary action" if closure should happen without a
                  sanction.
                </p>
              </div>
              <label class="flex items-center gap-3 cursor-pointer group mt-1">
                <span
                  class="text-[13px] font-semibold text-noble-black/50 group-hover:text-burning-orange transition-colors"
                  >No disciplinary action</span
                >
                <input
                  v-model="noActionSelected"
                  type="checkbox"
                  class="h-5 w-5 rounded border-gray-300 text-burning-orange focus:ring-burning-orange transition-colors"
                />
              </label>
            </div>

            <div
              class="grid gap-6 lg:grid-cols-2"
              :class="{ 'opacity-50 pointer-events-none grayscale': noActionSelected }"
            >
              <!-- Tiers here -->
              <div class="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-5">
                <div class="flex items-center justify-between">
                  <span class="text-[15px] font-semibold text-noble-black">Warning</span>
                  <input
                    v-model="warningEnabled"
                    type="checkbox"
                    class="h-4 w-4 rounded border-gray-300 text-burning-orange focus:ring-burning-orange"
                  />
                </div>
                <select
                  v-model="warningTargetId"
                  :disabled="!warningEnabled"
                  class="appearance-none w-full h-11 rounded-xl bg-gray-50 px-4 text-[13px] font-medium text-noble-black outline-none border border-gray-200 focus:border-burning-orange/40"
                >
                  <option v-for="target in actionTargets" :key="target.id" :value="target.id">
                    {{ target.displayName }}
                  </option>
                </select>
                <input
                  v-model="warningNote"
                  :disabled="!warningEnabled"
                  type="text"
                  placeholder="Optional note"
                  class="w-full h-11 rounded-xl bg-gray-50 px-4 text-[13px] font-medium text-noble-black outline-none border border-gray-200 focus:border-burning-orange/40"
                />
              </div>
              <div class="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-5">
                <div class="flex items-center justify-between">
                  <span class="text-[15px] font-semibold text-noble-black">Reduce Points</span>
                  <input
                    v-model="pointDeductionEnabled"
                    type="checkbox"
                    class="h-4 w-4 rounded border-gray-300 text-burning-orange focus:ring-burning-orange"
                  />
                </div>
                <div class="flex gap-3">
                  <input
                    v-model.number="pointDeductionPoints"
                    type="number"
                    class="w-20 h-11 rounded-xl bg-gray-50 px-4 text-[13px] font-medium text-noble-black outline-none border border-gray-200 focus:border-burning-orange/40"
                  />
                  <select
                    v-model="pointDeductionTargetId"
                    :disabled="!pointDeductionEnabled"
                    class="appearance-none flex-1 h-11 rounded-xl bg-gray-50 px-4 text-[13px] font-medium text-noble-black outline-none border border-gray-200 focus:border-burning-orange/40"
                  >
                    <option v-for="target in actionTargets" :key="target.id" :value="target.id">
                      {{ target.displayName }}
                    </option>
                  </select>
                </div>
                <input
                  v-model="pointDeductionNote"
                  :disabled="!pointDeductionEnabled"
                  type="text"
                  placeholder="Optional note"
                  class="w-full h-11 rounded-xl bg-gray-50 px-4 text-[13px] font-medium text-noble-black outline-none border border-gray-200 focus:border-burning-orange/40"
                />
              </div>
              <div class="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-5">
                <div class="flex items-center justify-between">
                  <span class="text-[15px] font-semibold text-noble-black">Suspend Account</span>
                  <input
                    v-model="suspensionEnabled"
                    type="checkbox"
                    class="h-4 w-4 rounded border-gray-300 text-burning-orange focus:ring-burning-orange"
                  />
                </div>
                <div class="flex gap-3">
                  <input
                    v-model.number="suspensionDurationDays"
                    type="number"
                    placeholder="Days"
                    class="w-20 h-11 rounded-xl bg-gray-50 px-4 text-[13px] font-medium text-noble-black outline-none border border-gray-200 focus:border-burning-orange/40"
                  />
                  <select
                    v-model="suspensionTargetId"
                    :disabled="!suspensionEnabled"
                    class="appearance-none flex-1 h-11 rounded-xl bg-gray-50 px-4 text-[13px] font-medium text-noble-black outline-none border border-gray-200 focus:border-burning-orange/40"
                  >
                    <option v-for="target in actionTargets" :key="target.id" :value="target.id">
                      {{ target.displayName }}
                    </option>
                  </select>
                </div>
                <input
                  v-model="suspensionNote"
                  :disabled="!suspensionEnabled"
                  type="text"
                  placeholder="Optional note"
                  class="w-full h-11 rounded-xl bg-gray-50 px-4 text-[13px] font-medium text-noble-black outline-none border border-gray-200 focus:border-burning-orange/40"
                />
              </div>
              <div class="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-5">
                <div class="flex items-center justify-between">
                  <span class="text-[15px] font-semibold text-cinnabar-red">Ban Account</span>
                  <input
                    v-model="banEnabled"
                    type="checkbox"
                    class="h-4 w-4 rounded border-red-300 text-cinnabar-red focus:ring-cinnabar-red"
                  />
                </div>
                <select
                  v-model="banTargetId"
                  :disabled="!banEnabled"
                  class="appearance-none w-full h-11 rounded-xl bg-red-50/50 px-4 text-[13px] font-medium text-noble-black outline-none border border-red-100 focus:border-red-300"
                >
                  <option v-for="target in actionTargets" :key="target.id" :value="target.id">
                    {{ target.displayName }}
                  </option>
                </select>
                <input
                  v-model="banNote"
                  :disabled="!banEnabled"
                  type="text"
                  placeholder="Optional note"
                  class="w-full h-11 rounded-xl bg-red-50/50 px-4 text-[13px] font-medium text-noble-black outline-none border border-red-100 focus:border-red-300"
                />
              </div>
            </div>
          </div>

          <div class="mt-10 flex justify-end">
            <button
              :disabled="isResolving || !resolutionNotes.trim()"
              class="h-12 px-8 rounded-full bg-burning-orange text-white text-[14px] font-semibold hover:bg-burning-orange/90 transition-all shadow-sm disabled:opacity-40"
              @click="resolveAndCloseDispute"
            >
              {{ isResolving ? "Executing..." : "Finalize" }}
            </button>
          </div>
        </div>

        <!-- Archived Verdict -->
        <div
          v-if="selectedDispute.finalDecision"
          class="bg-white rounded-[24px] border border-cinnamon-ice/20 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-8"
        >
          <div class="flex items-center justify-between mb-8 pb-6 border-b border-gray-50">
            <div class="border-l-[3px] border-burning-orange pl-4">
              <h3 class="text-[20px] font-semibold text-noble-black">Official Verdict Recorded</h3>
            </div>
            <span
              class="text-[11px] font-bold uppercase tracking-widest text-green-600 bg-green-50 px-3 py-1 rounded-full"
              >Case Archived</span
            >
          </div>

          <div class="flex items-center gap-3 mb-6">
            <span
              class="w-2 h-2 rounded-full"
              :class="
                selectedDispute.finalDecision === 'APPROVED' ? 'bg-burning-orange' : 'bg-gray-400'
              "
            ></span>
            <p class="text-[18px] font-semibold text-noble-black">
              {{ finalDecisionLabel(selectedDispute.finalDecision) }}
            </p>
          </div>

          <div class="rounded-2xl bg-gray-50/50 p-6 border border-gray-100 mb-8">
            <p
              class="text-[15px] leading-relaxed text-noble-black/70 font-light whitespace-pre-wrap"
            >
              {{ selectedDispute.finalDecisionNotes || "No formal verdict summary recorded." }}
            </p>
          </div>

          <div v-if="selectedDispute.actions.length" class="space-y-4">
            <p class="text-[14px] font-semibold text-noble-black mb-4">Enforcement History</p>
            <div class="grid gap-4 lg:grid-cols-2">
              <div
                v-for="action in selectedDispute.actions"
                :key="action.id"
                class="flex items-center justify-between p-5 rounded-2xl bg-white border border-gray-100 shadow-sm"
              >
                <div class="flex items-center gap-4">
                  <div class="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                    <Icon name="ph:warning-circle" class="w-5 h-5 text-noble-black/60" />
                  </div>
                  <div>
                    <p class="text-[14px] font-semibold text-noble-black">
                      {{ actionLabel(action.type) }}
                    </p>
                    <p class="text-[12px] font-medium text-noble-black/50 mt-0.5">
                      Target: {{ action.targetUser?.displayName }}
                    </p>
                  </div>
                </div>
                <p v-if="action.pointsDelta" class="text-[16px] font-semibold text-cinnabar-red">
                  {{ action.pointsDelta }} pts
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals (Suspend/Ban) -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showSuspendModal"
          class="fixed inset-0 z-[100] flex items-center justify-center p-6"
        >
          <div
            class="absolute inset-0 bg-noble-black/40 backdrop-blur-sm transition-opacity"
            @click="showSuspendModal = false"
          ></div>
          <div
            class="relative w-full max-w-lg rounded-[24px] bg-white p-8 shadow-2xl transition-transform"
          >
            <h3 class="text-[20px] font-semibold text-noble-black mb-6">Suspend Account</h3>
            <div class="space-y-5">
              <div class="space-y-2">
                <label class="text-[13px] font-semibold text-noble-black/70 ml-1"
                  >Duration (Days)</label
                >
                <input
                  v-model.number="suspendDays"
                  type="number"
                  class="w-full h-11 rounded-xl bg-gray-50 border border-gray-100 px-4 text-[14px] font-medium text-noble-black outline-none focus:border-burning-orange/30 focus:ring-2 focus:ring-burning-orange/10 transition-all"
                />
              </div>
              <div class="space-y-2">
                <label class="text-[13px] font-semibold text-noble-black/70 ml-1">Rationale</label>
                <textarea
                  v-model="suspendReason"
                  rows="4"
                  class="w-full rounded-xl bg-gray-50 border border-gray-100 p-4 text-[14px] font-medium text-noble-black outline-none focus:border-burning-orange/30 focus:ring-2 focus:ring-burning-orange/10 transition-all resize-none"
                ></textarea>
              </div>
            </div>
            <div class="mt-8 flex gap-3">
              <button
                class="flex-1 h-11 rounded-xl bg-white border border-gray-200 text-[13px] font-semibold text-noble-black/60 hover:bg-gray-50 transition-colors"
                @click="showSuspendModal = false"
              >
                Cancel
              </button>
              <button
                :disabled="isActingOnUser || !suspendReason.trim()"
                class="flex-1 h-11 rounded-xl bg-cinnabar-red text-white text-[13px] font-semibold shadow-sm hover:bg-red-600 transition-colors disabled:opacity-40"
                @click="suspendUser"
              >
                Execute Suspension
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showBanModal" class="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div
            class="absolute inset-0 bg-noble-black/60 backdrop-blur-md transition-opacity"
            @click="showBanModal = false"
          ></div>
          <div
            class="relative w-full max-w-lg rounded-[24px] bg-white p-8 shadow-2xl transition-transform"
          >
            <h3 class="text-[20px] font-semibold text-cinnabar-red mb-6">Permanent Ban</h3>
            <div class="space-y-5">
              <div class="space-y-2">
                <label class="text-[13px] font-semibold text-cinnabar-red/70 ml-1"
                  >Final Statement</label
                >
                <textarea
                  v-model="banReason"
                  rows="4"
                  class="w-full rounded-xl bg-red-50/30 border border-red-100 p-4 text-[14px] font-medium text-noble-black outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100 transition-all resize-none"
                ></textarea>
              </div>
            </div>
            <div class="mt-8 flex gap-3">
              <button
                class="flex-1 h-11 rounded-xl bg-white border border-gray-200 text-[13px] font-semibold text-noble-black/60 hover:bg-gray-50 transition-colors"
                @click="showBanModal = false"
              >
                Cancel
              </button>
              <button
                :disabled="isActingOnUser || !banReason.trim()"
                class="flex-1 h-11 rounded-xl bg-cinnabar-red text-white text-[13px] font-semibold shadow-sm hover:bg-red-600 transition-colors disabled:opacity-40"
                @click="banUser"
              >
                Confirm Revocation
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
