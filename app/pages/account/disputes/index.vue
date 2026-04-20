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

const disputeTabs: Array<{ id: DisputesTab; label: string }> = [
  { id: "report", label: "Report an Issue" },
  { id: "disputes", label: "Disputes" },
  { id: "appeals", label: "Appeal Decisions" },
]

const issueTypes = [
  { value: "damage_missing", label: "Damage / Missing parts" },
  { value: "late_return", label: "No-show / late return" },
  { value: "policy_violation", label: "Policy violation / harassment" },
  { value: "other_issue", label: "Other issue" },
] as const

const resolutionOptions = [
  { value: "refund_full", label: "Refund / deposit return (full/partial)" },
  { value: "replacement_cost", label: "Replacement or repair cost reimbursement" },
  { value: "late_fee", label: "Late return adjustment or fee review" },
  { value: "policy_review", label: "Admin review of conduct or policy issue" },
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
    case "RESOLVED":
      return "Resolved"
  }
}

const statusClasses = (status: MyDispute["status"]) => {
  switch (status) {
    case "SUBMITTED":
      return "bg-indigo-900 text-white"
    case "OPEN":
      return "bg-cinnabar-red/10 text-cinnabar-red border border-cinnabar-red/20"
    case "REJECTED":
      return "bg-noble-black/5 text-noble-black/70 border border-cinnamon-ice"
    case "APPEALED":
      return "bg-blue-estate/10 text-blue-estate border border-blue-estate/20"
    case "RESOLVED":
      return "bg-green-100 text-green-700 border border-green-200"
  }
}

const {
  data: reportableData,
  pending: reportablePending,
  error: reportableError,
  refresh: refreshReportableTransactions,
} = await useAsyncData("dispute:reportable-transactions", () =>
  $fetch<RouterOutputs["dispute"]["reportableTransactions"]>(
    "/api/dispute-reportable-transactions",
  ),
)

if (reportableError.value) {
  throw reportableError.value
}

const {
  data: disputesData,
  pending: disputesPending,
  error: disputesError,
  refresh: refreshDisputes,
} = await useAsyncData("dispute:mine", () =>
  $fetch<RouterOutputs["dispute"]["mine"]>("/api/my-disputes"),
)

if (disputesError.value) {
  throw disputesError.value
}

const reportableTransactions = computed(() => reportableData.value?.transactions ?? [])
const myDisputes = computed(() => disputesData.value?.disputes ?? [])
const recentAppealableDisputes = computed(() =>
  myDisputes.value.filter((dispute) => dispute.canAppeal),
)

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

const requestedTransactionUnavailable = computed(() =>
  Boolean(
    requestedTransactionId.value &&
    !reportableTransactions.value.some(
      (transaction) => transaction.transactionId === requestedTransactionId.value,
    ),
  ),
)

const resetReportForm = () => {
  selectedIssueType.value = issueTypes[0].value
  selectedResolution.value = resolutionOptions[0].value
  reportSummary.value = ""
  reportEvidenceFiles.value = []
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
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1480px] flex-col items-center pb-20 font-geist">
    <div class="w-full max-w-[1120px] text-left">
      <h1 class="text-[38px] font-bold leading-none text-noble-black sm:text-[44px]">Disputes</h1>
      <p class="mt-3 max-w-[760px] text-base leading-relaxed text-noble-black/60">
        Report transaction issues, follow dispute updates, and submit appeals when a recent rejected
        decision is still eligible for review.
      </p>
    </div>

    <div class="mt-10 w-full max-w-[1120px] border-b border-cinnamon-ice/80">
      <div class="flex w-full max-w-[780px] items-end gap-8 sm:gap-12">
        <button
          v-for="tab in disputeTabs"
          :key="tab.id"
          type="button"
          class="relative pb-3 text-sm font-semibold transition-colors"
          :class="
            activeTab === tab.id
              ? 'text-burning-orange'
              : 'text-noble-black/60 hover:text-noble-black'
          "
          @click="setActiveTab(tab.id)"
        >
          {{ tab.label }}
          <span
            v-if="activeTab === tab.id"
            class="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-burning-orange"
          ></span>
        </button>
      </div>
    </div>

    <p
      v-if="actionSuccessMessage"
      class="mb-6 w-full max-w-[1120px] rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-left text-sm text-green-700"
    >
      {{ actionSuccessMessage }}
    </p>
    <p
      v-if="actionErrorMessage"
      class="mb-6 w-full max-w-[1120px] rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-600"
    >
      {{ actionErrorMessage }}
    </p>

    <template v-if="activeTab === 'report'">
      <section class="mt-6 w-full max-w-[1120px] text-left">
        <div>
          <h2 class="text-[42px] font-bold leading-none text-noble-black sm:text-[48px]">
            Report an Issue
          </h2>
          <p class="mt-3 text-base text-noble-black/60">
            Submit details about a problematic transaction for our moderation team to review.
          </p>
        </div>

        <div
          v-if="requestedTransactionUnavailable"
          class="mt-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
        >
          The selected transaction is no longer eligible to report. Only transactions completed
          within the last 15 days can be reported here.
        </div>

        <div v-if="reportablePending" class="grid gap-4 lg:grid-cols-2">
          <div
            v-for="index in 6"
            :key="index"
            class="h-24 animate-pulse rounded-3xl bg-white/80"
          ></div>
        </div>

        <div
          v-else-if="!reportableTransactions.length"
          class="rounded-3xl border border-dashed border-cinnamon-ice bg-white px-6 py-14 text-center"
        >
          <p class="text-xl font-bold text-noble-black">No reportable transactions</p>
          <p class="mt-2 text-sm text-noble-black/60">
            Transactions become reportable only after they are completed, and only for the next 15
            days.
          </p>
        </div>

        <div v-else class="mt-12 space-y-12">
          <div>
            <h3 class="text-[30px] font-bold text-noble-black">Issue Type</h3>
            <div class="mt-6 flex flex-wrap gap-3">
              <button
                v-for="issueType in issueTypes"
                :key="issueType.value"
                type="button"
                class="rounded-full px-5 py-3 text-sm font-semibold transition-colors"
                :class="
                  selectedIssueType === issueType.value
                    ? 'bg-burning-orange text-white shadow-[0_10px_30px_rgba(255,113,36,0.24)]'
                    : 'bg-pale-cashmere text-noble-black/80 hover:bg-cinnamon-ice/50'
                "
                @click="selectedIssueType = issueType.value"
              >
                {{ issueType.label }}
              </button>
            </div>
          </div>

          <div class="rounded-[32px] bg-pale-cashmere/45 px-6 py-7 sm:px-7 sm:py-8">
            <h3 class="text-[34px] font-bold text-noble-black">Transaction Details</h3>

            <div class="mt-8 space-y-6">
              <div>
                <label
                  class="mb-3 block text-xs font-bold uppercase tracking-[0.1em] text-noble-black/45"
                >
                  Which transaction is this related to?
                </label>
                <select
                  v-model="selectedTransactionId"
                  :disabled="isTransactionLocked"
                  class="w-full rounded-2xl border border-white bg-white px-4 py-4 text-sm text-noble-black outline-none transition-colors focus:border-burning-orange disabled:cursor-not-allowed disabled:bg-white"
                >
                  <option
                    v-for="transaction in reportableTransactions"
                    :key="transaction.transactionId"
                    :value="transaction.transactionId"
                  >
                    {{ transaction.transactionReference }} • {{ transaction.item.name }}
                  </option>
                </select>
                <p v-if="isTransactionLocked" class="mt-2 text-xs text-noble-black/45">
                  This report came from a specific transaction, so it has already been selected.
                </p>
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    class="mb-3 block text-xs font-bold uppercase tracking-[0.1em] text-noble-black/45"
                  >
                    Item Name
                  </label>
                  <input
                    :value="selectedTransaction?.item.name ?? ''"
                    type="text"
                    readonly
                    placeholder="Item name"
                    class="w-full rounded-2xl border border-white bg-white px-4 py-4 text-sm text-noble-black/75"
                  />
                </div>

                <div>
                  <label
                    class="mb-3 block text-xs font-bold uppercase tracking-[0.1em] text-noble-black/45"
                  >
                    Other Party
                  </label>
                  <input
                    :value="selectedTransaction?.counterpartName ?? ''"
                    type="text"
                    readonly
                    placeholder="Other party"
                    class="w-full rounded-2xl border border-white bg-white px-4 py-4 text-sm text-noble-black/75"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 class="text-[30px] font-bold text-noble-black">Requested Resolution</h3>
            <select
              v-model="selectedResolution"
              class="mt-5 w-full rounded-2xl border border-cinnamon-ice/60 bg-white px-4 py-4 text-sm text-noble-black outline-none transition-colors focus:border-burning-orange"
            >
              <option v-for="option in resolutionOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>

            <div
              class="mt-5 rounded-2xl border-l-[4px] border-burning-orange bg-pale-cashmere/75 px-5 py-4"
            >
              <p class="text-sm font-bold text-burning-orange">Tip</p>
              <p class="mt-1 text-sm leading-relaxed text-noble-black/60">
                Providing clear photo evidence significantly speeds up the review process.
              </p>
            </div>
          </div>

          <div>
            <h3 class="text-[30px] font-bold text-noble-black">Summary</h3>
            <p class="mt-3 text-sm text-noble-black/60">
              Please describe the issue in detail. What happened and when?
            </p>
            <textarea
              v-model="reportSummary"
              rows="7"
              maxlength="1600"
              placeholder="Provide context..."
              class="mt-5 w-full rounded-2xl border border-cinnamon-ice/60 bg-white px-4 py-4 text-sm text-noble-black outline-none transition-colors focus:border-burning-orange"
            ></textarea>

            <input
              ref="reportFileInput"
              type="file"
              accept=".png,.jpg,.jpeg,.pdf"
              multiple
              class="hidden"
              @change="handleReportFileChange"
            />

            <div
              v-if="reportEvidenceFiles.length"
              class="mt-4 rounded-2xl bg-pale-cashmere/65 px-4 py-3 text-sm text-noble-black/60"
            >
              {{ reportEvidenceFiles.join(", ") }}
            </div>

            <button
              type="button"
              class="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-burning-orange transition-colors hover:text-cinnabar-red"
              @click="openReportFilePicker"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              Add file
            </button>

            <div
              class="mt-10 flex flex-col gap-4 border-t border-cinnamon-ice/80 pt-8 sm:flex-row sm:items-center sm:justify-between"
            >
              <p class="text-xs text-noble-black/35">False reports may lead to account action.</p>

              <button
                type="button"
                :disabled="isSubmittingReport"
                class="rounded-full bg-burning-orange px-8 py-4 text-sm font-bold text-white shadow-[0_12px_28px_rgba(255,113,36,0.28)] transition-colors hover:bg-cinnabar-red disabled:opacity-50"
                @click="submitReport"
              >
                {{ isSubmittingReport ? "Submitting..." : "Submit report" }}
              </button>
            </div>
          </div>
        </div>
      </section>
    </template>

    <template v-else-if="activeTab === 'disputes'">
      <section
        class="mt-6 w-full max-w-[1120px] rounded-[32px] border border-cinnamon-ice bg-cream p-6 text-left sm:p-8"
      >
        <div class="mb-6">
          <h2 class="text-[36px] font-bold text-noble-black">Your Disputes</h2>
          <p class="mt-2 text-sm text-noble-black/60">
            Review the status of your submitted concerns and any opened disputes.
          </p>
        </div>

        <div v-if="disputesPending" class="space-y-3">
          <div
            v-for="index in 3"
            :key="index"
            class="h-24 animate-pulse rounded-3xl bg-white/80"
          ></div>
        </div>

        <div
          v-else-if="!myDisputes.length"
          class="rounded-3xl border border-dashed border-cinnamon-ice bg-white px-6 py-14 text-center"
        >
          <p class="text-xl font-bold text-noble-black">No disputes yet</p>
          <p class="mt-2 text-sm text-noble-black/60">
            Submitted concerns and dispute updates will appear here.
          </p>
        </div>

        <div v-else class="space-y-3">
          <article
            v-for="dispute in myDisputes"
            :key="dispute.id"
            class="rounded-3xl border border-cinnamon-ice bg-white px-5 py-4 shadow-sm"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-lg font-bold text-blue-estate">
                    {{ dispute.transactionReference }}
                  </p>
                  <span
                    class="inline-flex rounded-full px-3 py-1 text-xs font-bold"
                    :class="statusClasses(dispute.status)"
                  >
                    {{ statusLabel(dispute.status) }}
                  </span>
                </div>

                <p class="mt-2 text-sm font-semibold text-noble-black">
                  {{ dispute.item?.name ?? "Removed item" }} • with {{ dispute.counterpartName }}
                </p>
                <p class="mt-1 text-xs text-noble-black/55">
                  {{ dispute.reason }}
                </p>
              </div>

              <div class="text-right text-xs text-noble-black/45">
                <p>{{ formatDate(dispute.createdAt) }}</p>
                <p class="mt-2">
                  {{ dispute.viewerRole ? dispute.viewerRole.toLowerCase() : "participant" }}
                </p>
              </div>
            </div>

            <p
              v-if="dispute.description"
              class="mt-4 line-clamp-2 text-sm leading-relaxed text-noble-black/65"
            >
              {{ dispute.description }}
            </p>
          </article>
        </div>

        <div class="mt-8 flex justify-end">
          <button
            type="button"
            :disabled="!recentAppealableDisputes.length"
            class="rounded-full bg-burning-orange px-8 py-4 text-sm font-bold text-white shadow-[0_12px_28px_rgba(255,113,36,0.28)] transition-colors hover:bg-cinnabar-red disabled:cursor-not-allowed disabled:opacity-40"
            @click="setActiveTab('appeals')"
          >
            Appeal a decision
          </button>
        </div>
      </section>
    </template>

    <template v-else>
      <section
        class="mt-6 w-full max-w-[1120px] rounded-[32px] border border-cinnamon-ice bg-cream p-6 text-left sm:p-8"
      >
        <div class="mb-6">
          <h2 class="text-[36px] font-bold text-noble-black">Appeal a Dispute Decision</h2>
          <p class="mt-2 text-sm text-noble-black/60">
            Appeals are only available for disputes marked “Appeal available”.
          </p>
        </div>

        <div
          v-if="!recentAppealableDisputes.length"
          class="rounded-3xl border border-dashed border-cinnamon-ice bg-white px-6 py-14 text-center"
        >
          <p class="text-xl font-bold text-noble-black">No appeal-ready disputes</p>
          <p class="mt-2 text-sm text-noble-black/60">
            Recent rejected disputes will appear here when they are still eligible for appeal.
          </p>
        </div>

        <div v-else class="space-y-8">
          <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div>
              <label class="block text-base font-bold text-noble-black">Dispute ID</label>
              <select
                v-model="selectedAppealDisputeId"
                class="mt-3 w-full rounded-2xl border border-cinnamon-ice/60 bg-white px-4 py-4 text-sm text-noble-black outline-none transition-colors focus:border-burning-orange"
              >
                <option
                  v-for="dispute in recentAppealableDisputes"
                  :key="dispute.id"
                  :value="dispute.id"
                >
                  {{ dispute.transactionReference }} • {{ dispute.item?.name ?? "Removed item" }}
                </option>
              </select>
              <p class="mt-2 text-xs text-noble-black/45">
                Tip: Choose from your recent disputes list.
              </p>
            </div>

            <div>
              <label class="block text-base font-bold text-noble-black">Evidence (optional)</label>
              <input
                ref="appealFileInput"
                type="file"
                accept=".png,.jpg,.jpeg,.pdf"
                multiple
                class="hidden"
                @change="handleAppealFileChange"
              />
              <div class="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  class="inline-flex min-w-[104px] items-center justify-center rounded-full border border-cinnamon-ice bg-white px-5 py-2.5 text-sm font-bold text-noble-black transition-colors hover:border-burning-orange/40"
                  @click="openAppealFilePicker"
                >
                  Add file
                </button>
                <span class="text-xs text-noble-black/45">Upload .png, .jpeg, .pdf</span>
              </div>
            </div>
          </div>

          <div
            v-if="appealEvidenceFiles.length"
            class="rounded-2xl bg-white px-4 py-3 text-sm text-noble-black/60"
          >
            {{ appealEvidenceFiles.join(", ") }}
          </div>

          <div>
            <label class="block text-base font-bold text-noble-black">Appeal Reason</label>
            <textarea
              v-model="appealReason"
              rows="6"
              maxlength="2000"
              placeholder="Explain why the decision should be reconsidered. Reference evidence and timeline."
              class="mt-3 w-full rounded-2xl border border-cinnamon-ice/60 bg-white px-4 py-4 text-sm text-noble-black outline-none transition-colors focus:border-burning-orange"
            ></textarea>
          </div>

          <div class="flex items-end justify-between gap-4 border-t border-cinnamon-ice/80 pt-6">
            <p class="text-xs text-noble-black/35">Appeals are final after review.</p>
            <button
              type="button"
              :disabled="isSubmittingAppeal"
              class="rounded-full bg-burning-orange px-8 py-4 text-sm font-bold text-white shadow-[0_12px_28px_rgba(255,113,36,0.28)] transition-colors hover:bg-cinnabar-red disabled:opacity-50"
              @click="submitAppeal"
            >
              {{ isSubmittingAppeal ? "Submitting..." : "Submit appeal" }}
            </button>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
