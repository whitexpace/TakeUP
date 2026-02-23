<template>
  <div class="w-full h-auto">
    <div
      class="box-border bg-cream rounded-[16px] p-[18px] w-full border-[0.5px] border-cinnamon-ice"
    >
      <div
        class="mt-0 mb-2 font-geist text-[17px] font-medium leading-none text-noble-black opacity-60"
      >
        {{ label }}
      </div>
      <div class="m-0 font-geist text-[30px] font-bold leading-none text-blue-estate">
        {{ value }}
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
