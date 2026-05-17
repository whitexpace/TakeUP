<template>
  <div class="min-h-screen bg-white font-geist pt-16 animate-pulse">
    <div class="max-w-[1200px] mx-auto py-6 flex flex-col gap-6 px-4 sm:px-0">
      <!-- TOP HERO SECTION SKELETON -->
      <header class="profile-hero shadow-xl">
        <div class="absolute inset-0 z-0 bg-noble-black/10"></div>

        <div
          class="hero-content relative z-10 w-full flex flex-col lg:flex-row items-center justify-between gap-12"
        >
          <!-- User Main Info Skeleton -->
          <div class="user-info-group flex flex-col md:flex-row items-center gap-8">
            <div
              class="w-[120px] h-[120px] md:w-[160px] md:h-[160px] rounded-full bg-noble-black/20 border-[6px] border-white/30 shrink-0"
            ></div>
            <div class="user-text space-y-4 text-center md:text-left">
              <div
                class="h-10 md:h-12 w-48 md:w-64 bg-noble-black/20 rounded mx-auto md:mx-0"
              ></div>
              <div class="flex gap-3 justify-center md:justify-start">
                <div class="h-6 w-24 bg-noble-black/10 rounded"></div>
                <div class="h-6 w-12 bg-noble-black/10 rounded"></div>
              </div>
              <div class="h-4 w-40 md:w-80 bg-noble-black/10 rounded mx-auto md:mx-0"></div>
            </div>
          </div>

          <!-- Rating & Stats Section Skeleton -->
          <div class="hero-stats-group w-full lg:w-auto min-w-0 lg:min-w-[320px] space-y-6">
            <div class="flex gap-4">
              <div
                v-for="i in 2"
                :key="i"
                class="flex-1 bg-white/10 rounded-[24px] p-6 flex flex-col items-center gap-2"
              >
                <div class="h-10 w-16 bg-noble-black/20 rounded"></div>
                <div class="h-3 w-16 bg-noble-black/10 rounded"></div>
                <div class="h-2 w-12 bg-noble-black/5 rounded"></div>
              </div>
            </div>
            <div
              class="grid grid-cols-3 bg-white/10 rounded-[24px] overflow-hidden border border-white/10"
            >
              <div
                v-for="i in 3"
                :key="i"
                class="p-4 flex flex-col items-center gap-2 border-r border-white/5 last:border-0"
              >
                <div class="h-5 w-8 bg-noble-black/20 rounded"></div>
                <div class="h-2 w-10 bg-noble-black/10 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- MAIN CONTENT SECTION SKELETON -->
      <main class="space-y-8 px-2">
        <!-- Simplified Tab Bar Skeleton -->
        <div class="flex items-center gap-8 border-b border-gray-100 mb-8">
          <div v-for="i in 2" :key="i" class="py-4 flex items-center gap-2">
            <div class="h-4 w-24 bg-noble-black/10 rounded"></div>
            <div class="h-5 w-8 bg-noble-black/10 rounded-full"></div>
          </div>
        </div>

        <div class="flex flex-col lg:flex-row gap-8">
          <!-- Left Column Skeleton -->
          <div class="lg:w-[65%] space-y-8">
            <!-- Filter Pills Skeleton -->
            <div class="flex gap-2 mb-8">
              <div v-for="i in 3" :key="i" class="h-8 w-24 bg-noble-black/10 rounded-full"></div>
            </div>
            <!-- Reviews List Skeleton -->
            <div v-for="i in 3" :key="i" class="py-6 border-b border-gray-50 flex flex-col gap-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="h-9 w-9 rounded-full bg-noble-black/10"></div>
                  <div class="space-y-2">
                    <div class="h-4 w-32 bg-noble-black/20 rounded"></div>
                    <div class="h-3 w-24 bg-noble-black/10 rounded"></div>
                  </div>
                </div>
                <div class="h-6 w-24 bg-noble-black/10 rounded-full"></div>
              </div>
              <div class="h-4 w-full bg-noble-black/5 rounded"></div>
              <div class="h-4 w-3/4 bg-noble-black/5 rounded"></div>
            </div>
          </div>

          <!-- Right Column Skeleton -->
          <div class="lg:w-[35%]">
            <div class="rounded-[14px] border border-gray-100 bg-white p-6 space-y-6 shadow-sm">
              <div class="h-4 w-24 bg-noble-black/10 rounded"></div>
              <div v-for="i in 2" :key="i" class="flex gap-4">
                <div class="mt-1.5 w-2 h-2 rounded-full bg-noble-black/10 shrink-0"></div>
                <div class="space-y-2 flex-1">
                  <div class="h-3 w-24 bg-noble-black/20 rounded"></div>
                  <div class="h-3 w-full bg-noble-black/5 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
// Profile Skeleton matches app/pages/profile/[username].vue layout
</script>

<style scoped>
.profile-hero {
  border-radius: 40px;
  padding: 48px;
  position: relative;
  overflow: hidden;
  min-height: 320px;
  display: flex;
  align-items: center;
}

@media (max-width: 1024px) {
  .hero-content {
    flex-direction: column;
    gap: 32px;
  }
}

@media (max-width: 768px) {
  .profile-hero {
    padding: 32px;
    border-radius: 30px;
  }
}
</style>
