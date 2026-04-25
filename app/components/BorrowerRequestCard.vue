<script setup lang="ts">
import type { BorrowerItemRequest } from "../composables/use-borrower-item-requests"

const props = defineProps<{
  request: BorrowerItemRequest
}>()

const lenderName = computed(() => {
  const user = props.request.lender.user
  return `${user.firstName} ${user.lastName[0]}.`
})

const requestId = computed(() => `REQUEST ID. ${props.request.id.slice(0, 16).toUpperCase()}`)

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
      return "bg-amber-100 text-amber-700"
    case "APPROVED":
      return "bg-emerald-100 text-emerald-700"
    case "REJECTED":
      return "bg-rose-100 text-rose-700"
    default:
      return "bg-cinnamon-ice/60 text-neutral-800"
  }
})
</script>

<template>
  <div class="overflow-hidden rounded-2xl border-[0.50px] border-cinnamon-ice bg-white font-geist">
    <div
      class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-stone-300/50 px-4 py-3 sm:px-6"
    >
      <span class="mr-auto text-base font-bold tracking-wide text-neutral-800/80">
        {{ lenderName }}
      </span>

      <span
        class="inline-flex items-center rounded-md px-2.5 py-1 text-sm font-normal leading-none sm:px-3 sm:text-base"
        :class="statusBadgeClass"
      >
        {{ request.requestStatusLabel }}
      </span>
    </div>

    <NuxtLink
      :to="detailPath"
      class="flex cursor-pointer items-start gap-3 px-4 py-4 transition-colors hover:bg-cream/50 sm:gap-4 sm:px-6"
    >
      <img
        v-if="request.item.thumbnailImage"
        :src="request.item.thumbnailImage"
        :alt="request.item.name"
        class="h-16 w-16 shrink-0 rounded object-cover sm:h-20 sm:w-20"
      />
      <div
        v-else
        class="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-cinnamon-ice/40 sm:h-20 sm:w-20"
      >
        <svg
          class="h-7 w-7 text-cinnamon-ice sm:h-8 sm:w-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>

      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-normal text-neutral-800 sm:text-base">
          {{ request.item.name }}
        </p>
        <p class="mt-1 truncate text-xs font-normal text-neutral-800/80">{{ requestId }}</p>
        <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class="flex items-center gap-1 text-xs text-neutral-800/80">
            <svg
              class="h-3.5 w-3.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke-width="1" />
              <line x1="16" y1="2" x2="16" y2="6" stroke-width="1" />
              <line x1="8" y1="2" x2="8" y2="6" stroke-width="1" />
              <line x1="3" y1="10" x2="21" y2="10" stroke-width="1" />
            </svg>
            Requested {{ requestedDate }}
          </span>
          <span class="text-xs text-neutral-800/80">Time frame: {{ requestedTimeFrame }}</span>
        </div>
      </div>
    </NuxtLink>
  </div>
</template>
