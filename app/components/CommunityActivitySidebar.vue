<template>
  <div class="flex flex-col py-6">
    <h2
      class="font-geist font-bold text-[12px] tracking-[0.15em] text-noble-black/30 uppercase mb-6"
    >
      YOUR ACTIVITY
    </h2>
    <div class="flex flex-col">
      <div v-for="(item, index) in activityItems" :key="item.label" class="group">
        <div class="flex items-center justify-between py-3.5 transition-all">
          <span
            class="text-[14px] font-medium text-noble-black/60 group-hover:text-noble-black/80 transition-colors"
          >
            {{ item.label }}
          </span>
          <span class="text-[18px] font-semibold text-noble-black/90">
            {{ item.value }}
          </span>
        </div>
        <!-- Subtle Divider -->
        <div
          v-if="index < activityItems.length - 1"
          class="h-[1px] w-full bg-cinnamon-ice/15"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"

interface Props {
  postsMade: number
  offersSent: number
  offersReceived: number
}

const props = defineProps<Props>()

const activityItems = computed(() => [
  {
    label: "Posts made",
    value: props.postsMade,
  },
  {
    label: "Offers sent",
    value: props.offersSent,
  },
  {
    label: "Offers received",
    value: props.offersReceived,
  },
])
</script>
