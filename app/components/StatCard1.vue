<template>
  <div class="inline-block w-fit h-[82px]">
    <div
      class="box-border bg-white border border-cinnamon-ice rounded-[14.5px] p-[18px] lg:p-3 xl:p-[18px]"
    >
      <div
        class="m-0 font-geist text-[32px] font-bold leading-none text-blue-estate whitespace-nowrap"
      >
        {{ value }}
      </div>
      <div
        class="mt-[9px] mb-0 font-geist text-base font-medium leading-none text-noble-black opacity-60 whitespace-nowrap"
      >
        {{ label }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  value: string
  label: string
}>()
</script>
