<script setup lang="ts">
interface Props {
  activeTab: "report" | "disputes" | "appeals"
}

defineProps<Props>()
</script>

<template>
  <div
    class="mx-auto max-w-[1100px] space-y-6 pb-10 animate-pulse font-geist px-4 sm:px-6 lg:px-16 xl:px-24"
  >
    <!-- Page Header Skeleton -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8 sm:mb-10">
      <section class="space-y-3">
        <div class="space-y-2">
          <div class="h-8 sm:h-10 w-40 sm:w-48 bg-noble-black/20 rounded-lg"></div>
          <div class="w-10 h-0.5 bg-burning-orange/30"></div>
        </div>
        <div class="h-4 w-64 sm:w-80 bg-noble-black/10 rounded"></div>
      </section>
    </div>

    <!-- Tab Bar Skeleton -->
    <div class="mb-8 sm:mb-10 overflow-x-auto">
      <div class="flex gap-6 sm:gap-10 border-b border-gray-100 min-w-max">
        <div
          v-for="i in 3"
          :key="i"
          class="pb-3 sm:pb-4 h-5 sm:h-6 w-24 sm:w-32 bg-noble-black/10 rounded"
        ></div>
      </div>
    </div>

    <!-- Tab Content Skeletons -->
    <template v-if="activeTab === 'report'">
      <div class="space-y-8 sm:space-y-12">
        <!-- Progress Indicator Skeleton -->
        <div class="max-w-2xl mx-auto px-2 sm:px-4">
          <div class="flex items-center justify-between relative">
            <div class="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-gray-100"></div>
            <div
              v-for="i in 3"
              :key="i"
              class="relative z-10 flex flex-col items-center gap-2 sm:gap-3"
            >
              <div
                class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-noble-black/10 border-2 border-white"
              ></div>
              <div class="h-3 w-16 sm:w-20 bg-noble-black/5 rounded"></div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-5 gap-8 sm:gap-12 mt-12 sm:mt-16">
          <!-- Left: Form Steps Skeleton -->
          <div class="lg:col-span-3 space-y-6 sm:space-y-8">
            <div
              class="space-y-3 sm:space-y-4 border-l-[3px] border-burning-orange/30 pl-3 sm:pl-4"
            >
              <div class="h-6 sm:h-8 w-48 sm:w-64 bg-noble-black/20 rounded"></div>
              <div class="h-3.5 sm:h-4 w-72 sm:w-96 bg-noble-black/10 rounded"></div>
            </div>
            <div class="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
              <div
                v-for="i in 4"
                :key="i"
                class="h-28 sm:h-32 bg-white border border-gray-100 rounded-[14px]"
              ></div>
            </div>
          </div>

          <!-- Right: Sidebar Skeleton -->
          <aside class="lg:col-span-2 space-y-6">
            <div
              class="bg-white border border-gray-100 rounded-[20px] sm:rounded-[24px] p-6 sm:p-8 space-y-5 sm:space-y-6"
            >
              <div class="h-5 sm:h-6 w-32 sm:w-40 bg-noble-black/20 rounded"></div>
              <div v-for="i in 3" :key="i" class="flex gap-3 sm:gap-4">
                <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-noble-black/5 shrink-0"></div>
                <div class="space-y-2 flex-1">
                  <div class="h-3.5 sm:h-4 w-20 sm:w-24 bg-noble-black/10 rounded"></div>
                  <div class="h-2.5 sm:h-3 w-full bg-noble-black/5 rounded"></div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </template>

    <template v-else>
      <!-- Disputes / Appeals Tab Skeleton -->
      <section
        class="bg-cream/50 border border-cinnamon-ice/20 rounded-[24px] p-5 sm:p-8 space-y-6 sm:space-y-8"
      >
        <div class="border-l-[3px] border-burning-orange/30 pl-3 sm:pl-4">
          <div class="h-5 sm:h-6 w-28 sm:w-32 bg-noble-black/20 rounded mb-2"></div>
          <div class="h-3 w-48 sm:w-64 bg-noble-black/10 rounded"></div>
        </div>

        <div class="space-y-4">
          <div
            v-for="i in 3"
            :key="i"
            class="bg-white border border-gray-50 rounded-[20px] sm:rounded-[22px] overflow-hidden shadow-sm"
          >
            <div
              class="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center"
            >
              <div class="h-3.5 sm:h-4 w-32 sm:w-48 bg-noble-black/10 rounded"></div>
              <div class="h-5 sm:h-6 w-16 sm:w-20 bg-noble-black/10 rounded-full"></div>
            </div>
            <div class="p-4 sm:p-6 space-y-3 sm:space-y-4">
              <div class="flex flex-col sm:flex-row justify-between gap-3 sm:gap-0">
                <div class="space-y-2">
                  <div class="h-4 sm:h-5 w-48 sm:w-64 bg-noble-black/20 rounded"></div>
                  <div class="h-3 sm:h-4 w-32 sm:w-40 bg-noble-black/10 rounded"></div>
                </div>
                <div class="h-3.5 sm:h-4 w-24 sm:w-32 bg-noble-black/10 rounded"></div>
              </div>
              <div class="h-14 sm:h-16 bg-gray-50/50 rounded-xl"></div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
