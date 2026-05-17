<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useNotifications } from "../composables/use-notifications"
import { useAuthUser } from "../composables/use-auth-user"
import { useAccountReviewsPrefetch } from "../composables/use-account-reviews"
import { useListingAnalyticsPrefetch } from "../composables/use-listing-analytics"
import { useRewardsPrefetch } from "../composables/use-rewards"

const route = useRoute()
const isSidebarOpen = ref(true)
const isMobile = ref(false)
const isHeaderVisible = ref(true)
const hasObservedPointerMove = ref(false)

const hideSidebar = computed(() => route.meta.hideAccountSidebar === true)

const user = useSupabaseUser()
const supabase = useSupabaseClient()
const {
  authUser: cachedAuthUser,
  hasFreshCache: hasFreshAuthUserCache,
  fetch: fetchAuthUser,
  clear: clearAuthUser,
} = useAuthUser()
const { clear: clearSessionBridge } = useSessionBridge()
const { clear: clearViewerSession } = useViewerSession()
const { warmAccountReviews } = useAccountReviewsPrefetch()
const { warmListingAnalytics } = useListingAnalyticsPrefetch()
const { warmRewards } = useRewardsPrefetch()

const authData = computed(() => (cachedAuthUser.value ? { user: cachedAuthUser.value } : null))

const { notifications, loadNotifications } = useNotifications()

onMounted(() => {
  void loadNotifications()
  if (user.value && !hasFreshAuthUserCache.value && !cachedAuthUser.value) {
    void fetchAuthUser()
  }

  isMobile.value = window.innerWidth < 1024
  if (isMobile.value) isSidebarOpen.value = false

  window.addEventListener("resize", () => {
    isMobile.value = window.innerWidth < 1024
    if (!isMobile.value && !isSidebarOpen.value) {
      isSidebarOpen.value = true
    }
  })
})

const markPointerInteraction = () => {
  hasObservedPointerMove.value = true
}

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

const handleSignOut = async () => {
  await supabase.auth.signOut()
  clearAuthUser()
  clearSessionBridge()
  clearViewerSession()
  navigateTo("/")
}

const isActive = (path: string) => {
  if (path === "/account") {
    return route.path === "/account"
  }
  return route.path.startsWith(path)
}

const warmNavLink = (path: string, event?: Event) => {
  if (event?.type === "pointermove") {
    markPointerInteraction()
  }

  if (event?.type === "pointerenter" && !hasObservedPointerMove.value) {
    return
  }

  if (path === "/account/analytics") {
    void warmListingAnalytics(path)
    return
  }

  if (path === "/account/rewards") {
    void warmRewards(path)
    return
  }

  if (path === "/account/reviews") {
    void warmAccountReviews(path)
  }
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
    const dbParts = [(u.firstName || "").trim(), u.middleName, (u.lastName || "").trim()].filter(
      Boolean,
    )
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
      title: "Account",
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
</script>

<template>
  <div class="min-h-screen bg-white">
    <Header
      :notifications="notifications"
      scroll-container-selector=".custom-account-main-scrollbar"
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
        <!-- User Profile Container -->
        <NuxtLink
          v-if="authData?.user.username"
          :to="`/profile/${authData.user.username}`"
          :prefetch-on="{ interaction: true }"
          class="px-6 pt-4 pb-4 border-b border-cinnamon-ice/30 shrink-0 flex items-center gap-4 hover:bg-pale-cashmere/30 transition-all duration-300 group/profile-link"
        >
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
                  stroke="currentColor"
                  class="text-cinnamon-ice"
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
                  stroke="currentColor"
                  class="text-burning-orange"
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
                  stroke="currentColor"
                  class="text-blue-estate"
                  stroke-width="2"
                  stroke-dasharray="64.9 129.8"
                  stroke-dashoffset="-129.8"
                  stroke-linecap="round"
                />
              </svg>

              <div
                class="w-[58px] h-[58px] rounded-full overflow-hidden shadow-sm transition-transform duration-300 group-hover/profile-link:scale-105 z-10"
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
            <h2
              class="font-semibold text-[16px] text-noble-black truncate leading-tight mb-0.5 group-hover/profile-link:text-burning-orange transition-colors"
            >
              {{ fullName }}
            </h2>
            <p class="text-[13px] text-noble-black/50 font-light truncate">
              {{ authData?.user.email || "" }}
            </p>
          </div>
        </NuxtLink>

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
                :prefetch-on="{ interaction: true }"
                class="group flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-200"
                :class="
                  isActive(link.to)
                    ? 'bg-burning-orange/15 text-burning-orange font-semibold shadow-sm shadow-burning-orange/5 border-l-4 border-burning-orange'
                    : 'text-noble-black/70 hover:bg-pale-cashmere/50 hover:text-noble-black border-l-4 border-transparent'
                "
                @pointerenter="warmNavLink(link.to, $event)"
                @pointermove.passive="warmNavLink(link.to, $event)"
                @focus="warmNavLink(link.to, $event)"
                @touchstart.passive="warmNavLink(link.to, $event)"
                @mousedown.left="warmNavLink(link.to, $event)"
                @click="isMobile && (isSidebarOpen = false)"
              >
                <!-- Icons -->
                <div
                  class="w-[22px] h-[22px] flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 -translate-y-[0.5px]"
                >
                  <Icon
                    v-if="link.icon === 'user'"
                    name="ph:user"
                    class="w-[22px] h-[22px] shrink-0"
                  />
                  <Icon
                    v-else-if="link.icon === 'wallet'"
                    name="ph:wallet"
                    class="w-[22px] h-[22px] shrink-0"
                  />
                  <Icon
                    v-else-if="link.icon === 'transactions'"
                    name="ph:receipt"
                    class="w-[22px] h-[22px] shrink-0"
                  />
                  <Icon
                    v-else-if="link.icon === 'dispute'"
                    name="ph:warning-circle"
                    class="w-[22px] h-[22px] shrink-0"
                  />
                  <Icon
                    v-else-if="link.icon === 'listings'"
                    name="ph:squares-four"
                    class="w-[22px] h-[22px] shrink-0"
                  />
                  <Icon
                    v-else-if="link.icon === 'analytics'"
                    name="ph:chart-bar"
                    class="w-[22px] h-[22px] shrink-0"
                  />
                  <Icon
                    v-else-if="link.icon === 'rewards'"
                    name="ph:gift"
                    class="w-[22px] h-[22px] shrink-0"
                  />
                  <Icon
                    v-else-if="link.icon === 'reviews'"
                    name="ph:chat-centered-text"
                    class="w-[22px] h-[22px] shrink-0"
                  />
                  <Icon
                    v-else-if="link.icon === 'admin-dispute'"
                    name="ph:shield-warning"
                    class="w-[22px] h-[22px] shrink-0"
                  />
                </div>
                <span class="text-[15px] truncate leading-none">{{ link.label }}</span>
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
            <div
              class="w-[22px] h-[22px] flex items-center justify-center shrink-0 -translate-y-[0.5px]"
            >
              <Icon
                name="ph:sign-out"
                class="w-[22px] h-[22px] transition-transform group-hover:-translate-x-1 shrink-0"
              />
            </div>
            <span class="font-medium text-[15px] leading-none">Log Out</span>
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
  background: theme("colors.cinnamon-ice");
  border-radius: 10px;
}

.custom-account-main-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-account-main-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-account-main-scrollbar::-webkit-scrollbar-thumb {
  background: theme("colors.cinnamon-ice");
  border-radius: 10px;
}
.custom-account-main-scrollbar::-webkit-scrollbar-thumb:hover {
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
