<template>
  <div class="mx-auto max-w-[1100px] space-y-6 pb-10 animate-pulse font-geist lg:px-16 xl:px-24">
    <!-- Header Skeleton -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <section class="space-y-3">
        <div class="space-y-2">
          <div class="h-10 w-64 bg-noble-black/20 rounded-lg"></div>
          <div class="w-10 h-0.5 bg-burning-orange/30"></div>
        </div>
        <div class="h-4 w-80 bg-noble-black/10 rounded"></div>
      </section>
    </div>

    <!-- Search Bar Skeleton (h-12) -->
    <div
      class="h-12 w-full bg-white rounded-[12px] border border-gray-100 shadow-sm px-5 flex items-center gap-3"
    >
      <div class="w-5 h-5 rounded-full bg-noble-black/10 shrink-0"></div>
      <div class="h-4 w-40 bg-noble-black/5 rounded"></div>
    </div>

    <!-- Tab Bar Skeleton -->
    <div class="flex items-center border-b border-cinnamon-ice/20 gap-8 px-2 mb-4">
      <div v-for="i in 2" :key="i" class="pb-4 h-6 w-32 bg-noble-black/10 rounded"></div>
    </div>

    <!-- Content Panel Skeleton -->
    <div class="bg-cream rounded-[24px] border border-cinnamon-ice/20 p-6 sm:p-8 space-y-8">
      <!-- Status Filter Chips Skeleton -->
      <div class="flex items-center gap-2 overflow-hidden py-1">
        <div
          v-for="i in 5"
          :key="i"
          class="px-8 py-4 bg-white rounded-full border border-gray-100 shrink-0"
        ></div>
      </div>

      <!-- Transaction Cards List Skeleton -->
      <div class="space-y-10">
        <!-- Date Group Header -->
        <div class="flex items-center gap-4 px-2">
          <div class="h-4 w-20 bg-noble-black/10 rounded"></div>
          <div class="h-[1px] w-full bg-cinnamon-ice/10"></div>
        </div>

        <div class="space-y-4">
          <TransactionCardSkeleton v-for="i in 3" :key="i" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Specialized skeleton for My Transactions page (index.vue)
</script>
