<script setup lang="ts">
defineProps<{
  message?: string
}>()
</script>

<template>
  <div
    class="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center transition-opacity duration-300"
  >
    <!-- Middle Section: TakeUP Logo -->
    <div class="flex-1 flex flex-col items-center justify-center">
      <img src="/images/takeup-logo.png" alt="TakeUP Logo" class="h-24 w-auto animate-pulse" />
      <p v-if="message" class="mt-4 text-noble-black/60 font-geist text-sm animate-pulse">
        {{ message }}
      </p>
    </div>

    <!-- Bottom Section: Team Logo & Text -->
    <div class="pb-16 flex flex-col items-center gap-3">
      <img src="/images/team-logo.png" alt="White Space Team" class="h-10 w-auto opacity-80" />
      <span class="font-montravia text-noble-black text-[22px] tracking-[0.1em] uppercase">
        White Space
      </span>
    </div>
  </div>
</template>

<style scoped>
.font-montravia {
  font-family: "Nv Montravia", sans-serif;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
