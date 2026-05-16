<template>
  <div
    class="bg-white border border-cinnamon-ice/20 rounded-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.02)] overflow-hidden animate-pulse"
  >
    <div class="p-8 border-b border-gray-50 flex items-center justify-between">
      <div class="space-y-2">
        <div class="h-6 w-40 bg-noble-black/20 rounded" />
        <div class="h-4 w-64 bg-noble-black/10 rounded" />
      </div>
      <div class="h-10 w-24 bg-noble-black/10 rounded-full" />
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-left">
        <thead>
          <tr class="bg-gray-50/50 border-b border-gray-100">
            <th v-for="i in 5" :key="i" class="px-8 py-4">
              <div class="h-3 w-16 bg-noble-black/10 rounded" />
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="i in 5" :key="i" class="h-[72px]">
            <td v-for="j in 5" :key="j" class="px-8 py-5">
              <div class="h-4 w-full bg-noble-black/10 rounded" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
// Generic Table Skeleton
</script>
