<script setup lang="ts">
import { ref } from "vue"

const currentLink = ref("Account Information")
const showLogoutModal = ref(false)
const showMobileSidebar = ref(false)
const route = useRoute()

type SidebarLink = {
  label: string
  to?: string
}

const links: SidebarLink[] = [
  { label: "Account Information", to: "/account" },
  { label: "My Wallet" },
  { label: "My Transactions", to: "/account/transactions" },
  { label: "My Listings" },
  { label: "My Listing Analytics" },
  { label: "My Rewards" },
]

const isActive = (link: SidebarLink) => {
  if (link.to) return route.path === link.to
  return currentLink.value === link.label
}

const selectLink = (link: SidebarLink) => {
  if (!link.to) currentLink.value = link.label
  showMobileSidebar.value = false
}
const supabase = useSupabaseClient()

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
</script>

<template>
  <div class="flex flex-col min-h-screen font-geist bg-white relative">
    <!-- Top Navbar -->
    <nav
      class="h-[77px] w-full bg-white border-b border-cinnamon-ice shrink-0 flex items-center px-4 lg:px-8 gap-3"
    >
      <!-- Hamburger button (mobile only) -->
      <button
        class="lg:hidden p-2 rounded-lg text-noble-black hover:bg-cream transition-colors"
        aria-label="Open menu"
        @click="showMobileSidebar = true"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <line x1="3" y1="6" x2="21" y2="6" stroke-width="2" stroke-linecap="round" />
          <line x1="3" y1="12" x2="21" y2="12" stroke-width="2" stroke-linecap="round" />
          <line x1="3" y1="18" x2="21" y2="18" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
      <!-- Mobile title -->
      <span class="lg:hidden font-bold text-lg text-blue-estate">MY ACCOUNT</span>
    </nav>

    <!-- Main Content Container -->
    <div class="flex flex-1 lg:overflow-hidden lg:h-[calc(100vh-77px)]">
      <!-- Mobile sidebar backdrop -->
      <Transition name="fade">
        <div
          v-if="showMobileSidebar"
          class="fixed inset-0 z-40 bg-noble-black/50 lg:hidden"
          @click="showMobileSidebar = false"
        />
      </Transition>

      <!-- Left Sidebar (desktop: static; mobile: slide-in drawer) -->
      <aside
        class="fixed lg:static inset-y-0 left-0 z-50 w-[300px] lg:w-[360px] bg-cream flex flex-col shrink-0 transform transition-transform duration-300 ease-in-out lg:translate-x-0"
        :class="showMobileSidebar ? 'translate-x-0' : '-translate-x-full'"
      >
        <!-- Mobile close button -->
        <div class="flex items-center justify-between px-6 pt-6 pb-2 lg:hidden">
          <h2 class="font-bold text-[22px] text-blue-estate">MY ACCOUNT</h2>
          <button
            class="p-2 rounded-lg text-noble-black hover:bg-pale-cashmere"
            @click="showMobileSidebar = false"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <!-- Sidebar Title (desktop only) -->
        <div class="hidden lg:block px-8 pt-10 pb-6">
          <h2 class="font-bold text-[25px] text-blue-estate">MY ACCOUNT</h2>
        </div>

        <!-- Navigation Links -->
        <nav class="flex-1 flex flex-col">
          <template v-for="link in links" :key="link.label">
            <NuxtLink
              v-if="link.to"
              :to="link.to"
              class="block w-full px-6 lg:px-8 py-3 text-[17px] lg:text-[18px] transition-all duration-200"
              :class="[
                isActive(link)
                  ? 'bg-burning-orange text-white font-medium'
                  : 'text-noble-black bg-cream font-normal hover:bg-pale-cashmere',
              ]"
              @click="showMobileSidebar = false"
            >
              {{ link.label }}
            </NuxtLink>
            <a
              v-else
              href="#"
              class="block w-full px-6 lg:px-8 py-3 text-[17px] lg:text-[18px] transition-all duration-200"
              :class="[
                isActive(link)
                  ? 'bg-burning-orange text-white font-medium'
                  : 'text-noble-black bg-cream font-normal hover:bg-pale-cashmere',
              ]"
              @click.prevent="selectLink(link)"
            >
              {{ link.label }}
            </a>
          </template>
        </nav>

        <!-- Logout Section -->
        <div class="mt-auto border-t border-cinnamon-ice bg-cream">
          <button
            class="flex items-center gap-3 w-full px-6 lg:px-8 py-5 group transition-all duration-200 text-noble-black"
            @click="openLogoutModal"
          >
            <!-- Logout Icon -->
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
              class="font-normal text-[18px] transition-colors duration-200 group-hover:text-burning-orange"
              >Log Out</span
            >
          </button>
        </div>
      </aside>

      <!-- Page Content Slot -->
      <main class="flex-1 bg-white overflow-y-auto p-4 sm:p-6 lg:p-8">
        <slot />
      </main>
    </div>

    <!-- Logout Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="showLogoutModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 font-geist"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm transition-opacity"
          @click="cancelLogout"
        />

        <!-- Modal Content -->
        <div
          class="relative bg-white rounded-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 shadow-2xl"
        >
          <div class="p-8 flex flex-col items-center text-center">
            <!-- Warning Icon -->
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

            <!-- Title -->
            <h3 class="text-2xl font-bold text-blue-estate mb-2">Confirm Logout</h3>

            <!-- Description -->
            <p class="text-noble-black/50 mb-8 font-medium">Are you sure you want to log out?</p>

            <!-- Pending Items List -->
            <div
              class="w-full bg-cream rounded-xl p-5 mb-8 text-left space-y-4 border border-cinnamon-ice/30"
            >
              <div class="flex items-center gap-3">
                <div class="shrink-0">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="12" cy="12" r="10" class="fill-blue-estate" />
                    <path
                      d="M8 12L11 15L16 9"
                      stroke="white"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </div>
                <span class="text-noble-black text-[15px] font-light leading-tight"
                  >Requests will remain pending</span
                >
              </div>
              <div class="flex items-center gap-3">
                <div class="shrink-0">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="12" cy="12" r="10" class="fill-blue-estate" />
                    <path
                      d="M8 12L11 15L16 9"
                      stroke="white"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </div>
                <span class="text-noble-black text-[15px] font-light leading-tight"
                  >You can review them after logging back in</span
                >
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-col sm:flex-row gap-3 w-full">
              <button
                class="flex-1 px-6 py-3 border-[0.5px] border-cinnamon-ice rounded-lg text-noble-black font-medium hover:bg-pale-cashmere transition-colors duration-200 focus:outline-none"
                @click="cancelLogout"
              >
                Go Back
              </button>
              <button
                class="flex-1 px-6 py-3 bg-burning-orange text-white rounded-lg font-medium hover:bg-cinnabar-red transition-colors duration-200 focus:outline-none"
                @click="confirmLogout"
              >
                Log Out Anyway
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
