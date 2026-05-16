<script setup lang="ts">
const { isLoading, stopLoading } = useAppLoading()
const { getSession, ensureBridgedSession } = useViewerSession()

onMounted(async () => {
  // Ensure the session is loaded and bridged before hiding the loading screen
  try {
    const session = await getSession()
    if (session) {
      await ensureBridgedSession()
    }
  } catch (error) {
    console.error("Initial load session error:", error)
  } finally {
    // Small delay to ensure smooth transition
    setTimeout(() => {
      stopLoading()
    }, 500)
  }
})
</script>

<template>
  <div class="min-h-screen bg-white font-geist">
    <AppLoadingScreen v-if="isLoading" />
    <NuxtLayout v-else>
      <NuxtPage :page-key="(route) => route.fullPath" />
    </NuxtLayout>
  </div>
</template>
