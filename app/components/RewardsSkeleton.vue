<template>
  <div class="mx-auto max-w-[1180px] space-y-8 animate-pulse font-geist lg:px-16 xl:px-24">
    <!-- Header Skeleton -->
    <header class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between mb-8">
      <section class="space-y-3">
        <div class="space-y-2">
          <div class="h-10 w-48 bg-noble-black/20 rounded-lg"></div>
          <div class="w-10 h-0.5 bg-burning-orange/30"></div>
        </div>
        <div class="h-4 w-96 bg-noble-black/10 rounded"></div>
      </section>
    </header>

    <!-- Points Hero Banner Skeleton -->
    <section
      class="w-full rounded-[32px] border border-cinnamon-ice/15 bg-cream/50 p-8 sm:p-12 mb-12 flex flex-col sm:flex-row items-center justify-between gap-10"
    >
      <div class="text-center sm:text-left space-y-4">
        <div class="h-16 w-32 bg-noble-black/20 rounded-xl mx-auto sm:mx-0"></div>
        <div class="h-4 w-40 bg-noble-black/10 rounded mx-auto sm:mx-0"></div>
      </div>
      <div
        class="w-32 h-32 rounded-full border-8 border-noble-black/5 flex items-center justify-center"
      >
        <div class="h-4 w-12 bg-noble-black/10 rounded"></div>
      </div>
    </section>

    <!-- Section 1: How to Earn Skeleton -->
    <section class="rounded-[24px] border border-cinnamon-ice/20 bg-cream/50 p-6 sm:p-8 space-y-8">
      <div class="border-l-[3px] border-burning-orange/30 pl-4 mb-8">
        <div class="h-6 w-32 bg-noble-black/20 rounded mb-2"></div>
        <div class="h-3 w-48 bg-noble-black/10 rounded"></div>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div
          v-for="i in 2"
          :key="i"
          class="h-48 bg-white rounded-[20px] border border-cinnamon-ice/10 p-6 space-y-4"
        >
          <div class="flex justify-between">
            <div class="h-10 w-10 rounded-full bg-noble-black/5"></div>
            <div class="h-5 w-5 bg-noble-black/5 rounded"></div>
          </div>
          <div class="space-y-2">
            <div class="h-5 w-32 bg-noble-black/20 rounded"></div>
            <div class="h-3 w-full bg-noble-black/10 rounded"></div>
          </div>
          <div class="h-6 w-20 bg-noble-black/5 rounded-full"></div>
        </div>
      </div>
    </section>

    <!-- Section 2: Spend Your Points Skeleton -->
    <section class="rounded-[24px] border border-cinnamon-ice/20 bg-cream/50 p-6 sm:p-8 space-y-8">
      <div class="border-l-[3px] border-burning-orange/30 pl-4 mb-8">
        <div class="h-6 w-40 bg-noble-black/20 rounded mb-2"></div>
        <div class="h-3 w-64 bg-noble-black/10 rounded"></div>
      </div>
      <div class="grid gap-6 xl:grid-cols-2">
        <div class="h-64 bg-white rounded-[20px] border border-cinnamon-ice/10"></div>
        <div class="h-64 bg-white rounded-[20px] border border-cinnamon-ice/10"></div>
      </div>
    </section>

    <!-- Section 3: Active Boosts Skeleton -->
    <section class="rounded-[24px] border border-cinnamon-ice/20 bg-cream/50 p-6 sm:p-8 space-y-8">
      <div class="border-l-[3px] border-burning-orange/30 pl-4 mb-8">
        <div class="h-6 w-32 bg-noble-black/20 rounded mb-2"></div>
        <div class="h-3 w-48 bg-noble-black/10 rounded"></div>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div
          v-for="i in 2"
          :key="i"
          class="h-28 bg-white rounded-[20px] border border-cinnamon-ice/10 p-4 flex items-center gap-4"
        >
          <div class="h-14 w-14 rounded-[10px] bg-noble-black/10"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 w-3/4 bg-noble-black/20 rounded"></div>
            <div class="h-3 w-1/2 bg-noble-black/10 rounded"></div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Specialized skeleton for My Rewards page
</script>
