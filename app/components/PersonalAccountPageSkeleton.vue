<script setup lang="ts">
interface Props {
  hasSidebar?: boolean
  hasFilters?: boolean
  hasStats?: boolean
}

defineProps<Props>()
</script>

<template>
  <div class="mx-auto max-w-[1100px] space-y-8 animate-pulse font-geist lg:px-16 xl:px-24">
    <!-- Page Header Skeleton -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
      <section class="space-y-3">
        <div class="space-y-2">
          <div class="h-10 w-48 bg-noble-black/20 rounded-lg"></div>
          <div class="w-10 h-0.5 bg-burning-orange/30"></div>
        </div>
        <div class="h-4 w-80 bg-noble-black/10 rounded"></div>
      </section>
      <div class="hidden sm:block h-10 w-32 bg-noble-black/10 rounded-[10px]"></div>
    </div>

    <!-- Stats Strip Skeleton (Optional) -->
    <div v-if="hasStats" class="flex flex-wrap items-center gap-3 mb-10">
      <div
        v-for="i in 3"
        :key="i"
        class="h-8 w-24 bg-noble-black/5 rounded-full border border-noble-black/5"
      ></div>
    </div>

    <!-- Tabs & Search Row Skeleton (Optional) -->
    <div
      v-if="hasFilters"
      class="flex flex-col sm:flex-row sm:items-end justify-between border-b border-cinnamon-ice/15 mb-12 gap-4"
    >
      <div class="flex gap-8">
        <div v-for="i in 3" :key="i" class="pb-4 h-6 w-20 bg-noble-black/10 rounded"></div>
      </div>
      <div class="mb-4 h-9 w-full sm:max-w-[280px] bg-noble-black/5 rounded-[10px]"></div>
    </div>

    <!-- Main Content Layout -->
    <div :class="['grid gap-8', hasSidebar ? 'lg:grid-cols-[1fr_340px]' : 'grid-cols-1']">
      <!-- Main Panel(s) -->
      <div class="space-y-6">
        <div class="bg-cream/50 rounded-[24px] border border-cinnamon-ice/20 p-8 space-y-8 h-full">
          <div class="border-l-[3px] border-burning-orange/30 pl-4 mb-6">
            <div class="h-6 w-32 bg-noble-black/20 rounded mb-2"></div>
            <div class="h-3 w-40 bg-noble-black/10 rounded"></div>
          </div>

          <div class="space-y-4">
            <div
              v-for="i in 3"
              :key="i"
              class="h-32 bg-white rounded-[16px] border border-cinnamon-ice/10"
            ></div>
          </div>
        </div>
      </div>

      <!-- Sidebar (Optional) -->
      <aside v-if="hasSidebar" class="space-y-6 self-start">
        <div class="rounded-[16px] border border-cinnamon-ice/30 bg-white p-5 space-y-6 h-64">
          <div class="h-4 w-24 bg-noble-black/10 rounded"></div>
          <div class="space-y-4">
            <div v-for="i in 4" :key="i" class="flex gap-3">
              <div class="w-4 h-4 rounded-full bg-noble-black/5"></div>
              <div class="h-3 flex-1 bg-noble-black/5 rounded"></div>
            </div>
          </div>
        </div>
        <div
          class="rounded-[12px] border border-blue-estate/10 bg-blue-estate/[0.02] p-4 h-24"
        ></div>
      </aside>
    </div>
  </div>
</template>
