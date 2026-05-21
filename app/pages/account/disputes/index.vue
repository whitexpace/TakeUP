<script setup lang="ts">
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../../../server/trpc/routers"
import type { Ref } from "vue"

definePageMeta({
  layout: "account",
  middleware: "account-auth",
})

type RouterOutputs = inferRouterOutputs<AppRouter>
type MyDispute = RouterOutputs["dispute"]["mine"]["disputes"][number]
type ReportableTransaction =
  RouterOutputs["dispute"]["reportableTransactions"]["transactions"][number]
type DisputesTab = "report" | "disputes" | "appeals"

const route = useRoute()
const router = useRouter()
const { clearAccountDisputesCache, fetchDisputeReportableTransactions, fetchMyDisputes } =
  useAccountDisputesPrefetch()
const { warmBookingDetail } = useBookingDetailPrefetch()

const disputeTabs: Array<{ id: DisputesTab; label: string }> = [
  { id: "report", label: "Report an Issue" },
  { id: "disputes", label: "Disputes" },
  { id: "appeals", label: "Appeal Decisions" },
]

const issueTypes = [
  {
    value: "damage_missing",
    label: "Damage / Missing parts",
    description: "Physical damage or components not returned.",
    icon: "damage",
  },
  {
    value: "late_return",
    label: "No-show / late return",
    description: "Party was late or missed the handoff.",
    icon: "clock",
  },
  {
    value: "policy_violation",
    label: "Policy violation",
    description: "Inappropriate behavior or guide breach.",
    icon: "shield",
  },
  {
    value: "other_issue",
    label: "Other issue",
    description: "Other concerns needing moderation review.",
    icon: "help",
  },
] as const

const resolutionOptions = [
  {
    value: "refund",
    label: "Refund / Deposit Return",
    description: "Request a full or partial reversal of the rental fee.",
  },
  {
    value: "replacement",
    label: "Item Replacement",
    description: "Request the other party to replace or repair the item.",
  },
  {
    value: "warning",
    label: "Formal Warning",
    description: "Ask moderation to record a strike on their account.",
  },
  {
    value: "other",
    label: "Other",
    description: "Specify a custom resolution for your situation.",
  },
] as const

const activeTab = computed<DisputesTab>(() => {
  const tab = route.query.tab
  if (tab === "disputes" || tab === "appeals") return tab
  return "report"
})

const setActiveTab = async (tab: DisputesTab) => {
  await router.replace({
    query: {
      ...route.query,
      tab,
      ...(tab === "report" ? {} : { transaction: undefined }),
      ...(tab === "appeals" ? {} : { dispute: undefined }),
    },
  })
}

const formatDate = (date: Date | string) =>
  new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

const finalDecisionLabel = (decision: MyDispute["finalDecision"]) => {
  if (decision === "APPROVED") return "Dispute approved"
  if (decision === "REJECTED") return "Dispute rejected"
  return "Pending final judgment"
}

const statusLabel = (status: MyDispute["status"]) => {
  switch (status) {
    case "SUBMITTED":
      return "In Review"
    case "OPEN":
      return "Open"
    case "REJECTED":
      return "Rejected"
    case "APPEALED":
      return "Appealed"
    case "CLOSED":
      return "Closed"
  }
}

const statusClasses = (status: MyDispute["status"]) => {
  switch (status) {
    case "SUBMITTED":
      return "bg-indigo-900/[0.08] text-indigo-900 border border-indigo-900/20"
    case "OPEN":
      return "bg-cinnabar-red/[0.08] text-cinnabar-red border border-cinnabar-red/20"
    case "REJECTED":
      return "bg-noble-black/5 text-noble-black/70 border border-cinnamon-ice"
    case "APPEALED":
      return "bg-blue-estate/[0.08] text-blue-estate border border-blue-estate/20"
    case "CLOSED":
      return "bg-success-green/[0.08] text-success-green border border-success-green/20"
  }
}
const {
  data: reportableData,
  pending: reportablePending,
  refresh: refreshReportableTransactions,
} = useLazyAsyncData("dispute:reportable-transactions", () => fetchDisputeReportableTransactions())

const {
  data: disputesData,
  pending: disputesPending,
  refresh: refreshDisputes,
} = useLazyAsyncData("dispute:mine", () => fetchMyDisputes())
const reportableTransactions = computed(() => reportableData.value?.transactions ?? [])
const myDisputes = computed(() => disputesData.value?.disputes ?? [])
const recentAppealableDisputes = computed(() =>
  myDisputes.value.filter((dispute) => dispute.canAppeal),
)

const currentReportStep = ref(1)
const reportSteps = [
  { id: 1, label: "Issue Type" },
  { id: 2, label: "Transaction & Details" },
  { id: 3, label: "Review & Submit" },
]

const selectedIssueType = ref<(typeof issueTypes)[number]["value"]>(issueTypes[0].value)
const selectedResolution = ref<(typeof resolutionOptions)[number]["value"]>(
  resolutionOptions[0].value,
)
const reportSummary = ref("")
const reportEvidenceFiles = ref<string[]>([])
const selectedTransactionId = ref<string | null>(null)
const selectedAppealDisputeId = ref<string | null>(null)
const appealReason = ref("")
const appealEvidenceFiles = ref<string[]>([])
const actionErrorMessage = ref("")
const actionSuccessMessage = ref("")
const isSubmittingReport = ref(false)
const isSubmittingAppeal = ref(false)
const reportFileInput = ref<HTMLInputElement | null>(null)
const appealFileInput = ref<HTMLInputElement | null>(null)

const issueTypeLabel = computed(
  () =>
    issueTypes.find((entry) => entry.value === selectedIssueType.value)?.label ??
    issueTypes[0].label,
)
const resolutionLabel = computed(
  () =>
    resolutionOptions.find((entry) => entry.value === selectedResolution.value)?.label ??
    resolutionOptions[0].label,
)

const requestedTransactionId = computed(() =>
  typeof route.query.transaction === "string" ? route.query.transaction : null,
)
const requestedAppealDisputeId = computed(() =>
  typeof route.query.dispute === "string" ? route.query.dispute : null,
)

watch(
  [reportableTransactions, requestedTransactionId],
  ([transactions, transactionId]) => {
    const hasSelection = (value: string | null) =>
      Boolean(value && transactions.some((entry) => entry.transactionId === value))

    if (transactionId && hasSelection(transactionId)) {
      selectedTransactionId.value = transactionId
      return
    }

    if (!hasSelection(selectedTransactionId.value)) {
      selectedTransactionId.value = transactions[0]?.transactionId ?? null
    }
  },
  { immediate: true },
)

watch(
  [recentAppealableDisputes, requestedAppealDisputeId],
  ([disputes, disputeId]) => {
    const hasSelection = (value: string | null) =>
      Boolean(value && disputes.some((entry) => entry.id === value))

    if (disputeId && hasSelection(disputeId)) {
      selectedAppealDisputeId.value = disputeId
      return
    }

    if (!hasSelection(selectedAppealDisputeId.value)) {
      selectedAppealDisputeId.value = disputes[0]?.id ?? null
    }
  },
  { immediate: true },
)

const selectedTransaction = computed<ReportableTransaction | null>(
  () =>
    reportableTransactions.value.find(
      (transaction) => transaction.transactionId === selectedTransactionId.value,
    ) ?? null,
)

const isTransactionLocked = computed(() =>
  Boolean(
    requestedTransactionId.value &&
    selectedTransaction.value?.transactionId === requestedTransactionId.value,
  ),
)

const resetReportForm = () => {
  selectedIssueType.value = issueTypes[0].value
  selectedResolution.value = resolutionOptions[0].value
  reportSummary.value = ""
  reportEvidenceFiles.value = []
  currentReportStep.value = 1
}

const resetAppealForm = () => {
  appealReason.value = ""
  appealEvidenceFiles.value = []
}

const attachSelectedFiles = (event: Event, target: Ref<string[]>) => {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? []).map((file) => file.name)
  target.value = files.slice(0, 5)
}

const openReportFilePicker = () => reportFileInput.value?.click()
const openAppealFilePicker = () => appealFileInput.value?.click()
const handleReportFileChange = (event: Event) => attachSelectedFiles(event, reportEvidenceFiles)
const handleAppealFileChange = (event: Event) => attachSelectedFiles(event, appealEvidenceFiles)

const warmDisputeTransactionDetail = (
  dispute: MyDispute,
  options: { immediate?: boolean } = {},
) => {
  if (!dispute.bookingId) return

  void warmBookingDetail(`/account/transactions/${dispute.bookingId}`, {
    priority: true,
    ...options,
  }).catch(() => {})
}

const buildReportDescription = () =>
  [
    `Requested resolution: ${resolutionLabel.value}`,
    selectedTransaction.value
      ? `Transaction: ${selectedTransaction.value.transactionReference} • ${selectedTransaction.value.item.name}`
      : null,
    selectedTransaction.value ? `Other party: ${selectedTransaction.value.counterpartName}` : null,
    reportSummary.value.trim() ? `Summary:\n${reportSummary.value.trim()}` : null,
    reportEvidenceFiles.value.length
      ? `Evidence filenames: ${reportEvidenceFiles.value.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n")

const submitReport = async () => {
  if (!selectedTransaction.value) {
    actionErrorMessage.value = "Select a completed transaction before submitting a report."
    return
  }

  isSubmittingReport.value = true
  actionErrorMessage.value = ""
  actionSuccessMessage.value = ""

  try {
    await $fetch("/api/disputes", {
      method: "POST",
      body: {
        transactionId: selectedTransaction.value.transactionId,
        reason: issueTypeLabel.value,
        description: buildReportDescription(),
      },
    })

    resetReportForm()
    clearAccountDisputesCache()
    await Promise.all([refreshReportableTransactions(), refreshDisputes()])
    actionSuccessMessage.value = "Your concern has been submitted for review."
    await router.replace({ query: { tab: "disputes" } })
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
      "Unable to submit your report right now."
  } finally {
    isSubmittingReport.value = false
  }
}

const submitAppeal = async () => {
  if (!selectedAppealDisputeId.value) {
    actionErrorMessage.value = "Select a recent rejected dispute before submitting an appeal."
    return
  }

  if (!appealReason.value.trim()) {
    actionErrorMessage.value = "Please explain why the decision should be reconsidered."
    return
  }

  isSubmittingAppeal.value = true
  actionErrorMessage.value = ""
  actionSuccessMessage.value = ""

  try {
    await $fetch(`/api/disputes/${selectedAppealDisputeId.value}/appeal`, {
      method: "POST",
      body: {
        appealReason: appealReason.value.trim(),
        evidenceFileNames: appealEvidenceFiles.value.length ? appealEvidenceFiles.value : undefined,
      },
    })

    resetAppealForm()
    clearAccountDisputesCache()
    await refreshDisputes()
    actionSuccessMessage.value = "Your appeal has been submitted."
    await router.replace({ query: { tab: "disputes" } })
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
      "Unable to submit your appeal right now."
  } finally {
    isSubmittingAppeal.value = false
  }
}

const nextStep = () => {
  if (currentReportStep.value < 3) {
    currentReportStep.value++
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
}

const prevStep = () => {
  if (currentReportStep.value > 1) {
    currentReportStep.value--
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
}
</script>

<template>
  <div class="relative">
    <MyDisputesSkeleton v-if="reportablePending || disputesPending" :active-tab="activeTab" />

    <div class="mx-auto max-w-[1100px] space-y-6 pb-10 font-geist px-4 sm:px-6 lg:px-16 xl:px-24">
      <!-- Page Header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8 sm:mb-10">
        <section class="space-y-3">
          <div class="space-y-2">
            <h1
              class="font-geist text-[28px] sm:text-[36px] font-medium text-noble-black tracking-tight leading-tight"
            >
              My Disputes
            </h1>
            <div class="w-10 h-0.5 bg-burning-orange"></div>
          </div>
          <p class="text-[14px] sm:text-[16px] font-light text-noble-black/50">
            Report transaction issues and track your ongoing disputes.
          </p>
        </section>
      </div>

      <!-- Modern Underline Tabs (Refined) -->
      <div class="mb-8 sm:mb-10 overflow-x-auto custom-scrollbar">
        <nav class="flex gap-6 sm:gap-10 min-w-max pb-1">
          <button
            v-for="tab in disputeTabs"
            :key="tab.id"
            type="button"
            class="relative pb-3 sm:pb-4 text-[16px] sm:text-[18px] font-semibold transition-all duration-300 outline-none whitespace-nowrap"
            :class="[
              activeTab === tab.id
                ? 'text-burning-orange'
                : 'text-noble-black/40 hover:text-noble-black',
            ]"
            @click="setActiveTab(tab.id)"
          >
            {{ tab.label }}
            <div
              v-if="activeTab === tab.id"
              class="absolute bottom-0 left-0 right-0 h-[2px] sm:h-[2.5px] bg-burning-orange rounded-full transition-all duration-300"
            ></div>
          </button>
        </nav>
      </div>

      <div v-if="actionSuccessMessage || actionErrorMessage" class="space-y-3 mb-8">
        <div
          v-if="actionSuccessMessage"
          class="flex items-center gap-3 text-[13px] font-bold text-success-green bg-success-green/5 border border-success-green/10 p-4 rounded-[14px]"
        >
          <Icon name="ph:check" class="w-[18px] h-[18px]" />
          {{ actionSuccessMessage }}
        </div>
        <div
          v-if="actionErrorMessage"
          class="flex items-center gap-3 text-[13px] font-bold text-cinnabar-red bg-cinnabar-red/5 border border-cinnabar-red/10 p-4 rounded-[14px]"
        >
          <Icon name="ph:warning-circle" class="w-[18px] h-[18px]" />
          {{ actionErrorMessage }}
        </div>
      </div>

      <template v-if="activeTab === 'report'">
        <div class="space-y-8 sm:space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <!-- Progress Indicator -->
          <div class="max-w-2xl mx-auto px-2 sm:px-4">
            <div class="relative flex items-center justify-between">
              <!-- Line background -->
              <div class="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-gray-100"></div>
              <!-- Progress Line -->
              <div
                class="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-burning-orange transition-all duration-500 ease-in-out"
                :style="{ width: ((currentReportStep - 1) / (reportSteps.length - 1)) * 100 + '%' }"
              ></div>

              <div
                v-for="step in reportSteps"
                :key="step.id"
                class="relative z-10 flex flex-col items-center gap-2 sm:gap-3"
              >
                <div
                  class="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[12px] sm:text-[14px] font-bold transition-all duration-500 border-2"
                  :class="[
                    currentReportStep > step.id
                      ? 'bg-burning-orange border-burning-orange text-white'
                      : currentReportStep === step.id
                        ? 'bg-white border-burning-orange text-burning-orange shadow-lg shadow-burning-orange/20'
                        : 'bg-white border-gray-100 text-gray-300',
                  ]"
                >
                  <Icon
                    v-if="currentReportStep > step.id"
                    name="ph:check"
                    class="w-4 h-4 sm:w-5 sm:h-5"
                  />
                  <span v-else>{{ step.id }}</span>
                </div>
                <span
                  class="absolute top-10 sm:top-12 whitespace-nowrap text-[9px] sm:text-[11px] font-bold uppercase tracking-wider transition-colors duration-500"
                  :class="currentReportStep >= step.id ? 'text-noble-black' : 'text-gray-300'"
                >
                  {{ step.label }}
                </span>
              </div>
            </div>
          </div>

          <!-- Main Content (Two Columns at lg) -->
          <div class="grid grid-cols-1 lg:grid-cols-5 gap-8 sm:gap-12 items-start mt-12 sm:mt-16">
            <!-- Left Column: Form Steps (60%) -->
            <div class="lg:col-span-3 space-y-6 sm:space-y-8 min-h-[300px] sm:min-h-[400px]">
              <div
                v-if="!reportableTransactions.length"
                class="rounded-[24px] sm:rounded-[32px] border border-dashed border-cinnamon-ice bg-cream px-5 py-12 sm:py-16 text-center"
              >
                <div
                  class="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-sm border border-gray-100"
                >
                  <Icon name="ph:shield" class="text-noble-black/20 w-7 h-7 sm:w-8 sm:h-8" />
                </div>
                <p class="text-lg sm:text-xl font-semibold text-noble-black">
                  No reportable transactions
                </p>
                <p
                  class="mt-2 text-[13px] sm:text-sm text-noble-black/50 max-w-[280px] mx-auto leading-relaxed"
                >
                  Transactions become eligible for reporting for 15 days after they are marked as
                  completed.
                </p>
              </div>

              <div v-else>
                <form @submit.prevent>
                  <!-- Step 1: Issue Type -->
                  <div
                    v-if="currentReportStep === 1"
                    class="space-y-6 sm:space-y-8 animate-in fade-in duration-500"
                  >
                    <div
                      class="space-y-3 sm:space-y-4 border-l-[3px] border-burning-orange pl-3 sm:pl-4"
                    >
                      <h2 class="text-[18px] sm:text-[22px] font-semibold text-noble-black">
                        What's the problem?
                      </h2>
                      <p class="text-[13px] sm:text-[14px] text-noble-black/50 font-light">
                        Please select the reason that best describes your issue.
                      </p>
                    </div>

                    <div class="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
                      <button
                        v-for="issueType in issueTypes"
                        :key="issueType.value"
                        type="button"
                        class="flex flex-col text-left p-4 rounded-[14px] border-[1.5px] transition-all duration-300 group"
                        :class="[
                          selectedIssueType === issueType.value
                            ? 'bg-[#FFF5EE] border-burning-orange border-2'
                            : 'bg-white border-gray-200 hover:border-burning-orange/30 shadow-sm',
                        ]"
                        @click="selectedIssueType = issueType.value"
                      >
                        <div
                          class="mb-3 sm:mb-4 transition-colors"
                          :class="
                            selectedIssueType === issueType.value
                              ? 'text-burning-orange'
                              : 'text-gray-400'
                          "
                        >
                          <Icon
                            v-if="issueType.icon === 'damage'"
                            name="ph:package"
                            class="w-7 h-7 sm:w-8 sm:h-8"
                          />
                          <Icon
                            v-else-if="issueType.icon === 'clock'"
                            name="ph:clock"
                            class="w-7 h-7 sm:w-8 sm:h-8"
                          />
                          <Icon
                            v-else-if="issueType.icon === 'shield'"
                            name="ph:shield-warning"
                            class="w-7 h-7 sm:w-8 sm:h-8"
                          />
                          <Icon v-else name="ph:question" class="w-7 h-7 sm:w-8 sm:h-8" />
                        </div>
                        <span class="text-[13px] sm:text-[14px] font-bold mb-1 text-noble-black">
                          {{ issueType.label }}
                        </span>
                        <span
                          class="text-[11px] sm:text-[12px] text-gray-400 font-medium leading-tight"
                        >
                          {{ issueType.description }}
                        </span>
                      </button>
                    </div>
                  </div>

                  <!-- Step 2: Transaction & Details -->
                  <div
                    v-if="currentReportStep === 2"
                    class="space-y-8 sm:space-y-10 animate-in fade-in duration-500"
                  >
                    <div class="space-y-6">
                      <div class="space-y-2 border-l-[3px] border-burning-orange pl-3 sm:pl-4">
                        <h2 class="text-[16px] font-semibold text-noble-black">
                          Transaction Details
                        </h2>
                        <p class="text-[13px] text-noble-black/40 font-medium">
                          Select the booking you are reporting.
                        </p>
                      </div>

                      <div
                        class="bg-white border border-[#F0EDE8] rounded-[16px] p-4 sm:p-6 space-y-5 sm:space-y-6"
                      >
                        <div>
                          <label
                            class="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-noble-black/30 mb-2 sm:mb-3 ml-1"
                            >Related Transaction</label
                          >
                          <div class="relative">
                            <select
                              v-model="selectedTransactionId"
                              :disabled="isTransactionLocked"
                              class="w-full h-11 sm:h-12 rounded-[10px] border-[1.5px] border-[#E5E7EB] bg-white px-3 sm:px-4 text-[13px] sm:text-[14px] text-noble-black font-semibold outline-none transition-all focus:border-burning-orange appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <option
                                v-for="transaction in reportableTransactions"
                                :key="transaction.transactionId"
                                :value="transaction.transactionId"
                              >
                                {{ transaction.transactionReference }} • {{ transaction.item.name }}
                              </option>
                            </select>
                            <Icon
                              name="ph:caret-down"
                              class="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 pointer-events-none text-noble-black/30 w-[16px] h-[16px] sm:w-[18px] sm:h-[18px]"
                            />
                          </div>
                          <p
                            v-if="isTransactionLocked"
                            class="mt-2 text-[10px] sm:text-[11px] font-medium text-burning-orange/60 ml-1"
                          >
                            ✓ Pre-selected from your order history
                          </p>
                        </div>

                        <!-- Confirmation Row (Auto-populated) -->
                        <div class="grid gap-4 sm:grid-cols-2">
                          <div class="space-y-2">
                            <p
                              class="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-noble-black/30 ml-1"
                            >
                              Item Name
                            </p>
                            <div
                              class="flex items-center gap-3 p-3 sm:p-4 rounded-[12px] border border-dashed border-[#E5E7EB] bg-[#F9FAFB]"
                            >
                              <div
                                class="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden shrink-0 border border-gray-100"
                              >
                                <Icon name="ph:package" class="w-5 h-5 text-gray-400" />
                              </div>
                              <span
                                class="text-[13px] sm:text-[14px] font-bold text-noble-black/70 truncate"
                              >
                                {{ selectedTransaction?.item.name ?? "---" }}
                              </span>
                            </div>
                          </div>

                          <div class="space-y-2">
                            <p
                              class="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-noble-black/30 ml-1"
                            >
                              Other Party
                            </p>
                            <div
                              class="flex items-center gap-3 p-3 sm:p-4 rounded-[12px] border border-dashed border-[#E5E7EB] bg-[#F9FAFB]"
                            >
                              <UserAvatar
                                :user-name="selectedTransaction?.counterpartName || 'U'"
                                size="sm"
                                class="shrink-0 ring-2 ring-white"
                              />
                              <span
                                class="text-[13px] sm:text-[14px] font-bold text-noble-black/70 truncate"
                              >
                                {{ selectedTransaction?.counterpartName ?? "---" }}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="space-y-8">
                      <!-- Summary -->
                      <div class="space-y-4">
                        <div class="space-y-1 border-l-[3px] border-burning-orange pl-3 sm:pl-4">
                          <h2 class="text-[16px] font-semibold text-noble-black">Summary</h2>
                          <p class="text-[13px] text-noble-black/40 font-medium">
                            Explain your concern in detail.
                          </p>
                        </div>

                        <div class="relative">
                          <textarea
                            v-model="reportSummary"
                            rows="6"
                            maxlength="1000"
                            placeholder="What happened and when?"
                            class="w-full min-h-[140px] rounded-[12px] border-[1.5px] border-[#E5E7EB] bg-white p-[14px] text-[14px] sm:text-[15px] text-noble-black font-medium outline-none transition-all focus:border-burning-orange focus:ring-4 focus:ring-burning-orange/10 leading-relaxed shadow-sm"
                          ></textarea>
                          <div
                            class="absolute bottom-3 right-3 text-[11px] sm:text-[12px] font-bold text-[#9CA3AF] pointer-events-none bg-white/80 px-2 rounded"
                          >
                            {{ reportSummary.length }} / 1000
                          </div>
                        </div>
                      </div>

                      <!-- Evidence -->
                      <div class="space-y-4">
                        <div class="space-y-1 border-l-[3px] border-burning-orange pl-3 sm:pl-4">
                          <h2 class="text-[16px] font-semibold text-noble-black">Evidence</h2>
                          <p class="text-[13px] text-noble-black/40 font-medium">
                            Attach photos or documents supporting your claim.
                          </p>
                        </div>

                        <div class="relative group cursor-pointer" @click="openReportFilePicker">
                          <div
                            class="w-full py-6 sm:py-8 px-5 sm:px-6 rounded-[12px] border-2 border-dashed border-[#E5E7EB] bg-gray-50/30 flex flex-col items-center justify-center transition-all duration-300 group-hover:border-burning-orange group-hover:bg-[#FFF5EE]"
                          >
                            <div
                              class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-100 mb-3 sm:mb-4 transition-colors group-hover:text-burning-orange text-[#9CA3AF]"
                            >
                              <Icon name="ph:upload-simple" class="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <p class="text-[13px] sm:text-[14px] font-bold text-[#6B7280]">
                              Drag photos or files here
                            </p>
                            <button
                              type="button"
                              class="mt-2 text-[12px] sm:text-[13px] font-bold text-burning-orange hover:underline underline-offset-4"
                            >
                              Browse files
                            </button>
                          </div>
                        </div>

                        <input
                          ref="reportFileInput"
                          type="file"
                          accept=".png,.jpg,.jpeg,.pdf"
                          multiple
                          class="hidden"
                          @change="handleReportFileChange"
                        />

                        <div v-if="reportEvidenceFiles.length" class="flex flex-wrap gap-2 mt-2">
                          <div
                            v-for="(fileName, index) in reportEvidenceFiles"
                            :key="index"
                            class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-burning-orange/[0.08] text-burning-orange text-[11px] sm:text-[12px] font-bold border border-burning-orange/10"
                          >
                            <Icon name="ph:upload-simple" class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span class="max-w-[120px] sm:max-w-[140px] truncate">{{
                              fileName
                            }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Step 3: Review & Submit -->
                  <div
                    v-if="currentReportStep === 3"
                    class="space-y-8 sm:space-y-10 animate-in fade-in duration-500"
                  >
                    <div
                      class="space-y-3 sm:space-y-4 border-l-[3px] border-burning-orange pl-3 sm:pl-4"
                    >
                      <h2 class="text-[18px] sm:text-[22px] font-bold text-noble-black">
                        Final Review
                      </h2>
                      <p class="text-[13px] sm:text-[14px] text-noble-black/50 font-medium">
                        Please review your report details before submitting for moderation.
                      </p>
                    </div>

                    <div
                      class="bg-cream border border-cinnamon-ice/20 rounded-[20px] sm:rounded-[28px] p-5 sm:p-8 space-y-6 sm:space-y-8 shadow-sm"
                    >
                      <div class="grid gap-6 sm:gap-8 grid-cols-2">
                        <div class="min-w-0">
                          <p
                            class="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-noble-black/30 mb-2"
                          >
                            Category
                          </p>
                          <p class="text-[14px] sm:text-[16px] font-bold text-noble-black truncate">
                            {{ issueTypeLabel }}
                          </p>
                        </div>
                        <div class="min-w-0">
                          <p
                            class="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-noble-black/30 mb-2"
                          >
                            Item
                          </p>
                          <p class="text-[14px] sm:text-[16px] font-bold text-noble-black truncate">
                            {{ selectedTransaction?.item.name }}
                          </p>
                        </div>
                      </div>

                      <div
                        v-if="reportSummary"
                        class="pt-6 sm:pt-8 border-t border-cinnamon-ice/10"
                      >
                        <p
                          class="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-noble-black/30 mb-3"
                        >
                          Your Summary
                        </p>
                        <p
                          class="text-[13px] sm:text-[14px] text-noble-black/70 leading-relaxed italic border-l-2 border-burning-orange/20 pl-4"
                        >
                          {{ reportSummary }}
                        </p>
                      </div>

                      <div class="pt-6 sm:pt-8 border-t border-cinnamon-ice/10">
                        <p
                          class="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-noble-black/30 mb-4 ml-1"
                        >
                          Proposed Resolution
                        </p>
                        <div class="grid gap-3">
                          <button
                            v-for="option in resolutionOptions"
                            :key="option.value"
                            type="button"
                            class="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-[14px] border-[1.5px] transition-all duration-300 text-left"
                            :class="[
                              selectedResolution === option.value
                                ? 'bg-[#FFF5EE] border-burning-orange border-2 shadow-sm'
                                : 'bg-white border-gray-100 hover:border-burning-orange/30 shadow-sm',
                            ]"
                            @click="selectedResolution = option.value"
                          >
                            <!-- Radio Circle -->
                            <div
                              class="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                              :class="[
                                selectedResolution === option.value
                                  ? 'border-burning-orange'
                                  : 'border-gray-200',
                              ]"
                            >
                              <div
                                v-if="selectedResolution === option.value"
                                class="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-burning-orange"
                              ></div>
                            </div>
                            <div class="min-w-0">
                              <p
                                class="text-[13px] sm:text-[14px] font-semibold text-noble-black leading-tight"
                              >
                                {{ option.label }}
                              </p>
                              <p
                                class="text-[11px] sm:text-[12px] text-noble-black/40 font-medium mt-1 truncate"
                              >
                                {{ option.description }}
                              </p>
                            </div>
                          </button>
                        </div>
                      </div>

                      <div class="pt-6 sm:pt-8 border-t border-cinnamon-ice/10">
                        <p
                          class="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-noble-black/30 mb-3"
                        >
                          Evidence Files
                        </p>
                        <div class="flex flex-col sm:flex-row sm:items-center gap-3">
                          <button
                            type="button"
                            class="h-10 sm:h-12 px-5 sm:px-6 rounded-[12px] sm:rounded-[14px] bg-blue-estate/[0.08] text-blue-estate hover:bg-blue-estate/[0.12] font-bold text-[12px] sm:text-[13px] transition-all flex items-center justify-center sm:justify-start gap-2"
                            @click="openReportFilePicker"
                          >
                            <Icon name="ph:upload-simple" class="w-4 h-4 sm:w-5 sm:h-5" />
                            {{
                              reportEvidenceFiles.length
                                ? `Manage Files (${reportEvidenceFiles.length})`
                                : "Add Evidence"
                            }}
                          </button>
                          <div
                            v-if="reportEvidenceFiles.length"
                            class="flex-1 min-w-0 flex items-center"
                          >
                            <p
                              class="text-[11px] sm:text-[12px] text-noble-black/40 font-medium truncate"
                            >
                              {{ reportEvidenceFiles.join(", ") }}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Step Navigation Footer (Modernized) -->
                  <div
                    class="mt-8 sm:mt-12 pt-5 border-t border-[#F0EDE8] flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6"
                  >
                    <!-- Left: Security Disclaimer -->
                    <div class="flex items-center gap-2.5 text-[#9CA3AF]">
                      <Icon name="ph:warning-circle" class="w-[18px] h-[18px]" />
                      <p class="text-[11px] sm:text-[12px] font-medium leading-none">
                        False reports may lead to account action
                      </p>
                    </div>

                    <!-- Right: Actions -->
                    <div class="flex items-center gap-3 w-full sm:w-auto">
                      <button
                        v-if="currentReportStep > 1"
                        type="button"
                        class="flex-1 sm:flex-none h-10 sm:h-11 px-5 sm:px-6 rounded-[10px] text-noble-black/40 font-bold text-[13px] sm:text-[14px] hover:bg-gray-50 hover:text-noble-black transition-all"
                        @click="prevStep"
                      >
                        Back
                      </button>
                      <button
                        v-else
                        type="button"
                        class="flex-1 sm:flex-none h-10 sm:h-11 px-5 sm:px-6 rounded-[10px] text-noble-black/40 font-bold text-[13px] sm:text-[14px] hover:bg-gray-50 hover:text-noble-black transition-all"
                        @click="setActiveTab('disputes')"
                      >
                        Cancel
                      </button>

                      <button
                        v-if="currentReportStep < 3"
                        type="button"
                        class="flex-1 sm:flex-none h-10 sm:h-11 px-6 sm:px-8 rounded-[10px] bg-blue-estate text-white font-bold text-[13px] sm:text-[14px] hover:brightness-110 shadow-lg shadow-blue-estate/20 transition-all"
                        @click="nextStep"
                      >
                        Continue
                      </button>

                      <button
                        v-else
                        type="button"
                        :disabled="isSubmittingReport"
                        class="flex-1 sm:flex-none h-10 sm:h-11 px-6 sm:px-8 rounded-[10px] bg-burning-orange text-white font-bold text-[13px] sm:text-[14px] hover:brightness-110 shadow-[0_4px_14px_rgba(232,101,10,0.3)] transition-all disabled:opacity-50 disabled:grayscale"
                        @click="submitReport"
                      >
                        <span
                          v-if="isSubmittingReport"
                          class="flex items-center justify-center gap-2"
                        >
                          <Icon name="ph:spinner" class="w-4 h-4 animate-spin" />
                          Submitting...
                        </span>
                        <span v-else>Submit Report</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            <!-- Right Column: Info Panel (40%, Sticky) -->
            <aside
              class="lg:col-span-2 space-y-6 lg:sticky lg:top-8 animate-in fade-in slide-in-from-right-4 duration-700"
            >
              <div
                class="bg-white border border-gray-100 rounded-[20px] sm:rounded-[24px] p-6 sm:p-8 shadow-sm"
              >
                <h3 class="text-[16px] sm:text-[18px] font-bold text-noble-black mb-5 sm:mb-6">
                  What happens next?
                </h3>
                <div class="space-y-5 sm:space-y-6">
                  <div class="flex gap-3 sm:gap-4">
                    <div
                      class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-estate/[0.08] text-blue-estate flex items-center justify-center shrink-0"
                    >
                      <Icon name="ph:book-open" class="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                    </div>
                    <div>
                      <p class="text-[13px] sm:text-[14px] font-bold text-noble-black">
                        Admin Review
                      </p>
                      <p
                        class="text-[12px] sm:text-[13px] text-noble-black/50 leading-relaxed mt-1"
                      >
                        Our team typically reviews all reports within 24-48 hours to determine
                        eligibility.
                      </p>
                    </div>
                  </div>
                  <div class="flex gap-3 sm:gap-4">
                    <div
                      class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-estate/[0.08] text-blue-estate flex items-center justify-center shrink-0"
                    >
                      <Icon name="ph:chat-centered-text" class="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                    </div>
                    <div>
                      <p class="text-[13px] sm:text-[14px] font-bold text-noble-black">
                        Dispute Opening
                      </p>
                      <p
                        class="text-[12px] sm:text-[13px] text-noble-black/50 leading-relaxed mt-1"
                      >
                        If approved, a dispute will be opened and the other party will be notified
                        to provide their side.
                      </p>
                    </div>
                  </div>
                  <div class="flex gap-3 sm:gap-4">
                    <div
                      class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-estate/[0.08] text-blue-estate flex items-center justify-center shrink-0"
                    >
                      <Icon name="ph:check-circle" class="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                    </div>
                    <div>
                      <p class="text-[13px] sm:text-[14px] font-bold text-noble-black">
                        Final Judgment
                      </p>
                      <p
                        class="text-[12px] sm:text-[13px] text-noble-black/50 leading-relaxed mt-1"
                      >
                        An admin will issue a final decision based on all submitted evidence and
                        platform policies.
                      </p>
                    </div>
                  </div>
                </div>

                <div class="mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-gray-50">
                  <div
                    class="bg-[#FFFBF5] border border-[#FED7AA] rounded-[10px] p-3 sm:p-4 flex gap-3 items-center"
                  >
                    <div class="shrink-0 text-burning-orange">
                      <Icon name="ph:lightbulb" class="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                    </div>
                    <p class="text-[12px] sm:text-[13px] text-[#6B7280] leading-relaxed">
                      <span
                        class="text-[11px] sm:text-[12px] font-bold text-burning-orange uppercase tracking-wider mr-1.5"
                        >Pro tip</span
                      >
                      Detailed photos of damages or proof of messages often resolve disputes twice
                      as fast.
                    </p>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-3 px-4 text-noble-black/30">
                <Icon name="ph:shield" class="w-4 h-4" />
                <p class="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest">
                  TakeUP Secure Policy
                </p>
              </div>
            </aside>
          </div>
        </div>
      </template>
      <template v-else-if="activeTab === 'disputes'">
        <div class="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <section
            class="bg-cream border border-cinnamon-ice/20 rounded-[24px] p-5 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
          >
            <div class="border-l-[3px] border-burning-orange pl-3 sm:pl-4 mb-6 sm:mb-8">
              <h2 class="text-[18px] sm:text-[20px] font-bold text-noble-black">Your Disputes</h2>
              <p class="text-[12px] sm:text-[13px] font-medium text-noble-black/40 mt-0.5">
                Review the status of your submitted concerns and any opened disputes.
              </p>
            </div>

            <div
              v-if="!myDisputes.length"
              class="rounded-[24px] border border-dashed border-cinnamon-ice/40 bg-white/40 px-6 py-12 sm:py-14 text-center"
            >
              <div
                class="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100 shadow-sm"
              >
                <Icon name="ph:shield-check" class="text-noble-black/20 w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <p class="text-[16px] sm:text-[18px] font-bold text-noble-black">No disputes yet</p>
              <p class="mt-1 text-[12px] sm:text-[13px] text-noble-black/40 max-w-[280px] mx-auto">
                Submitted concerns and dispute updates will appear here.
              </p>
            </div>

            <div v-else class="space-y-4">
              <article
                v-for="dispute in myDisputes"
                :key="dispute.id"
                class="group relative bg-white border border-gray-100 rounded-[20px] sm:rounded-[22px] overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                @pointerenter="warmDisputeTransactionDetail(dispute)"
                @pointerover.passive="warmDisputeTransactionDetail(dispute)"
                @focusin="warmDisputeTransactionDetail(dispute)"
                @touchstart.passive="warmDisputeTransactionDetail(dispute)"
                @mousedown.left="warmDisputeTransactionDetail(dispute, { immediate: true })"
              >
                <!-- Zone 1: Header / Status -->
                <div
                  class="flex flex-row items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-50 bg-gray-50/30"
                >
                  <div class="flex items-center gap-2 sm:gap-3">
                    <div
                      class="flex items-center gap-1.5 font-mono text-[10px] sm:text-[11px] font-bold text-noble-black/40 bg-white px-2 py-0.5 rounded border border-gray-100"
                    >
                      ID. {{ dispute.transactionReference }}
                    </div>
                    <span class="hidden xs:inline text-noble-black/20 font-bold select-none"
                      >•</span
                    >
                    <p
                      class="hidden xs:block text-[11px] sm:text-[12px] font-bold text-noble-black/50 uppercase tracking-tight"
                    >
                      {{ dispute.viewerRole?.toLowerCase() || "participant" }}
                    </p>
                  </div>
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 sm:px-2.5 sm:py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border shadow-sm"
                    :class="statusClasses(dispute.status)"
                  >
                    {{ statusLabel(dispute.status) }}
                  </span>
                </div>

                <!-- Zone 2: Details -->
                <div class="p-4 sm:p-6">
                  <div
                    class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4"
                  >
                    <div class="space-y-1">
                      <h3
                        class="text-[15px] sm:text-[17px] font-bold text-noble-black leading-tight"
                      >
                        {{ dispute.item?.name ?? "Removed item" }}
                      </h3>
                      <p class="text-[12px] sm:text-[13px] font-medium text-noble-black/40">
                        With <span class="text-noble-black/70">{{ dispute.counterpartName }}</span>
                      </p>
                    </div>
                    <div class="text-left sm:text-right shrink-0">
                      <p class="text-[12px] sm:text-[13px] font-bold text-noble-black/70">
                        {{ dispute.reason }}
                      </p>
                      <p class="text-[10px] sm:text-[11px] font-medium text-noble-black/30 mt-0.5">
                        Submitted {{ formatDate(dispute.createdAt) }}
                      </p>
                    </div>
                  </div>

                  <div
                    v-if="dispute.description"
                    class="mt-3 sm:mt-4 p-3 sm:p-4 rounded-xl bg-gray-50/50 border border-gray-100/50"
                  >
                    <p
                      class="text-[12px] sm:text-[13px] leading-relaxed text-noble-black/60 line-clamp-2 italic"
                    >
                      "{{ dispute.description }}"
                    </p>
                  </div>

                  <!-- Admin Decision Box -->
                  <div
                    v-if="dispute.finalDecision"
                    class="mt-4 sm:mt-5 rounded-[16px] border border-success-green/10 bg-success-green/[0.03] p-3 sm:p-4"
                  >
                    <div class="flex items-center gap-2 text-success-green mb-1.5">
                      <Icon name="ph:check" class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <p class="text-[12px] sm:text-[13px] font-bold">
                        {{ finalDecisionLabel(dispute.finalDecision) }}
                      </p>
                    </div>
                    <p
                      v-if="dispute.finalDecisionNotes"
                      class="text-[12px] sm:text-[13px] text-noble-black/50 leading-relaxed pl-5 sm:pl-6"
                    >
                      {{ dispute.finalDecisionNotes }}
                    </p>
                    <p
                      v-if="dispute.closedAt"
                      class="mt-2 text-[10px] font-mono text-noble-black/30 pl-5 sm:pl-6"
                    >
                      RESOLVED ON {{ formatDate(dispute.closedAt).toUpperCase() }}
                    </p>
                  </div>

                  <div class="mt-5 sm:mt-6 flex items-center justify-between gap-4">
                    <div class="flex gap-2">
                      <NuxtLink
                        v-if="dispute.canSubmitRebuttal && dispute.bookingId"
                        :to="`/account/transactions/${dispute.bookingId}?action=rebuttal`"
                        :prefetch-on="{ interaction: true }"
                        class="h-8 sm:h-9 px-4 sm:px-5 flex items-center justify-center rounded-lg bg-blue-estate text-white text-[11px] sm:text-[12px] font-bold hover:brightness-110 transition-all shadow-sm shadow-blue-estate/20"
                        @pointerenter="warmDisputeTransactionDetail(dispute)"
                        @focus="warmDisputeTransactionDetail(dispute)"
                        @mousedown.left="warmDisputeTransactionDetail(dispute, { immediate: true })"
                      >
                        Submit Rebuttal
                      </NuxtLink>

                      <div
                        v-else-if="dispute.hasRebuttal"
                        class="h-8 sm:h-9 px-3 sm:px-4 flex items-center justify-center rounded-lg bg-blue-estate/[0.08] text-blue-estate text-[11px] sm:text-[12px] font-bold border border-blue-estate/10"
                      >
                        <Icon name="ph:check" class="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 sm:mr-1.5" />
                        Rebuttal submitted
                      </div>
                    </div>

                    <NuxtLink
                      v-if="dispute.bookingId"
                      :to="`/account/transactions/${dispute.bookingId}`"
                      :prefetch-on="{ interaction: true }"
                      class="text-[11px] sm:text-[12px] font-bold text-burning-orange hover:underline flex items-center gap-1"
                      @pointerenter="warmDisputeTransactionDetail(dispute)"
                      @focus="warmDisputeTransactionDetail(dispute)"
                      @mousedown.left="warmDisputeTransactionDetail(dispute, { immediate: true })"
                    >
                      View Details
                      <Icon name="ph:caret-right" class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </NuxtLink>
                  </div>
                </div>
              </article>
            </div>

            <div
              class="mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-cinnamon-ice/10 flex justify-end"
            >
              <button
                type="button"
                :disabled="!recentAppealableDisputes.length"
                class="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-8 rounded-[12px] sm:rounded-[14px] bg-white border-2 border-burning-orange text-burning-orange font-bold text-[13px] sm:text-[14px] hover:bg-burning-orange hover:text-white transition-all shadow-sm disabled:opacity-40 disabled:grayscale disabled:pointer-events-none"
                @click="setActiveTab('appeals')"
              >
                Appeal a decision
              </button>
            </div>
          </section>
        </div>
      </template>

      <template v-else>
        <div class="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <section
            class="bg-cream border border-cinnamon-ice/20 rounded-[24px] p-5 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
          >
            <div class="border-l-[3px] border-burning-orange pl-3 sm:pl-4 mb-6 sm:mb-8">
              <h2 class="text-[18px] sm:text-[20px] font-bold text-noble-black">
                Appeal a Dispute Decision
              </h2>
              <p class="text-[12px] sm:text-[13px] font-medium text-noble-black/40 mt-0.5">
                Appeals are only available for disputes marked “Appeal available”.
              </p>
            </div>

            <div
              v-if="!recentAppealableDisputes.length"
              class="rounded-[24px] border border-dashed border-cinnamon-ice/40 bg-white/40 px-6 py-12 sm:py-14 text-center"
            >
              <div
                class="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100 shadow-sm"
              >
                <Icon name="ph:shield-check" class="text-noble-black/20 w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <p class="text-[16px] sm:text-[18px] font-bold text-noble-black">
                No appeal-ready disputes
              </p>
              <p class="mt-1 text-[12px] sm:text-[13px] text-noble-black/40 max-w-[280px] mx-auto">
                Recent rejected disputes will appear here when they are still eligible for appeal.
              </p>
            </div>

            <div v-else class="space-y-6 sm:space-y-8">
              <div class="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div class="bg-white border border-gray-100 rounded-[20px] p-5 sm:p-6 shadow-sm">
                  <label
                    class="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-noble-black/30 mb-3 sm:mb-4 ml-1"
                    >Select Dispute to Appeal</label
                  >
                  <div class="relative">
                    <select
                      v-model="selectedAppealDisputeId"
                      class="w-full h-12 sm:h-14 rounded-[12px] sm:rounded-[16px] border border-gray-200 bg-white px-4 sm:px-5 text-[14px] sm:text-[15px] text-noble-black font-bold outline-none transition-all focus:border-burning-orange appearance-none cursor-pointer"
                    >
                      <option
                        v-for="dispute in recentAppealableDisputes"
                        :key="dispute.id"
                        :value="dispute.id"
                      >
                        {{ dispute.transactionReference }} •
                        {{ dispute.item?.name ?? "Removed item" }}
                      </option>
                    </select>
                    <div
                      class="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 pointer-events-none text-noble-black/30"
                    >
                      <Icon name="ph:caret-down" class="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                  </div>
                </div>

                <div
                  class="bg-blue-estate/[0.03] border border-blue-estate/10 rounded-[20px] p-5 sm:p-6 flex flex-col items-center justify-center text-center"
                >
                  <input
                    ref="appealFileInput"
                    type="file"
                    accept=".png,.jpg,.jpeg,.pdf"
                    multiple
                    class="hidden"
                    @change="handleAppealFileChange"
                  />
                  <button
                    type="button"
                    class="w-full h-11 sm:h-12 flex items-center justify-center gap-2 rounded-[12px] sm:rounded-[14px] bg-white border border-blue-estate/20 text-blue-estate font-bold text-[12px] sm:text-[13px] hover:bg-white/80 transition-all shadow-sm"
                    @click="openAppealFilePicker"
                  >
                    <Icon name="ph:upload-simple" class="w-4 h-4 sm:w-5 sm:h-5" />
                    Attach Files
                  </button>
                  <p
                    class="mt-2 sm:mt-3 text-[10px] sm:text-[11px] text-blue-estate/40 font-bold uppercase tracking-wider"
                  >
                    {{
                      appealEvidenceFiles.length
                        ? `${appealEvidenceFiles.length} files attached`
                        : "Upload PDF or JPG"
                    }}
                  </p>
                </div>
              </div>

              <div
                v-if="appealEvidenceFiles.length"
                class="rounded-xl bg-white/50 border border-gray-100 p-3 sm:p-4 text-[11px] sm:text-[12px] text-noble-black/50 font-medium truncate"
              >
                {{ appealEvidenceFiles.join(", ") }}
              </div>

              <div class="space-y-3 sm:space-y-4">
                <label
                  class="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-noble-black/30 mb-2 sm:mb-3 ml-1"
                  >Appeal Reason</label
                >
                <textarea
                  v-model="appealReason"
                  rows="6"
                  maxlength="2000"
                  placeholder="Explain why the decision should be reconsidered..."
                  class="w-full rounded-[20px] sm:rounded-[24px] border border-gray-200 bg-white p-5 sm:p-6 text-[14px] sm:text-[15px] text-noble-black font-medium outline-none transition-all focus:border-burning-orange leading-relaxed shadow-sm"
                ></textarea>
              </div>

              <div
                class="flex flex-col sm:flex-row items-center justify-between gap-5 sm:gap-6 pt-6 sm:pt-8 border-t border-cinnamon-ice/10"
              >
                <p
                  class="text-[11px] sm:text-[12px] text-noble-black/30 font-medium italic text-center sm:text-left"
                >
                  Note: Appeals are final and subject to detailed secondary review.
                </p>
                <button
                  type="button"
                  :disabled="isSubmittingAppeal"
                  class="w-full sm:w-auto h-11 sm:h-12 px-8 sm:px-10 rounded-[12px] sm:rounded-[14px] bg-gradient-to-br from-burning-orange to-orange-500 text-white font-bold text-[14px] sm:text-[15px] hover:brightness-110 shadow-lg shadow-burning-orange/20 transition-all disabled:opacity-50 disabled:grayscale"
                  @click="submitAppeal"
                >
                  {{ isSubmittingAppeal ? "Submitting..." : "Submit Appeal Request" }}
                </button>
              </div>
            </div>
          </section>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.notifications-menu-enter-active,
.notifications-menu-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.notifications-menu-enter-from,
.notifications-menu-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
