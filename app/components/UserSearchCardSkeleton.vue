<template>
  <div
    class="flex items-center gap-4 bg-white border border-cinnamon-ice/20 p-4 rounded-[20px] animate-pulse"
  >
    <!-- Avatar Skeleton -->
    <div class="w-14 h-14 rounded-full bg-noble-black/10 shrink-0" />

    <div class="flex-1 min-w-0 flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <!-- Name Skeleton -->
        <div class="h-4 w-32 bg-noble-black/20 rounded" />
        <!-- Badge Skeleton -->
        <div class="h-4 w-12 bg-noble-black/10 rounded-full" />
      </div>
      <!-- Username Skeleton -->
      <div class="h-3 w-20 bg-noble-black/10 rounded" />

      <div class="flex items-center gap-3">
        <!-- Rating Skeleton -->
        <div class="flex items-center gap-1">
          <div class="w-3 h-3 bg-noble-black/10 rounded-full" />
          <div class="h-3 w-8 bg-noble-black/10 rounded" />
        </div>
        <!-- Listings Skeleton -->
        <div class="h-3 w-24 bg-noble-black/10 rounded" />
      </div>
    </div>

    <!-- Arrow Skeleton -->
    <div class="h-5 w-5 rounded-full bg-noble-black/5" />
  </div>
</template>

<script setup lang="ts">
// Skeleton component
</script>
