<template>
  <div class="mx-auto max-w-[1180px] space-y-8 animate-pulse font-geist lg:px-16 xl:px-24">
    <!-- Header Skeleton -->
    <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">
      <section class="space-y-3">
        <div class="space-y-2">
          <div class="h-10 w-64 bg-noble-black/20 rounded-lg"></div>
          <div class="w-10 h-0.5 bg-burning-orange/30"></div>
        </div>
        <div class="h-4 w-96 bg-noble-black/10 rounded"></div>
      </section>
      <div class="h-10 w-64 bg-white border border-gray-100 rounded-[20px]"></div>
    </div>

    <!-- Tier 1: Stat Cards Skeleton -->
    <section class="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mb-8">
      <div
        v-for="i in 6"
        :key="i"
        class="flex flex-col h-full rounded-[14px] border border-cinnamon-ice/15 bg-white px-5 py-4 space-y-3"
      >
        <div class="h-4 w-4 bg-noble-black/5 rounded"></div>
        <div class="space-y-2">
          <div class="h-3 w-16 bg-noble-black/10 rounded tracking-widest"></div>
          <div class="h-6 w-20 bg-noble-black/20 rounded"></div>
          <div class="h-3 w-full bg-noble-black/5 rounded"></div>
        </div>
      </div>
    </section>

    <!-- Tier 2: Middle Section Skeleton -->
    <section class="flex flex-col lg:flex-row gap-6 mb-8 items-start">
      <!-- Left Column -->
      <div class="w-full lg:w-[65%] space-y-6">
        <!-- Views Snapshot Skeleton -->
        <div class="bg-cream/50 border border-cinnamon-ice/20 rounded-[24px] p-8 space-y-8">
          <div class="border-l-[3px] border-burning-orange/30 pl-4">
            <div class="h-6 w-32 bg-noble-black/20 rounded mb-2"></div>
            <div class="h-3 w-48 bg-noble-black/10 rounded"></div>
          </div>
          <div class="space-y-6">
            <div v-for="i in 5" :key="i" class="space-y-2">
              <div class="flex justify-between">
                <div class="h-3 w-32 bg-noble-black/10 rounded"></div>
                <div class="h-3 w-8 bg-noble-black/10 rounded"></div>
              </div>
              <div class="h-1.5 w-full bg-noble-black/5 rounded-full"></div>
            </div>
          </div>
        </div>

        <!-- Performance Metrics Skeleton -->
        <div class="bg-cream/50 border border-cinnamon-ice/20 rounded-[24px] p-8 space-y-8">
          <div class="border-l-[3px] border-burning-orange/30 pl-4">
            <div class="h-6 w-40 bg-noble-black/20 rounded mb-2"></div>
            <div class="h-3 w-56 bg-noble-black/10 rounded"></div>
          </div>
          <div class="bg-white rounded-[16px] border border-cinnamon-ice/15 p-6 space-y-6">
            <div v-for="i in 3" :key="i" class="space-y-3">
              <div class="flex justify-between">
                <div class="h-4 w-24 bg-noble-black/20 rounded"></div>
                <div class="h-4 w-12 bg-noble-black/20 rounded"></div>
              </div>
              <div class="h-1.5 w-full bg-noble-black/5 rounded-full"></div>
              <div class="h-3 w-32 bg-noble-black/5 rounded"></div>
              <div v-if="i < 3" class="h-px w-full bg-gray-50 mt-4"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column (Sidebar) -->
      <aside class="w-full lg:w-[35%] space-y-6">
        <!-- Top Items Skeleton -->
        <div class="bg-cream/50 border border-cinnamon-ice/20 rounded-[24px] p-6 space-y-6">
          <div
            class="flex justify-between items-center border-l-[3px] border-burning-orange/30 pl-4"
          >
            <div class="h-5 w-24 bg-noble-black/20 rounded"></div>
            <div class="h-3 w-12 bg-noble-black/10 rounded"></div>
          </div>
          <div class="space-y-4">
            <div v-for="i in 5" :key="i" class="flex items-center gap-3">
              <div class="h-4 w-4 bg-noble-black/5 rounded text-center"></div>
              <div class="h-10 w-10 rounded-lg bg-noble-black/10 shrink-0"></div>
              <div class="flex-1 space-y-2">
                <div class="h-3.5 w-3/4 bg-noble-black/20 rounded"></div>
                <div class="h-2.5 w-1/2 bg-noble-black/5 rounded"></div>
              </div>
              <div class="h-4 w-8 bg-noble-black/10 rounded text-right"></div>
            </div>
          </div>
        </div>

        <!-- Categories Skeleton -->
        <div class="bg-cream/50 border border-cinnamon-ice/20 rounded-[24px] p-6 space-y-6">
          <div class="border-l-[3px] border-burning-orange/30 pl-4">
            <div class="h-5 w-32 bg-noble-black/20 rounded mb-1.5"></div>
          </div>
          <div class="space-y-5">
            <div v-for="i in 5" :key="i" class="space-y-2">
              <div class="flex justify-between">
                <div class="h-3 w-20 bg-noble-black/10 rounded"></div>
                <div class="h-3 w-4 bg-noble-black/10 rounded"></div>
              </div>
              <div class="h-1 w-full bg-noble-black/5 rounded-full"></div>
            </div>
          </div>
        </div>
      </aside>
    </section>
  </div>
</template>

<script setup lang="ts">
// Specialized skeleton for My Listing Analytics dashboard
</script>
