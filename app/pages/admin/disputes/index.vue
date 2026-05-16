<script setup lang="ts">
import { computed } from "vue"
import { useRoute, useRouter } from "vue-router"

definePageMeta({
  layout: "admin",
  middleware: "admin-auth",
})

type DisputeListItem = {
  id: string
  status: string
  reason: string
  createdAt: string
  transactionReference: string
  participants: {
    borrower: {
      displayName: string
    } | null
  }
}

const route = useRoute()
const router = useRouter()

const statusFilters: Array<{ value: string; label: string; description: string }> = [
  { value: "ALL", label: "All", description: "All disputes across every status" },
  { value: "SUBMITTED", label: "Submitted", description: "New concerns awaiting intake review" },
  { value: "OPEN", label: "Open", description: "Ready for final resolution" },
  { value: "APPEALED", label: "Appealed", description: "Rejected concerns sent back for review" },
  { value: "REJECTED", label: "Rejected", description: "Concerns not opened as formal disputes" },
  { value: "CLOSED", label: "Closed", description: "Resolved and finalized disputes" },
]

const activeStatus = computed(() => {
  const raw = route.query.status
  return statusFilters.some((filter) => filter.value === raw) ? (raw as string) : "SUBMITTED"
})

const requestFetch = useRequestFetch()
const nuxtApp = useNuxtApp()

// Counts
const { data: countsData } = useLazyAsyncData("admin:dispute:counts", () =>
  requestFetch<Record<string, number>>("/api/disputes/counts"),
)

const statusCount = (status: string): number => {
  if (!countsData.value) return 0
  if (status === "ALL") return Object.values(countsData.value).reduce((a, b) => a + b, 0)
  return countsData.value[status] ?? 0
}

const limit = ref(10)

// Per-tab dispute list
const { data: queueData, pending } = useLazyAsyncData(
  () => `admin:disputes:${activeStatus.value}:${limit.value}`,
  () =>
    requestFetch<{ disputes: unknown[]; hasMore?: boolean }>("/api/disputes", {
      query: {
        status: activeStatus.value === "ALL" ? undefined : activeStatus.value,
        limit: limit.value,
      },
    }),
  {
    watch: [activeStatus, limit],
    getCachedData: (key) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  },
)

const loadMore = () => {
  limit.value += 10
}

const hasMore = computed(() => queueData.value?.hasMore ?? false)
const isLoading = computed(() => pending.value)

const updateStatus = (status: string) => {
  limit.value = 10
  router.push({ query: { ...route.query, status } })
}

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

const queue = computed<DisputeListItem[]>(
  () => (queueData.value?.disputes as DisputeListItem[]) ?? [],
)

const navigateToDetail = (id: string) => {
  navigateTo(`/admin/disputes/${id}`)
}
</script>

<template>
  <div class="font-geist space-y-8">
    <!-- Elegant Executive Header -->
    <header class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-8">
      <div class="space-y-3">
        <div class="space-y-2">
          <h1 class="font-montravia text-[36px] font-medium text-noble-black">Dispute Queue</h1>
          <div class="w-10 h-0.5 bg-burning-orange"></div>
        </div>
        <p class="text-[16px] font-light leading-relaxed text-noble-black/50">
          Review, moderate, and resolve community concerns.
        </p>
      </div>
    </header>

    <!-- Refined Status Tabs -->
    <div class="mb-10 border-b border-cinnamon-ice/15">
      <div class="flex gap-10 overflow-x-auto hide-scrollbar">
        <button
          v-for="filter in statusFilters"
          :key="filter.value"
          type="button"
          class="relative flex items-center gap-3 pb-5 text-[14px] font-bold transition-all group whitespace-nowrap"
          :class="
            activeStatus === filter.value
              ? 'text-burning-orange'
              : 'text-noble-black/30 hover:text-noble-black/60'
          "
          @click="updateStatus(filter.value)"
        >
          {{ filter.label }}
          <span
            class="flex h-5 min-w-[22px] items-center justify-center rounded-full px-2 text-[10px] font-black tracking-tighter transition-colors"
            :class="
              activeStatus === filter.value
                ? 'bg-burning-orange text-white shadow-md shadow-burning-orange/20'
                : 'bg-noble-black/5 text-noble-black/30 group-hover:bg-noble-black/10'
            "
          >
            {{ statusCount(filter.value) }}
          </span>
          <span
            v-if="activeStatus === filter.value"
            class="absolute bottom-0 left-0 h-[3px] w-full bg-burning-orange rounded-t-full"
          ></span>
        </button>
      </div>
    </div>

    <!-- Full Width List -->
    <div
      class="bg-white rounded-[32px] border border-cinnamon-ice/20 shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden"
    >
      <div class="border-b border-gray-100 p-8 bg-white/50 backdrop-blur-md">
        <div class="border-l-[3px] border-burning-orange pl-4">
          <h2 class="text-[20px] font-semibold text-noble-black">Pending Records</h2>
          <p class="mt-0.5 text-[13px] font-light text-noble-black/50">
            Showing {{ queue.length }} matching cases for {{ activeStatus }}
          </p>
        </div>
      </div>

      <div class="min-h-[400px]">
        <div v-if="pending && !queue.length" class="p-8 space-y-6">
          <AdminListRecordSkeleton v-for="index in 4" :key="index" />
        </div>

        <div
          v-else-if="!queue.length"
          class="flex flex-col items-center justify-center py-24 text-center"
        >
          <div
            class="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-noble-black/[0.03] text-noble-black/10"
          >
            <Icon name="ph:tray" class="w-12 h-12" />
          </div>
          <p class="text-[20px] font-bold text-noble-black/30">No matches found</p>
          <p class="mt-2 text-[15px] text-noble-black/40 font-medium max-w-sm mx-auto">
            Change the status filter or wait for new community concerns to be raised.
          </p>
        </div>

        <div v-else class="flex flex-col">
          <div class="max-h-[1000px] overflow-y-auto divide-y divide-gray-100 custom-scrollbar">
            <button
              v-for="dispute in queue"
              :key="dispute.id"
              type="button"
              class="flex w-full h-[100px] items-center px-10 transition-all duration-300 text-left group hover:bg-gray-50"
              @click="navigateToDetail(dispute.id)"
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-4 mb-1">
                  <span
                    class="text-[16px] font-black text-noble-black group-hover:text-burning-orange transition-colors truncate"
                  >
                    {{ dispute.participants.borrower?.displayName || "Unknown User" }}
                  </span>
                  <span
                    class="shrink-0 rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-sm"
                    :class="statusClasses(dispute.status)"
                  >
                    {{ dispute.status }}
                  </span>
                </div>
                <p class="text-[14px] font-medium text-noble-black/40 line-clamp-1">
                  {{ dispute.reason }}
                </p>
              </div>

              <div class="text-right ml-8 shrink-0 space-y-1">
                <p class="text-[12px] font-black text-noble-black/20 font-mono tracking-widest">
                  REF: {{ dispute.transactionReference }}
                </p>
                <p class="text-[11px] font-bold text-noble-black/30 uppercase tracking-tighter">
                  {{ formatDateTime(dispute.createdAt) }}
                </p>
              </div>
            </button>
          </div>

          <!-- Load More Records -->
          <div
            v-if="hasMore || (isLoading && queue.length > 0)"
            class="flex justify-center py-6 border-t border-gray-50"
          >
            <button
              :disabled="isLoading"
              class="text-[13px] font-black uppercase tracking-widest text-noble-black/30 hover:text-burning-orange transition-all disabled:opacity-40"
              @click="loadMore"
            >
              <span v-if="isLoading" class="flex items-center gap-2">
                <Icon name="ph:circle-notch" class="animate-spin w-4 h-4" />
                Loading...
              </span>
              <span v-else>Load More</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
