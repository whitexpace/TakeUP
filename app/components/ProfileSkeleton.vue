<template>
  <div class="min-h-screen bg-white font-geist pt-16 animate-pulse">
    <div class="max-w-[1200px] mx-auto py-6 flex flex-col gap-6">
      <!-- TOP HERO SECTION SKELETON -->
      <header class="profile-hero shadow-xl group/hero">
        <div class="absolute inset-0 z-0 bg-noble-black/10"></div>

        <div class="hero-content relative z-10 w-full flex items-center gap-8">
          <!-- User Main Info Skeleton -->
          <div class="user-info-group flex items-center gap-8">
            <div
              class="w-[160px] h-[160px] rounded-full bg-noble-black/20 border-[6px] border-white/30"
            ></div>
            <div class="user-text space-y-4">
              <div class="h-12 w-64 bg-noble-black/20 rounded"></div>
              <div class="flex gap-3">
                <div class="h-6 w-32 bg-noble-black/10 rounded"></div>
                <div class="h-6 w-16 bg-noble-black/10 rounded"></div>
              </div>
              <div class="h-4 w-96 bg-noble-black/10 rounded"></div>
            </div>
          </div>
        </div>
      </header>

      <!-- MAIN CONTENT SECTION SKELETON -->
      <main class="space-y-8">
        <!-- Simplified Tab Bar Skeleton -->
        <div class="flex items-center gap-8 border-b border-gray-100 px-2">
          <div v-for="i in 2" :key="i" class="py-4 flex items-center gap-2">
            <div class="h-4 w-24 bg-noble-black/10 rounded"></div>
            <div class="h-5 w-8 bg-noble-black/10 rounded-full"></div>
          </div>
        </div>

        <div class="flex flex-col lg:flex-row gap-8">
          <!-- Left Column Skeleton -->
          <div class="lg:w-[65%] space-y-8">
            <div class="flex gap-2 mb-8">
              <div v-for="i in 3" :key="i" class="h-8 w-24 bg-noble-black/10 rounded-full"></div>
            </div>
            <div v-for="i in 3" :key="i" class="py-6 border-b border-gray-50 flex flex-col gap-4">
              <div class="flex items-center gap-3">
                <div class="h-9 w-9 rounded-full bg-noble-black/10"></div>
                <div class="space-y-2">
                  <div class="h-4 w-32 bg-noble-black/20 rounded"></div>
                  <div class="h-3 w-24 bg-noble-black/10 rounded"></div>
                </div>
              </div>
              <div class="h-4 w-full bg-noble-black/10 rounded"></div>
              <div class="h-4 w-3/4 bg-noble-black/10 rounded"></div>
            </div>
          </div>

          <!-- Right Column Skeleton -->
          <div class="lg:w-[35%]">
            <div class="rounded-[14px] border border-gray-100 bg-white p-5 space-y-4">
              <div class="h-4 w-24 bg-noble-black/10 rounded"></div>
              <div v-for="i in 2" :key="i" class="flex gap-3">
                <div class="h-2 w-2 rounded-full bg-noble-black/10 mt-1"></div>
                <div class="space-y-2 flex-1">
                  <div class="h-3 w-20 bg-noble-black/20 rounded"></div>
                  <div class="h-2 w-full bg-noble-black/10 rounded"></div>
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
// Profile Skeleton
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
</style>
