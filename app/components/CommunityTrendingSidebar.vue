<template>
  <div class="flex flex-col gap-6 py-6">
    <h2 class="text-[12px] font-bold tracking-[1.5px] text-gray-400 uppercase">TRENDING NOW</h2>
    <div class="flex flex-col gap-1">
      <div
        v-for="(item, index) in trendingItems"
        :key="item.id"
        class="group flex items-start gap-3 p-3 transition-all hover:bg-gray-50 rounded-[8px] cursor-pointer"
      >
        <span class="text-[14px] font-bold text-gray-200 leading-none pt-1 shrink-0">
          {{ index + 1 }}
        </span>
        <div class="flex-1 min-w-0 flex flex-col gap-0.5">
          <div class="flex items-center gap-1.5">
            <h3 class="text-[13px] font-semibold text-gray-900 leading-snug truncate">
              {{ item.title }}
            </h3>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              class="text-burning-orange shrink-0"
            >
              <path d="M7 17l10-10M7 7h10v10" />
            </svg>
          </div>
          <span class="text-[11px] text-gray-400"
            >{{ item.offersCount }} {{ item.offersCount === 1 ? "offer" : "offers" }}</span
          >
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TrendingRequest } from "~/types/community-requests"

defineProps<{
  trendingItems: TrendingRequest[]
}>()
</script>
