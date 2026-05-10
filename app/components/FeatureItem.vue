<template>
  <div class="flex items-center gap-[6px]">
    <div class="flex items-center justify-center shrink-0">
      <Icon name="ph:check-circle" class="w-[18px] h-[18px] text-burning-orange" />
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
