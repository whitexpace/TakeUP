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
          <Icon name="ph:star-fill" class="w-3 h-3 text-burning-orange" />
          <span class="text-xs font-bold text-noble-black">{{ rating.toFixed(1) }}</span>
        </div>
        <span class="text-[10px] text-noble-black/30">•</span>
        <span class="text-xs text-noble-black/60">{{ activeListings }} active listings</span>
      </div>
    </div>

    <div class="text-noble-black/20 group-hover:text-burning-orange transition-colors">
      <Icon name="ph:caret-right-light" class="w-5 h-5" />
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
