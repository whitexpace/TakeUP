<script setup lang="ts">
import type { BorrowerItemRequest } from "../composables/use-borrower-item-requests"
import { useBookingDetailPrefetch } from "../composables/use-booking-detail-prefetch"

const props = defineProps<{
  request: BorrowerItemRequest
}>()

const { warmBookingDetail } = useBookingDetailPrefetch()

const lenderName = computed(() => {
  const user = props.request.lender.user
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

const formatDate = (date: Date | string) =>
  new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

const formatTime = (value: Date | string) =>
  new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })

const dateRange = computed(() => {
  const start = formatDate(props.request.startDate)
  const end = formatDate(props.request.endDate)
  return start === end ? start : `${start} - ${end}`
})

const timeRange = computed(() => {
  const start = formatTime(props.request.startDate)
  const end = formatTime(props.request.endDate)
  return `${start} – ${end}`
})

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

const warmOrderDetails = () => {
  void warmBookingDetail(detailPath.value, { priority: true }).catch(() => {})
}

const warmOrderDetailsImmediately = () => {
  void warmBookingDetail(detailPath.value, { immediate: true, priority: true }).catch(() => {})
}
</script>

<template>
  <NuxtLink
    :to="detailPath"
    :prefetch-on="{ interaction: true }"
    class="block overflow-hidden rounded-[16px] border border-cinnamon-ice/20 bg-white font-geist shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 cursor-pointer hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] group/card"
    @pointerenter="warmOrderDetails"
    @focus="warmOrderDetails"
    @mousedown="warmOrderDetailsImmediately"
    @touchstart.passive="warmOrderDetails"
  >
    <div class="border-b border-[#F3F0EB] bg-white/50 px-3 sm:px-5 py-2 sm:py-3">
      <div class="flex items-center justify-between gap-3">
        <span class="text-noble-black text-[13px] sm:text-[14px] font-semibold truncate">{{
          lenderName
        }}</span>
        <span
          class="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shrink-0 border shadow-sm scale-90 origin-right sm:scale-100"
          :class="badgeClass"
        >
          {{ request.requestStatusLabel }}
        </span>
      </div>
    </div>

    <div class="p-3 sm:p-5 flex items-center gap-3 sm:gap-4 relative">
      <div class="shrink-0">
        <img
          v-if="request.item.thumbnailImage"
          :src="request.item.thumbnailImage"
          :alt="request.item.name"
          loading="lazy"
          decoding="async"
          class="w-11 h-11 sm:w-16 sm:h-16 object-cover rounded-lg border border-gray-100"
        />
        <div
          v-else
          class="w-11 h-11 sm:w-16 sm:h-16 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100 shrink-0"
        >
          <Icon name="ph:image" class="w-5 h-5 text-gray-300" />
        </div>
      </div>

      <div class="flex-1 min-w-0">
        <h4 class="text-noble-black text-[14px] sm:text-[15px] font-bold truncate leading-tight">
          {{ request.item.name }}
        </h4>
        <div
          class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-[11px] text-noble-black/40 font-medium"
        >
          <span class="font-mono text-noble-black/25">{{ shortId }}</span>
          <span class="hidden xs:inline text-noble-black/10">|</span>
          <span>{{ dateRange }}</span>
          <span class="hidden xs:inline text-noble-black/10">|</span>
          <span>{{ timeRange }}</span>
          <span class="hidden sm:inline text-noble-black/10">|</span>
          <span class="hidden sm:inline">{{ duration }}</span>
        </div>
      </div>

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
  </NuxtLink>
</template>
