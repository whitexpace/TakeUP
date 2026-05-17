<template>
  <div
    class="rounded-[24px] bg-white border border-cinnamon-ice/20 p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] animate-pulse"
  >
    <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0 flex-1 space-y-5">
        <!-- Title Row Skeleton -->
        <div class="flex flex-wrap items-center gap-3">
          <!-- Name -->
          <div class="h-6 w-56 bg-noble-black/20 rounded" />
          <!-- REF ID -->
          <div class="h-4 w-32 bg-noble-black/10 rounded" />
          <!-- Status -->
          <div class="h-5 w-20 bg-noble-black/10 rounded-full" />
        </div>

        <!-- Meta Info Grid Skeleton -->
        <div class="flex flex-wrap items-center gap-y-4 gap-x-8">
          <div v-for="i in 4" :key="i" class="space-y-1">
            <div class="h-3 w-20 bg-noble-black/10 rounded" />
            <div class="h-4 w-32 bg-noble-black/10 rounded" />
          </div>
        </div>
      </div>

      <!-- Action Button Skeleton -->
      <div class="h-10 w-10 rounded-full bg-noble-black/10 self-start" />
    </div>
  </div>
</template>

<script setup lang="ts">
// Updated Admin List Record Skeleton (matches Platform Listings)
</script>
