<template>
  <div
    class="rounded-[24px] bg-white border border-cinnamon-ice/20 p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] animate-pulse"
  >
    <!-- Top Full Width Row -->
    <div class="flex items-center gap-3 mb-6 w-full pb-4 border-b border-gray-50">
      <!-- Title Skeleton -->
      <div class="h-6 w-64 bg-noble-black/20 rounded" />
      <!-- Status Badge Skeleton -->
      <div class="h-5 w-20 bg-noble-black/10 rounded-full" />
    </div>

    <div class="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
      <!-- Left Column -->
      <div class="min-w-0 flex-1">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
          <div v-for="i in 4" :key="i" class="space-y-1">
            <div class="h-3 w-24 bg-noble-black/10 rounded" />
            <div class="h-4 w-40 bg-noble-black/10 rounded" />
          </div>
        </div>
      </div>

      <!-- Right Financial Box Skeleton -->
      <div
        class="w-full lg:w-auto shrink-0 grid grid-cols-3 gap-4 lg:gap-6 text-right bg-gray-50/50 p-6 rounded-[24px] border border-gray-100/50"
      >
        <div v-for="i in 3" :key="i" class="space-y-1 text-center px-2">
          <div class="h-3 w-16 bg-noble-black/10 rounded mx-auto" />
          <div class="h-5 w-20 bg-noble-black/20 rounded mx-auto" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Skeleton for Admin Commission Ledger items
</script>
