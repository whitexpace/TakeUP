<script setup lang="ts">
import { computed, ref } from "vue"
import { useAdminListings } from "~/composables/use-admin-listings"
import type { AdminListingRecord } from "~/types/admin-listing"

definePageMeta({
  layout: "admin",
  middleware: "admin-auth",
})

type ListingStatusFilter = AdminListingRecord["status"] | null

const STATUS_OPTIONS: Array<{ label: string; value: ListingStatusFilter }> = [
  { label: "All", value: null },
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
  { label: "Admin Deactivated", value: "DEACTIVATED_BY_ADMIN" },
  { label: "Admin Removed", value: "REMOVED_BY_ADMIN" },
]

const CATEGORY_OPTIONS = [
  "ELECTRONICS",
  "BOOKS",
  "CLOTHING",
  "TOOLS",
  "HOME_APPLIANCES",
  "SPORTS_OUTDOORS",
  "MUSIC_AUDIO",
  "TOYS_GAMES",
  "FURNITURE",
  "VEHICLES_ACCESSORIES",
  "HEALTH_BEAUTY",
  "SCHOOL_SUPPLIES",
  "PET_SUPPLIES",
  "OTHER",
] as const

const activeStatus = ref<ListingStatusFilter>(null)
const activeCategory = ref<string>("")
const searchQuery = ref("")
const isActionLoading = ref(false)
const actionError = ref<string | null>(null)
const confirmationTarget = ref<{
  listing: AdminListingRecord
  action: "activate" | "deactivate" | "remove"
} | null>(null)

const selectedStatuses = computed(() => (activeStatus.value ? [activeStatus.value] : []))
const selectedCategories = computed(() => (activeCategory.value ? [activeCategory.value] : []))

const { summary, listings, isLoading, error, hasMore, loadMore, refresh, moderateListing } =
  useAdminListings({
    statuses: selectedStatuses,
    categories: selectedCategories,
    searchQuery,
  })

const hasActiveFilters = computed(() =>
  Boolean(activeStatus.value || activeCategory.value || searchQuery.value.trim()),
)
const isInitialLoading = computed(() => !listings.value.length && isLoading.value)
const hasInitialError = computed(
  () => !listings.value.length && !isLoading.value && Boolean(error.value),
)
const hasEmptyState = computed(() => !listings.value.length && !isLoading.value && !error.value)

const formatDateTime = (value: string | Date) =>
  new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))

const formatCategory = (category: string) =>
  category
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")

const summaryItems = computed(() => [
  {
    label: "Total Listings",
    value: summary.value.totalListings.toLocaleString(),
    detail: "Admin-visible marketplace inventory",
  },
  {
    label: "Active Listings",
    value: summary.value.activeListings.toLocaleString(),
    detail: "Currently open or available to borrowers",
  },
  {
    label: "Inactive Listings",
    value: summary.value.inactiveListings.toLocaleString(),
    detail: "Owner inactive plus admin-moderated inventory",
  },
])

const openConfirmation = (
  listing: AdminListingRecord,
  action: "activate" | "deactivate" | "remove",
) => {
  actionError.value = null
  confirmationTarget.value = { listing, action }
}

const closeConfirmation = () => {
  if (isActionLoading.value) return
  confirmationTarget.value = null
}

const confirmationTitle = computed(() => {
  const action = confirmationTarget.value?.action
  if (action === "activate") return "Reactivate listing?"
  if (action === "remove") return "Remove listing?"
  return "Deactivate listing?"
})

const confirmationMessage = computed(() => {
  const target = confirmationTarget.value
  if (!target) return ""
  if (target.action === "activate") {
    return "This will restore marketplace visibility and allow future bookings again."
  }

  if (target.action === "remove") {
    return "This listing will be hidden from users and marked as removed by an administrator."
  }

  if (target.listing.hasActiveTransactions) {
    return "This listing has active or upcoming transactions. Deactivation will stop new bookings, but current transaction records will remain intact."
  }

  return "This will stop new bookings and hide the listing from normal marketplace browsing."
})

const confirmationButtonLabel = computed(() => {
  const action = confirmationTarget.value?.action
  if (action === "activate") return "Reactivate Listing"
  if (action === "remove") return "Remove Listing"
  return "Deactivate Listing"
})

const confirmAction = async () => {
  if (!confirmationTarget.value || isActionLoading.value) return

  isActionLoading.value = true
  actionError.value = null

  try {
    await moderateListing(confirmationTarget.value.listing.id, confirmationTarget.value.action)
    confirmationTarget.value = null
  } catch (err: unknown) {
    actionError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      "Unable to update this listing right now."
  } finally {
    isActionLoading.value = false
  }
}

const resetFilters = async () => {
  activeStatus.value = null
  activeCategory.value = ""
  searchQuery.value = ""
  await refresh()
}

const getRowTone = (listing: AdminListingRecord) => {
  if (listing.status === "REMOVED_BY_ADMIN") return "text-cinnabar-red"
  if (listing.status === "DEACTIVATED_BY_ADMIN") return "text-burning-orange"
  if (listing.status === "INACTIVE") return "text-slate-500"
  return "text-emerald-700"
}
</script>

<template>
  <div class="space-y-5 font-geist">
    <section class="space-y-3">
      <div class="space-y-2">
        <h1 class="text-[28px] font-semibold text-noble-black">Listings</h1>
        <div class="h-0.5 w-10 bg-burning-orange"></div>
      </div>
      <p class="max-w-3xl text-[16px] font-medium leading-relaxed text-noble-black/50">
        Review platform-wide inventory, trace listing ownership, and apply moderation controls with
        transaction-aware safeguards.
      </p>
    </section>

    <section class="grid gap-4 md:grid-cols-3">
      <div
        v-for="item in summaryItems"
        :key="item.label"
        class="rounded-[18px] border border-cinnamon-ice/20 bg-cream p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
      >
        <p class="text-[12px] font-bold uppercase text-noble-black/40">{{ item.label }}</p>
        <p class="mt-2 text-[26px] font-extrabold leading-tight text-noble-black">
          {{ item.value }}
        </p>
        <p class="mt-1 text-[13px] font-medium text-noble-black/45">{{ item.detail }}</p>
      </div>
    </section>

    <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">
      <div>
        <label class="mb-2 block text-[12px] font-bold text-noble-black/50">Search</label>
        <div
          class="flex h-12 items-center gap-3 rounded-[12px] border-[1.5px] border-gray-200 bg-white px-5 transition-all focus-within:border-burning-orange focus-within:shadow-[0_0_0_3px_rgba(232,101,10,0.05)]"
        >
          <svg
            class="h-5 w-5 shrink-0 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" stroke-width="2" />
            <path d="m21 21-4.35-4.35" stroke-width="2" stroke-linecap="round" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by item, listing ID, owner, username, or email"
            class="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-noble-black outline-none placeholder:text-gray-400"
          />
        </div>
      </div>

      <label>
        <span class="mb-2 block text-[12px] font-bold text-noble-black/50">Category</span>
        <select
          v-model="activeCategory"
          class="h-12 w-full rounded-[12px] border-[1.5px] border-gray-200 bg-white px-4 text-[14px] font-medium text-noble-black outline-none transition-all focus:border-burning-orange focus:shadow-[0_0_0_3px_rgba(232,101,10,0.05)]"
        >
          <option value="">All Categories</option>
          <option v-for="category in CATEGORY_OPTIONS" :key="category" :value="category">
            {{ formatCategory(category) }}
          </option>
        </select>
      </label>

      <button
        v-if="hasActiveFilters"
        class="inline-flex h-12 items-center justify-center rounded-[12px] bg-burning-orange px-5 text-[14px] font-bold text-white shadow-lg shadow-burning-orange/20 transition-all hover:brightness-110"
        @click="resetFilters"
      >
        Clear Filters
      </button>
    </div>

    <section
      class="rounded-[24px] border border-cinnamon-ice/20 bg-cream p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] sm:p-8"
    >
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <h2 class="text-[18px] font-bold text-noble-black">Platform Listings</h2>
          <p class="mt-1 max-w-2xl text-[14px] font-medium leading-relaxed text-noble-black/50">
            Admin moderation actions are persisted to the system logs and validated again on the
            backend.
          </p>
        </div>
      </div>

      <div class="mt-6 flex items-center gap-2 overflow-x-auto py-1">
        <button
          v-for="option in STATUS_OPTIONS"
          :key="option.label"
          class="shrink-0 rounded-full border-[1.5px] px-[14px] py-1.5 text-[13px] font-bold transition-all duration-200"
          :class="
            activeStatus === option.value
              ? 'border-burning-orange/30 bg-burning-orange/[0.12] text-burning-orange'
              : 'border-gray-200 bg-white text-noble-black/40 hover:border-gray-300 hover:text-noble-black/60'
          "
          @click="activeStatus = option.value"
        >
          {{ option.label }}
        </button>
      </div>

      <template v-if="isInitialLoading">
        <div
          v-for="index in 4"
          :key="index"
          class="mt-4 h-28 animate-pulse rounded-2xl bg-cinnamon-ice/20"
        />
      </template>

      <div
        v-else-if="hasInitialError"
        class="flex flex-col items-center justify-center py-14 text-center"
      >
        <p class="text-[16px] font-semibold text-noble-black">Listings unavailable</p>
        <p class="mt-2 max-w-md text-[14px] font-medium text-noble-black/45">{{ error }}</p>
        <button
          class="mt-6 rounded-[12px] bg-burning-orange px-6 py-2.5 text-[14px] font-bold text-white shadow-lg shadow-burning-orange/20 transition-all hover:brightness-110"
          @click="refresh"
        >
          Retry
        </button>
      </div>

      <div
        v-else-if="hasEmptyState"
        class="flex flex-col items-center justify-center py-16 text-center"
      >
        <p class="text-[18px] font-bold text-noble-black">No listings matched your filters</p>
        <p class="mt-2 max-w-sm text-[14px] font-medium text-noble-black/40">
          Try another status, category, or search term.
        </p>
      </div>

      <div v-else class="mt-5 space-y-4">
        <article
          v-for="listing in listings"
          :key="listing.id"
          class="rounded-[18px] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
        >
          <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0 space-y-3">
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-[17px] font-bold text-noble-black">{{ listing.name }}</p>
                <span
                  class="rounded-full bg-cinnamon-ice/15 px-2.5 py-1 text-[11px] font-bold uppercase text-noble-black/45"
                >
                  #{{ listing.numericId }}
                </span>
                <span
                  class="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase"
                  :class="getRowTone(listing)"
                >
                  {{ listing.statusLabel }}
                </span>
                <span
                  v-if="listing.hasActiveTransactions"
                  class="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase text-amber-700"
                >
                  Active Transactions
                </span>
              </div>

              <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p class="text-[11px] font-bold uppercase text-noble-black/35">Category</p>
                  <p class="mt-1 text-[14px] font-medium text-noble-black">
                    {{ formatCategory(listing.category) }}
                  </p>
                </div>
                <div>
                  <p class="text-[11px] font-bold uppercase text-noble-black/35">Owner</p>
                  <p class="mt-1 text-[14px] font-medium text-noble-black">
                    {{ listing.owner.name }}
                  </p>
                  <p class="text-[12px] text-noble-black/45">@{{ listing.owner.username }}</p>
                </div>
                <div>
                  <p class="text-[11px] font-bold uppercase text-noble-black/35">Rating</p>
                  <p class="mt-1 text-[14px] font-medium text-noble-black">
                    {{ listing.rating.toFixed(1) }}
                  </p>
                </div>
                <div>
                  <p class="text-[11px] font-bold uppercase text-noble-black/35">Date Listed</p>
                  <p class="mt-1 text-[14px] font-medium text-noble-black">
                    {{ formatDateTime(listing.createdAt) }}
                  </p>
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-2 sm:flex-row lg:flex-col lg:min-w-[180px]">
              <button
                v-if="listing.status !== 'REMOVED_BY_ADMIN' && listing.status !== 'ACTIVE'"
                class="rounded-[12px] border border-gray-200 bg-white px-4 py-2 text-[13px] font-bold text-noble-black/70 transition-all hover:border-gray-300 hover:text-noble-black"
                @click="openConfirmation(listing, 'activate')"
              >
                Reactivate
              </button>
              <button
                v-if="listing.status === 'ACTIVE' || listing.status === 'INACTIVE'"
                class="rounded-[12px] border border-burning-orange/25 bg-burning-orange/[0.08] px-4 py-2 text-[13px] font-bold text-burning-orange transition-all hover:bg-burning-orange/[0.14]"
                @click="openConfirmation(listing, 'deactivate')"
              >
                Deactivate
              </button>
              <button
                v-if="listing.status !== 'REMOVED_BY_ADMIN'"
                class="rounded-[12px] bg-cinnabar-red px-4 py-2 text-[13px] font-bold text-white transition-all hover:bg-noble-black disabled:cursor-not-allowed disabled:bg-cinnabar-red/40"
                :disabled="listing.hasActiveTransactions"
                @click="openConfirmation(listing, 'remove')"
              >
                Remove
              </button>
              <p
                v-if="listing.hasActiveTransactions"
                class="max-w-[180px] text-[12px] font-medium leading-relaxed text-noble-black/45"
              >
                Remove is blocked while active or upcoming transactions exist.
              </p>
            </div>
          </div>
        </article>
      </div>

      <div v-if="hasMore || (isLoading && listings.length > 0)" class="mt-6 flex justify-center">
        <button
          :disabled="isLoading"
          class="rounded-[12px] bg-burning-orange px-8 py-2.5 text-[15px] font-bold text-white shadow-lg shadow-burning-orange/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          @click="loadMore"
        >
          <span v-if="isLoading">Loading...</span>
          <span v-else>Load More</span>
        </button>
      </div>
    </section>

    <div
      v-if="confirmationTarget"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-noble-black/55 px-4 backdrop-blur-sm"
      @click.self="closeConfirmation"
    >
      <div class="w-full max-w-lg rounded-[24px] bg-white p-6 shadow-2xl sm:p-7">
        <div class="space-y-3">
          <div class="space-y-2">
            <h2 class="text-[22px] font-bold text-noble-black">{{ confirmationTitle }}</h2>
            <p class="text-[14px] font-medium leading-relaxed text-noble-black/55">
              {{ confirmationMessage }}
            </p>
          </div>

          <div class="rounded-[16px] border border-cinnamon-ice/30 bg-cream px-4 py-4">
            <p class="text-[12px] font-bold uppercase text-noble-black/35">Listing</p>
            <p class="mt-1 text-[16px] font-semibold text-noble-black">
              {{ confirmationTarget.listing.name }} · #{{ confirmationTarget.listing.numericId }}
            </p>
            <p class="mt-1 text-[13px] text-noble-black/45">
              Owner: {{ confirmationTarget.listing.owner.name }} · @{{
                confirmationTarget.listing.owner.username
              }}
            </p>
          </div>

          <p
            v-if="actionError"
            class="rounded-[14px] border border-cinnabar-red/20 bg-cinnabar-red/5 px-4 py-3 text-[13px] font-medium text-cinnabar-red"
          >
            {{ actionError }}
          </p>
        </div>

        <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            class="rounded-[12px] border border-gray-200 px-5 py-2.5 text-[14px] font-bold text-noble-black/60 transition-all hover:border-gray-300 hover:text-noble-black"
            :disabled="isActionLoading"
            @click="closeConfirmation"
          >
            Cancel
          </button>
          <button
            class="rounded-[12px] bg-burning-orange px-5 py-2.5 text-[14px] font-bold text-white shadow-lg shadow-burning-orange/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            :class="
              confirmationTarget.action === 'remove' ? 'bg-cinnabar-red shadow-cinnabar-red/20' : ''
            "
            :disabled="isActionLoading"
            @click="confirmAction"
          >
            {{ isActionLoading ? "Processing..." : confirmationButtonLabel }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
