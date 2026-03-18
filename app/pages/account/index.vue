<script setup lang="ts">
import { computed, inject, ref, onMounted } from "vue"
import type { Ref } from "vue"

definePageMeta({
  layout: "account",
  auth: false,
})

type AccountNavId =
  | "account-information"
  | "my-wallet"
  | "my-transactions"
  | "my-listings"
  | "my-listing-analytics"
  | "my-rewards"

type ListingStatus = "IN USE" | "ACTIVE" | "INACTIVE"
type ListingFilter = "All" | "In Use" | "Active" | "Inactive"

type ListingCardItem = {
  id: string
  type: "Rent" | "Borrow"
  status: ListingStatus
  image: string
  category: string
  name: string
  rating: number
  reviews: number
  price?: number
  requestCount: number
}

const activeItem = inject<Ref<AccountNavId>>("accountActiveItem", ref("my-listings"))

const searchQuery = ref("")
const selectedFilter = ref<ListingFilter>("All")

const defaultListings: ListingCardItem[] = [
  {
    id: "1",
    type: "Rent",
    status: "ACTIVE",
    image: "/images/popular/macbook.jpg",
    category: "Electronics",
    name: "MacBook Air M1",
    rating: 4.8,
    reviews: 21,
    price: 850,
    requestCount: 3,
  },
  {
    id: "2",
    type: "Borrow",
    status: "IN USE",
    image: "/images/popular/camera.jpg",
    category: "Photography",
    name: "Canon EOS M50 Camera Kit",
    rating: 4.9,
    reviews: 12,
    requestCount: 8,
  },
  {
    id: "3",
    type: "Rent",
    status: "INACTIVE",
    image: "/images/popular/dress.jpg",
    category: "Event & Party",
    name: "Formal Event Dress",
    rating: 4.6,
    reviews: 9,
    price: 280,
    requestCount: 0,
  },
  {
    id: "4",
    type: "Borrow",
    status: "ACTIVE",
    image: "/images/popular/scical.jpg",
    category: "Books & Academics",
    name: "Scientific Calculator",
    rating: 4.7,
    reviews: 17,
    requestCount: 2,
  },
  {
    id: "5",
    type: "Rent",
    status: "ACTIVE",
    image: "/images/popular/camera.jpg",
    category: "Music & Audio",
    name: "Portable Speaker System",
    rating: 4.5,
    reviews: 14,
    price: 420,
    requestCount: 5,
  },
  {
    id: "6",
    type: "Borrow",
    status: "IN USE",
    image: "/images/popular/macbook.jpg",
    category: "Electronics",
    name: "Tablet with Stylus",
    rating: 4.9,
    reviews: 6,
    requestCount: 4,
  },
]

const listingItems = ref<ListingCardItem[]>([])

onMounted(() => {
  if (typeof localStorage !== 'undefined') {
    const mockListings = JSON.parse(localStorage.getItem("mockMyListings") || "[]")
    listingItems.value = [...mockListings, ...defaultListings]
  } else {
    listingItems.value = defaultListings
  }
})

const filterConfig: Array<{ label: ListingFilter; status?: ListingStatus }> = [
  { label: "All" },
  { label: "In Use", status: "IN USE" },
  { label: "Active", status: "ACTIVE" },
  { label: "Inactive", status: "INACTIVE" },
]

const filterPills = computed(() =>
  filterConfig.map((filter) => ({
    ...filter,
    count:
      filter.label === "All"
        ? listingItems.value.length
        : listingItems.value.filter((item) => item.status === filter.status).length,
  })),
)

const filteredListings = computed(() => {
  const normalizedQuery = searchQuery.value.trim().toLowerCase()

  return listingItems.value.filter((item) => {
    const matchesFilter =
      selectedFilter.value === "All" ||
      (selectedFilter.value === "In Use" && item.status === "IN USE") ||
      (selectedFilter.value === "Active" && item.status === "ACTIVE") ||
      (selectedFilter.value === "Inactive" && item.status === "INACTIVE")

    const matchesSearch =
      normalizedQuery.length === 0 ||
      item.name.toLowerCase().includes(normalizedQuery) ||
      item.category.toLowerCase().includes(normalizedQuery)

    return matchesFilter && matchesSearch
  })
})

</script>

<template>
  <div v-if="activeItem === 'my-listings'" class="mx-auto w-full max-w-7xl">
    <section class="flex flex-col gap-12">
      <!-- Header with Title and Buttons -->
      <div class="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div class="max-w-2xl">
          <h1 class="text-[34px] font-bold tracking-tight text-noble-black sm:text-[40px]">
            My Listings
          </h1>
          <p class="mt-2 text-[16px] leading-relaxed text-noble-black/55 sm:text-[18px]">
            Manage your listed items for rent or borrow
          </p>
        </div>

        <div class="flex shrink-0 flex-wrap items-center gap-3 sm:mt-2">
          <button
            class="inline-flex items-center justify-center rounded-full border border-cinnamon-ice/50 bg-white px-8 py-3 text-[15px] font-semibold text-wahoo transition-all duration-300 hover:bg-cream hover:text-noble-black active:scale-[0.98]"
          >
            View Requests
          </button>
          <NuxtLink
            to="/items/new"
            class="inline-flex items-center justify-center rounded-full bg-burning-orange px-8 py-3 text-[15px] font-semibold text-white shadow-sm transition-all duration-300 hover:bg-blue-estate hover:shadow-md active:scale-[0.98]"
          >
            Add Item
          </NuxtLink>
        </div>
      </div>

      <!-- Search and Filters Section -->
      <div class="flex flex-col gap-4">
        <div class="flex w-full flex-col gap-3 sm:flex-row">
          <div class="relative w-full">
            <div
              class="absolute left-4 top-1/2 -translate-y-1/2 text-noble-black/45 z-10 sm:left-6"
              :class="{ 'cursor-pointer hover:text-noble-black transition-colors': searchQuery.length > 0 }"
              @click="searchQuery.length > 0 && (searchQuery = '')"
            >
              <svg
                v-if="searchQuery.length === 0"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 sm:h-6 sm:w-6"
              >
                <path
                  d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M21 21L16.65 16.65"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <svg
                v-else
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 sm:h-6 sm:w-6"
              >
                <path
                  d="M18 6L6 18M6 6L18 18"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>

            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search your listings"
              class="h-[48px] w-full rounded-[12px] border border-transparent bg-cream pl-11 pr-4 font-geist text-base font-normal text-noble-black outline-none transition-all placeholder:text-noble-black/70 focus:border-cinnamon-ice sm:h-[60px] sm:rounded-[15px] sm:pl-14 sm:pr-6 sm:text-[20px]"
            />
          </div>
        </div>

        <div class="flex flex-wrap gap-2.5">
          <button
            v-for="filter in filterPills"
            :key="filter.label"
            class="group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium transition-all duration-300"
            :class="
              selectedFilter === filter.label
                ? 'border-transparent bg-blue-estate text-white shadow-sm'
                : 'border-cinnamon-ice/40 bg-white text-wahoo hover:border-cinnamon-ice/80 hover:bg-cream/50 hover:text-noble-black hover:shadow-md active:scale-[0.98]'
            "
            @click="selectedFilter = filter.label"
          >
            <span>{{ filter.label }}</span>
            <span
              class="inline-flex min-w-4 items-center justify-center text-[12px] transition-colors duration-300"
              :class="
                selectedFilter === filter.label
                  ? 'text-white/80'
                  : 'text-noble-black/40 group-hover:text-noble-black/60'
              "
            >
              {{ filter.count }}
            </span>
          </button>
        </div>
      </div>

      <div
        v-if="filteredListings.length > 0"
        class="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <MyListingCard
          v-for="item in filteredListings"
          :id="item.id"
          :key="item.id"
          :type="item.type"
          :status="item.status"
          :image="item.image"
          :category="item.category"
          :name="item.name"
          :rating="item.rating"
          :reviews="item.reviews"
          :price="item.price"
          :request-count="item.requestCount"
        />
      </div>

      <div
        v-else
        class="rounded-[20px] border border-cinnamon-ice/35 bg-cream/45 px-8 py-16 text-center"
      >
        <h2 class="text-[22px] font-semibold text-noble-black">No listings found</h2>
        <p class="mt-2 text-[15px] text-noble-black/55">
          Try adjusting your search or status filters to find the item you need.
        </p>
      </div>
    </section>
  </div>

  <div v-else class="max-w-4xl p-10">
    <h1 class="mb-2 text-2xl font-bold text-gray-900">Account Information</h1>
    <p class="mb-8 text-gray-600">Manage your personal details and account settings.</p>

    <div class="rounded-xl border-2 border-dashed border-gray-300 p-8 text-center text-gray-500">
      Account settings and profile content will go here.
    </div>
  </div>
</template>
