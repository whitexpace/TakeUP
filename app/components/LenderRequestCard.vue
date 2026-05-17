<script setup lang="ts">
import { computed, ref } from "vue"
import type { LenderItemRequest } from "../composables/use-lender-item-requests"
import {
  clearPrefetchedBookingDetail,
  useBookingDetailPrefetch,
} from "../composables/use-booking-detail-prefetch"

const props = defineProps<{
  request: LenderItemRequest
}>()

const emit = defineEmits<{
  refresh: []
}>()

const _router = useRouter()
const { warmBookingDetail } = useBookingDetailPrefetch()

const borrowerName = computed(() => {
  const user = props.request.borrower.user
  const first = (user.firstName || "").trim()
  const last = (user.lastName || "").trim()
  if (!first && !last) return "Former user"
  const displayFirst = first ? first.charAt(0).toUpperCase() + first.slice(1) : "Former user"
  const isGenericLast = /^user$/i.test(last) || !last
  if (isGenericLast) return displayFirst
  return `${displayFirst} ${last.charAt(0).toUpperCase()}.`
})

const detailPath = computed(() => `/account/transactions/${props.request.id}`)

const shortId = computed(() => props.request.id.slice(0, 12).toUpperCase())

const formatDate = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

const startDateLabel = computed(() => formatDate(props.request.startDate))
const endDateLabel = computed(() => formatDate(props.request.endDate))

const computeDuration = (startDate: Date | string, endDate: Date | string): string => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  if (totalDays <= 1) return "1 day"
  if (totalDays < 7) return `${totalDays} days`
  const weeks = Math.floor(totalDays / 7)
  const remainingDays = totalDays % 7
  if (remainingDays === 0) return weeks === 1 ? "1 week" : `${weeks} weeks`
  const weekPart = weeks === 1 ? "1 week" : `${weeks} weeks`
  const dayPart = remainingDays === 1 ? "1 day" : `${remainingDays} days`
  return `${weekPart} and ${dayPart}`
}

const duration = computed(() => computeDuration(props.request.startDate, props.request.endDate))

const badgeClass = computed(() => {
  switch (props.request.requestStatus) {
    case "PENDING":
      return "bg-burning-orange/[0.08] text-burning-orange border-burning-orange/20"
    case "APPROVED":
      return "bg-blue-estate/[0.08] text-blue-estate border-blue-estate/20"
    case "REJECTED":
      return "bg-cinnabar-red/[0.08] text-cinnabar-red border-cinnabar-red/20"
    default:
      return "bg-gray-100 text-gray-500 border-gray-200"
  }
})

const formatPeso = (value: number) =>
  `₱${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(value)}`

const rateLabel = computed(() => {
  if (props.request.item.freeToBorrow) return "Free"
  const unit = props.request.item.rateOption === "PER_HOUR" ? "/hour" : "/day"
  return `${formatPeso(props.request.item.rentalFee)}${unit}`
})

const totalLabel = computed(() =>
  props.request.item.freeToBorrow ? "₱0" : formatPeso(props.request.totalFee),
)

const actingBookingId = ref<string | null>(null)
const actingStatus = ref<"CONFIRMED" | "CANCELLED" | null>(null)
const actionError = ref<string | null>(null)

const handleBookingDecision = async (nextStatus: Extract<"CONFIRMED" | "CANCELLED", string>) => {
  if (actingBookingId.value) return

  actingBookingId.value = props.request.id
  actingStatus.value = nextStatus
  actionError.value = null

  try {
    await $fetch(`/api/bookings/${props.request.id}`, {
      method: "PATCH",
      body: { status: nextStatus },
    })

    clearPrefetchedBookingDetail(props.request.id)
    emit("refresh")
  } catch (err: unknown) {
    const fetchError = err as {
      data?: { statusMessage?: string; error?: { message?: string } }
      statusMessage?: string
      message?: string
    }

    actionError.value =
      fetchError.data?.statusMessage ??
      fetchError.data?.error?.message ??
      fetchError.statusMessage ??
      fetchError.message ??
      "Unable to update this booking request."
  } finally {
    actingBookingId.value = null
    actingStatus.value = null
  }
}

const warmOrderDetails = () => {
  void warmBookingDetail(detailPath.value, { priority: true }).catch(() => {})
}

const warmOrderDetailsImmediately = () => {
  void warmBookingDetail(detailPath.value, { immediate: true, priority: true }).catch(() => {})
}
</script>

<template>
  <div
    class="block bg-white rounded-[16px] border border-cinnamon-ice/20 overflow-hidden font-geist shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] transition-all duration-200 cursor-pointer group/card"
    @pointerenter="warmOrderDetails"
    @mousedown="warmOrderDetailsImmediately"
    @touchstart.passive="warmOrderDetails"
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between px-5 py-3 border-b border-cinnamon-ice/15 bg-white/50"
    >
      <span class="text-noble-black text-[14px] font-semibold">{{ borrowerName }}</span>

      <span
        class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] shrink-0 border"
        :class="badgeClass"
      >
        {{ request.requestStatusLabel }}
      </span>
    </div>

    <!-- Body -->
    <div class="p-5 flex items-center gap-4 relative">
      <!-- Thumbnail -->
      <div class="relative shrink-0">
        <img
          v-if="request.item.thumbnailImage"
          :src="request.item.thumbnailImage"
          :alt="request.item.name"
          class="w-16 h-16 object-cover rounded-[10px] border border-gray-100"
        />
        <div
          v-else
          class="w-16 h-16 bg-cinnamon-ice/10 rounded-[10px] border border-gray-100 flex items-center justify-center"
        >
          <svg
            class="w-6 h-6 text-cinnamon-ice/40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      </div>

      <!-- Item Details -->
      <div class="flex-1 min-w-0">
        <NuxtLink
          :to="detailPath"
          :prefetch-on="{ interaction: true }"
          class="block"
          @focus="warmOrderDetails"
          @click.stop
        >
          <h4
            class="text-noble-black text-[15px] font-bold truncate leading-tight mb-1 group-hover/card:underline"
          >
            {{ request.item.name }}
          </h4>
        </NuxtLink>
        <div
          class="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium leading-none mb-3"
        >
          <span class="font-mono tracking-wider">{{ shortId }}</span>
          <span class="opacity-50 select-none">·</span>
          <span>{{ startDateLabel }} to {{ endDateLabel }}</span>
          <span class="opacity-50 select-none">·</span>
          <span>{{ duration }}</span>
        </div>

        <!-- Action buttons -->
        <div v-if="request.status === 'PENDING'" class="flex flex-wrap gap-2 relative z-10">
          <button
            class="px-4 py-1.5 rounded-[8px] bg-white border border-burning-orange text-[12px] font-bold text-burning-orange hover:bg-burning-orange/5 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="actingBookingId === request.id"
            @click.stop="handleBookingDecision('CANCELLED')"
          >
            {{ actingStatus === "CANCELLED" ? "Declining..." : "Decline" }}
          </button>
          <button
            class="px-4 py-1.5 rounded-[8px] bg-burning-orange text-white text-[12px] font-bold hover:brightness-110 transition-all shadow-sm shadow-burning-orange/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="actingBookingId === request.id"
            @click.stop="handleBookingDecision('CONFIRMED')"
          >
            {{ actingStatus === "CONFIRMED" ? "Accepting..." : "Accept Request" }}
          </button>
        </div>

        <!-- Error message -->
        <div v-if="actionError" class="mt-2 text-[12px] text-cinnabar-red">
          {{ actionError }}
        </div>
      </div>

      <!-- Pricing Info -->
      <div class="shrink-0 z-10 text-right self-start">
        <div class="flex flex-col items-end">
          <p class="text-[13px] text-gray-400 font-medium leading-none mb-1.5">{{ rateLabel }}</p>
          <div class="flex items-baseline gap-1.5">
            <span class="text-[11px] text-[#9CA3AF] font-bold uppercase tracking-wider">
              Total:
            </span>
            <span class="text-[16px] font-bold text-burning-orange leading-none">
              {{ totalLabel }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
