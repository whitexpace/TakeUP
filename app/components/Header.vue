<script setup lang="ts">
defineOptions({
  name: "AppHeader",
})
</script>

<template>
  <header
    class="sticky top-0 left-0 w-full h-14 bg-white border-b border-cinnamon-ice flex items-center z-[1000] shrink-0"
  >
    <!-- Left Section: Logo & App Name (Sidebar width on desktop) -->
    <div class="w-auto lg:w-80 flex items-center px-4 sm:px-6 shrink-0 gap-4">
      <slot name="left" />
      <NuxtLink to="/" class="flex items-center gap-3">
        <img src="/images/logo.svg" alt="TakeUP Logo" class="h-8 w-auto" />
      </NuxtLink>
    </div>

    <!-- Middle Section: Navigation (Centered) -->
    <div class="flex-1 flex justify-center overflow-hidden px-2">
      <nav class="hidden lg:flex items-center gap-8 whitespace-nowrap px-4">
        <NuxtLink
          to="/dashboard"
          class="text-noble-black font-geist font-normal hover:text-burning-orange transition-colors"
          active-class="text-burning-orange"
        >
          Feed
        </NuxtLink>
        <NuxtLink
          to="/list-item"
          class="text-noble-black font-geist font-normal hover:text-burning-orange transition-colors"
          active-class="text-burning-orange"
        >
          List an Item
        </NuxtLink>
      </nav>
    </div>

    <!-- Right Section: Icons (Width matches Left on desktop for perfect centering) -->
    <div class="w-auto lg:w-80 flex justify-end items-center px-4 sm:px-6 gap-4 shrink-0">
      <!-- Notification Icon -->
      <button
        class="hidden md:block text-noble-black hover:text-burning-orange transition-colors p-1"
        title="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      </button>

      <!-- Chat Icon -->
      <button
        class="hidden md:block text-noble-black hover:text-burning-orange transition-colors p-1"
        title="Chat"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      <!-- Heart Icon (Likes) -->
      <button
        class="hidden md:block text-noble-black hover:text-burning-orange transition-colors p-1"
        title="Likes"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
          />
        </svg>
      </button>

      <!-- Cart Icon -->
      <button
        class="hidden md:block text-noble-black hover:text-burning-orange transition-colors p-1"
        title="Cart"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      </button>

      <!-- Profile Icon (Always Visible) -->
      <NuxtLink
        to="/account"
        class="text-noble-black hover:text-burning-orange transition-colors p-1 md:pl-3 md:border-l border-cinnamon-ice md:ml-1"
        active-class="text-burning-orange"
        title="Profile"
      >
        <template #default="{ isActive }">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            :fill="isActive ? 'currentColor' : 'none'"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </template>
      </NuxtLink>
    </div>
  </header>
</template>

