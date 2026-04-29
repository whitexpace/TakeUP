<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useNotifications } from "../composables/use-notifications"

type AdminLink = {
  label: string
  to: string
  description: string
}

const route = useRoute()
const showMobileSidebar = ref(false)
const showLogoutModal = ref(false)
const isHeaderVisible = ref(true)
const { notifications, loadNotifications, markNotificationRead, markAllNotificationsRead } =
  useNotifications()

const adminLinks: AdminLink[] = [
  {
    label: "Transactions",
    to: "/admin/transactions",
    description: "Monitor all borrower and lender transactions across the platform.",
  },
  {
    label: "Dispute Queue",
    to: "/admin/disputes",
    description: "Review submitted rental disputes and appeals.",
  },
  {
    label: "System Wallet",
    to: "/admin/wallet",
    description: "Monitor the shared commission wallet for the platform.",
  },
]

const currentSection = computed(() => {
  return adminLinks.find((link) => route.path.startsWith(link.to)) ?? adminLinks[0]
})

const isActive = (link: AdminLink) => route.path.startsWith(link.to)

const supabase = useSupabaseClient()

const openLogoutModal = () => {
  showLogoutModal.value = true
  showMobileSidebar.value = false
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
      <template #mobile-menu>
        <button
          class="lg:hidden p-2 text-noble-black hover:text-burning-orange transition-colors"
          aria-label="Open admin navigation"
          @click="showMobileSidebar = true"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </template>
    </Header>

    <div class="relative flex flex-1 overflow-hidden">
      <Transition name="fade">
        <div
          v-if="showMobileSidebar"
          class="fixed inset-0 z-30 bg-noble-black/50 lg:hidden"
          @click="showMobileSidebar = false"
        />
      </Transition>

      <div
        class="pointer-events-none fixed inset-y-0 left-0 z-[35] w-[300px] lg:w-[360px] bg-blue-estate transition-transform duration-300"
        :class="showMobileSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
      />

      <aside
        class="fixed inset-y-0 left-0 z-40 flex h-full w-[300px] shrink-0 flex-col bg-blue-estate text-white transition-all duration-500 ease-in-out lg:w-[360px]"
        :class="showMobileSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
      >
        <div class="flex h-full flex-col" :class="isHeaderVisible ? 'pt-14' : 'pt-0'">
          <button
            class="absolute right-4 p-2 text-white/60 hover:text-white lg:hidden"
            :class="isHeaderVisible ? 'top-16' : 'top-4'"
            @click="showMobileSidebar = false"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div class="border-b border-white/10 px-8 pt-10 pb-6">
            <p class="text-[12px] font-bold uppercase tracking-[0.18em] text-white/60">
              Platform Controls
            </p>
            <h2 class="mt-2 text-[26px] font-bold text-white">ADMIN PANEL</h2>
            <p class="mt-3 max-w-[250px] text-[14px] leading-relaxed text-white/70">
              Centralized tools for shared operational workflows and platform revenue.
            </p>
          </div>

          <nav class="flex flex-col gap-2 px-4 pt-6 pb-24">
            <NuxtLink
              v-for="link in adminLinks"
              :key="link.to"
              :to="link.to"
              class="block rounded-[20px] px-4 py-4 transition-all duration-200"
              :class="
                isActive(link)
                  ? 'bg-white text-blue-estate shadow-sm'
                  : 'bg-white/5 text-white hover:bg-white/10'
              "
              @click="showMobileSidebar = false"
            >
              <p class="text-[16px] font-semibold">
                {{ link.label }}
              </p>
              <p
                class="mt-1 text-[13px] leading-relaxed"
                :class="isActive(link) ? 'text-blue-estate/70' : 'text-white/60'"
              >
                {{ link.description }}
              </p>
            </NuxtLink>

            <NuxtLink
              to="/account"
              class="mt-4 block rounded-[20px] border border-white/15 px-4 py-4 text-white transition-colors duration-200 hover:bg-white/10"
              @click="showMobileSidebar = false"
            >
              <p class="text-[16px] font-semibold">Personal Account</p>
              <p class="mt-1 text-[13px] leading-relaxed text-white/60">
                Return to profile details, wallet, listings, and personal transactions.
              </p>
            </NuxtLink>
          </nav>
        </div>
      </aside>

      <div
        class="fixed bottom-0 left-0 z-50 w-[300px] lg:w-[360px] border-t border-white/10 bg-blue-estate transition-transform duration-300"
        :class="showMobileSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
      >
        <button
          class="flex w-full items-center gap-3 px-8 py-5 text-white group transition-all duration-200"
          @click="openLogoutModal"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class="transition-colors duration-200 group-hover:text-burning-orange"
          >
            <path
              d="M17 16L21 12M21 12L17 8M21 12H9M13 16V17C13 18.6569 11.6569 20 10 20H6C4.34315 20 3 18.6569 3 17V7C3 5.34315 4.34315 4 6 4H10C11.6569 4 13 5.34315 13 7V8"
              stroke="currentColor"
              stroke-width="1"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span
            class="text-[18px] font-normal transition-colors duration-200 group-hover:text-burning-orange"
          >
            Log Out
          </span>
        </button>
      </div>

      <main
        class="custom-admin-main-scrollbar relative flex-1 min-w-0 overflow-y-auto bg-[#f9f8f6] transition-all duration-500 ease-in-out lg:ml-[360px]"
      >
        <div
          :class="[
            isHeaderVisible ? 'pt-24' : 'pt-10',
            'px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8',
          ]"
        >
          <section
            class="rounded-[30px] border border-cinnamon-ice/35 bg-white px-6 py-6 shadow-[0_20px_50px_rgba(25,28,38,0.04)] sm:px-8"
          >
            <div
              class="flex flex-col gap-3 border-b border-cinnamon-ice/35 pb-6 sm:flex-row sm:items-end sm:justify-between"
            >
              <div>
                <p class="text-[12px] font-bold uppercase tracking-[0.16em] text-burning-orange">
                  Admin Workspace
                </p>
                <h1 class="mt-2 text-[28px] font-bold text-blue-estate">
                  {{ currentSection?.label ?? "Admin Panel" }}
                </h1>
                <p class="mt-2 max-w-2xl text-[15px] leading-relaxed text-noble-black/60">
                  {{ currentSection?.description ?? "Manage platform-level operations." }}
                </p>
              </div>

              <NuxtLink
                to="/account"
                class="inline-flex items-center rounded-full border border-cinnamon-ice px-4 py-2 text-[13px] font-semibold text-blue-estate transition-colors duration-200 hover:border-burning-orange hover:text-burning-orange"
              >
                Back to My Account
              </NuxtLink>
            </div>

            <div class="pt-6">
              <slot />
            </div>
          </section>
        </div>
      </main>
    </div>

    <Teleport to="body">
      <div
        v-if="showLogoutModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 font-geist"
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
