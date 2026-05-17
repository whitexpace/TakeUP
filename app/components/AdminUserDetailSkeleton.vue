<template>
  <div class="animate-pulse space-y-10">
    <!-- Header Skeleton -->
    <header class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <div class="flex items-center gap-6">
        <div class="w-20 h-20 rounded-full bg-noble-black/10 shrink-0" />
        <div class="space-y-3">
          <div class="h-8 w-64 bg-noble-black/20 rounded-lg" />
          <div class="flex gap-2">
            <div class="h-5 w-24 bg-noble-black/10 rounded-full" />
            <div class="h-5 w-32 bg-noble-black/10 rounded-full" />
          </div>
        </div>
      </div>
      <div class="flex gap-3">
        <div class="h-11 w-32 bg-noble-black/10 rounded-xl" />
        <div class="h-11 w-32 bg-noble-black/20 rounded-xl" />
      </div>
    </header>

    <!-- Content Grid Skeleton -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Left: Main Info -->
      <div class="lg:col-span-2 space-y-8">
        <div class="bg-white rounded-[24px] border border-cinnamon-ice/20 p-8 shadow-sm">
          <div class="h-6 w-48 bg-noble-black/20 rounded mb-8" />
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div v-for="i in 4" :key="i" class="space-y-2">
              <div class="h-3 w-20 bg-noble-black/10 rounded" />
              <div class="h-5 w-40 bg-noble-black/10 rounded" />
            </div>
          </div>
        </div>

        <!-- Tabs Skeleton -->
        <div class="space-y-6">
          <div class="flex gap-8 border-b border-gray-100">
            <div v-for="i in 2" :key="i" class="pb-4 h-6 w-24 bg-noble-black/10 rounded" />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="i in 6" :key="i" class="h-64 bg-noble-black/5 rounded-[20px]" />
          </div>
        </div>
      </div>

      <!-- Right: Stats & Metadata -->
      <div class="space-y-8">
        <div class="bg-white rounded-[24px] border border-cinnamon-ice/20 p-8 shadow-sm h-64" />
        <div class="bg-white rounded-[24px] border border-cinnamon-ice/20 p-8 shadow-sm h-96" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Admin User Detail Skeleton
</script>
