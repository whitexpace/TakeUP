<template>
  <div class="flex flex-col h-screen font-geist bg-white relative overflow-hidden">
    <!-- Top Header -->
    <Header
      :notifications="notifications"
      @mark-notification-read="markNotificationRead"
      @mark-all-notifications-read="markAllNotificationsRead"
    >
      <template #left>
        <button
          v-if="!hideSidebar"
          class="flex items-center justify-center h-10 w-10 rounded-full text-noble-black transition-colors hover:bg-cream hover:text-burning-orange"
          aria-label="Toggle Sidebar"
          title="Toggle Sidebar"
          @click="toggleSidebar"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
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
      </template>
    </Header>

    <div class="flex flex-1 overflow-hidden h-[calc(100vh-56px)] relative">
      <!-- Sidebar Overlay for Mobile -->
      <div
        v-if="!hideSidebar && isSidebarOpen && isMobile"
        class="fixed inset-0 bg-noble-black/50 z-40 lg:hidden transition-opacity duration-300"
        @click="isSidebarOpen = false"
      />

      <!-- Left Sidebar -->
      <aside
        v-if="!hideSidebar"
        class="bg-cream flex-col shrink-0 border-r border-cinnamon-ice transition-all duration-300 ease-in-out z-50 overflow-y-auto custom-sidebar-scrollbar fixed inset-y-0 left-0 lg:relative lg:translate-x-0"
        :class="[
          isSidebarOpen
            ? 'translate-x-0 w-80'
            : '-translate-x-full lg:translate-x-0 lg:w-0 lg:opacity-0 lg:pointer-events-none',
        ]"
      >
        <!-- Sidebar Content Area -->
        <div class="px-6 space-y-0 pb-12">
          <FilterPanel
            v-if="$route.path.startsWith('/dashboard')"
            :filter-metadata="filterMetadata"
            :selected-listing-types="filters.selectedListingTypes.value"
            :selected-categories="filters.selectedCategories.value"
            :selected-price-range="filters.selectedPriceRange.value"
            :selected-rating="filters.selectedRating.value"
            :selected-conditions="filters.selectedConditions.value"
            :date-from="filters.dateFrom.value"
            :time-from="filters.timeFrom.value"
            :date-to="filters.dateTo.value"
            :time-to="filters.timeTo.value"
            @update:selected-listing-types="(v) => (filters.selectedListingTypes.value = v)"
            @update:selected-categories="(v) => (filters.selectedCategories.value = v)"
            @update:selected-price-range="(v) => (filters.selectedPriceRange.value = v)"
            @update:selected-rating="(v) => (filters.selectedRating.value = v)"
            @update:selected-conditions="(v) => (filters.selectedConditions.value = v)"
            @update:date-from="(v) => (filters.dateFrom.value = v)"
            @update:time-from="(v) => (filters.timeFrom.value = v)"
            @update:date-to="(v) => (filters.dateTo.value = v)"
            @update:time-to="(v) => (filters.timeTo.value = v)"
          />
          <slot name="sidebar" />
        </div>
      </aside>

      <!-- Main Content Area -->
      <main
        class="flex-1 bg-white overflow-y-auto custom-main-scrollbar transition-all duration-300 ease-in-out relative"
      >
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue"
import type { FilterMetadata } from "../types/item-listing"
import { useDashboardFilters } from "../composables/use-dashboard-filters"
import { useNotifications } from "../composables/use-notifications"

const route = useRoute()
const isSidebarOpen = ref(true)
const isMobile = ref(false)
const hideSidebar = computed(() => Boolean(route.meta.hideDashboardSidebar))
const { notifications, loadNotifications, markNotificationRead, markAllNotificationsRead } =
  useNotifications()

const toggleSidebar = () => {
  if (hideSidebar.value) return
  isSidebarOpen.value = !isSidebarOpen.value
}

const checkMobile = () => {
  if (hideSidebar.value) {
    isMobile.value = window.innerWidth < 1024
    isSidebarOpen.value = false
    return
  }

  isMobile.value = window.innerWidth < 1024 // lg breakpoint
  if (isMobile.value) {
    isSidebarOpen.value = false
  } else {
    isSidebarOpen.value = true
  }
}

// ── Filter state (shared via provide/inject) ──────────────────────────────────
const filters = useDashboardFilters()

// ── Filter metadata (static counts – fetched once) ───────────────────────────
const filterMetadata = ref<FilterMetadata | null>(null)
const fetchFilterMetadata = async () => {
  try {
    filterMetadata.value = await $fetch<FilterMetadata>("/api/items/filter-metadata")
  } catch {
    // Non-critical – counts will show 0
  }
}

// Provide to child pages
provide("dashboardFilters", filters)

onMounted(async () => {
  checkMobile()
  window.addEventListener("resize", checkMobile)
  await loadNotifications()
  if (!hideSidebar.value) {
    await fetchFilterMetadata()
  }
})

onUnmounted(() => {
  window.removeEventListener("resize", checkMobile)
})
</script>

<style scoped>
.custom-sidebar-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-sidebar-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-sidebar-scrollbar::-webkit-scrollbar-thumb {
  background: theme("colors.cinnamon-ice / 50%");
  border-radius: 20px;
}

.custom-sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
  background: theme("colors.cinnamon-ice");
}

/* Firefox support */
.custom-sidebar-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: theme("colors.cinnamon-ice / 50%") transparent;
}

.custom-main-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-main-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-main-scrollbar::-webkit-scrollbar-thumb {
  background: theme("colors.noble-black / 10%"); /* noble-black/10 */
  border-radius: 20px;
}

.custom-main-scrollbar::-webkit-scrollbar-thumb:hover {
  background: theme("colors.noble-black / 20%");
}

/* Firefox support */
.custom-main-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: theme("colors.noble-black / 10%") transparent;
}
</style>
