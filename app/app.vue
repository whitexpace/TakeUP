<script setup lang="ts">
const { isLoading, stopLoading } = useAppLoading()
const { getSession, ensureBridgedSession } = useViewerSession()

const INITIAL_PAINT_ASSET_TIMEOUT_MS = 3500

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number) =>
  Promise.race([
    promise,
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, timeoutMs)
    }),
  ])

const waitForStylesheet = (link: HTMLLinkElement) => {
  if (link.sheet) return Promise.resolve()

  return new Promise<void>((resolve) => {
    const done = () => {
      link.removeEventListener("load", done)
      link.removeEventListener("error", done)
      resolve()
    }

    link.addEventListener("load", done, { once: true })
    link.addEventListener("error", done, { once: true })
  })
}

const waitForInitialPaintAssets = async () => {
  const stylesheetLinks = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
  )

  await withTimeout(
    Promise.all([
      Promise.all(stylesheetLinks.map(waitForStylesheet)),
      document.fonts?.ready ?? Promise.resolve(),
    ]),
    INITIAL_PAINT_ASSET_TIMEOUT_MS,
  )
}

onMounted(async () => {
  // Ensure the session is loaded and bridged before hiding the loading screen
  try {
    const session = await getSession()
    if (session) {
      await ensureBridgedSession()
    }
    await waitForInitialPaintAssets()
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
    <!-- Overlay the loading screen -->
    <Transition
      leave-active-class="transition duration-500 ease-in-out"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <AppLoadingScreen v-if="isLoading" />
    </Transition>

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
