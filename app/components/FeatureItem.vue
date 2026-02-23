<template>
  <div class="flex items-center gap-[6px]">
    <div class="flex items-center justify-center shrink-0">
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="9" cy="9" r="9" class="fill-burning-orange" />
        <path
          d="M5 9L8 12L13 6"
          class="stroke-pale-cashmere"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
    <span class="font-geist font-light text-xs text-noble-black leading-[1.2] whitespace-nowrap">{{
      text
    }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  text: string
}>()
</script>
