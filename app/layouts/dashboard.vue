<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue"

const isSidebarOpen = ref(true)
const isMobile = ref(false)

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

const checkMobile = () => {
  isMobile.value = window.innerWidth < 1024 // lg breakpoint
  if (isMobile.value) {
    isSidebarOpen.value = false
  } else {
    isSidebarOpen.value = true
  }
}

onMounted(() => {
  checkMobile()
  window.addEventListener("resize", checkMobile)
})

onUnmounted(() => {
  window.removeEventListener("resize", checkMobile)
})
</script>

<template>
  <div class="flex flex-col min-h-screen font-geist bg-white relative">
    <!-- Top Header -->
    <Header />

    <div class="flex flex-1 overflow-hidden h-[calc(100vh-56px)] relative">
      <!-- Sidebar Overlay for Mobile -->
      <div
        v-if="isSidebarOpen && isMobile"
        class="fixed inset-0 bg-noble-black/50 z-40 lg:hidden transition-opacity duration-300"
        @click="isSidebarOpen = false"
      ></div>

      <!-- Left Sidebar -->
      <aside
        class="bg-cream flex-col shrink-0 border-r border-cinnamon-ice transition-all duration-300 ease-in-out z-50 overflow-y-auto fixed inset-y-0 left-0 lg:relative lg:translate-x-0"
        :class="[
          isSidebarOpen
            ? 'translate-x-0 w-80'
            : '-translate-x-full lg:translate-x-0 lg:w-0 lg:opacity-0 lg:pointer-events-none',
        ]"
      >
        <!-- Sidebar Header with Toggle -->
        <div class="p-6 flex items-center justify-between">
          <div class="font-bold text-xl text-blue-estate"></div>
          <button
            @click="toggleSidebar"
            class="p-1 hover:bg-pale-cashmere rounded-full transition-colors"
            title="Hide Sidebar"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              class="text-noble-black"
            >
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>

        <!-- Sidebar Content Placeholder for future implementation -->
        <div class="px-6 space-y-4"></div>
      </aside>

      <!-- Main Content Area -->
      <main
        class="flex-1 bg-white overflow-y-auto transition-all duration-300 ease-in-out relative"
      >
        <!-- Floating Toggle Button (visible when sidebar is hidden) -->
        <button
          v-if="!isSidebarOpen"
          @click="toggleSidebar"
          class="fixed left-4 top-[72px] z-20 p-2.5 bg-white border border-cinnamon-ice rounded-full shadow-md hover:bg-cream transition-all hover:scale-110 flex items-center justify-center"
          title="Show Sidebar"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class="text-noble-black"
          >
            <path
              d="M4 6H20M4 12H20M4 18H20"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <slot />
      </main>
    </div>
  </div>
</template>
