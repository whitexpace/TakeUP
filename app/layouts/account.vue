<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useNotifications } from "../composables/use-notifications"

const route = useRoute()
const isSidebarOpen = ref(true)
const isMobile = ref(false)
const showLogoutModal = ref(false)
const isHeaderVisible = ref(true)

const hideSidebar = computed(() => Boolean(route.meta.hideAccountSidebar))
const { notifications, loadNotifications, markNotificationRead, markAllNotificationsRead } =
  useNotifications()

const user = useSupabaseUser()
const supabase = useSupabaseClient()

type AuthMeResponse = {
  user: {
    id: string
    email: string
    name: string
    username: string
    firstName: string
    middleName: string | null
    lastName: string
    accountType: string | null
    avatarUrl: string | null
  }
}

const { data: authData } = useAsyncData(
  "account:auth-me",
  () => $fetch<AuthMeResponse>("/api/auth/me"),
  {
    server: false,
    watch: [user],
  },
)

// Helper to safely extract string from metadata
const asNonEmptyString = (val: unknown) =>
  typeof val === "string" && val.trim() ? val.trim() : null
const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== "object" || value === null) return null
  return value as Record<string, unknown>
}

const getIdentityMetadata = (authUser: unknown) => {
  const authUserRecord = asRecord(authUser)
  const identities = authUserRecord?.identities
  if (!Array.isArray(identities)) return []

  return identities
    .map((identity) => {
      const identityRecord = asRecord(identity)
      return asRecord(identityRecord?.identity_data) ?? asRecord(identityRecord?.provider_metadata)
    })
    .filter((identityData): identityData is Record<string, unknown> => Boolean(identityData))
}

const buildNameFromSource = (source: Record<string, unknown> | null) => {
  if (!source) return null
  const directName =
    asNonEmptyString(source.full_name) ||
    asNonEmptyString(source.name) ||
    asNonEmptyString(source.display_name)
  if (directName) return directName

  const firstName =
    asNonEmptyString(source.given_name) ||
    asNonEmptyString(source.first_name) ||
    asNonEmptyString(source.firstName)
  const lastName =
    asNonEmptyString(source.family_name) ||
    asNonEmptyString(source.last_name) ||
    asNonEmptyString(source.lastName)
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()
  return fullName || null
}

const getAvatarFromSource = (source: Record<string, unknown> | null) => {
  if (!source) return null
  return (
    asNonEmptyString(source.picture) ||
    asNonEmptyString(source.avatar_url) ||
    asNonEmptyString(source.photo_url) ||
    asNonEmptyString(source.profile_image) ||
    asNonEmptyString(source.image) ||
    asNonEmptyString(source.avatarUrl)
  )
}

const fullName = computed(() => {
  const authUser = user.value
  if (!authUser) return "Loading..."

  // 1. Try DB name first (Highest priority for local edits)
  const u = authData.value?.user
  if (u) {
    const dbParts = [u.firstName, u.middleName, u.lastName].filter(Boolean)
    if (dbParts.length > 0) return dbParts.join(" ")
    if (u.name && u.name !== u.username) return u.name
  }

  const authUserRecord = asRecord(authUser)
  const metadataSources = [
    asRecord(authUserRecord?.user_metadata),
    asRecord(authUserRecord?.app_metadata),
    ...getIdentityMetadata(authUser),
  ]

  // 2. Try metadata fields as fallback
  for (const source of metadataSources) {
    const name = buildNameFromSource(source)
    if (name) return name
  }

  return authUser.email?.split("@")[0] || "User"
})

const profileAvatar = computed(() => {
  const authUser = user.value
  if (!authUser) return null

  // 1. Try DB avatar first
  const dbAvatar = asNonEmptyString(authData.value?.user.avatarUrl)
  if (dbAvatar) return dbAvatar

  const authUserRecord = asRecord(authUser)
  const metadataSources = [
    asRecord(authUserRecord?.user_metadata),
    asRecord(authUserRecord?.app_metadata),
    ...getIdentityMetadata(authUser),
  ]

  // 2. Try metadata sources as fallback
  for (const source of metadataSources) {
    const avatar = getAvatarFromSource(source)
    if (avatar) return avatar
  }

  return null
})

const fallbackColors = ["bg-burning-orange", "bg-cinnamon-ice", "bg-wahoo", "bg-blue-estate"]

const fallbackBgClass = computed(() => {
  const userId = authData.value?.user.id
  if (!userId) return "bg-burning-orange"
  // Simple deterministic hash based on userId
  const hash = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return fallbackColors[hash % fallbackColors.length]
})

const firstInitial = computed(() => {
  return fullName.value.charAt(0).toUpperCase()
})

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

const handleResize = () => {
  isMobile.value = window.innerWidth < 1024
  if (isMobile.value) {
    isSidebarOpen.value = false
  } else {
    isSidebarOpen.value = true
  }
}

onMounted(() => {
  void loadNotifications()
  handleResize()
  window.addEventListener("resize", handleResize)
})

const isActive = (to: string) => {
  if (to === "/account") return route.path === "/account"
  if (to === "/account/listings" && route.path.startsWith("/account/requests")) {
    return true
  }
  return route.path.startsWith(to)
}

const openLogoutModal = () => {
  showLogoutModal.value = true
  if (isMobile.value) isSidebarOpen.value = false
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

const navGroups = computed(() => {
  const groups = [
    {
      title: "Personal",
      links: [
        { label: "Account Information", to: "/account", icon: "user" },
        { label: "My Wallet", to: "/account/wallet", icon: "wallet" },
        { label: "My Transactions", to: "/account/transactions", icon: "transactions" },
      ],
    },
    {
      title: "My Listings",
      links: [
        { label: "All Listings", to: "/account/listings", icon: "listings" },
        { label: "Analytics", to: "/account/analytics", icon: "analytics" },
      ],
    },
    {
      title: "My Perks",
      links: [
        { label: "Rewards", to: "/account/rewards", icon: "rewards" },
        { label: "Reviews", to: "/account/reviews", icon: "reviews" },
      ],
    },
  ]

  if (authData.value?.user.accountType === "ADMIN") {
    groups.push({
      title: "Admin",
      links: [{ label: "Disputes", to: "/admin/disputes", icon: "dispute" }],
    })
  }

  return groups
})
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden font-geist bg-white relative">
    <!-- Top Header -->
    <Header
      :notifications="notifications"
      scroll-container-selector=".custom-account-main-scrollbar"
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
        class="bg-cream flex flex-col shrink-0 border-r border-cinnamon-ice/30 transition-all duration-500 ease-in-out z-50 fixed inset-y-0 left-0 lg:relative lg:translate-x-0"
        :class="[
          isSidebarOpen
            ? 'translate-x-0 w-[320px]'
            : '-translate-x-full lg:translate-x-0 lg:w-0 lg:opacity-0 lg:pointer-events-none',
          isHeaderVisible ? 'pt-14' : 'pt-0',
        ]"
      >
        <!-- Profile Section -->
        <div class="px-6 pt-4 pb-4 border-b border-cinnamon-ice/30">
          <div class="flex items-center gap-4">
            <div class="relative group shrink-0">
              <!-- Branded Tri-color Border Container (Tight fit) -->
              <div class="relative w-16 h-16 flex items-center justify-center rounded-full">
                <!-- SVG Arcs for Border -->
                <svg class="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 64 64">
                  <!-- Cinnamon Ice Arc -->
                  <circle
                    cx="32"
                    cy="32"
                    r="31"
                    fill="none"
                    stroke="#dbbba7"
                    stroke-width="2"
                    stroke-dasharray="64.9 129.8"
                    stroke-linecap="round"
                  />
                  <!-- Burning Orange Arc -->
                  <circle
                    cx="32"
                    cy="32"
                    r="31"
                    fill="none"
                    stroke="#ff7124"
                    stroke-width="2"
                    stroke-dasharray="64.9 129.8"
                    stroke-dashoffset="-64.9"
                    stroke-linecap="round"
                  />
                  <!-- Blue Estate Arc -->
                  <circle
                    cx="32"
                    cy="32"
                    r="31"
                    fill="none"
                    stroke="#3b4883"
                    stroke-width="2"
                    stroke-dasharray="64.9 129.8"
                    stroke-dashoffset="-129.8"
                    stroke-linecap="round"
                  />
                </svg>

                <div
                  class="w-[58px] h-[58px] rounded-full overflow-hidden shadow-sm transition-transform duration-300 group-hover:scale-105 z-10"
                >
                  <!-- Direct Image Tag for maximum reliability -->
                  <img
                    v-if="profileAvatar"
                    :src="profileAvatar"
                    class="w-full h-full object-cover"
                    referrerpolicy="no-referrer"
                  />
                  <div
                    v-else
                    class="w-full h-full flex items-center justify-center text-white font-bold text-xl"
                    :class="fallbackBgClass"
                  >
                    {{ firstInitial }}
                  </div>
                </div>
              </div>
            </div>
            <div class="min-w-0 flex-1">
              <h2 class="font-bold text-[16px] text-noble-black truncate leading-tight mb-0.5">
                {{ fullName }}
              </h2>
              <p class="text-[13px] text-noble-black/50 font-medium truncate">
                {{ authData?.user.email || "" }}
              </p>
            </div>
          </div>
        </div>

        <!-- Navigation Groups -->
        <nav class="flex-1 overflow-y-auto py-8 px-4 custom-sidebar-scrollbar space-y-8">
          <div v-for="group in navGroups" :key="group.title">
            <h3 class="px-4 text-[15px] font-extrabold text-cinnamon-ice tracking-wider mb-3">
              {{ group.title }}
            </h3>
            <div class="space-y-1">
              <NuxtLink
                v-for="link in group.links"
                :key="link.label"
                :to="link.to"
                class="group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200"
                :class="
                  isActive(link.to)
                    ? 'bg-burning-orange/15 text-burning-orange font-bold shadow-sm shadow-burning-orange/5 border-l-4 border-burning-orange'
                    : 'text-noble-black/70 hover:bg-pale-cashmere/50 hover:text-noble-black border-l-4 border-transparent'
                "
                @click="isMobile && (isSidebarOpen = false)"
              >
                <!-- Icons -->
                <div class="shrink-0 transition-transform duration-200 group-hover:scale-110">
                  <svg
                    v-if="link.icon === 'user'"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <svg
                    v-else-if="link.icon === 'wallet'"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path
                      d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"
                    />
                    <path d="M16 12h5" />
                  </svg>
                  <svg
                    v-else-if="link.icon === 'transactions'"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                  <svg
                    v-else-if="link.icon === 'listings'"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  <svg
                    v-else-if="link.icon === 'analytics'"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                  <svg
                    v-else-if="link.icon === 'rewards'"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="8" r="7" />
                    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                  </svg>
                  <svg
                    v-else-if="link.icon === 'reviews'"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path
                      d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.9A8.38 8.38 0 0 1 4 11.3a8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
                    />
                  </svg>
                  <svg
                    v-else-if="link.icon === 'dispute'"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path
                      d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                    />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <span class="text-[15px] truncate">{{ link.label }}</span>
              </NuxtLink>
            </div>
          </div>
        </nav>

        <!-- Logout Button -->
        <div class="px-4 py-2.5 border-t border-cinnamon-ice/30">
          <button
            class="flex items-center gap-3 w-full px-4 py-1.5 rounded-xl text-noble-black/70 hover:bg-cinnabar-red/10 hover:text-cinnabar-red transition-all duration-200"
            @click="openLogoutModal"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span class="font-medium text-[15px]">Log Out</span>
          </button>
        </div>
      </aside>

      <!-- Main Content Area -->
      <main
        class="flex-1 bg-white overflow-y-auto custom-account-main-scrollbar transition-all duration-500 ease-in-out relative"
        :class="isHeaderVisible ? 'pt-14' : 'pt-0'"
      >
        <div class="mx-auto px-6 sm:px-12 lg:px-16 xl:px-20 py-8 pt-10 max-w-[1400px]">
          <slot />
        </div>
      </main>
    </div>

    <!-- Logout Confirmation Modal -->
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
          class="relative bg-white rounded-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 shadow-2xl"
        >
          <div class="p-8 flex flex-col items-center text-center">
            <div class="w-16 h-16 bg-cream rounded-full flex items-center justify-center mb-6">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                class="text-cinnabar-red"
              >
                <path
                  d="M12 9V11M12 15H12.01M5.07183 19H18.9282C20.4678 19 21.4301 17.3333 20.6603 16L13.7321 4C12.9623 2.66667 11.0378 2.66667 10.268 4L3.33978 16C2.56998 17.3333 3.53223 19 5.07183 19Z"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            <h3 class="text-2xl font-bold text-noble-black mb-2">Confirm Logout</h3>
            <p class="text-noble-black/50 mb-8 font-medium">Are you sure you want to log out?</p>
            <div
              class="w-full bg-cream rounded-xl p-5 mb-8 text-left space-y-4 border border-cinnamon-ice/30"
            >
              <div class="flex items-center gap-3 text-noble-black/70">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M20 6L9 17L4 12"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <span class="text-[14px] font-medium leading-tight"
                  >Requests will remain pending</span
                >
              </div>
              <div class="flex items-center gap-3 text-noble-black/70">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M20 6L9 17L4 12"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <span class="text-[14px] font-medium leading-tight"
                  >You can review them after logging back in</span
                >
              </div>
            </div>
            <div class="flex flex-col sm:flex-row gap-3 w-full">
              <button
                class="flex-1 px-6 py-3 bg-cream rounded-xl text-noble-black font-semibold hover:bg-pale-cashmere transition-all duration-200"
                @click="cancelLogout"
              >
                Cancel
              </button>
              <button
                class="flex-1 px-6 py-3 bg-burning-orange text-white rounded-xl font-semibold hover:bg-cinnabar-red shadow-lg shadow-burning-orange/20 transition-all duration-200"
                @click="confirmLogout"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.custom-account-main-scrollbar::-webkit-scrollbar {
  width: 5px;
}

.custom-account-main-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-account-main-scrollbar::-webkit-scrollbar-thumb {
  background: theme("colors.cinnamon-ice / 40%");
  border-radius: 20px;
}

.custom-account-main-scrollbar::-webkit-scrollbar-thumb:hover {
  background: theme("colors.cinnamon-ice / 60%");
}

.custom-sidebar-scrollbar::-webkit-scrollbar {
  width: 3px;
}

.custom-sidebar-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-sidebar-scrollbar::-webkit-scrollbar-thumb {
  background: theme("colors.cinnamon-ice / 30%");
  border-radius: 20px;
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

.group\/tooltip:hover .custom-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(14px);
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
</style>
