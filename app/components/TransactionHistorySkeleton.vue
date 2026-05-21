<template>
  <div
    class="mx-auto max-w-[1100px] space-y-6 pb-10 animate-pulse font-geist px-4 sm:px-6 lg:px-16 xl:px-24"
  >
    <!-- Header Skeleton -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <section class="space-y-3">
        <div class="space-y-2">
          <div class="h-8 sm:h-10 w-40 sm:w-64 bg-noble-black/20 rounded-lg"></div>
          <div class="w-10 h-0.5 bg-burning-orange/30"></div>
        </div>
        <div class="h-4 w-64 sm:w-80 bg-noble-black/10 rounded"></div>
      </section>
    </div>

    <!-- Search Bar Skeleton (h-11 sm:h-12) -->
    <div
      class="h-11 sm:h-12 w-full bg-white rounded-[12px] border border-gray-100 shadow-sm px-4 sm:px-5 flex items-center gap-2 sm:gap-3"
    >
      <div class="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-noble-black/10 shrink-0"></div>
      <div class="h-3.5 sm:h-4 w-32 sm:w-40 bg-noble-black/5 rounded"></div>
    </div>

    <!-- Tab Bar Skeleton -->
    <div class="flex items-center border-b border-cinnamon-ice/20 gap-6 sm:gap-8 px-2 mb-4">
      <div
        v-for="i in 2"
        :key="i"
        class="pb-3 sm:pb-4 h-5 sm:h-6 w-24 sm:w-32 bg-noble-black/10 rounded"
      ></div>
    </div>

    <!-- Content Panel Skeleton -->
    <div
      class="bg-cream/50 border border-cinnamon-ice/20 rounded-[24px] p-4 sm:p-8 space-y-6 sm:space-y-8"
    >
      <!-- Filter Chips Skeleton -->
      <div class="flex gap-2 overflow-hidden">
        <div
          v-for="i in 5"
          :key="i"
          class="h-8 w-20 sm:w-24 bg-white border border-gray-100 rounded-full shrink-0"
        ></div>
      </div>

      <!-- Grouped List Skeleton -->
      <div class="space-y-8 sm:space-y-10">
        <div v-for="g in 2" :key="g" class="space-y-4 sm:space-y-5">
          <!-- Date Header Skeleton -->
          <div class="flex items-center gap-3 sm:gap-4 px-1 sm:px-2">
            <div class="h-3 w-16 sm:w-20 bg-noble-black/10 rounded shrink-0"></div>
            <div class="h-px w-full bg-cinnamon-ice/10"></div>
          </div>

          <!-- Cards Skeleton -->
          <div class="space-y-3 sm:space-y-4">
            <TransactionCardSkeleton v-for="i in 2" :key="i" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Specialized skeleton for My Transactions page (index.vue)
</script>
