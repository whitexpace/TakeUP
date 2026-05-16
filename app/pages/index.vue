<script setup lang="ts">
import { ref, onMounted, computed } from "vue"
import Header from "../components/Header.vue"

import ItemCard from "../components/ItemCard.vue"
import { getTrendingItemIds } from "../utils/item-trending"

definePageMeta({
  middleware: "home-auth-redirect",
})

const supabase = useSupabaseClient()
const route = useRoute()

type LoginStatus = "idle" | "loading" | "success" | "error" | "blocked_domain"
const loginStatus = ref<LoginStatus>("idle")
const errorMessage = ref("")

// 1. Fetch Dynamic Category Metadata using the same endpoint as the dashboard
const { data: filterData, pending: isLoadingMetadata } = useFetch("/api/items/filter-metadata")

// 2. Fetch Popular/Trending Items using standard API
const { data: itemsResponse, pending: isLoadingPopular } = useFetch("/api/items?limit=8")

const trendingIds = computed(() => {
  const items = itemsResponse.value?.items || []
  if (items.length === 0) return new Set<string>()
  return getTrendingItemIds(items)
})

// Fallback Mock Data for Popular Section (if DB is empty)
const MOCK_POPULAR_ITEMS: Array<{
  id: string
  type: "Rent" | "Borrow"
  image: string | null
  category: string
  name: string
  price: string | number
  rating: number
  reviews: number
  owner: string
  isTrending: boolean
}> = [
  {
    id: "m1",
    type: "Rent",
    image: "/images/popular/macbook.jpg",
    category: "Electronics",
    name: "Macbook Air 13-inch M1",
    price: "300",
    rating: 4.9,
    reviews: 67,
    owner: "jslegaspo",
    isTrending: true,
  },
  {
    id: "m2",
    type: "Borrow",
    image: "/images/popular/scical.jpg",
    category: "Electronics",
    name: "Casio FX-991EX",
    price: "Free",
    rating: 4.8,
    reviews: 8,
    owner: "mchen",
    isTrending: true,
  },
  {
    id: "m3",
    type: "Rent",
    image: "/images/popular/camera.jpg",
    category: "Photography",
    name: "Sony A7 IV Kit",
    price: "500",
    rating: 5.0,
    reviews: 35,
    owner: "binicolete",
    isTrending: true,
  },
  {
    id: "m4",
    type: "Rent",
    image: "/images/popular/dress.jpg",
    category: "Attire",
    name: "Long Green Dress",
    price: "100",
    rating: 4.8,
    reviews: 27,
    owner: "sophia_l",
    isTrending: true,
  },
]

const displayPopularItems = computed(() => {
  const items = itemsResponse.value?.items || []
  if (items.length > 0) {
    return items.map((item) => ({
      id: item.id,
      type: (item.freeToBorrow ? "Borrow" : "Rent") as "Borrow" | "Rent",
      image: item.thumbnailImage,
      category: item.categories[0] || "Others",
      name: item.name,
      price: item.freeToBorrow ? "Free" : item.rentalFee,
      rating: item.rating ?? 0,
      reviews: item.bookingCount ?? 0,
      isTrending: trendingIds.value.has(item.id),
      owner: item.ownerName || "user",
    }))
  }
  return MOCK_POPULAR_ITEMS
})

const CATEGORY_UI_MAP: Record<string, { label: string; image: string }> = {
  BOOKS: { label: "Books & Academics", image: "/images/books.jpg" },
  ELECTRONICS: { label: "Electronics", image: "/images/electronics.jpg" },
  SPORTS_OUTDOORS: { label: "Sports Equipment", image: "/images/sports.jpg" },
  SCHOOL_SUPPLIES: { label: "Dorm Essentials", image: "/images/dorm.jpg" },
  MUSIC_AUDIO: { label: "Music & Audio", image: "/images/music.jpg" },
  TOOLS: { label: "Tools", image: "/images/categories/camera.png" },
  CLOTHING: { label: "Attire", image: "/images/attire.jpg" },
  HOME_APPLIANCES: { label: "Home & Appliances", image: "/images/categories/lamp.png" },
  TOYS_GAMES: { label: "Toys & Games", image: "/images/categories/disco-ball.png" },
  PET_SUPPLIES: { label: "Pet Supplies", image: "/images/pet.jpg" },
  OTHER: { label: "Others", image: "/images/categories/palette.png" },
  OTHERS: { label: "Others", image: "/images/categories/palette.png" },
}

// Flexible Bento Span generator
const getGridSpan = (index: number, total: number) => {
  if (total === 1) return "md:col-span-4 md:row-span-2"
  if (total === 2) return "md:col-span-2 md:row-span-2"
  if (total === 3) {
    if (index === 0) return "md:col-span-2 md:row-span-2"
    return "md:col-span-2 md:row-span-1"
  }
  if (total === 4) return "md:col-span-2 md:row-span-1"

  // 5 items (Standard Layout)
  if (total === 5) {
    if (index === 0) return "md:col-span-2 md:row-span-1"
    if (index === 1) return "md:col-span-1 md:row-span-2"
    if (index === 2) return "md:col-span-1 md:row-span-1"
    if (index === 3) return "md:col-span-2 md:row-span-1"
    return "md:col-span-1 md:row-span-1"
  }

  // 6 items (Full Fill Layout)
  if (index === 0) return "md:col-span-2 md:row-span-1"
  if (index === 1) return "md:col-span-1 md:row-span-1"
  if (index === 2) return "md:col-span-1 md:row-span-1"
  if (index === 3) return "md:col-span-1 md:row-span-1"
  if (index === 4) return "md:col-span-1 md:row-span-1"
  return "md:col-span-2 md:row-span-1"
}

const dynamicCategories = computed(() => {
  const categoriesToUse = []

  // Try to extract real categories with items
  if (filterData.value?.categories) {
    const sorted = Object.entries(filterData.value.categories)
      .filter(([, count]) => (count as number) > 0)
      .sort(([, a], [, b]) => (b as number) - (a as number))

    if (sorted.length > 0) {
      categoriesToUse.push(...sorted.slice(0, 6)) // Take up to 6 real categories
    }
  }

  // If no items found, use curated static defaults
  if (categoriesToUse.length === 0) {
    return [
      {
        title: "Books & Academics",
        subtitle: "Featured",
        imageSrc: "/images/books.jpg",
        class: "md:col-span-2 md:row-span-1",
      },
      {
        title: "Electronics",
        subtitle: "Trending",
        imageSrc: "/images/electronics.jpg",
        class: "md:col-span-1 md:row-span-2",
      },
      {
        title: "Sports Equipment",
        subtitle: "Active",
        imageSrc: "/images/sports.jpg",
        class: "md:col-span-1 md:row-span-1",
      },
      {
        title: "Dorm Essentials",
        subtitle: "Essential",
        imageSrc: "/images/dorm.jpg",
        class: "md:col-span-2 md:row-span-1",
      },
      {
        title: "Attire",
        subtitle: "Style",
        imageSrc: "/images/attire.jpg",
        class: "md:col-span-1 md:row-span-1",
      },
    ]
  }

  // Map to UI objects with dynamic grid spans
  return categoriesToUse.map(([key, count], index) => {
    const ui = CATEGORY_UI_MAP[key] || { label: key, image: "/images/landing-pic1.jpg" }
    return {
      title: ui.label,
      subtitle: `${count} items`,
      imageSrc: ui.image,
      class: getGridSpan(index, categoriesToUse.length),
    }
  })
})

const stats = [
  { value: "1,500+", label: "Items Available" },
  { value: "500+", label: "Verified Iskos" },
  { value: "4.9", label: "Average Rating" },
]

const trustBadges = [
  "Verified UP Cebu Students only",
  "Secure transactions",
  "Campus-based meetups",
]

onMounted(async () => {
  if (route.query.error) {
    errorMessage.value = route.query.error as string
    loginStatus.value = (route.query.status as LoginStatus) || "error"
    scrollToSignIn()
  }
})

const signInRef = ref<HTMLElement | null>(null)
const categoriesRef = ref<HTMLElement | null>(null)
const popularItemsRef = ref<HTMLElement | null>(null)
const isSignInHighlighted = ref(false)

const scrollToSection = (element: HTMLElement | null) => {
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "center" })
  }
}

const scrollToSignIn = () => {
  scrollToSection(signInRef.value)
  isSignInHighlighted.value = true
  setTimeout(() => {
    isSignInHighlighted.value = false
  }, 1000)
}

const handleGoogleLogin = async () => {
  errorMessage.value = ""
  loginStatus.value = "loading"

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        prompt: "select_account",
      },
    },
  })

  if (error) {
    loginStatus.value = "error"
    errorMessage.value = error.message || "Google Sign-In is not configured."
  }
}
</script>

<template>
  <main
    class="min-h-screen bg-white font-geist selection:bg-burning-orange/10 selection:text-burning-orange"
  >
    <!-- Redesigned Shared Header -->
    <Header :show-nav="false" hide-icons @sign-in="scrollToSignIn" />

    <!-- 1. Immersive Hero Section (Dark) -->
    <section class="relative min-h-screen flex items-center pt-20 overflow-hidden">
      <div class="absolute inset-0 z-0">
        <img src="/images/up.jpg" class="w-full h-full object-cover" alt="UP Cebu Campus" />
        <div class="absolute inset-0 bg-noble-black/60 backdrop-brightness-75"></div>
      </div>

      <div class="max-w-7xl mx-auto px-6 relative z-10 w-full">
        <div class="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
          <div
            class="w-full lg:w-[60%] flex flex-col items-center text-center lg:items-start lg:text-left"
          >
            <h1
              class="font-montravia italic text-[56px] md:text-[72px] text-white leading-[1.05] mb-8 drop-shadow-sm"
            >
              Share what you <span class="text-burning-orange not-italic">have</span>.<br />
              Get what you <span class="text-burning-orange not-italic">need</span>.
            </h1>
            <p
              class="text-[18px] md:text-[22px] text-white/80 font-light max-w-[580px] leading-relaxed mb-12"
            >
              The premier peer-to-peer sharing marketplace exclusively for the UP Cebu community.
              Borrow gear for free or rent items for your projects.
            </p>

            <div class="flex items-center gap-10">
              <div v-for="(stat, i) in stats" :key="stat.label" class="flex items-center">
                <div class="flex flex-col">
                  <span class="text-[32px] font-bold text-white leading-none mb-1">{{
                    stat.value
                  }}</span>
                  <span class="text-[14px] text-white/60 font-medium tracking-wide uppercase">{{
                    stat.label
                  }}</span>
                </div>
                <div v-if="i < stats.length - 1" class="h-10 w-px bg-white/20 ml-10"></div>
              </div>
            </div>
          </div>

          <div class="w-full lg:w-[40%] flex justify-center lg:justify-end">
            <div
              ref="signInRef"
              class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[24px] shadow-2xl w-full max-w-[440px] p-10 lg:p-12 transition-all duration-500 overflow-hidden"
              :class="{
                'scale-[1.03] border-burning-orange/50 bg-white/20 shadow-[0_0_80px_rgba(255,113,36,0.15)] ring-4 ring-burning-orange/5':
                  isSignInHighlighted,
              }"
            >
              <h2 class="text-[24px] font-bold text-white mb-2">Get started today.</h2>
              <p class="text-[14px] text-white/60 mb-10">
                Sign in with your Google account to join the community.
              </p>

              <button
                class="w-full h-14 bg-burning-orange rounded-[12px] flex items-center justify-center gap-3 hover:brightness-110 transition-all duration-300 disabled:opacity-50 group mb-6 active:scale-95 shadow-lg shadow-burning-orange/20"
                :disabled="loginStatus === 'loading' || loginStatus === 'success'"
                @click="handleGoogleLogin"
              >
                <div class="p-1 bg-white rounded-full">
                  <img src="/images/google-icon.svg" alt="Google" class="w-5 h-5 block" />
                </div>
                <span class="text-white font-semibold text-[15px]">Continue with Google</span>
              </button>

              <div class="h-px bg-white/10 w-full mb-6"></div>
              <p class="text-[12px] text-white/40 text-center leading-relaxed">
                Accounts ending with <span class="text-white font-semibold">up.edu.ph</span> or
                <span class="text-white font-semibold">gmail.com</span> are accepted
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 2. Trust Badges Row (Infinite Scrolling Ticker) -->
    <div class="bg-white py-8 border-b border-cinnamon-ice/10 relative overflow-hidden group">
      <div
        class="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none"
      ></div>
      <div
        class="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"
      ></div>

      <div
        class="flex whitespace-nowrap animate-infinite-scroll hover:[animation-play-state:paused]"
      >
        <div class="flex items-center gap-x-20 px-10">
          <div
            v-for="badge in trustBadges"
            :key="`set1-${badge}`"
            class="flex items-center gap-3 transition-all duration-300"
          >
            <div
              class="w-6 h-6 rounded-full bg-success-green/5 flex items-center justify-center border border-success-green/10 shrink-0"
            >
              <Icon name="ph:check" class="text-success-green w-3.5 h-3.5" />
            </div>
            <span class="text-[12px] text-noble-black/40 font-semibold tracking-widest uppercase">{{
              badge
            }}</span>
          </div>
        </div>
        <div class="flex items-center gap-x-20 px-10" aria-hidden="true">
          <div
            v-for="badge in trustBadges"
            :key="`set2-${badge}`"
            class="flex items-center gap-3 transition-all duration-300"
          >
            <div
              class="w-6 h-6 rounded-full bg-success-green/5 flex items-center justify-center border border-success-green/10 shrink-0"
            >
              <Icon name="ph:check" class="text-success-green w-3.5 h-3.5" />
            </div>
            <span class="text-[12px] text-noble-black/40 font-semibold tracking-widest uppercase">{{
              badge
            }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. Borrow Locally Branded Panel (Dark) -->
    <section class="bg-noble-black py-24 lg:py-32 overflow-hidden">
      <div class="max-w-7xl mx-auto px-6">
        <div class="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
          <div class="w-full lg:w-1/2">
            <h2 class="font-montravia text-[42px] lg:text-[56px] text-white leading-[1.1] mb-8">
              Borrow <span class="text-burning-orange">LOCALLY</span>. <br />
              Lend <span class="text-white/60 font-light italic">SAFELY</span>. <br />
              Save <span class="text-burning-orange">MONEY</span>.
            </h2>
            <p
              class="text-[17px] lg:text-[19px] text-white/50 font-light leading-relaxed mb-12 max-w-[500px]"
            >
              Join 500+ verified UP Cebu students already sharing 1,500+ items on campus. No
              “neighbors” — just students within your trusted community.
            </p>
            <div class="flex flex-col sm:flex-row gap-5">
              <button
                type="button"
                class="h-12 px-10 bg-burning-orange text-white rounded-[14px] font-bold text-[15px] flex items-center justify-center hover:brightness-110 transition-all active:scale-95 shadow-lg shadow-burning-orange/20"
                @click="scrollToSignIn"
              >
                Borrow Now
              </button>
              <button
                type="button"
                class="h-12 px-10 border-[1.5px] border-white/15 text-white rounded-[14px] font-bold text-[15px] flex items-center justify-center hover:bg-white/5 transition-all active:scale-95"
                @click="scrollToSignIn"
              >
                Lend an Item
              </button>
            </div>
          </div>

          <div class="w-full lg:w-1/2 grid grid-cols-2 gap-4 sm:gap-6">
            <div class="space-y-4 sm:space-y-6 pt-16">
              <div
                class="rounded-[24px] overflow-hidden aspect-[4/5] border border-white/5 shadow-2xl transition-transform duration-700 hover:scale-[1.02]"
              >
                <img src="/images/popular/macbook.jpg" class="w-full h-full object-cover" />
              </div>
              <div
                class="rounded-[24px] overflow-hidden aspect-square border border-white/5 shadow-2xl transition-transform duration-700 hover:scale-[1.02]"
              >
                <img src="/images/popular/camera.jpg" class="w-full h-full object-cover" />
              </div>
            </div>
            <div class="space-y-4 sm:space-y-6">
              <div
                class="rounded-[24px] overflow-hidden aspect-square border border-white/5 shadow-2xl transition-transform duration-700 hover:scale-[1.02]"
              >
                <img src="/images/popular/scical.jpg" class="w-full h-full object-cover" />
              </div>
              <div
                class="rounded-[24px] overflow-hidden aspect-[4/5] border border-white/5 shadow-2xl transition-transform duration-700 hover:scale-[1.02]"
              >
                <img src="/images/popular/dress.jpg" class="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. Browse Categories (Dynamic Editorial Bento Grid - Light) -->
    <section ref="categoriesRef" class="py-24 lg:py-32 bg-white">
      <div class="max-w-7xl mx-auto px-6">
        <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
          <div>
            <h2 class="font-montravia text-[36px] text-noble-black mb-2 leading-none">
              Browse Categories
            </h2>
            <p class="text-[14px] text-noble-black/40 font-light">
              Find exactly what you need from verified UP Cebu students.
            </p>
          </div>
          <button
            type="button"
            class="text-burning-orange font-semibold text-[13px] flex items-center gap-1 hover:underline"
            @click="scrollToSignIn"
          >
            View Categories <span class="text-[16px]">→</span>
          </button>
        </div>

        <!-- Skeleton Loading State -->
        <div
          v-if="isLoadingMetadata"
          class="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-4 h-auto md:h-[600px]"
        >
          <div
            v-for="i in 5"
            :key="i"
            :class="[
              i === 1 ? 'md:col-span-2 md:row-span-1' : '',
              i === 2 ? 'md:col-span-1 md:row-span-2' : '',
              i === 3 ? 'md:col-span-1 md:row-span-1' : '',
              i === 4 ? 'md:col-span-2 md:row-span-1' : '',
              i === 5 ? 'md:col-span-1 md:row-span-1' : '',
              'bg-noble-black/5 rounded-[24px] animate-pulse border border-cinnamon-ice/10',
            ]"
          ></div>
        </div>

        <div
          v-else
          class="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-4 h-auto md:h-[600px]"
        >
          <div
            v-for="cat in dynamicCategories"
            :key="cat.title"
            :class="[
              cat.class,
              'relative rounded-[24px] overflow-hidden group cursor-pointer shadow-sm border border-cinnamon-ice/10 transition-all duration-500 hover:scale-[1.01] hover:shadow-2xl',
            ]"
          >
            <img
              :src="cat.imageSrc"
              class="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
            />
            <div
              class="absolute inset-0 bg-noble-black/45 group-hover:bg-noble-black/30 transition-colors duration-500"
            ></div>

            <div class="absolute inset-0 p-8 flex flex-col justify-between z-10">
              <h3 class="text-white text-[20px] font-bold tracking-tight drop-shadow-md">
                {{ cat.title }}
              </h3>
              <div class="flex justify-end">
                <span
                  class="bg-burning-orange text-white text-[11px] font-bold uppercase tracking-widest px-4 py-2 rounded-full shadow-lg"
                >
                  {{ cat.subtitle }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 5. Popular on Campus (Dark Spotlight) -->
    <section ref="popularItemsRef" class="py-32 bg-noble-black overflow-hidden relative">
      <div
        class="absolute top-0 right-0 w-[500px] h-[500px] bg-burning-orange/5 rounded-full blur-[100px] -mr-64 -mt-64"
      ></div>

      <div class="max-w-7xl mx-auto px-6 relative z-10">
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div>
            <h2 class="font-montravia text-[48px] italic text-white mb-2 leading-none">
              Popular on Campus
            </h2>
            <p class="text-[15px] text-white/40 font-light tracking-wide">
              Most borrowed items this week across the UP Cebu community
            </p>
          </div>
          <button
            type="button"
            class="text-white font-semibold text-[13px] flex items-center gap-3 group"
            @click="scrollToSignIn"
          >
            <span
              class="tracking-widest uppercase text-[11px] opacity-70 group-hover:opacity-100 transition-opacity"
              >View All Items</span
            >
            <div
              class="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center transition-all group-hover:border-burning-orange group-hover:bg-burning-orange shadow-lg"
            >
              <Icon name="ph:arrow-right" class="w-4 h-4" />
            </div>
          </button>
        </div>

        <div v-if="isLoadingPopular" class="flex gap-8 overflow-x-auto pb-12 hide-scrollbar">
          <div
            v-for="i in 4"
            :key="i"
            class="flex-shrink-0 w-[300px] h-[360px] bg-white/5 rounded-[20px] animate-pulse"
          ></div>
        </div>

        <div
          v-else
          class="flex gap-8 overflow-x-auto pb-12 hide-scrollbar snap-x cursor-grab active:cursor-grabbing"
        >
          <!-- Styled Item Cards with Ghost Rank Numbers -->
          <div
            v-for="(item, idx) in displayPopularItems"
            :key="item.id"
            class="flex-shrink-0 w-[280px] snap-start relative group/card-wrapper"
            @click.capture.stop="scrollToSignIn"
          >
            <!-- Ghost Rank Number (Behind Card) -->
            <span
              class="absolute top-[-30px] left-[-10px] text-[120px] font-black text-white/5 leading-none select-none tracking-tighter italic z-0 pointer-events-none group-hover/card-wrapper:text-white/10 transition-colors duration-500"
            >
              {{ idx + 1 }}
            </span>

            <div class="relative z-10">
              <ItemCard
                :id="item.id"
                :type="item.type"
                :category="item.category"
                :name="item.name"
                :image="item.image"
                :price="item.price"
                :rating="item.rating"
                :reviews="item.reviews"
                :is-trending="item.isTrending"
                :owner="item.owner"
                class="!mx-0 shadow-[0_12px_40px_rgba(0,0,0,0.4)] group-hover/card-wrapper:-translate-y-2 transition-all duration-500"
              />
            </div>
          </div>
          <div class="flex-shrink-0 w-32"></div>
        </div>
      </div>
    </section>

    <!-- Simple Footer -->
    <footer class="bg-white border-t border-cinnamon-ice/10 h-auto md:h-16">
      <div
        class="max-w-7xl mx-auto h-full px-6 py-6 md:py-0 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] text-noble-black/40 uppercase tracking-widest font-bold"
      >
        <span>&copy; 2026 TakeUP Marketplace</span>
        <div class="flex items-center gap-1">
          Made with <Icon name="ph:heart-fill" class="text-cinnabar-red w-3.5 h-3.5" /> for the UP
          Cebu Community
        </div>
        <span>UP Cebu Campus</span>
      </div>
    </footer>
  </main>
</template>

<style scoped>
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
