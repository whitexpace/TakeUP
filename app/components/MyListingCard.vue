<template>
  <div
    class="mx-auto flex h-full w-full max-w-[340px] cursor-pointer flex-col overflow-hidden rounded-[15px] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-shadow duration-300 hover:shadow-lg sm:rounded-[20px]"
  >
    <!-- Image Section -->
    <div class="relative aspect-square w-full bg-gray-50">
      <img :src="image" :alt="name" class="h-full w-full object-cover" />

      <!-- Type Tag -->
      <div
        class="absolute left-2 top-2 flex h-[24px] min-w-[50px] items-center justify-center whitespace-nowrap rounded-full font-geist text-[11px] font-normal tracking-wide shadow-sm sm:left-4 sm:top-4 sm:h-[32px] sm:min-w-[80px] sm:text-[15px]"
        :class="type === 'Rent' ? 'bg-cinnamon-ice text-noble-black' : 'bg-blue-estate text-white'"
      >
        {{ type }}
      </div>
    </div>

    <!-- Details Section -->
    <div class="flex flex-1 flex-col bg-white p-3 sm:p-5">
      <div
        class="mb-1 flex items-center justify-between gap-2 font-geist text-[11px] font-medium uppercase tracking-wide sm:mb-1.5 sm:gap-3 sm:text-[13px]"
      >
        <div class="min-w-0 truncate text-burning-orange">
          {{ category }}
        </div>
      </div>

      <div class="mb-2 flex flex-col gap-1 sm:mb-2 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
        <h3
          class="w-full truncate font-geist text-[14px] font-semibold leading-tight text-noble-black sm:text-[17px]"
        >
          {{ name }}
        </h3>
        <div class="flex shrink-0 items-center gap-1 sm:pt-0.5">
          <svg
            class="h-3 w-3 fill-burning-orange sm:h-3.5 sm:w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
            />
          </svg>
          <span
            class="font-geist text-[11px] font-medium text-noble-black opacity-80 sm:text-[13px]"
            >{{ rating }}</span
          >
          <span class="font-geist text-[11px] font-light text-noble-black opacity-60 sm:text-[13px]"
            >({{ reviews }})</span
          >
        </div>
      </div>

      <div class="mt-auto">
        <div v-if="price !== undefined" class="flex items-baseline gap-1">
          <span class="font-geist text-[15px] font-bold text-burning-orange sm:text-[19px]"
            >₱{{ price }}</span
          >
          <span
            class="font-geist text-[12px] font-normal text-noble-black opacity-70 sm:text-[15px]"
            >/day</span
          >
        </div>
      </div>
    </div>

    <!-- Divider -->
    <div class="h-[1px] w-full bg-cinnamon-ice"></div>

    <!-- Owner/Request Section -->
    <div class="flex items-center justify-between bg-white px-3 py-2 sm:px-5 sm:py-4">
      <span
        class="truncate font-geist text-[12px] font-normal text-noble-black opacity-80 sm:text-[15px]"
        >by You</span
      >

      <div
        class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-[0.05em] sm:px-2.5 sm:py-1"
        :class="[statusClasses.text, statusClasses.badge]"
      >
        <span class="h-1.5 w-1.5 rounded-full" :class="statusClasses.dot" />
        <span>{{ status }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"

const props = defineProps<{
  id: string | number
  type: "Rent" | "Borrow"
  status: "IN USE" | "ACTIVE" | "INACTIVE"
  image: string
  category: string
  name: string
  rating: number | string
  reviews: number | string
  price?: string | number
  requestCount: number
}>()

const statusClasses = computed(() => {
  if (props.status === "IN USE") {
    return {
      text: "text-cinnabar-red",
      dot: "bg-cinnabar-red",
      badge: "bg-cinnabar-red/10",
    }
  }

  if (props.status === "ACTIVE") {
    return {
      text: "text-success-green",
      dot: "bg-success-green",
      badge: "bg-success-green/10",
    }
  }

  return {
    text: "text-noble-black/45",
    dot: "bg-noble-black/35",
    badge: "bg-noble-black/5",
  }
})
</script>
