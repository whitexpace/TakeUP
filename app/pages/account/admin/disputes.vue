<script setup lang="ts">
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../../../server/trpc/routers"

definePageMeta({
  layout: "account",
  middleware: "account-auth",
})

type RouterOutputs = inferRouterOutputs<AppRouter>
type AdminDisputeDetail = RouterOutputs["dispute"]["byId"]
type AuthMeResponse = {
  user: {
    id: string
    accountType: string | null
  }
}

const route = useRoute()
const router = useRouter()

const formatDateTime = (date: Date | string) =>
  new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

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
    case "RESOLVED":
      return "bg-green-100 text-green-700 border border-green-200"
  }
}

const { data: authData, error: authError } = await useAsyncData("account:auth-admin-queue", () =>
  $fetch<AuthMeResponse>("/api/auth/me"),
)

if (authError.value) {
  throw authError.value
}

if (authData.value?.user.accountType !== "ADMIN") {
  throw createError({
    statusCode: 403,
    statusMessage: "Only admins can access the dispute queue.",
  })
}

const {
  data: queueData,
  pending,
  error,
  refresh,
} = await useAsyncData("admin:disputes", () =>
  $fetch<RouterOutputs["dispute"]["list"]>("/api/disputes", {
    query: { status: "SUBMITTED" },
  }),
)

if (error.value) {
  throw error.value
}

const selectedDisputeId = ref<string | null>(
  typeof route.query.dispute === "string"
    ? route.query.dispute
    : (queueData.value?.disputes[0]?.id ?? null),
)
const selectedDispute = ref<AdminDisputeDetail | null>(null)
const detailPending = ref(false)
const actionErrorMessage = ref("")
const actionSuccessMessage = ref("")
const isReviewing = ref(false)

const queue = computed(() => queueData.value?.disputes ?? [])

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

watch(selectedDisputeId, async (id) => {
  const query = id ? { dispute: id } : {}
  if (route.query.dispute !== id) {
    await router.replace({ query })
  }

  if (!id) {
    selectedDispute.value = null
    return
  }

  detailPending.value = true

  try {
    selectedDispute.value = await $fetch<AdminDisputeDetail>(`/api/disputes/${id}`)
  } finally {
    detailPending.value = false
  }
})

const reviewDispute = async (decision: "APPROVE" | "REJECT") => {
  if (!selectedDisputeId.value) return

  isReviewing.value = true
  actionErrorMessage.value = ""
  actionSuccessMessage.value = ""

  try {
    await $fetch(`/api/disputes/${selectedDisputeId.value}/review`, {
      method: "PATCH",
      body: { decision },
    })

    actionSuccessMessage.value =
      decision === "APPROVE"
        ? "The dispute request was approved and opened."
        : "The dispute request was rejected."

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

    actionErrorMessage.value =
      errorData?.error?.message ??
      errorData?.statusMessage ??
      "Unable to review this dispute right now."
  } finally {
    isReviewing.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-[1280px] pb-20 font-geist">
    <div class="mb-8">
      <h1 class="text-[28px] font-bold text-noble-black">Dispute Queue</h1>
      <p class="mt-2 max-w-2xl text-sm text-noble-black/60">
        Review submitted concern reports and decide which ones should become formal disputes.
      </p>
    </div>

    <p
      v-if="actionSuccessMessage"
      class="mb-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
    >
      {{ actionSuccessMessage }}
    </p>
    <p
      v-if="actionErrorMessage"
      class="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
    >
      {{ actionErrorMessage }}
    </p>

    <div class="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section class="rounded-[30px] border border-cinnamon-ice bg-cream p-5">
        <p class="text-xs font-bold uppercase tracking-[0.14em] text-noble-black/35">Queue</p>
        <h2 class="mt-2 text-xl font-bold text-noble-black">
          {{ queue.length }} {{ queue.length === 1 ? "submitted dispute" : "submitted disputes" }}
        </h2>

        <div v-if="pending" class="mt-5 space-y-3">
          <div
            v-for="index in 3"
            :key="index"
            class="h-28 animate-pulse rounded-3xl bg-white/80"
          ></div>
        </div>

        <div
          v-else-if="!queue.length"
          class="mt-5 rounded-3xl border border-dashed border-cinnamon-ice bg-white px-5 py-12 text-center"
        >
          <p class="text-lg font-bold text-noble-black">No pending disputes</p>
          <p class="mt-2 text-sm text-noble-black/60">New submitted concerns will appear here.</p>
        </div>

        <div v-else class="mt-5 space-y-3">
          <button
            v-for="dispute in queue"
            :key="dispute.id"
            class="w-full rounded-3xl border p-4 text-left transition-colors"
            :class="
              selectedDisputeId === dispute.id
                ? 'border-burning-orange bg-white shadow-sm'
                : 'border-transparent bg-white/80 hover:border-cinnamon-ice'
            "
            @click="selectedDisputeId = dispute.id"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs font-bold uppercase tracking-[0.14em] text-noble-black/35">
                  {{ dispute.transactionReference }}
                </p>
                <p class="mt-1 text-base font-bold text-noble-black">
                  {{ dispute.item?.name ?? "Removed item" }}
                </p>
              </div>
              <span
                class="inline-flex rounded-full px-3 py-1 text-xs font-bold"
                :class="statusClasses(dispute.status)"
              >
                {{ dispute.status }}
              </span>
            </div>

            <p class="mt-3 text-sm font-semibold text-noble-black">{{ dispute.reason }}</p>
            <p class="mt-2 text-xs text-noble-black/45">
              Submitted {{ formatDateTime(dispute.createdAt) }}
            </p>
          </button>
        </div>
      </section>

      <section class="rounded-[30px] border border-cinnamon-ice bg-white p-6 shadow-sm">
        <div v-if="detailPending" class="space-y-4">
          <div class="h-8 w-44 animate-pulse rounded-xl bg-cream"></div>
          <div class="h-40 animate-pulse rounded-3xl bg-cream"></div>
          <div class="h-24 animate-pulse rounded-3xl bg-cream"></div>
        </div>

        <div
          v-else-if="!selectedDispute"
          class="flex min-h-[420px] items-center justify-center rounded-3xl bg-cream text-center"
        >
          <div>
            <p class="text-xl font-bold text-noble-black">Select a submitted dispute</p>
            <p class="mt-2 text-sm text-noble-black/60">
              The selected concern details will appear here.
            </p>
          </div>
        </div>

        <div v-else class="space-y-6">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p class="text-xs font-bold uppercase tracking-[0.14em] text-noble-black/35">
                Transaction
              </p>
              <h2 class="mt-1 text-2xl font-bold text-noble-black">
                {{ selectedDispute.transactionReference }}
              </h2>
              <p class="mt-2 text-sm text-noble-black/60">
                Submitted {{ formatDateTime(selectedDispute.createdAt) }}
              </p>
            </div>
            <span
              class="inline-flex w-fit rounded-full px-4 py-2 text-sm font-bold"
              :class="statusClasses(selectedDispute.status)"
            >
              {{ selectedDispute.status }}
            </span>
          </div>

          <div class="grid gap-4 lg:grid-cols-2">
            <div class="rounded-3xl bg-cream p-5">
              <p class="text-xs font-bold uppercase tracking-[0.14em] text-noble-black/35">
                Users involved
              </p>
              <div class="mt-4 space-y-4">
                <div>
                  <p class="text-sm font-bold text-noble-black">Borrower</p>
                  <p class="mt-1 text-sm text-noble-black/70">
                    {{ selectedDispute.participants.borrower?.displayName ?? "Former user" }}
                  </p>
                </div>
                <div>
                  <p class="text-sm font-bold text-noble-black">Lender</p>
                  <p class="mt-1 text-sm text-noble-black/70">
                    {{ selectedDispute.participants.lender?.displayName ?? "Former user" }}
                  </p>
                </div>
              </div>
            </div>

            <div class="rounded-3xl bg-cream p-5">
              <p class="text-xs font-bold uppercase tracking-[0.14em] text-noble-black/35">
                Concern summary
              </p>
              <p class="mt-4 text-lg font-bold text-noble-black">{{ selectedDispute.reason }}</p>
              <p class="mt-2 text-sm text-noble-black/60">
                Raised by {{ selectedDispute.raisedBy?.displayName ?? "Former user" }}
              </p>
            </div>
          </div>

          <div class="rounded-3xl border border-cinnamon-ice bg-cream/60 p-5">
            <p class="text-xs font-bold uppercase tracking-[0.14em] text-noble-black/35">
              Description
            </p>
            <p class="mt-3 whitespace-pre-line text-sm leading-relaxed text-noble-black/75">
              {{ selectedDispute.description || "No additional details were provided." }}
            </p>
          </div>

          <div class="flex flex-col gap-3 sm:flex-row">
            <button
              :disabled="isReviewing || !selectedDispute.canReview"
              class="flex-1 rounded-2xl bg-cinnabar-red px-6 py-4 font-bold text-white transition-colors hover:bg-cinnabar-red/90 disabled:opacity-50"
              @click="reviewDispute('APPROVE')"
            >
              {{ isReviewing ? "Processing..." : "Approve & Open Dispute" }}
            </button>
            <button
              :disabled="isReviewing || !selectedDispute.canReview"
              class="flex-1 rounded-2xl border border-cinnamon-ice bg-cream px-6 py-4 font-bold text-noble-black transition-colors hover:bg-pale-cashmere disabled:opacity-50"
              @click="reviewDispute('REJECT')"
            >
              Reject Request
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
