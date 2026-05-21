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
      class="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-3 border-b border-cinnamon-ice/15 bg-white/50"
    >
      <span class="text-noble-black text-[13px] sm:text-[14px] font-semibold truncate">{{
        borrowerName
      }}</span>

      <span
        class="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shrink-0 border shadow-sm scale-90 origin-right sm:scale-100"
        :class="badgeClass"
      >
        {{ request.requestStatusLabel }}
      </span>
    </div>

    <!-- Body -->
    <div class="p-3 sm:p-5 flex items-center gap-3 sm:gap-4 relative">
      <!-- Thumbnail -->
      <div class="shrink-0">
        <img
          v-if="request.item.thumbnailImage"
          :src="request.item.thumbnailImage"
          :alt="request.item.name"
          class="w-11 h-11 sm:w-16 sm:h-16 object-cover rounded-lg border border-gray-100"
        />
        <div
          v-else
          class="w-11 h-11 sm:w-16 sm:h-16 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100"
        >
          <Icon name="ph:image" class="w-5 h-5 text-gray-300" />
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
            class="text-noble-black text-[14px] sm:text-[15px] font-bold truncate leading-tight group-hover/card:underline"
          >
            {{ request.item.name }}
          </h4>
        </NuxtLink>
        <div
          class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-[11px] text-noble-black/40 font-medium"
        >
          <span class="font-mono text-noble-black/25">{{ shortId }}</span>
          <span class="hidden xs:inline text-noble-black/10">|</span>
          <span>{{ startDateLabel }} to {{ endDateLabel }}</span>
          <span class="hidden sm:inline text-noble-black/10">|</span>
          <span class="hidden sm:inline">{{ duration }}</span>
        </div>

        <!-- Action buttons (For Pending Requests) -->
        <div v-if="request.status === 'PENDING'" class="mt-2 flex gap-2 relative z-10">
          <button
            class="px-3 py-1 rounded-lg bg-white border border-burning-orange text-[11px] font-bold text-burning-orange hover:bg-burning-orange/5 transition-all active:scale-95 disabled:opacity-50"
            :disabled="actingBookingId === request.id"
            @click.stop="handleBookingDecision('CANCELLED')"
          >
            {{ actingStatus === "CANCELLED" ? "Declining..." : "Decline" }}
          </button>
          <button
            class="px-3 py-1 rounded-lg bg-burning-orange text-white text-[11px] font-bold hover:brightness-110 shadow-sm transition-all active:scale-95 disabled:opacity-50"
            :disabled="actingBookingId === request.id"
            @click.stop="handleBookingDecision('CONFIRMED')"
          >
            {{ actingStatus === "CONFIRMED" ? "Accepting..." : "Accept" }}
          </button>
        </div>
        <div v-else-if="request.status === 'CONFIRMED'" class="flex flex-wrap gap-2 relative z-10">
          <NuxtLink
            :to="detailPath"
            :prefetch-on="{ interaction: true }"
            class="inline-flex items-center gap-1.5 rounded-[8px] bg-burning-orange px-4 py-1.5 text-[12px] font-bold text-white shadow-sm shadow-burning-orange/20 transition-all hover:brightness-110 active:scale-95"
            @focus="warmOrderDetails"
            @click.stop
          >
            <Icon name="ph:receipt" class="h-3.5 w-3.5 shrink-0" />
            <span>Order Details</span>
          </NuxtLink>
        </div>

        <!-- Error message -->
        <div v-if="actionError" class="mt-1 text-[10px] font-bold text-cinnabar-red truncate">
          {{ actionError }}
        </div>
      </div>

      <!-- Pricing Info -->
      <div class="shrink-0 text-right">
        <p class="text-[10px] sm:text-[12px] text-noble-black/30 font-medium leading-none mb-1">
          {{ rateLabel }}
        </p>
        <div class="flex items-center justify-end gap-1">
          <span class="text-[9px] text-noble-black/20 font-bold uppercase tracking-tight"
            >Total</span
          >
          <p class="text-[14px] sm:text-[16px] font-extrabold text-burning-orange leading-none">
            {{ totalLabel }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
