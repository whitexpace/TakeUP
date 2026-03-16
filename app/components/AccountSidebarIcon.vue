<script setup lang="ts">
defineProps<{
  name:
    | "user"
    | "wallet"
    | "transactions"
    | "grid"
    | "activity"
    | "star"
    | "logout"
}>()
</script>

<template>
  <svg
    v-if="name === 'user'"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="h-[18px] w-[18px] shrink-0"
  >
    <path
      d="M18 20a6 6 0 0 0-12 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>

  <svg
    v-else-if="name === 'wallet'"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="h-[18px] w-[18px] shrink-0"
  >
    <path
      d="M3 8.5A2.5 2.5 0 0 1 5.5 6h11A2.5 2.5 0 0 1 19 8.5V9h1.5A1.5 1.5 0 0 1 22 10.5v6a1.5 1.5 0 0 1-1.5 1.5H19v.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 3 18.5v-10Z"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M19 9H6.5A1.5 1.5 0 1 1 6.5 6H18"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M18 13.5h.01"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>

  <svg
    v-else-if="name === 'transactions'"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="h-[18px] w-[18px] shrink-0"
  >
    <path
      d="M17 3l4 4-4 4"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M3 7h18"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M7 21l-4-4 4-4"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M21 17H3"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>

  <svg
    v-else-if="name === 'grid'"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="h-[18px] w-[18px] shrink-0"
  >
    <path
      d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>

  <svg
    v-else-if="name === 'activity'"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="h-[18px] w-[18px] shrink-0"
  >
    <path
      d="M3 17h4l3-8 4 11 3-6h4"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>

  <svg
    v-else-if="name === 'star'"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="h-[18px] w-[18px] shrink-0"
  >
    <path
      d="M12 3.5 14.8 9l6 .5-4.6 4 1.4 5.9L12 16.4l-5.6 3 1.4-5.9-4.6-4 6-.5L12 3.5Z"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>

  <svg
    v-else
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="h-[18px] w-[18px] shrink-0"
  >
    <path
      d="M10 17v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M21 12H9"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M18 8l4 4-4 4"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
