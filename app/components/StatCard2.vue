<template>
  <div class="inline-block w-fit h-[82px]">
    <div class="box-border bg-cream rounded-[16px] p-[18px]">
        <div class="mt-[9px] mb-0 font-geist text-base font-medium leading-none text-noble-black opacity-60">{{ label }}</div>
      <div class="m-0 font-geist text-[32px] font-bold leading-none text-blue-estate">{{ value }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  value: string
  label: string
}>()
</script>

