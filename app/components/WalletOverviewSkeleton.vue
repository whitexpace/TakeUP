<template>
  <div class="space-y-6 font-geist animate-pulse">
    <!-- Header Skeleton -->
    <section class="space-y-3">
      <div class="space-y-2">
        <div class="h-8 sm:h-10 w-40 sm:w-48 bg-noble-black/20 rounded-lg"></div>
        <div class="w-10 h-0.5 bg-burning-orange/30"></div>
      </div>
      <div class="h-4 w-64 sm:w-80 bg-noble-black/10 rounded"></div>
    </section>

    <!-- Centered Card Container Skeleton -->
    <div class="flex justify-center w-full">
      <div
        class="rounded-[24px] bg-noble-black/5 w-full max-w-[540px] aspect-[1.586/1] max-h-[320px] p-5 sm:p-8 flex flex-col justify-between border border-noble-black/5"
      >
        <div class="flex justify-end">
          <div class="h-3 w-20 sm:w-24 bg-noble-black/10 rounded"></div>
        </div>
        <div class="py-2 sm:py-4">
          <div class="h-3 w-16 sm:w-20 bg-noble-black/10 rounded mb-3 sm:mb-4"></div>
          <div class="h-10 sm:h-12 w-36 sm:w-48 bg-noble-black/20 rounded-xl"></div>
        </div>
        <div
          class="flex flex-col xs:flex-row justify-between items-start xs:items-end gap-4 xs:gap-0"
        >
          <div class="h-3 w-28 sm:w-32 bg-noble-black/10 rounded"></div>
          <div class="flex gap-2 sm:gap-3 w-full xs:w-auto">
            <div
              class="h-9 sm:h-10 flex-1 xs:w-24 bg-noble-black/20 rounded-[12px] sm:rounded-2xl"
            ></div>
            <div
              class="h-9 sm:h-10 flex-1 xs:w-24 bg-noble-black/10 rounded-[12px] sm:rounded-xl"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Protection Notice Skeleton -->
    <div class="flex justify-center">
      <div class="h-4 w-72 sm:w-96 bg-noble-black/5 rounded"></div>
    </div>

    <!-- Grid Content Skeleton -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
      <!-- Linked Accounts Skeleton -->
      <div
        class="bg-cream/50 rounded-[24px] border border-cinnamon-ice/20 p-5 sm:p-8 space-y-6 sm:space-y-8 h-full"
      >
        <div class="border-l-[3px] border-burning-orange/30 pl-3 sm:pl-4">
          <div class="h-5 sm:h-6 w-28 sm:w-32 bg-noble-black/20 rounded mb-2"></div>
          <div class="h-3 w-36 sm:w-40 bg-noble-black/10 rounded"></div>
        </div>
        <div class="space-y-3 sm:space-y-4">
          <div
            v-for="i in 2"
            :key="i"
            class="h-14 sm:h-[72px] bg-white rounded-[14px] border border-neutral-100"
          ></div>
        </div>
        <div
          class="h-12 sm:h-14 w-full bg-noble-black/5 rounded-[14px] border-2 border-dashed border-burning-orange/10"
        ></div>
      </div>

      <!-- Recent Activity Skeleton -->
      <div
        class="bg-cream/50 rounded-[24px] border border-cinnamon-ice/20 p-5 sm:p-8 space-y-6 sm:space-y-8 h-full"
      >
        <div class="border-l-[3px] border-burning-orange/30 pl-3 sm:pl-4">
          <div class="h-5 sm:h-6 w-28 sm:w-32 bg-noble-black/20 rounded mb-2"></div>
          <div class="h-3 w-36 sm:w-40 bg-noble-black/10 rounded"></div>
        </div>
        <div class="space-y-4 sm:space-y-6">
          <div v-for="i in 4" :key="i" class="flex items-center justify-between">
            <div class="flex items-center gap-3 sm:gap-4">
              <div class="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-noble-black/10"></div>
              <div class="space-y-2">
                <div class="h-3.5 w-28 sm:w-32 bg-noble-black/20 rounded"></div>
                <div class="h-2.5 w-20 sm:w-24 bg-noble-black/10 rounded"></div>
              </div>
            </div>
            <div class="h-4 w-16 sm:w-20 bg-noble-black/20 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
