<template>
  <div class="bg-white border border-cinnamon-ice/20 rounded-[32px] p-8 shadow-sm animate-pulse">
    <div class="flex items-start justify-between mb-8">
      <div class="space-y-2">
        <div class="h-6 w-40 bg-noble-black/20 rounded" />
        <div class="h-4 w-64 bg-noble-black/10 rounded" />
      </div>
      <div class="h-8 w-20 bg-noble-black/10 rounded-[12px]" />
    </div>

    <div class="space-y-6">
      <div v-for="i in 5" :key="i" class="flex items-center gap-4">
        <div class="w-11 h-11 shrink-0 rounded-[14px] bg-noble-black/10" />
        <div class="min-w-0 flex-1 space-y-2">
          <div class="h-4 w-3/4 bg-noble-black/20 rounded" />
          <div class="h-3 w-1/2 bg-noble-black/10 rounded" />
        </div>
        <div class="w-10 h-6 bg-noble-black/10 rounded shrink-0" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Sidebar List Skeleton
</script>
