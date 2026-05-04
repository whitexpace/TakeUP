<template>
  <div
    class="block overflow-hidden rounded-[16px] border border-cinnamon-ice/20 bg-white font-geist shadow-[0_2px_8px_rgba(0,0,0,0.04)] animate-pulse"
  >
    <!-- Top Zone: Header Skeleton -->
    <div
      class="border-b border-cinnamon-ice/15 bg-white/50 px-5 py-3 flex items-center justify-between"
    >
      <div class="flex items-center gap-3">
        <!-- Counterpart Name / Admin Info Skeleton -->
        <div class="h-4 w-32 bg-noble-black/20 rounded" />
      </div>

      <!-- Status Badge Skeleton -->
      <div class="h-6 w-20 bg-noble-black/10 rounded-full" />
    </div>

    <!-- Bottom Zone: Content Skeleton -->
    <div class="p-5 flex items-center gap-4 relative">
      <!-- Thumbnail Skeleton -->
      <div class="w-16 h-16 rounded-[10px] bg-noble-black/10 shrink-0" />

      <div class="flex-1 min-w-0">
        <!-- Item Name Skeleton -->
        <div class="h-4 w-3/4 bg-noble-black/20 rounded mb-2" />

        <!-- Meta Info Skeleton -->
        <div class="flex items-center gap-2">
          <div class="h-3 w-16 bg-noble-black/10 rounded" />
          <div class="h-3 w-24 bg-noble-black/10 rounded" />
          <div class="h-3 w-12 bg-noble-black/10 rounded" />
        </div>
      </div>

      <div class="shrink-0 text-right">
        <div class="flex flex-col items-end gap-2">
          <!-- Rate Label Skeleton -->
          <div class="h-3 w-16 bg-noble-black/10 rounded" />
          <!-- Total Price Skeleton -->
          <div class="h-5 w-24 bg-noble-black/20 rounded" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Skeleton component
</script>
