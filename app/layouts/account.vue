<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useNotifications } from "../composables/use-notifications"

const route = useRoute()
const isSidebarOpen = ref(true)
const isMobile = ref(false)
const isHeaderVisible = ref(true)

const hideSidebar = computed(() => route.meta.hideAccountSidebar === true)

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
    createdAt: string | null
    location: string | null
    avatarUrl: string | null
    bio: string | null
    pronouns: string | null
  }
}

const { data: authData } = await useAsyncData("account:auth-me", () =>
  $fetch<AuthMeResponse>("/api/auth/me"),
)

onMounted(() => {
  isMobile.value = window.innerWidth < 1024
  if (isMobile.value) isSidebarOpen.value = false

  window.addEventListener("resize", () => {
    isMobile.value = window.innerWidth < 1024
    if (!isMobile.value && !isSidebarOpen.value) {
      isSidebarOpen.value = true
    }
  })
})

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

const handleSignOut = async () => {
  await supabase.auth.signOut()
  navigateTo("/")
}

const isActive = (path: string) => {
  if (path === "/account") {
    return route.path === "/account"
  }
  return route.path.startsWith(path)
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== "object" || value === null) return null
  return value as Record<string, unknown>
}

const asNonEmptyString = (val: unknown) =>
  typeof val === "string" && val.trim() ? val.trim() : null

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
    const first = (u.firstName || "").trim()
    const last = (u.lastName || "").trim()

    if (last.toLowerCase() === "user" || !last) {
      return first.charAt(0).toUpperCase() + first.slice(1)
    }

    const dbParts = [first, u.middleName, last].filter(Boolean)
    if (dbParts.length > 0) return dbParts.join(" ")
    if (u.name && u.name !== u.username) return u.name
  }

  const authUserRecord = asRecord(authUser)
  const metadata = asRecord(authUserRecord?.user_metadata)
  const metaName = asNonEmptyString(metadata?.full_name) || asNonEmptyString(metadata?.name)
  if (metaName) return metaName

  const email = (authUserRecord?.email as string | undefined) || null
  return email?.split("@")[0] || "User"
})

const profileAvatar = computed(() => {
  // 1. Try DB avatar first
  if (authData.value?.user.avatarUrl) return authData.value.user.avatarUrl

  // 2. Try Identity/Google metadata fallback
  const authUser = user.value
  const authUserRecord = asRecord(authUser)
  const sources = [
    asRecord(authUserRecord?.user_metadata),
    asRecord(authUserRecord?.app_metadata),
    ...getIdentityMetadata(authUser),
  ]

  for (const source of sources) {
    const avatar = getAvatarFromSource(source)
    if (avatar) return avatar
  }

  return null
})

const firstInitial = computed(() => {
  const name = fullName.value.trim()
  return name ? name.charAt(0).toUpperCase() : "U"
})

const fallbackBgClass = computed(() => {
  const userId = authData.value?.user.id
  if (!userId) return "bg-burning-orange"
  const colors = ["bg-burning-orange", "bg-cinnamon-ice", "bg-wahoo", "bg-blue-estate"]
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
})

const navGroups = computed(() => {
  const groups = [
    {
      title: "Personal",
      links: [
        { label: "Account Information", to: "/account", icon: "user" },
        { label: "My Wallet", to: "/account/wallet", icon: "wallet" },
        { label: "My Transactions", to: "/account/transactions", icon: "transactions" },
        { label: "My Disputes", to: "/account/disputes", icon: "dispute" },
      ],
    },
    {
      title: "My Listings",
      links: [
        { label: "All Items", to: "/account/listings", icon: "listings" },
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
      links: [{ label: "Manage Disputes", to: "/admin/disputes", icon: "admin-dispute" }],
    })
  }
  return groups
})

const { notifications, markNotificationRead, markAllNotificationsRead } = useNotifications()
</script>

<template>
  <div class="min-h-screen bg-white">
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
        class="bg-cream flex flex-col shrink-0 border-r border-cinnamon-ice/30 transition-all duration-500 ease-in-out z-50 fixed inset-y-0 left-0 lg:relative lg:translate-x-0 overflow-hidden"
        :class="[
          isSidebarOpen
            ? 'translate-x-0 w-[300px]'
            : '-translate-x-full lg:translate-x-0 lg:w-0 lg:opacity-0 lg:pointer-events-none',
          isHeaderVisible ? 'pt-14' : 'pt-0',
        ]"
      >
        <!-- Profile Section -->
        <div class="px-6 pt-4 pb-4 border-b border-cinnamon-ice/30 shrink-0">
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

        <!-- Navigation Groups (Tightened for non-scroll) -->
        <nav class="flex-1 overflow-hidden py-6 px-4 space-y-6">
          <div v-for="group in navGroups" :key="group.title">
            <h3
              class="px-4 text-[11px] font-bold text-noble-black/30 uppercase tracking-[0.15em] mb-2"
            >
              {{ group.title }}
            </h3>
            <div class="space-y-0.5">
              <NuxtLink
                v-for="link in group.links"
                :key="link.label"
                :to="link.to"
                class="group flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-200"
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
                      d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
                    />
                  </svg>
                  <svg
                    v-else-if="link.icon === 'admin-dispute'"
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
                      d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
                    />
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                    <path d="m9 14 2 2 4-4" />
                  </svg>
                </div>
                <span class="text-[15px] truncate">{{ link.label }}</span>
              </NuxtLink>
            </div>
          </div>
        </nav>

        <!-- Log Out Section -->
        <div class="p-4 border-t border-cinnamon-ice/30 mt-auto">
          <button
            type="button"
            class="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-cinnabar-red hover:bg-cinnabar-red/5 transition-all font-bold group"
            @click="handleSignOut"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="transition-transform group-hover:-translate-x-1"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span class="font-medium text-[15px]">Log Out</span>
          </button>
        </div>
      </aside>

      <!-- Main Content Container -->
      <main
        class="flex-1 overflow-y-auto bg-white custom-account-main-scrollbar"
        :class="[isHeaderVisible ? 'pt-14' : 'pt-0']"
      >
        <div class="py-8">
          <slot />
        </div>
      </main>
    </div>
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
  background: #dbbba7;
  border-radius: 10px;
}

.custom-account-main-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-account-main-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-account-main-scrollbar::-webkit-scrollbar-thumb {
  background: #dbbba7;
  border-radius: 10px;
}
.custom-account-main-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #ff7124;
}

.custom-tooltip {
  position: absolute;
  top: 50%;
  left: 100%;
  transform: translateY(-50%) translateX(12px);
  background: #111;
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: all 0.2s ease;
  z-index: 100;
}

.custom-tooltip::before {
  content: "";
  position: absolute;
  top: 50%;
  right: 100%;
  transform: translateY(-50%);
  border-width: 5px;
  border-style: solid;
  border-color: transparent #111 transparent transparent;
}

.group\/tooltip:hover .custom-tooltip {
  opacity: 1;
  transform: translateY(-50%) translateX(16px);
}
</style>
