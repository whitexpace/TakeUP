<template>
  <div
    class="block bg-white rounded-[16px] border border-cinnamon-ice/20 overflow-hidden font-geist shadow-[0_2px_8px_rgba(0,0,0,0.04)] animate-pulse"
  >
    <!-- Top Zone: Slim Header Skeleton -->
    <div
      class="flex items-center justify-between px-5 py-3 border-b border-cinnamon-ice/15 bg-white/50"
    >
      <div class="flex items-center gap-3">
        <!-- Lender Name Skeleton -->
        <div class="h-4 w-32 bg-noble-black/20 rounded" />
      </div>

      <!-- Status Badge Skeleton -->
      <div class="h-5 w-20 bg-noble-black/10 rounded-full" />
    </div>

    <!-- Bottom Zone: Item Row Skeleton -->
    <div class="p-5 flex items-center gap-4 relative">
      <!-- Thumbnail Skeleton -->
      <div class="w-16 h-16 rounded-[10px] bg-noble-black/10 shrink-0" />

      <!-- Item Details Skeleton -->
      <div class="flex-1 min-w-0">
        <!-- Item Name Skeleton -->
        <div class="h-4 w-3/4 bg-noble-black/20 rounded mb-2" />
        <div class="flex items-center gap-2">
          <!-- ID Skeleton -->
          <div class="h-3 w-16 bg-noble-black/10 rounded" />
          <!-- Date Skeleton -->
          <div class="h-3 w-24 bg-noble-black/10 rounded" />
        </div>
      </div>

      <!-- Pricing / Extra Info Skeleton -->
      <div class="shrink-0 text-right">
        <div class="flex flex-col items-end gap-2">
          <!-- Time Frame Label Skeleton -->
          <div class="h-3 w-16 bg-noble-black/10 rounded" />
          <!-- Time Frame Value Skeleton -->
          <div class="h-4 w-32 bg-noble-black/20 rounded" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Skeleton component
</script>
