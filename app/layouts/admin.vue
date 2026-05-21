<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue"
import { scheduleIdleWarmup } from "../utils/idle-warmup"

type AdminLink = {
  key: "overview" | "users" | "transactions" | "disputes" | "listings" | "wallet" | "logs"
  label: string
  to: string
  description: string
}

const route = useRoute()
const isSidebarOpen = ref(true)
const isMobile = ref(false)
const isHeaderVisible = ref(true)
const showLogoutModal = ref(false)

const { clear: clearAuthUser } = useAuthUser()
const { clear: clearBridge } = useSessionBridge()
const { clear: clearViewerSession } = useViewerSession()

const adminLinks: AdminLink[] = [
  {
    key: "overview",
    label: "Overview",
    to: "/admin/overview",
    description: "Monitor platform metrics, ratings, recent activity, and revenue at a glance.",
  },
  {
    key: "users",
    label: "Users",
    to: "/admin/users",
    description: "Manage users, roles, and account settings.",
  },
  {
    key: "transactions",
    label: "Transactions",
    to: "/admin/transactions",
    description: "Monitor borrower and lender transactions across the platform.",
  },
  {
    key: "disputes",
    label: "Disputes",
    to: "/admin/disputes",
    description: "Review submitted rental disputes and appeals.",
  },
  {
    key: "listings",
    label: "Listings",
    to: "/admin/listings",
    description: "Review platform inventory and visibility from one place.",
  },
  {
    key: "wallet",
    label: "Wallet",
    to: "/admin/wallet",
    description: "Track platform commission revenue and source records.",
  },
  {
    key: "logs",
    label: "System Logs",
    to: "/admin/system-logs",
    description: "Inspect operational audit and system activity placeholders.",
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
  await Promise.allSettled([
    supabase.auth.signOut(),
    $fetch("/api/auth/logout", { method: "POST" }),
  ])
  clearAuthCaches()
  await navigateTo("/", { replace: true })
}

const clearAuthCaches = () => {
  clearAuthUser()
  clearBridge()
  clearViewerSession()
}

const handleResize = () => {
  isMobile.value = window.innerWidth < 1024
  if (!isMobile.value && !isSidebarOpen.value) {
    isSidebarOpen.value = true
  }
}

onMounted(() => {
  isMobile.value = window.innerWidth < 1024
  if (isMobile.value) isSidebarOpen.value = false

  window.addEventListener("resize", handleResize)

  scheduleIdleWarmup(() => {
    const { fetch: fetchAuthUser } = useAuthUser()
    const { fetchOverview } = useAdminOverview()

    void Promise.allSettled([fetchAuthUser(), fetchOverview()])
  })
})

onUnmounted(() => {
  window.removeEventListener("resize", handleResize)
})
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden bg-white font-geist relative">
    <Header
      scroll-container-selector=".custom-admin-main-scrollbar"
      :show-nav="!(isMobile && isSidebarOpen)"
      @visibility-change="(visible) => (isHeaderVisible = visible)"
    >
      <template #left>
        <div class="relative flex items-stretch group/tooltip h-full">
          <button
            class="flex items-center justify-center px-2 text-noble-black transition-colors hover:text-burning-orange group"
            aria-label="Toggle Sidebar"
            @click="toggleSidebar"
          >
            <Icon
              name="ph:list"
              class="w-5.5 h-5.5 shrink-0 transition-transform duration-300 ease-in-out group-hover:scale-110 group-active:scale-95"
            />
          </button>
          <div class="custom-tooltip">
            Sidebar
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
        class="bg-noble-black flex flex-col shrink-0 text-white border-r border-white/5 transition-all duration-500 ease-in-out z-50 fixed inset-y-0 left-0 lg:relative lg:translate-x-0 overflow-hidden"
        :class="[
          isSidebarOpen
            ? 'translate-x-0 w-[300px]'
            : '-translate-x-full lg:translate-x-0 lg:w-0 lg:opacity-0 lg:pointer-events-none',
          isHeaderVisible ? 'pt-14' : 'pt-0',
        ]"
      >
        <div class="px-6 pt-10 pb-8 border-b border-white/5 shrink-0">
          <h2 class="font-geist text-[26px] font-bold text-white tracking-tight">Admin Panel</h2>
        </div>

        <nav class="flex-1 overflow-y-auto custom-sidebar-scrollbar px-4 py-8 space-y-1">
          <NuxtLink
            v-for="link in adminLinks"
            :key="link.to"
            :to="link.to"
            class="group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300"
            :class="
              isActive(link)
                ? 'bg-burning-orange/15 text-burning-orange font-semibold shadow-sm shadow-burning-orange/5 border-l-4 border-burning-orange'
                : 'text-white/50 hover:bg-white/5 hover:text-white border-l-4 border-transparent'
            "
            @click="isMobile && (isSidebarOpen = false)"
          >
            <div
              class="shrink-0 transition-transform duration-300 w-[24px] h-[24px] flex items-center justify-center group-hover:scale-110"
              :class="
                isActive(link) ? 'text-burning-orange' : 'text-white/20 group-hover:text-white/60'
              "
            >
              <Icon
                v-if="link.key === 'overview'"
                name="ph:chart-line-up"
                class="w-[22px] h-[22px] shrink-0"
              />
              <Icon
                v-else-if="link.key === 'users'"
                name="ph:users-three"
                class="w-[22px] h-[22px] shrink-0"
              />
              <Icon
                v-else-if="link.key === 'transactions'"
                name="ph:arrows-left-right"
                class="w-[22px] h-[22px] shrink-0"
              />
              <Icon
                v-else-if="link.key === 'disputes'"
                name="ph:scales"
                class="w-[22px] h-[22px] shrink-0"
              />
              <Icon
                v-else-if="link.key === 'listings'"
                name="ph:squares-four"
                class="w-[22px] h-[22px] shrink-0"
              />
              <Icon
                v-else-if="link.key === 'wallet'"
                name="ph:wallet"
                class="w-[22px] h-[22px] shrink-0"
              />
              <Icon
                v-else-if="link.key === 'logs'"
                name="ph:activity"
                class="w-[22px] h-[22px] shrink-0"
              />
            </div>
            <span class="text-[15px] leading-tight">
              {{ link.label }}
            </span>
          </NuxtLink>

          <div class="mx-4 my-6 border-t border-white/5" />

          <NuxtLink
            to="/account"
            class="group flex items-center gap-3 px-4 py-3 text-white/40 rounded-xl transition-all duration-300 hover:bg-white/5 hover:text-white border-l-4 border-transparent"
            @click="isMobile && (isSidebarOpen = false)"
          >
            <div
              class="shrink-0 text-white/20 transition-all duration-300 w-[24px] h-[24px] flex items-center justify-center group-hover:scale-110 group-hover:text-white/60"
            >
              <Icon name="ph:arrow-left" class="w-[22px] h-[22px] shrink-0" />
            </div>
            <span class="text-[15px] leading-tight">Personal Account</span>
          </NuxtLink>
        </nav>

        <!-- Log Out Section -->
        <div class="p-4 border-t border-white/5 shrink-0">
          <button
            class="flex w-full items-center gap-3 px-4 py-3 text-white/40 rounded-xl group transition-all duration-300 hover:bg-cinnabar-red/10 hover:text-cinnabar-red font-bold"
            @click="openLogoutModal"
          >
            <div
              class="shrink-0 w-[24px] h-[24px] flex items-center justify-center group-hover:scale-110"
            >
              <Icon
                name="ph:sign-out"
                class="w-[22px] h-[22px] shrink-0 transition-all duration-300 text-white/20 group-hover:text-cinnabar-red group-hover:-translate-x-1"
              />
            </div>
            <span class="text-[15px] leading-tight"> Log Out </span>
          </button>
        </div>
      </aside>

      <main
        class="custom-admin-main-scrollbar relative flex-1 min-w-0 overflow-y-auto bg-cream"
        :class="[isHeaderVisible ? 'pt-14' : 'pt-0']"
      >
        <div class="py-12">
          <div class="mx-auto max-w-[1400px] px-4 sm:px-12 lg:px-16 xl:px-24">
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
              <Icon name="ph:sign-out" class="w-8 h-8 text-noble-black" />
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

.custom-admin-main-scrollbar {
  overflow-anchor: none;
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
