<script setup lang="ts">
import { onMounted, ref } from "vue"
import { useNotifications } from "../composables/use-notifications"

type AdminLink = {
  label: string
  to: string
  description: string
}

const route = useRoute()
const isSidebarOpen = ref(true)
const isMobile = ref(false)
const isHeaderVisible = ref(true)
const showLogoutModal = ref(false)

const { notifications, loadNotifications, markNotificationRead, markAllNotificationsRead } =
  useNotifications()

const adminLinks: AdminLink[] = [
  {
    label: "Users",
    to: "/admin/users",
    description: "Manage users, roles, and account settings.",
  },
  {
    label: "Transactions",
    to: "/admin/transactions",
    description: "Monitor borrower and lender transactions across the platform.",
  },
  {
    label: "Dispute Queue",
    to: "/admin/disputes",
    description: "Review submitted rental disputes and appeals.",
  },
  {
    label: "Commissions",
    to: "/admin/wallet",
    description: "Track platform commission revenue and source records.",
  },
]

const isActive = (link: AdminLink) => route.path.startsWith(link.to)

const supabase = useSupabaseClient()

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

const openLogoutModal = () => {
  showLogoutModal.value = true
}

const cancelLogout = () => {
  showLogoutModal.value = false
}

const confirmLogout = async () => {
  showLogoutModal.value = false
  await supabase.auth.signOut()
  await $fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined)
  await navigateTo("/")
}

onMounted(() => {
  isMobile.value = window.innerWidth < 1024
  if (isMobile.value) isSidebarOpen.value = false

  window.addEventListener("resize", () => {
    isMobile.value = window.innerWidth < 1024
    if (!isMobile.value && !isSidebarOpen.value) {
      isSidebarOpen.value = true
    }
  })

  void loadNotifications()
})
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden bg-white font-geist relative">
    <Header
      :notifications="notifications"
      scroll-container-selector=".custom-admin-main-scrollbar"
      @mark-notification-read="markNotificationRead"
      @mark-all-notifications-read="markAllNotificationsRead"
      @visibility-change="(visible) => (isHeaderVisible = visible)"
    >
      <template #left>
        <div class="relative flex items-stretch group/tooltip h-full">
          <button
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

    <div class="relative flex flex-1 overflow-hidden">
      <!-- Sidebar Overlay for Mobile -->
      <div
        v-if="isSidebarOpen && isMobile"
        class="fixed inset-0 bg-noble-black/50 z-40 lg:hidden transition-opacity duration-300"
        @click="isSidebarOpen = false"
      />

      <!-- Left Sidebar -->
      <aside
        class="bg-wahoo flex flex-col shrink-0 text-white border-r border-white/10 transition-all duration-500 ease-in-out z-50 fixed inset-y-0 left-0 lg:relative lg:translate-x-0 overflow-hidden"
        :class="[
          isSidebarOpen
            ? 'translate-x-0 w-[300px]'
            : '-translate-x-full lg:translate-x-0 lg:w-0 lg:opacity-0 lg:pointer-events-none',
          isHeaderVisible ? 'pt-14' : 'pt-0',
        ]"
      >
        <div class="px-6 pt-10 pb-6 shrink-0">
          <p class="text-[10px] font-bold uppercase tracking-[2px] text-slate-500">
            Platform Controls
          </p>
          <h2 class="mt-2 text-[20px] font-bold text-white">ADMIN PANEL</h2>
          <p class="mt-2 max-w-[220px] text-[13px] leading-relaxed text-slate-400">
            Centralized tools for shared operational workflows and platform revenue.
          </p>
        </div>

        <nav class="flex-1 overflow-y-auto custom-sidebar-scrollbar px-4 pt-6 pb-24">
          <NuxtLink
            v-for="link in adminLinks"
            :key="link.to"
            :to="link.to"
            class="group flex items-center gap-3 px-4 py-3 transition-all duration-200"
            :class="
              isActive(link)
                ? 'bg-white/10 text-white border-l-[3px] border-orange-600 rounded-r-[8px]'
                : 'text-slate-400 hover:bg-white/5 border-l-[3px] border-transparent'
            "
            @click="isMobile && (isSidebarOpen = false)"
          >
            <div
              class="shrink-0 transition-colors"
              :class="isActive(link) ? 'text-white' : 'text-slate-600'"
            >
              <svg
                v-if="link.label === 'Users'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <svg
                v-else-if="link.label === 'Transactions'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m17 2 4 4-4 4" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <path d="m7 22-4-4 4-4" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              <svg
                v-else-if="link.label === 'Dispute Queue'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                <path d="M7 21h10" />
                <path d="M12 3v18" />
                <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
              </svg>
              <svg
                v-else-if="link.label === 'System Wallet'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
              </svg>
            </div>
            <span class="text-[14px] font-medium">
              {{ link.label }}
            </span>
          </NuxtLink>

          <div class="mx-6 my-4 border-t border-white/10" />

          <NuxtLink
            to="/account"
            class="group flex items-center gap-3 px-4 py-3 text-slate-400 transition-all duration-200 hover:bg-white/5 border-l-[3px] border-transparent"
            @click="isMobile && (isSidebarOpen = false)"
          >
            <div class="shrink-0 text-slate-600 transition-colors">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
              </svg>
            </div>
            <span class="text-[14px] font-medium">Personal Account</span>
          </NuxtLink>
        </nav>

        <!-- Log Out Section -->
        <div class="p-4 border-t border-white/10 shrink-0">
          <button
            class="flex w-full items-center gap-3 px-4 py-3 text-slate-400 group transition-all duration-200 hover:text-white"
            @click="openLogoutModal"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              class="transition-colors duration-200 text-slate-600 group-hover:text-burning-orange"
            >
              <path
                d="M17 16L21 12M21 12L17 8M21 12H9M13 16V17C13 18.6569 11.6569 20 10 20H6C4.34315 20 3 18.6569 3 17V7C3 5.34315 4.34315 4 6 4H10C11.6569 4 13 5.34315 13 7V8"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span class="text-[14px] font-medium transition-colors duration-200"> Log Out </span>
          </button>
        </div>
      </aside>

      <main
        class="custom-admin-main-scrollbar relative flex-1 min-w-0 overflow-y-auto bg-white"
        :class="[isHeaderVisible ? 'pt-14' : 'pt-0']"
      >
        <div class="py-8">
          <div class="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
            <slot />
          </div>
        </div>
      </main>
    </div>

    <Teleport to="body">
      <div
        v-if="showLogoutModal"
        class="fixed inset-0 z-[2000] flex items-center justify-center p-4 font-geist"
      >
        <div
          class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm transition-opacity"
          @click="cancelLogout"
        />
        <div
          class="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl transition-all"
        >
          <div class="flex flex-col items-center p-8 text-center">
            <div class="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-cream">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M17 16L21 12M21 12L17 8M21 12H9M13 16V17C13 18.6569 11.6569 20 10 20H6C4.34315 20 3 18.6569 3 17V7C3 5.34315 4.34315 4 6 4H10C11.6569 4 13 5.34315 13 7V8"
                  stroke="#1f2937"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            <h3 class="text-[24px] font-bold text-noble-black">Log out?</h3>
            <p class="mt-2 text-[15px] leading-relaxed text-noble-black/60">
              You will be signed out from both the admin panel and your personal account.
            </p>
          </div>

          <div class="flex gap-3 border-t border-cinnamon-ice/20 p-6">
            <button
              class="flex-1 rounded-full border border-cinnamon-ice px-5 py-3 text-[15px] font-semibold text-noble-black transition-colors duration-200 hover:bg-cream"
              @click="cancelLogout"
            >
              Cancel
            </button>
            <button
              class="flex-1 rounded-full bg-burning-orange px-5 py-3 text-[15px] font-semibold text-white transition-colors duration-200 hover:bg-burning-orange/90"
              @click="confirmLogout"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.custom-sidebar-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-sidebar-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-sidebar-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}

.custom-admin-main-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-admin-main-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-admin-main-scrollbar::-webkit-scrollbar-thumb {
  background: theme("colors.cinnamon-ice");
  border-radius: 10px;
}
.custom-admin-main-scrollbar::-webkit-scrollbar-thumb:hover {
  background: theme("colors.burning-orange");
}

.custom-tooltip {
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

.tooltip-arrow {
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

.tooltip-arrow::after {
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

.group\/tooltip:hover .custom-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(14px);
}
</style>
