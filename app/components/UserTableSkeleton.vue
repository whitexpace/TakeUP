<template>
  <div class="animate-pulse">
    <div class="overflow-x-auto">
      <table class="w-full text-left">
        <thead>
          <tr class="bg-gray-50 border-b border-gray-100">
            <th v-for="i in 4" :key="i" class="px-8 py-5">
              <div class="h-3 w-20 bg-noble-black/10 rounded tracking-[2px]" />
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="i in 6" :key="i" class="h-[72px]">
            <!-- User Column -->
            <td class="px-8 py-2">
              <div class="flex items-center gap-4">
                <div class="h-[42px] w-[42px] rounded-full bg-noble-black/10 shrink-0" />
                <div class="space-y-2">
                  <div class="h-4 w-32 bg-noble-black/20 rounded" />
                  <div class="h-3 w-24 bg-noble-black/10 rounded" />
                </div>
              </div>
            </td>
            <!-- Role Column -->
            <td class="px-8 py-2">
              <div class="h-6 w-20 bg-noble-black/10 rounded-full" />
            </td>
            <!-- Status Column -->
            <td class="px-8 py-2">
              <div class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full bg-noble-black/20" />
                <div class="h-4 w-16 bg-noble-black/10 rounded" />
              </div>
            </td>
            <!-- Ratings Column -->
            <td class="px-8 py-2">
              <div class="flex gap-4">
                <div class="h-4 w-8 bg-noble-black/10 rounded" />
                <div class="h-4 w-8 bg-noble-black/10 rounded" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
// Specialized skeleton for the User Management table
</script>
