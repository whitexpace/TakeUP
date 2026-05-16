<template>
  <div
    class="relative overflow-hidden rounded-[24px] border border-cinnamon-ice/20 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] animate-pulse"
  >
    <div class="relative z-10">
      <!-- Label Skeleton -->
      <div class="h-3 w-24 bg-noble-black/10 rounded mb-4" />

      <!-- Value Skeleton -->
      <div class="h-8 w-32 bg-noble-black/20 rounded mb-2" />

      <!-- Detail Skeleton -->
      <div class="h-4 w-full bg-noble-black/10 rounded" />
    </div>

    <!-- Decorative Circle (if any) -->
    <div class="absolute -right-4 -bottom-4 w-24 h-24 bg-noble-black/[0.02] rounded-full"></div>
  </div>
</template>

<script setup lang="ts">
// Admin KPI Card Skeleton
</script>
