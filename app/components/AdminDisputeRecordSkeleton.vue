<template>
  <div class="flex w-full h-[100px] items-center px-10 border-b border-gray-100 animate-pulse">
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-4 mb-1">
        <!-- Display Name Skeleton -->
        <div class="h-5 w-40 bg-noble-black/20 rounded" />
        <!-- Status Badge Skeleton -->
        <div class="h-4 w-16 bg-noble-black/10 rounded-full" />
      </div>
      <!-- Reason Skeleton -->
      <div class="h-4 w-64 bg-noble-black/10 rounded" />
    </div>

    <div class="text-right ml-8 shrink-0 space-y-1">
      <!-- REF Skeleton -->
      <div class="h-3 w-24 bg-noble-black/10 rounded ml-auto" />
      <!-- Date Skeleton -->
      <div class="h-3 w-32 bg-noble-black/5 rounded ml-auto" />
    </div>
  </div>
</template>

<script setup lang="ts">
// Skeleton for Dispute Queue list items
</script>
