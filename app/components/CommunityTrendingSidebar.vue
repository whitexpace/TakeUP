<template>
  <div class="flex flex-col gap-6 py-6">
    <h2 class="font-geist font-bold text-[12px] tracking-[0.15em] text-noble-black/30 uppercase">
      TRENDING NOW
    </h2>
    <div class="flex flex-col">
      <div
        v-for="(item, index) in trendingItems"
        :key="item.id"
        class="group flex flex-col gap-1.5 py-4 transition-all border-b border-cinnamon-ice/15 last:border-b-0"
      >
        <div class="flex items-start gap-3">
          <span
            class="text-[18px] font-bold text-cinnamon-ice group-hover:text-burning-orange/40 transition-colors leading-none pt-0.5"
          >
            {{ index + 1 }}
          </span>
          <div class="flex flex-col gap-1">
            <h3
              class="text-[14px] font-semibold text-noble-black/80 group-hover:text-noble-black transition-colors leading-snug"
            >
              {{ item.title }}
            </h3>
            <div class="flex items-center gap-1.5">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                class="text-noble-black/30"
              >
                <path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span class="text-[11px] font-bold text-noble-black/40"
                >{{ item.upvotes }} upvotes</span
              >
            </div>
          </div>
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
