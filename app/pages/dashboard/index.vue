<template>
  <div class="container mx-auto px-4 py-8 max-w-7xl">
    <!-- Header Section -->
    <div class="mb-10">
      <h1 class="font-rewon text-[40px] text-noble-black leading-tight mb-2">
        Good {{ greeting }}, {{ firstName }}!
      </h1>
      <p class="font-geist font-normal text-[20px] text-noble-black/70">
        Discover items to rent or borrow near you.
      </p>

      <!-- Search Bar Section -->
      <div class="mt-6 sm:mt-8 flex items-center gap-2 sm:gap-4 w-full">
        <!-- Input Container -->
        <div class="relative flex-1">
          <!-- Clear Button (X) or Search Icon -->
          <button
            v-if="searchQuery"
            class="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 focus:outline-none"
            title="Clear search"
            @click="clearSearch"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              class="sm:w-6 sm:h-6 stroke-noble-black/70"
              stroke-width="1"
            >
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <div
            v-else
            class="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 pointer-events-none"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              class="sm:w-6 sm:h-6 stroke-noble-black/70"
              stroke-width="1"
            >
              <path
                d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path d="M21 21L16.65 16.65" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>

          <!-- Search Input -->
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search for items to rent or buy"
            class="w-full h-[48px] sm:h-[60px] bg-cream rounded-[12px] sm:rounded-[15px] pl-11 sm:pl-14 pr-4 sm:pr-6 font-geist font-normal text-base sm:text-[20px] text-noble-black placeholder:text-noble-black/70 focus:outline-none border border-transparent focus:border-cinnamon-ice transition-colors"
          />
        </div>

        <!-- Search Button -->
        <button
          class="h-[48px] sm:h-[60px] px-6 sm:px-10 bg-burning-orange text-white rounded-[12px] sm:rounded-[15px] font-geist font-medium text-base sm:text-[20px] hover:bg-blue-estate transition-colors shrink-0 flex items-center justify-center"
        >
          Search
        </button>
      </div>
    </div>

    <!-- Items Grid & Empty State -->
    <div
      v-if="items.length > 0 || isLoading"
      class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6"
    >
      <ItemCard
        v-for="item in items"
        :id="item.id"
        :key="item.id"
        :type="item.type"
        :image="item.image"
        :category="item.category"
        :name="item.name"
        :rating="item.rating"
        :reviews="item.reviews"
        :price="item.price"
        :owner="item.owner"
      />

      <template v-if="isLoading">
        <ItemCardSkeleton v-for="i in 4" :key="`skeleton-${i}`" />
      </template>
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="w-full flex flex-col items-center justify-center py-24 px-4 text-center bg-cream rounded-[20px] border border-cinnamon-ice/50 shadow-sm mt-4"
    >
      <div class="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          class="stroke-cinnamon-ice"
          stroke-width="1.5"
        >
          <path
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path d="M8 11h4m-4 0v-4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <h3 class="font-geist font-semibold text-[24px] sm:text-[28px] text-noble-black mb-3">
        No items found
      </h3>
      <p
        class="font-geist font-normal text-[16px] sm:text-[18px] text-noble-black/70 max-w-md mx-auto"
      >
        We couldn't find any items matching your search or filters. Try adjusting them to see more
        results!
      </p>
      <button
        v-if="searchQuery"
        class="mt-8 h-[48px] px-8 bg-burning-orange text-white rounded-[12px] font-geist font-medium text-[16px] hover:bg-blue-estate transition-colors"
        @click="clearSearch"
      >
        Clear Search
      </button>
    </div>

    <!-- Intersection Trigger -->
    <div ref="loadMoreTrigger" class="h-10 w-full mt-4 flex items-center justify-center" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue"

definePageMeta({
  layout: "dashboard",
})

interface Item {
  id: string
  type: "Rent" | "Borrow"
  image: string
  category: string
  name: string
  rating: number | string
  reviews: number | string
  price?: string | number
  owner: string
}

// User & Greeting State
const user = useSupabaseUser()
const firstName = computed(() => {
  if (!user.value) return "User"
  const fullName = user.value.user_metadata?.full_name || user.value.user_metadata?.name || "User"
  return fullName.split(" ")[0]
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return "morning"
  if (hour < 18) return "afternoon"
  return "evening"
})

// Search State
const searchQuery = ref("")
const clearSearch = () => {
  searchQuery.value = ""
}

// Items State
const items = ref<Item[]>([])
const page = ref(1)
const isLoading = ref(false)
const hasMore = ref(true)

// Template Ref
const loadMoreTrigger = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

// Mock fetch function
const fetchMockItems = async (pageNumber: number): Promise<Item[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const popularItems: Array<Omit<Item, "id">> = [
        {
          type: "Rent" as const,
          image: "/images/popular/macbook.jpg",
          category: "Electronics",
          name: 'Macbook Air 13" M1',
          rating: "4.9",
          reviews: 67,
          price: 300,
          owner: "Paolo F.",
        },
        {
          type: "Borrow" as const,
          image: "/images/popular/scical.jpg",
          category: "Electronics",
          name: "Casio FX-991EX ClassWiz",
          rating: "4.8",
          reviews: 8,
          owner: "Dave S.",
        },
        {
          type: "Rent" as const,
          image: "/images/popular/camera.jpg",
          category: "Photography",
          name: "Sony A7 IV Camera Kit",
          rating: "5.0",
          reviews: 35,
          price: 500,
          owner: "Issa S.",
        },
        {
          type: "Rent" as const,
          image: "/images/popular/dress.jpg",
          category: "Attire",
          name: "Long Green Dress",
          rating: "4.8",
          reviews: 27,
          price: 100,
          owner: "Issa S.",
        },
      ]

      if (popularItems.length === 0) {
        resolve([])
        return
      }

      const newItems: Item[] = Array.from({ length: 12 }).map((_, i) => {
        const id = `item-${pageNumber}-${i}`
        const baseItem = popularItems[i % popularItems.length]!

        return {
          ...baseItem,
          id,
        }
      })
      resolve(newItems)
    }, 1000)
  })
}

// Load more logic
const loadMore = async () => {
  if (isLoading.value || !hasMore.value) return

  isLoading.value = true
  const newItems = await fetchMockItems(page.value)

  if (newItems.length === 0) {
    hasMore.value = false
  } else {
    items.value = [...items.value, ...newItems]
    page.value++
  }

  isLoading.value = false
}

// Intersection Observer Setup
onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        loadMore()
      }
    },
    {
      rootMargin: "100px", // Trigger load slightly before scrolling to the very bottom
      threshold: 0.1,
    },
  )

  if (loadMoreTrigger.value) {
    observer.observe(loadMoreTrigger.value)
  }
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
  }
})
</script>
