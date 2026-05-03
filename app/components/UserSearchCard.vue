<template>
  <NuxtLink
    :to="`/profile/${username}`"
    class="flex items-center gap-4 bg-white border border-cinnamon-ice/20 p-4 rounded-[20px] hover:border-burning-orange hover:shadow-md transition-all group"
  >
    <UserAvatar
      :user-name="name"
      :avatar-url="avatarUrl"
      size="md"
      class="w-14 h-14 border-2 border-cream group-hover:scale-105 transition-transform"
    />

    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 mb-0.5">
        <h4
          class="font-geist font-bold text-noble-black truncate group-hover:text-burning-orange transition-colors"
        >
          {{ name }}
        </h4>
        <span
          class="px-2 py-0.5 bg-wahoo text-white text-[10px] font-bold uppercase rounded-full tracking-wider"
        >
          Lender
        </span>
      </div>
      <p class="text-xs text-noble-black/50 truncate mb-1.5">@{{ username }}</p>

      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="text-burning-orange"
          >
            <path
              d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
            />
          </svg>
          <span class="text-xs font-bold text-noble-black">{{ rating.toFixed(1) }}</span>
        </div>
        <span class="text-[10px] text-noble-black/30">•</span>
        <span class="text-xs text-noble-black/60">{{ activeListings }} active listings</span>
      </div>
    </div>

    <div class="text-noble-black/20 group-hover:text-burning-orange transition-colors">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
defineProps<{
  name: string
  username: string
  avatarUrl: string | null
  rating: number
  activeListings: number
}>()
</script>
