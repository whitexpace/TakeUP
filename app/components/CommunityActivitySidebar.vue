<template>
  <div class="flex flex-col py-6">
    <h2 class="text-[12px] font-bold tracking-[1.5px] text-gray-400 uppercase mb-6">
      YOUR ACTIVITY
    </h2>
    <div class="flex flex-col border-t border-gray-50">
      <div v-for="item in activityItems" :key="item.label" class="group border-b border-gray-50">
        <div class="flex items-center justify-between py-4">
          <span class="text-[13px] text-gray-500 group-hover:text-gray-700 transition-colors">
            {{ item.label }}
          </span>
          <span class="text-[15px] font-semibold text-gray-900">
            {{ item.value }}
          </span>
        </div>
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
