<script setup lang="ts">
import { ref } from "vue"

const currentLink = ref("Account Information")
const showLogoutModal = ref(false)

const links = [
  "Account Information",
  "My Wallet",
  "My Transactions",
  "My Listings",
  "My Listing Analytics",
  "My Rewards",
]

const selectLink = (link: string) => {
  currentLink.value = link
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
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error("Error logging out:", error)
    return
  }
  await navigateTo("/")
}
</script>

<template>
  <div class="flex flex-col min-h-screen font-geist bg-white relative">
    <!-- Top Navbar -->
    <nav
      class="h-[77px] w-full bg-white border-b border-cinnamon-ice shrink-0 flex items-center px-8"
    >
      <!-- Empty content for now -->
    </nav>

    <!-- Main Content Container -->
    <div class="flex flex-1 overflow-hidden h-[calc(100vh-77px)]">
      <!-- Left Sidebar -->
      <aside class="w-[360px] bg-cream flex flex-col shrink-0">
        <!-- Sidebar Title -->
        <div class="px-8 pt-10 pb-6">
          <h2 class="font-bold text-[25px] text-blue-estate">MY ACCOUNT</h2>
        </div>

        <!-- Navigation Links -->
        <nav class="flex-1 flex flex-col">
          <a
            v-for="link in links"
            :key="link"
            href="#"
            class="block w-full px-8 py-3 text-[18px] transition-all duration-200"
            :class="[
              currentLink === link
                ? 'bg-burning-orange text-white font-medium'
                : 'text-noble-black bg-cream font-normal hover:bg-pale-cashmere',
            ]"
            @click.prevent="selectLink(link)"
          >
            {{ link }}
          </a>
        </nav>

        <!-- Logout Section -->
        <div class="mt-auto border-t border-cinnamon-ice bg-cream">
          <button
            class="flex items-center gap-3 w-full px-8 py-5 group transition-all duration-200 text-noble-black"
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
      <main class="flex-1 bg-white overflow-y-auto p-8">
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
                    <circle cx="12" cy="12" r="10" fill="#3b4883" />
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
                    <circle cx="12" cy="12" r="10" fill="#3b4883" />
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
