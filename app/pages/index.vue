<template>
  <main class="page">
    <h1>Nuxt 4 + tRPC + Prisma + Supabase</h1>
    <p>{{ status }}</p>
  </main>
</template>

<script setup lang="ts">
const { $trpc } = useNuxtApp()

const { data } = await useAsyncData('health', () => $trpc.health.ping.query())
const status = computed(() => (data.value?.ok ? 'API is healthy' : 'API not ready'))
</script>

<style scoped>
.page {
  padding: 2rem;
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    sans-serif;
}
</style>
