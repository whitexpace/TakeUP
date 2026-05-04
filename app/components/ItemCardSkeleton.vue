<template>
  <div
    class="bg-white rounded-[14px] overflow-hidden border border-cinnamon-ice/20 flex flex-col h-full w-full min-w-[210px] max-w-[280px] mx-auto animate-pulse"
  >
    <!-- Image Section (Compact: 180px) -->
    <div class="relative h-[180px] w-full bg-noble-black/10 rounded-t-[12px]">
      <!-- Type Tag Skeleton -->
      <div class="absolute top-[10px] left-[10px] w-12 h-[22px] rounded-[6px] bg-noble-black/20" />

      <!-- Like Button Skeleton -->
      <div class="absolute top-[10px] right-[10px] w-8 h-8 rounded-full bg-noble-black/20" />
    </div>

    <!-- Content Area (12px padding) -->
    <div class="p-3 flex-1 flex flex-col justify-between bg-white min-h-0">
      <!-- Row 1: Category Skeleton -->
      <div class="flex items-center justify-between mb-1 min-w-0">
        <div class="h-3 w-16 bg-noble-black/10 rounded" />
      </div>

      <!-- Row 2: Title Skeleton -->
      <div class="h-4 w-full bg-noble-black/20 rounded mb-2" />

      <!-- Row 3: Price & Rating Skeleton (Unified Row) -->
      <div class="flex items-center justify-between gap-2 mt-auto">
        <!-- Price Skeleton -->
        <div class="h-5 w-20 bg-noble-black/20 rounded" />

        <!-- Rating Skeleton -->
        <div class="flex items-center gap-1 shrink-0">
          <div class="w-3 h-3 bg-noble-black/10 rounded-full" />
          <div class="h-4 w-10 bg-noble-black/10 rounded" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Skeleton component doesn't require props or logic
</script>
