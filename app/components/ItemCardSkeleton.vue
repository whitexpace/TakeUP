<template>
  <div
    class="bg-white rounded-[14px] border border-cinnamon-ice/20 flex flex-col h-full w-full sm:min-w-[210px] sm:max-w-[280px] mx-auto animate-pulse"
  >
    <!-- Image Section (Responsive: 120px/150px/180px) -->
    <div
      class="relative h-[120px] xs:h-[150px] sm:h-[180px] w-full bg-noble-black/5 rounded-t-[14px]"
    >
      <!-- Type Tag Skeleton -->
      <div
        class="absolute top-2 sm:top-[10px] left-2 sm:left-[10px] w-8 sm:w-12 h-4 sm:h-[22px] rounded-[4px] sm:rounded-[6px] bg-noble-black/10"
      />

      <!-- Like Button Skeleton (Hidden in management mode) -->
      <div
        v-if="!isManagement"
        class="absolute top-2 sm:top-[10px] right-2 sm:right-[10px] w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-noble-black/10"
      />
    </div>

    <!-- Content Area (Responsive padding: 8px/12px) -->
    <div class="p-2 sm:p-3 flex-1 flex flex-col justify-between bg-white min-h-0 rounded-b-[14px]">
      <!-- Row 1: Category Skeleton -->
      <div class="flex items-center justify-between mb-0.5 sm:mb-1 min-w-0">
        <div class="h-2.5 sm:h-3 w-12 sm:w-16 bg-noble-black/10 rounded" />
      </div>

      <!-- Row 2: Title Skeleton -->
      <div class="h-3.5 sm:h-4 w-full bg-noble-black/20 rounded mb-1 sm:mb-2" />

      <!-- Row 3: Price & Rating Skeleton (Unified Row) -->
      <div class="flex items-center justify-between gap-1 sm:gap-2 mt-auto">
        <!-- Price Skeleton -->
        <div class="flex items-baseline gap-0.5 sm:gap-1">
          <div class="h-4 sm:h-5 w-10 sm:w-12 bg-noble-black/20 rounded" />
          <div class="h-2.5 sm:h-3 w-6 sm:w-8 bg-noble-black/10 rounded" />
        </div>

        <!-- Rating Skeleton (Hidden in management mode) -->
        <div v-if="!isManagement" class="flex items-center gap-1 shrink-0">
          <div class="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 bg-noble-black/10 rounded-full" />
          <div class="h-3 sm:h-4 w-6 sm:w-8 bg-noble-black/10 rounded" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isManagement?: boolean
}>()
</script>
