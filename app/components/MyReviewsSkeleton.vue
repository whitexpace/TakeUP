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

    <!-- Stats Strip Skeleton -->
    <div class="flex flex-wrap items-center gap-3 mb-10">
      <div
        v-for="i in 3"
        :key="i"
        class="h-8 w-24 bg-noble-black/5 rounded-full border border-noble-black/5"
      ></div>
    </div>

    <!-- Tabs & Search Row Skeleton -->
    <div
      class="flex flex-col sm:flex-row sm:items-end justify-between border-b border-cinnamon-ice/15 mb-12 gap-4"
    >
      <div class="flex gap-8">
        <div v-for="i in 3" :key="i" class="pb-4 h-6 w-20 bg-noble-black/10 rounded"></div>
      </div>
      <div class="mb-4 h-9 w-full sm:max-w-[280px] bg-noble-black/5 rounded-[10px]"></div>
    </div>

    <div class="grid gap-8 lg:grid-cols-[1fr_340px]">
      <!-- Main Content Skeleton -->
      <div class="space-y-6">
        <div
          class="bg-cream/50 rounded-[24px] border border-cinnamon-ice/20 p-6 sm:p-8 space-y-8 h-full"
        >
          <div class="border-l-[3px] border-burning-orange/30 pl-4 mb-6">
            <div class="h-6 w-48 bg-noble-black/20 rounded mb-2"></div>
            <div class="h-3 w-64 bg-noble-black/10 rounded"></div>
          </div>

          <div class="space-y-4">
            <div
              v-for="i in 3"
              :key="i"
              class="bg-white rounded-[16px] border border-cinnamon-ice/10 overflow-hidden shadow-sm"
            >
              <div
                class="px-5 py-3 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center"
              >
                <div class="h-4 w-32 bg-noble-black/10 rounded"></div>
                <div class="h-5 w-24 bg-noble-black/5 rounded-full"></div>
              </div>
              <div class="p-5 flex items-center gap-4">
                <div class="w-14 h-14 rounded-[10px] bg-noble-black/5 shrink-0"></div>
                <div class="flex-1 space-y-2">
                  <div class="h-4 w-40 bg-noble-black/20 rounded"></div>
                  <div class="h-3 w-32 bg-noble-black/10 rounded"></div>
                </div>
                <div class="h-8 w-24 bg-noble-black/5 rounded-lg"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar Skeleton -->
      <aside class="space-y-6 self-start">
        <div class="rounded-[16px] border border-cinnamon-ice/30 bg-white p-5 space-y-6">
          <div class="h-4 w-24 bg-noble-black/10 rounded"></div>
          <div class="space-y-4">
            <div v-for="i in 4" :key="i" class="flex gap-3">
              <div class="w-4 h-4 rounded-full bg-noble-black/5 shrink-0"></div>
              <div class="h-3 flex-1 bg-noble-black/5 rounded"></div>
            </div>
          </div>
        </div>
        <div class="h-24 bg-blue-estate/[0.02] border border-blue-estate/10 rounded-[12px]"></div>
      </aside>
    </div>

    <!-- Leaderboard Skeleton -->
    <section class="mt-16 pt-12 border-t border-cinnamon-ice/20 space-y-8">
      <div class="border-l-[3px] border-burning-orange/30 pl-4">
        <div class="h-6 w-48 bg-noble-black/20 rounded mb-2"></div>
        <div class="h-3 w-96 bg-noble-black/10 rounded"></div>
      </div>
      <div class="grid gap-6 lg:grid-cols-2">
        <div
          v-for="i in 2"
          :key="i"
          class="bg-white rounded-[20px] border border-cinnamon-ice/30 p-6 space-y-6"
        >
          <div class="h-5 w-32 bg-noble-black/10 rounded"></div>
          <div class="space-y-4">
            <div v-for="j in 5" :key="j" class="flex items-center gap-4">
              <div class="h-6 w-6 bg-noble-black/5 rounded"></div>
              <div class="h-9 w-9 rounded-full bg-noble-black/10"></div>
              <div class="flex-1 space-y-2">
                <div class="h-4 w-24 bg-noble-black/10 rounded"></div>
                <div class="h-3 w-16 bg-noble-black/5 rounded"></div>
              </div>
              <div class="h-4 w-8 bg-noble-black/10 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Specialized skeleton for My Reviews page
</script>
