<template>
  <div
    class="bg-white rounded-[15px] sm:rounded-[20px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.08)] flex flex-col h-full w-full max-w-[340px] mx-auto animate-pulse"
  >
    <!-- Image Section -->
    <div class="relative aspect-square w-full bg-gray-200">
      <!-- Type Tag Skeleton -->
      <div class="absolute top-2 sm:top-4 left-2 sm:left-4 w-[50px] sm:w-[80px] h-[24px] sm:h-[32px] rounded-full bg-gray-300"></div>

      <!-- Like Button Skeleton -->
      <div class="absolute top-2 sm:top-4 right-2 sm:right-4 w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-gray-300"></div>
    </div>

    <!-- Details Section -->
    <div class="p-3 sm:p-5 flex-1 flex flex-col bg-white">
      <!-- Category Skeleton -->
      <div class="h-[11px] sm:h-[13px] w-20 sm:w-24 bg-gray-200 rounded mb-1 sm:mb-1.5 mt-0.5"></div>

      <!-- Title & Rating Skeleton -->
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-1 sm:gap-2">
        <div class="flex-1 flex flex-col gap-1.5 pt-0.5 w-full">
          <div class="h-[14px] sm:h-[17px] w-full bg-gray-200 rounded"></div>
        </div>
        <!-- Rating Skeleton -->
        <div class="w-10 sm:w-12 h-[11px] sm:h-[14px] bg-gray-200 rounded shrink-0 sm:mt-1"></div>
      </div>

      <!-- Price Skeleton -->
      <div class="mt-auto pt-2 sm:pt-4">
        <div class="h-[15px] sm:h-[19px] w-20 sm:w-28 bg-gray-200 rounded"></div>
      </div>
    </div>

    <!-- Divider -->
    <div class="h-[1px] bg-gray-100 w-full"></div>

    <!-- Owner Section -->
    <div class="px-3 py-2 sm:px-5 sm:py-4 flex justify-between items-center bg-white">
      <!-- Owner Name Skeleton -->
      <div class="h-[12px] sm:h-[15px] w-24 sm:w-32 bg-gray-200 rounded"></div>
      <!-- Contact Button Skeleton -->
      <div class="w-7 h-7 sm:w-9 sm:h-9 shrink-0 rounded-full bg-gray-200 shadow-sm"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Skeleton component doesn't require props or logic
</script>
