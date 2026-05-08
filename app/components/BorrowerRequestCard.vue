<script setup lang="ts">
import type { BorrowerItemRequest } from "../composables/use-borrower-item-requests"

const props = defineProps<{
  request: BorrowerItemRequest
}>()

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

const formatDate = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

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
</script>

<template>
  <NuxtLink
    :to="detailPath"
    class="block overflow-hidden rounded-[16px] border border-cinnamon-ice/20 bg-white font-geist shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 cursor-pointer hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] group/card"
  >
    <div class="border-b border-[#F3F0EB] bg-white/50 px-5 py-3">
      <div class="flex items-center justify-between">
        <span class="text-noble-black text-[14px] font-semibold">{{ lenderName }}</span>
        <span
          class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold font-geist uppercase tracking-[0.1em] shrink-0 border"
          :class="badgeClass"
        >
          {{ request.requestStatusLabel }}
        </span>
      </div>
    </div>

    <div class="p-5 flex items-center gap-4 relative">
      <div class="relative shrink-0">
        <img
          v-if="request.item.thumbnailImage"
          :src="request.item.thumbnailImage"
          :alt="request.item.name"
          class="w-16 h-16 object-cover rounded-[10px] border border-gray-100"
        />
        <div
          v-else
          class="w-16 h-16 bg-cinnamon-ice/10 rounded-[10px] border border-gray-100 flex items-center justify-center shrink-0"
        >
          <Icon name="ph:image-light" class="w-6 h-6 text-cinnamon-ice/40" />
        </div>
      </div>

      <div class="flex-1 min-w-0">
        <h4 class="text-noble-black text-[15px] font-bold truncate leading-tight mb-1">
          {{ request.item.name }}
        </h4>
        <div
          class="flex flex-wrap items-center gap-1.5 text-[10px] text-[#B0B0B0] font-medium leading-none"
        >
          <span class="font-mono tracking-wider">{{ shortId }}</span>
          <span class="opacity-50 select-none">·</span>
          <span>{{ dateRange }}</span>
          <span class="opacity-50 select-none">·</span>
          <span>{{ timeRange }}</span>
          <span class="opacity-50 select-none">·</span>
          <span>{{ duration }}</span>
        </div>
      </div>

      <div class="shrink-0 z-10 text-right">
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
  </NuxtLink>
</template>
