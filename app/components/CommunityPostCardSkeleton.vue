<template>
  <div
    class="relative flex flex-col gap-4 rounded-[24px] border border-gray-100 bg-white p-6 animate-pulse"
  >
    <!-- Card Header Skeleton -->
    <div class="flex items-start justify-between">
      <div class="flex items-center gap-3 min-w-0">
        <!-- Avatar Skeleton -->
        <div class="h-9 w-9 rounded-full bg-noble-black/10 shrink-0" />
        <div class="min-w-0 flex flex-col gap-1.5">
          <div class="flex items-center gap-2">
            <!-- Name Skeleton -->
            <div class="h-3 w-24 bg-noble-black/20 rounded" />
            <!-- Time Skeleton -->
            <div class="h-3 w-8 bg-noble-black/10 rounded" />
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <!-- Status Badge Skeleton -->
        <div class="h-[22px] w-12 rounded-full bg-noble-black/10" />
        <!-- Menu Button Skeleton -->
        <div class="h-8 w-8 rounded-full bg-noble-black/10" />
      </div>
    </div>

    <!-- Content Area Skeleton -->
    <div class="flex gap-4">
      <div class="flex-1 flex flex-col gap-3">
        <!-- Title Skeleton -->
        <div class="h-5 w-3/4 bg-noble-black/20 rounded" />
        <!-- Description Skeleton -->
        <div class="flex flex-col gap-2">
          <div class="h-3 w-full bg-noble-black/10 rounded" />
          <div class="h-3 w-5/6 bg-noble-black/10 rounded" />
        </div>
      </div>

      <!-- Reference Image Skeleton -->
      <div class="shrink-0 w-[120px] h-[90px] rounded-[10px] bg-noble-black/10" />
    </div>

    <!-- Metadata Row Skeleton -->
    <div class="flex flex-wrap items-center justify-between gap-4 pt-2">
      <div class="flex flex-wrap items-center gap-2">
        <!-- Chips Skeletons -->
        <div class="h-[26px] w-32 bg-noble-black/10 rounded-[8px]" />
        <div class="h-[26px] w-24 bg-noble-black/10 rounded-[8px]" />
      </div>

      <!-- Action Area Skeleton -->
      <div class="flex items-center gap-4 ml-auto">
        <!-- Offers Count Skeleton -->
        <div class="h-3 w-14 bg-noble-black/10 rounded" />
        <!-- Button Skeleton -->
        <div class="h-8 w-24 bg-noble-black/20 rounded-[8px]" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Skeleton component
</script>
