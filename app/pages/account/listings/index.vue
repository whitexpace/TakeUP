<script setup lang="ts">
definePageMeta({ layout: "account", middleware: "account-auth" })

const { listings, isLoading, error, hasMore, fetchListings, toggleStatus, loadMore, refresh } =
  useMyListings()

const searchQuery = ref("")
const togglingId = ref<string | null>(null)

const filteredListings = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return listings.value
  return listings.value.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.categories.some((c) => c.toLowerCase().includes(q)),
  )
})

const handleToggleStatus = async (id: string, status: "AVAILABLE" | "DEACTIVATED") => {
  togglingId.value = id
  try {
    await toggleStatus(id, status)
  } catch {
    // error handled silently; toast could be added here
  } finally {
    togglingId.value = null
  }
}

onMounted(() => fetchListings())
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div>
        <h1 class="text-neutral-800 text-xl sm:text-2xl font-bold font-geist">My Listings</h1>
        <p class="text-neutral-800 text-base sm:text-lg font-normal font-geist tracking-wide mt-1">
          Manage your listed items for borrow, rent, or sale
        </p>
      </div>
      <div class="flex flex-col sm:flex-row gap-3 shrink-0">
        <NuxtLink
          to="/account/listings/new"
          class="inline-flex items-center justify-center px-5 py-3 bg-orange-500 text-white rounded-[30px] text-base sm:text-lg font-normal font-geist hover:bg-orange-600 transition-colors whitespace-nowrap"
        >
          Add a New Item
        </NuxtLink>
        <button
          class="inline-flex items-center justify-center px-5 py-3 bg-blue-950 text-white rounded-[30px] text-base sm:text-lg font-normal font-geist hover:bg-indigo-900 transition-colors whitespace-nowrap"
        >
          View Requests
        </button>
      </div>
    </div>

    <!-- Search bar -->
    <div
      class="w-full bg-orange-50 rounded-[30px] border border-red-300/30 px-4 py-3 flex items-center gap-3"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="text-neutral-800/50 shrink-0"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search for items to borrow, rent, or buy..."
        class="flex-1 bg-transparent text-neutral-800/70 text-base sm:text-lg font-normal font-geist placeholder:text-neutral-800/50 focus:outline-none"
      />
    </div>

    <!-- Loading state -->
    <div
      v-if="isLoading && listings.length === 0"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      <div v-for="i in 4" :key="i" class="h-72 bg-orange-50 rounded-[20px] animate-pulse" />
    </div>

    <!-- Error state -->
    <div
      v-else-if="error"
      class="bg-red-50 border border-red-200 rounded-xl p-6 text-center space-y-3"
    >
      <p class="text-red-600 text-base font-geist">{{ error }}</p>
      <button
        class="px-6 py-2 bg-red-500 text-white rounded-xl text-sm font-geist hover:bg-red-600 transition-colors"
        @click="refresh"
      >
        Try Again
      </button>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!isLoading && filteredListings.length === 0"
      class="bg-orange-50 rounded-[20px] border border-red-300/30 p-10 text-center space-y-4"
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        class="text-neutral-800/30 mx-auto"
      >
        <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
        <path d="M16 3H8l-2 4h12l-2-4z" />
      </svg>
      <p class="text-neutral-800/60 text-lg font-geist">
        {{ searchQuery ? "No listings match your search." : "You haven't listed any items yet." }}
      </p>
      <NuxtLink
        v-if="!searchQuery"
        to="/account/listings/new"
        class="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-[30px] text-base font-geist hover:bg-orange-600 transition-colors"
      >
        List Your First Item
      </NuxtLink>
    </div>

    <!-- Listings grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MyListingCard
        v-for="item in filteredListings"
        :key="item.id"
        :item="item"
        :is-toggling="togglingId === item.id"
        @toggle-status="handleToggleStatus"
      />
    </div>

    <!-- Load more -->
    <div v-if="hasMore && !isLoading" class="flex justify-center pt-4">
      <button
        class="px-8 py-3 bg-burning-orange text-white rounded-xl text-base font-geist hover:bg-cinnabar-red transition-colors"
        @click="loadMore"
      >
        Load More
      </button>
    </div>

    <!-- Loading more indicator -->
    <div v-if="isLoading && listings.length > 0" class="flex justify-center py-4">
      <div
        class="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"
      />
    </div>
  </div>
</template>
