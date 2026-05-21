<template>
  <div
    class="block overflow-hidden rounded-[16px] border border-cinnamon-ice/20 bg-white font-geist shadow-[0_2px_8px_rgba(0,0,0,0.04)] animate-pulse"
  >
    <!-- Top Zone: Header Skeleton -->
    <div
      class="border-b border-cinnamon-ice/15 bg-white/50 px-3 sm:px-5 py-2 sm:py-3 flex items-center justify-between"
    >
      <div class="flex items-center gap-2 sm:gap-3">
        <!-- Counterpart Name / Admin Info Skeleton -->
        <div class="h-3.5 sm:h-4 w-28 sm:w-32 bg-noble-black/10 rounded" />
      </div>

      <!-- Status Badge Skeleton -->
      <div class="h-5 sm:h-6 w-16 sm:w-20 bg-noble-black/5 rounded-full" />
    </div>

    <!-- Bottom Zone: Content Skeleton -->
    <div class="p-3 sm:p-5 flex items-center gap-3 sm:gap-4 relative">
      <!-- Thumbnail Skeleton -->
      <div class="w-11 h-11 sm:w-16 sm:h-16 rounded-lg bg-noble-black/5 shrink-0" />

      <div class="flex-1 min-w-0 pt-0.5 sm:pt-0">
        <!-- Item Name Skeleton -->
        <div class="h-3.5 sm:h-4 w-3/4 bg-noble-black/10 rounded mb-1.5" />

        <!-- Meta Info Skeleton -->
        <div class="flex items-center gap-1.5 sm:gap-2">
          <div class="h-2.5 sm:h-3 w-10 sm:w-14 bg-noble-black/5 rounded" />
          <div class="h-2.5 sm:h-3 w-16 sm:w-20 bg-noble-black/5 rounded" />
        </div>
      </div>

      <div class="shrink-0 text-right pt-0.5 sm:pt-0">
        <div class="flex flex-col items-end gap-1 sm:gap-1.5">
          <!-- Rate Label Skeleton -->
          <div class="h-2 sm:h-2.5 w-10 sm:w-14 bg-noble-black/5 rounded" />
          <!-- Total Price Skeleton -->
          <div class="h-4 sm:h-5 w-16 sm:w-20 bg-noble-black/10 rounded" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Skeleton component
</script>
