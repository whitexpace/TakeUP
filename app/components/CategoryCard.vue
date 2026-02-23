<template>
  <div
    class="bg-white p-6 flex flex-row items-center justify-between h-full hover:bg-cream transition-colors cursor-pointer group"
  >
    <div class="w-[80px] h-[80px] flex items-center justify-center shrink-0">
      <img
        :src="imageSrc"
        :alt="imageAlt"
        class="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-300"
      />
    </div>
    <div class="text-right flex flex-col items-end">
      <div class="font-geist font-medium text-2xl text-noble-black leading-tight mb-1">
        {{ title }}
      </div>
      <div class="font-geist font-normal text-xl text-noble-black opacity-70">{{ subtitle }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  subtitle: string
  imageSrc: string
  imageAlt: string
}>()
</script>
