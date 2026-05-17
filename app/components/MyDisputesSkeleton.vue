<script setup lang="ts">
interface Props {
  activeTab: "report" | "disputes" | "appeals"
}

defineProps<Props>()
</script>

<template>
  <div class="mx-auto max-w-[1100px] space-y-6 pb-10 animate-pulse font-geist lg:px-16 xl:px-24">
    <!-- Page Header Skeleton -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-10">
      <section class="space-y-3">
        <div class="space-y-2">
          <div class="h-10 w-48 bg-noble-black/20 rounded-lg"></div>
          <div class="w-10 h-0.5 bg-burning-orange/30"></div>
        </div>
        <div class="h-4 w-80 bg-noble-black/10 rounded"></div>
      </section>
    </div>

    <!-- Tab Bar Skeleton -->
    <div class="mb-10">
      <div class="flex gap-10 border-b border-gray-100">
        <div v-for="i in 3" :key="i" class="pb-4 h-6 w-32 bg-noble-black/10 rounded"></div>
      </div>
    </div>

    <!-- Tab Content Skeletons -->
    <template v-if="activeTab === 'report'">
      <div class="space-y-12">
        <!-- Progress Indicator Skeleton -->
        <div class="max-w-2xl mx-auto px-4">
          <div class="flex items-center justify-between relative">
            <div class="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-gray-100"></div>
            <div v-for="i in 3" :key="i" class="relative z-10 flex flex-col items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-noble-black/10 border-2 border-white"></div>
              <div class="h-3 w-20 bg-noble-black/5 rounded"></div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-5 gap-12 mt-16">
          <!-- Left: Form Steps Skeleton -->
          <div class="lg:col-span-3 space-y-8">
            <div class="space-y-4 border-l-[3px] border-burning-orange/30 pl-4">
              <div class="h-8 w-64 bg-noble-black/20 rounded"></div>
              <div class="h-4 w-96 bg-noble-black/10 rounded"></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                v-for="i in 4"
                :key="i"
                class="h-32 bg-white border border-gray-100 rounded-[14px]"
              ></div>
            </div>
          </div>

          <!-- Right: Sidebar Skeleton -->
          <aside class="lg:col-span-2 space-y-6">
            <div class="bg-white border border-gray-100 rounded-[24px] p-8 space-y-6">
              <div class="h-6 w-40 bg-noble-black/20 rounded"></div>
              <div v-for="i in 3" :key="i" class="flex gap-4">
                <div class="w-8 h-8 rounded-full bg-noble-black/5 shrink-0"></div>
                <div class="space-y-2 flex-1">
                  <div class="h-4 w-24 bg-noble-black/10 rounded"></div>
                  <div class="h-3 w-full bg-noble-black/5 rounded"></div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </template>

    <template v-else>
      <!-- Disputes / Appeals Tab Skeleton -->
      <section class="bg-cream/50 border border-cinnamon-ice/20 rounded-[24px] p-8 space-y-8">
        <div class="border-l-[3px] border-burning-orange/30 pl-4">
          <div class="h-6 w-32 bg-noble-black/20 rounded mb-2"></div>
          <div class="h-3 w-64 bg-noble-black/10 rounded"></div>
        </div>

        <div class="space-y-4">
          <div
            v-for="i in 3"
            :key="i"
            class="bg-white border border-gray-50 rounded-[22px] overflow-hidden shadow-sm"
          >
            <div
              class="px-6 py-4 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center"
            >
              <div class="h-4 w-48 bg-noble-black/10 rounded"></div>
              <div class="h-6 w-20 bg-noble-black/10 rounded-full"></div>
            </div>
            <div class="p-6 space-y-4">
              <div class="flex justify-between">
                <div class="space-y-2">
                  <div class="h-5 w-64 bg-noble-black/20 rounded"></div>
                  <div class="h-4 w-40 bg-noble-black/10 rounded"></div>
                </div>
                <div class="h-4 w-32 bg-noble-black/10 rounded"></div>
              </div>
              <div class="h-16 bg-gray-50/50 rounded-xl"></div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
