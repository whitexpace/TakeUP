<template>
  <div class="rounded-[24px] border border-cinnamon-ice/30 bg-cream p-6 shadow-sm animate-pulse">
    <!-- Header Skeleton -->
    <div class="flex items-start justify-between gap-4">
      <div class="flex items-center gap-3 min-w-0">
        <!-- Avatar Skeleton -->
        <div class="h-10 w-10 rounded-full bg-noble-black/10 shrink-0" />
        <div class="flex flex-col gap-1.5 min-w-0">
          <!-- Name Skeleton -->
          <div class="h-3.5 w-28 bg-noble-black/20 rounded" />
          <!-- Username Skeleton -->
          <div class="h-3 w-20 bg-noble-black/10 rounded" />
        </div>
      </div>
      <!-- Relative Time Skeleton -->
      <div class="h-3 w-10 bg-noble-black/10 rounded shrink-0" />
    </div>

    <!-- Content Skeleton -->
    <div class="mt-5 min-w-0">
      <!-- Item Needed Skeleton -->
      <div class="h-7 w-3/4 bg-noble-black/20 rounded" />
      <!-- Description Skeleton -->
      <div class="mt-2 flex flex-col gap-2">
        <div class="h-4 w-full bg-noble-black/10 rounded" />
        <div class="h-4 w-5/6 bg-noble-black/10 rounded" />
      </div>
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
