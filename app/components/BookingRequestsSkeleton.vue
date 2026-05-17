<template>
  <div class="mx-auto max-w-[1180px] space-y-8 animate-pulse font-geist lg:px-16 xl:px-24">
    <!-- Header Skeleton -->
    <div class="h-10 w-10 rounded-full bg-noble-black/10 mb-8" />

    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
      <section class="space-y-3">
        <div class="space-y-2">
          <div class="h-10 w-64 bg-noble-black/20 rounded-lg"></div>
          <div class="w-10 h-0.5 bg-burning-orange/30"></div>
        </div>
        <div class="h-4 w-96 bg-noble-black/10 rounded"></div>
      </section>
    </div>

    <!-- Content Panel Skeleton -->
    <div class="bg-cream rounded-[24px] border border-cinnamon-ice/20 p-6 sm:p-8 space-y-8">
      <div class="border-l-[3px] border-burning-orange/30 pl-4 mb-6">
        <div class="h-6 w-32 bg-noble-black/20 rounded mb-2"></div>
        <div class="h-3 w-48 bg-noble-black/10 rounded"></div>
      </div>

      <!-- Action & Filter Row Skeleton -->
      <div class="flex items-center gap-2 overflow-hidden py-1 mb-8">
        <div
          v-for="i in 4"
          :key="i"
          class="h-8 w-24 bg-white rounded-full border border-gray-100 shrink-0"
        ></div>
      </div>

      <!-- Request Cards Skeleton -->
      <div class="space-y-4">
        <div
          v-for="i in 3"
          :key="i"
          class="block bg-white rounded-[16px] border border-cinnamon-ice/15 overflow-hidden shadow-sm"
        >
          <div
            class="px-5 py-3 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center"
          >
            <div class="h-4 w-32 bg-noble-black/10 rounded"></div>
            <div class="h-5 w-16 bg-noble-black/10 rounded-full"></div>
          </div>
          <div class="p-5 flex items-center gap-4">
            <div class="w-16 h-16 rounded-[10px] bg-noble-black/5 shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 w-48 bg-noble-black/20 rounded"></div>
              <div class="h-3 w-64 bg-noble-black/10 rounded"></div>
              <div class="flex gap-2 pt-2">
                <div class="h-8 w-24 bg-noble-black/5 rounded-lg"></div>
                <div class="h-8 w-32 bg-noble-black/10 rounded-lg"></div>
              </div>
            </div>
            <div class="h-5 w-20 bg-noble-black/20 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Specialized skeleton for Booking Requests page
</script>
