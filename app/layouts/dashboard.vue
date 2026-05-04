<template>
  <div class="flex flex-col h-screen font-geist bg-white relative overflow-hidden">
    <!-- Top Header -->
    <Header
      :notifications="notifications"
      scroll-container-selector=".custom-main-scrollbar"
      @mark-notification-read="markNotificationRead"
      @mark-all-notifications-read="markAllNotificationsRead"
      @visibility-change="(v) => (isHeaderVisible = v)"
    >
      <template #left>
        <div class="relative flex items-stretch group/tooltip h-full">
          <button
            v-if="!hideSidebar"
            class="flex items-center justify-center px-2 text-noble-black transition-colors hover:text-burning-orange group"
            aria-label="Toggle Sidebar"
            @click="toggleSidebar"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              class="transition-transform duration-300 ease-in-out group-hover:scale-110 group-active:scale-95"
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
          <div class="custom-tooltip">
            Toggle Sidebar
            <div class="tooltip-arrow"></div>
          </div>
        </div>
      </template>
    </Header>

    <div class="flex flex-1 overflow-hidden h-screen relative">
      <!-- Sidebar Overlay for Mobile -->
      <div
        v-if="!hideSidebar && isSidebarOpen && isMobile"
        class="fixed inset-0 bg-noble-black/50 z-40 lg:hidden transition-opacity duration-300"
        @click="isSidebarOpen = false"
      />

      <!-- Left Sidebar -->
      <aside
        v-if="!hideSidebar"
        class="bg-cream flex-col shrink-0 border-r border-cinnamon-ice/40 transition-all duration-500 ease-in-out z-50 overflow-y-auto custom-sidebar-scrollbar fixed inset-y-0 left-0 lg:relative lg:translate-x-0"
        :class="[
          isSidebarOpen
            ? 'translate-x-0 w-[300px]'
            : '-translate-x-full lg:translate-x-0 lg:w-0 lg:opacity-0 lg:pointer-events-none',
          isHeaderVisible ? 'pt-14' : 'pt-0',
        ]"
      >
        <!-- Sidebar Content Area -->
        <div class="px-6 space-y-0 pb-12">
          <FilterPanel
            v-if="$route.path.startsWith('/dashboard')"
            :filter-metadata="filterMetadata"
            :selected-listing-types="filters.selectedListingTypes.value"
            :selected-categories="filters.selectedCategories.value"
            :min-price="filters.minPrice.value"
            :max-price="filters.maxPrice.value"
            :selected-rating="filters.selectedRating.value"
            :selected-conditions="filters.selectedConditions.value"
            :date-from="filters.dateFrom.value"
            :time-from="filters.timeFrom.value"
            :date-to="filters.dateTo.value"
            :time-to="filters.timeTo.value"
            @update:selected-listing-types="(v) => (filters.selectedListingTypes.value = v)"
            @update:selected-categories="(v) => (filters.selectedCategories.value = v)"
            @update:min-price="(v) => (filters.minPrice.value = v)"
            @update:max-price="(v) => (filters.maxPrice.value = v)"
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
        class="flex-1 bg-white overflow-y-auto custom-main-scrollbar transition-all duration-500 ease-in-out relative"
        :class="isHeaderVisible ? 'pt-14' : 'pt-0'"
      >
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, provide } from "vue"
import type { FilterMetadata } from "../types/item-listing"
import { useDashboardFilters } from "../composables/use-dashboard-filters"
import { useNotifications } from "../composables/use-notifications"

const route = useRoute()
const isSidebarOpen = ref(true)
const isMobile = ref(false)
const isHeaderVisible = ref(true)
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

onMounted(() => {
  checkMobile()
  window.addEventListener("resize", checkMobile)

  const startupTasks: Array<Promise<unknown>> = [loadNotifications()]
  if (!hideSidebar.value) {
    startupTasks.push(fetchFilterMetadata())
  }

  void Promise.allSettled(startupTasks)
})

onUnmounted(() => {
  window.removeEventListener("resize", checkMobile)
})
</script>

<style scoped>
/* Custom Tooltip Styling (Mirrored from Header.vue) */
:deep(.custom-tooltip) {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(10px);
  background-color: theme("colors.cream");
  color: theme("colors.noble-black");
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid theme("colors.cinnamon-ice / 30%");
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease,
    visibility 0.2s;
  z-index: 1200;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

:deep(.tooltip-arrow) {
  position: absolute;
  top: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 5px solid theme("colors.cinnamon-ice / 30%");
}

:deep(.tooltip-arrow::after) {
  content: "";
  position: absolute;
  top: 1px;
  left: -5px;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 5px solid theme("colors.cream");
}

.group\/tooltip:hover :deep(.custom-tooltip) {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(14px);
}

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
