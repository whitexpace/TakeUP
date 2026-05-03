<script setup lang="ts">
import type { BorrowerItemRequest } from "../composables/use-borrower-item-requests"

const props = defineProps<{
  request: BorrowerItemRequest
}>()

const lenderName = computed(() => {
  const user = props.request.lender.user
  return `${user.firstName} ${user.lastName[0]}.`
})

const detailPath = computed(() => `/account/transactions/${props.request.id}`)

const formatDate = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

const formatDateTime = (value: Date | string) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

const requestedDate = computed(() => formatDate(props.request.requestedAt))

const requestedTimeFrame = computed(() => {
  const start = formatDateTime(props.request.startDate)
  const end = formatDateTime(props.request.endDate)
  return start === end ? start : `${start} to ${end}`
})

const statusBadgeClass = computed(() => {
  switch (props.request.requestStatus) {
    case "PENDING":
      return "bg-burning-orange/[0.08] text-burning-orange border-burning-orange/20"
    case "APPROVED":
      return "bg-success-green/[0.08] text-success-green border-success-green/20"
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
    class="block bg-white rounded-[16px] border border-cinnamon-ice/20 overflow-hidden font-geist shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] transition-all duration-200 cursor-pointer group/card"
  >
    <!-- Top Zone: Slim Header -->
    <div
      class="flex items-center justify-between px-5 py-3 border-b border-cinnamon-ice/15 bg-white/50"
    >
      <div class="flex items-center gap-3">
        <span class="text-noble-black text-[14px] font-semibold">
          {{ lenderName }}
        </span>
      </div>

      <!-- Status Badge -->
      <span
        class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] shrink-0 border"
        :class="statusBadgeClass"
      >
        {{ request.requestStatusLabel }}
      </span>
    </div>

    <!-- Bottom Zone: Item Row -->
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
        <h4 class="text-noble-black text-[15px] font-bold truncate leading-tight mb-1">
          {{ request.item.name }}
        </h4>
        <div
          class="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400 font-medium leading-none"
        >
          <span class="font-mono tracking-wider">{{ request.id.slice(0, 12).toUpperCase() }}</span>
          <span class="opacity-50 select-none">·</span>
          <span>Requested {{ requestedDate }}</span>
        </div>
      </div>

      <!-- Pricing / Extra Info -->
      <div class="shrink-0 z-10 text-right">
        <div class="flex flex-col items-end">
          <p class="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">
            Time frame
          </p>
          <div class="text-[13px] font-bold text-noble-black leading-none">
            {{ requestedTimeFrame }}
          </div>
        </div>
      </div>
    </div>
  </NuxtLink>
</template>
