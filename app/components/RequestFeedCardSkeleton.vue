<template>
  <div class="rounded-[24px] border border-cinnamon-ice/30 bg-cream p-6 shadow-sm animate-pulse">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0 flex flex-col gap-2">
        <!-- Requester Label Skeleton -->
        <div class="h-3 w-32 bg-noble-black/10 rounded" />
        <!-- Item Needed Skeleton -->
        <div class="h-6 w-64 bg-noble-black/20 rounded" />
      </div>
      <!-- Relative Time Skeleton -->
      <div class="h-3 w-12 bg-noble-black/10 rounded shrink-0" />
    </div>

    <!-- Description Skeleton -->
    <div class="mt-4 flex flex-col gap-2">
      <div class="h-4 w-full bg-noble-black/10 rounded" />
      <div class="h-4 w-5/6 bg-noble-black/10 rounded" />
    </div>

    <!-- Info Grid Skeleton -->
    <div class="mt-5 grid gap-3 sm:grid-cols-3">
      <div v-for="i in 3" :key="i" class="rounded-[18px] bg-white/75 px-4 py-3">
        <!-- Label Skeleton -->
        <div class="h-3 w-20 bg-noble-black/10 rounded mb-3" />
        <!-- Value Skeleton -->
        <div class="h-4 w-28 bg-noble-black/20 rounded" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Skeleton component
</script>
