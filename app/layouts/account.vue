<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"

type NavItemId =
  | "account-information"
  | "my-wallet"
  | "my-transactions"
  | "my-listings"
  | "my-listing-analytics"
  | "my-rewards"

type NavIconName = "user" | "wallet" | "transactions" | "grid" | "activity" | "star"

type NavGroup = {
  label: string
  items: Array<{
    id: NavItemId
    label: string
    icon: NavIconName
  }>
}

const activeItem = ref<NavItemId>("account-information")
const isSidebarOpen = ref(true)
const isMobile = ref(false)
const showLogoutModal = ref(false)

const supabase = useSupabaseClient()
const user = useSupabaseUser()

const navGroups: NavGroup[] = [
  {
    label: "Account",
    items: [
      { id: "account-information", label: "Account Information", icon: "user" },
      { id: "my-wallet", label: "My Wallet", icon: "wallet" },
      { id: "my-transactions", label: "My Transactions", icon: "transactions" },
    ],
  },
  {
    label: "Listings",
    items: [
      { id: "my-listings", label: "My Listings", icon: "grid" },
      { id: "my-listing-analytics", label: "My Listing Analytics", icon: "activity" },
    ],
  },
  {
    label: "Perks",
    items: [{ id: "my-rewards", label: "My Rewards", icon: "star" }],
  },
]

const selectItem = (itemId: NavItemId) => {
  activeItem.value = itemId
}

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

const checkMobile = () => {
  isMobile.value = window.innerWidth < 1024
  if (isMobile.value) {
    isSidebarOpen.value = false
  } else {
    isSidebarOpen.value = true
  }
}

const profileName = computed(() => {
  if (!user.value) return "Account User"

  const fullName =
    (user.value.user_metadata?.full_name as string | undefined) ||
    (user.value.user_metadata?.name as string | undefined) ||
    user.value.email ||
    "Account User"

  return fullName
})

const profileSubtitle = computed(() => user.value?.email ?? "Signed in to TakeUP")

const profileImageUrl = computed(() => {
  if (!user.value) return ""

  return (
    (user.value.user_metadata?.avatar_url as string | undefined) ||
    (user.value.user_metadata?.picture as string | undefined) ||
    ""
  )
})

const profileInitials = computed(() => {
  const words = profileName.value
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean)

  if (words.length === 0) return "TU"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
})

const avatarColorClasses = [
  "bg-blue-estate",
  "bg-burning-orange",
  "bg-cinnamon-ice",
  "bg-wahoo",
  "bg-success-green",
  "bg-cinnabar-red",
] as const

const avatarColorClass = computed(() => {
  const seed = user.value?.id || user.value?.email || profileName.value
  const index = Array.from(seed).reduce((total, char) => total + char.charCodeAt(0), 0)
  return avatarColorClasses[index % avatarColorClasses.length]
})

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
  checkMobile()
  window.addEventListener("resize", checkMobile)
})

onUnmounted(() => {
  window.removeEventListener("resize", checkMobile)
})
</script>

<template>
  <div class="flex flex-col h-screen font-geist bg-white relative overflow-hidden text-noble-black">
    <Header>
      <template #left>
        <button
          class="flex items-center justify-center h-10 w-10 rounded-full text-noble-black transition-colors hover:bg-cream hover:text-burning-orange"
          aria-label="Toggle account sidebar"
          title="Toggle account sidebar"
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
      <div
        v-if="isSidebarOpen && isMobile"
        class="fixed inset-0 bg-noble-black/50 z-40 lg:hidden transition-opacity duration-300"
        @click="isSidebarOpen = false"
      />

      <aside
        class="bg-cream flex flex-col shrink-0 border-r-[0.5px] border-black/[0.07] transition-all duration-300 ease-in-out z-50 fixed bottom-0 left-0 top-14 lg:relative lg:bottom-auto lg:left-auto lg:top-auto lg:translate-x-0 font-geist"
        :class="[
          isSidebarOpen
            ? 'translate-x-0 w-80'
            : '-translate-x-full lg:translate-x-0 lg:w-0 lg:opacity-0 lg:pointer-events-none',
        ]"
      >
        <!-- Profile Section -->
        <div class="border-b-[0.5px] border-black/[0.07] px-6 py-7">
          <div class="flex items-center gap-3">
            <div class="relative flex h-10 w-10 shrink-0 items-center justify-center">
              <!-- Three-color Arc Stroke -->
              <svg class="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 40 40">
                <circle
                  cx="20"
                  cy="20"
                  r="19.25"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-dasharray="40.32 80.63"
                  class="text-burning-orange"
                />
                <circle
                  cx="20"
                  cy="20"
                  r="19.25"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-dasharray="40.32 80.63"
                  stroke-dashoffset="-40.32"
                  class="text-cinnamon-ice"
                />
                <circle
                  cx="20"
                  cy="20"
                  r="19.25"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-dasharray="40.32 80.63"
                  stroke-dashoffset="-80.64"
                  class="text-blue-estate"
                />
              </svg>

              <!-- Avatar Core -->
              <div
                class="relative z-10 flex h-[37px] w-[37px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[13px] font-bold text-white shadow-sm"
                :class="profileImageUrl ? 'bg-pale-cashmere' : avatarColorClass"
              >
                <img
                  v-if="profileImageUrl"
                  :src="profileImageUrl"
                  :alt="`${profileName} profile picture`"
                  class="h-full w-full object-cover"
                />
                <span v-else>{{ profileInitials }}</span>
              </div>
            </div>

            <div class="min-w-0">
              <p class="truncate text-[16px] font-semibold text-noble-black leading-tight">
                {{ profileName }}
              </p>
              <p class="truncate text-[12px] text-noble-black/50 mt-1">
                {{ profileSubtitle }}
              </p>
            </div>
          </div>
        </div>

        <!-- Navigation Section -->
        <nav class="flex-1 overflow-y-auto custom-sidebar-scrollbar px-6 py-8">
          <section
            v-for="(group, groupIndex) in navGroups"
            :key="group.label"
            :class="groupIndex === 0 ? '' : 'mt-10'"
          >
            <p class="mb-4 text-[15px] font-semibold uppercase tracking-[0.05em] text-cinnamon-ice">
              {{ group.label }}
            </p>

            <div class="space-y-1.5">
              <button
                v-for="item in group.items"
                :key="item.id"
                class="flex w-full items-center gap-3.5 py-3 px-4 transition-all text-left text-[14px] leading-5 font-geist rounded-xl group"
                :class="
                  activeItem === item.id
                    ? 'bg-burning-orange/10 text-burning-orange font-bold border-l-4 border-burning-orange pl-[12px]'
                    : 'text-noble-black/80 hover:bg-black/5 hover:text-noble-black'
                "
                @click="selectItem(item.id)"
              >
                <AccountSidebarIcon :name="item.icon" />
                <span class="truncate">{{ item.label }}</span>
              </button>
            </div>
          </section>
        </nav>

        <!-- Logout Section -->
        <div class="mt-auto border-t-[0.5px] border-black/[0.07] px-6 py-4">
          <button
            class="flex w-full items-center gap-3.5 rounded-xl px-4 py-2 text-left text-[14px] font-medium text-noble-black/80 transition-all font-geist hover:bg-cinnabar-red/10 hover:text-cinnabar-red"
            @click="openLogoutModal"
          >
            <AccountSidebarIcon name="logout" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      <main
        class="flex-1 bg-white overflow-y-auto custom-main-scrollbar p-8 transition-all duration-300 ease-in-out"
      >
        <slot />
      </main>
    </div>

    <Teleport to="body">
      <div
        v-if="showLogoutModal"
        class="fixed inset-0 z-[2000] flex items-center justify-center p-4 font-geist"
      >
        <div
          class="absolute inset-0 bg-noble-black/40 backdrop-blur-[2px] transition-opacity"
          @click="cancelLogout"
        />

        <div class="relative w-full max-w-[360px] overflow-hidden rounded-[28px] bg-white shadow-2xl">
          <div class="flex flex-col items-center px-8 py-10 text-center">
            <div
              class="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-cream shadow-inner"
            >
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                class="text-burning-orange"
              >
                <path
                  d="M10 3H6C5.46957 3 4.96086 3.21071 4.58579 3.58579C4.21071 3.96086 4 4.46957 4 5V19C4 19.5304 4.21071 20.0391 4.58579 20.4142C4.96086 20.7893 5.46957 21 6 21H10"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M16 17L21 12L16 7"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M21 12H9"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>

            <h3 class="mb-3 text-[22px] font-bold tracking-tight text-noble-black">Log out?</h3>
            <p class="mb-10 text-[14px] leading-relaxed text-noble-black/40 max-w-[260px]">
              Requests will remain pending. You can review them after logging back in.
            </p>

            <div class="flex items-center justify-center gap-3">
              <button
                class="h-10 rounded-xl border border-cinnamon-ice/30 px-6 text-[14px] font-semibold text-noble-black/60 transition-all hover:bg-pale-cashmere hover:text-noble-black"
                @click="cancelLogout"
              >
                Go Back
              </button>
              <button
                class="h-10 rounded-xl bg-burning-orange px-6 text-[14px] font-semibold text-white shadow-sm transition-all hover:bg-cinnabar-red hover:shadow-md"
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
  background: theme("colors.noble-black / 10%");
  border-radius: 20px;
}

.custom-main-scrollbar::-webkit-scrollbar-thumb:hover {
  background: theme("colors.noble-black / 20%");
}

.custom-main-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: theme("colors.noble-black / 10%") transparent;
}
</style>
