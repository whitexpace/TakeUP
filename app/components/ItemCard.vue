<template>
  <div
    class="bg-white rounded-[15px] sm:rounded-[20px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.08)] flex flex-col h-full hover:shadow-lg transition-shadow duration-300 w-full max-w-[340px] mx-auto cursor-pointer"
  >
    <!-- Image Section (~70% of card) -->
    <div class="relative aspect-square w-full bg-gray-50">
      <img :src="image" :alt="name" class="w-full h-full object-cover" />

      <!-- Type Tag -->
      <div
        class="absolute top-2 sm:top-4 left-2 sm:left-4 px-2 sm:px-4 py-1 sm:py-1.5 min-w-[50px] sm:min-w-[80px] h-[24px] sm:h-[32px] rounded-full font-geist text-[11px] sm:text-[15px] font-normal tracking-wide flex items-center justify-center shadow-sm whitespace-nowrap"
        :class="type === 'Rent' ? 'bg-cinnamon-ice text-noble-black' : 'bg-blue-estate text-white'"
      >
        {{ type }}
      </div>

      <!-- Like Button -->
      <button
        class="absolute top-2 sm:top-4 right-2 sm:right-4 w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors group"
      >
        <svg
          class="w-4 h-4 sm:w-5 sm:h-5 stroke-noble-black group-hover:fill-noble-black/10 transition-colors"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>

    <!-- Details Section -->
    <div class="p-3 sm:p-5 flex-1 flex flex-col bg-white">
      <div
        class="font-geist font-medium text-[11px] sm:text-[13px] uppercase tracking-wide text-burning-orange mb-1 sm:mb-1.5"
      >
        {{ category }}
      </div>

      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-1 sm:gap-2">
        <h3
          class="font-geist font-semibold text-[14px] sm:text-[17px] text-noble-black leading-tight truncate w-full"
        >
          {{ name }}
        </h3>
        <div class="flex items-center gap-1 shrink-0 sm:pt-0.5">
          <svg
            class="w-3 h-3 sm:w-3.5 sm:h-3.5"
            viewBox="0 0 24 24"
            fill="#ff7124"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
            />
          </svg>
          <span
            class="font-geist font-medium text-[11px] sm:text-[13px] text-noble-black opacity-80"
            >{{ rating }}</span
          >
          <span class="font-geist font-light text-[11px] sm:text-[13px] text-noble-black opacity-60"
            >({{ reviews }})</span
          >
        </div>
      </div>

      <div class="mt-auto">
        <div v-if="price" class="flex items-baseline gap-1">
          <span class="font-geist font-bold text-[15px] sm:text-[19px] text-burning-orange"
            >₱{{ price }}</span
          >
          <span
            class="font-geist font-normal text-[12px] sm:text-[15px] text-noble-black opacity-70"
            >/day</span
          >
        </div>
      </div>
    </div>

    <!-- Divider -->
    <div class="h-[1px] bg-cinnamon-ice w-full" />

    <!-- Owner Section -->
    <div class="px-3 py-2 sm:px-5 sm:py-4 flex justify-between items-center bg-white">
      <span
        class="font-geist font-normal text-[12px] sm:text-[15px] text-noble-black opacity-80 truncate pr-2"
        >by {{ owner }}</span
      >
      <button
        class="w-7 h-7 sm:w-9 sm:h-9 shrink-0 rounded-full bg-blue-estate flex items-center justify-center hover:opacity-90 transition-opacity shadow-sm"
      >
        <svg
          class="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
            stroke="white"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  type: "Rent" | "Borrow"
  image: string
  category: string
  name: string
  rating: number | string
  reviews: number | string
  price?: string | number
  owner: string
}>()
</script>
