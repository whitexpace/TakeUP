<script setup lang="ts">
const { isLoading, stopLoading } = useAppLoading()
const { getSession, ensureBridgedSession } = useViewerSession()
const isAppReady = ref(false)

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
    isAppReady.value = true
    // Small delay to ensure smooth transition
    setTimeout(() => {
      stopLoading()
    }, 500)
  }
})
</script>

<template>
  <div class="min-h-screen bg-white font-geist">
    <!-- Overlay the loading screen -->
    <Transition
      leave-active-class="transition duration-500 ease-in-out"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <AppLoadingScreen v-if="isLoading" />
    </Transition>

    <!-- Always render components to satisfy Nuxt, but only allow them to act when ready -->
    <NuxtLayout v-if="isAppReady">
      <NuxtPage :page-key="(route) => route.fullPath" />
    </NuxtLayout>
  </div>
</template>
