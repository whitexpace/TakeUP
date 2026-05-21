<template>
  <article
    class="rounded-[24px] border border-cinnamon-ice/30 bg-cream p-6 shadow-sm transition-shadow duration-300 hover:shadow-md"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex items-center gap-3 min-w-0">
        <UserAvatar
          :avatar-url="post.requester.avatar"
          :user-name="post.requester.name"
          size="md"
          class="shrink-0"
        />
        <div class="flex flex-col min-w-0">
          <span class="text-[15px] font-bold text-noble-black truncate">
            {{ post.requester.name }}
          </span>
          <span class="text-[13px] text-noble-black/50 truncate">
            @{{ post.requester.username }}
          </span>
        </div>
      </div>
      <span class="shrink-0 text-[12px] text-noble-black/50">
        {{ relativeTime }}
      </span>
    </div>

    <div class="mt-5 min-w-0">
      <h2 class="text-[22px] font-bold leading-tight text-noble-black">
        {{ post.itemNeeded }}
      </h2>
      <p class="mt-2 text-[15px] leading-relaxed text-noble-black/70">
        {{ post.description }}
      </p>
    </div>

    <div class="mt-5 grid gap-3 sm:grid-cols-3">
      <div class="rounded-[18px] bg-white/75 px-4 py-3">
        <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-noble-black/40">
          Requested Dates
        </p>
        <p class="mt-2 text-[14px] font-semibold text-noble-black">
          {{ requestedDateRange }}
        </p>
      </div>

      <div class="rounded-[18px] bg-white/75 px-4 py-3">
        <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-noble-black/40">
          Target Price
        </p>
        <p class="mt-2 text-[14px] font-semibold text-noble-black">
          {{ priceRange }}
        </p>
      </div>

      <div class="rounded-[18px] bg-white/75 px-4 py-3">
        <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-noble-black/40">
          Status
        </p>
        <p class="mt-2 text-[14px] font-semibold text-burning-orange">Open until {{ openUntil }}</p>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { RequestFeedPost } from "../types/request-feed"
import {
  formatRequestDateRange,
  formatRequestPriceRange,
  formatRequestRelativeTime,
} from "../utils/request-feed"

const props = defineProps<{
  post: RequestFeedPost
  showRequesterIdentity?: boolean
}>()

const requestedDateRange = computed(() =>
  formatRequestDateRange(props.post.requestedFrom, props.post.requestedTo),
)
const priceRange = computed(() =>
  formatRequestPriceRange(props.post.minTargetPrice, props.post.maxTargetPrice),
)
const openUntil = computed(() =>
  formatRequestDateRange(props.post.requestedTo, props.post.requestedTo),
)
const relativeTime = computed(() => formatRequestRelativeTime(props.post.createdAt))
</script>
