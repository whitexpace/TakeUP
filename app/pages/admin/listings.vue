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
  <div class="space-y-10 font-geist">
    <!-- Elegant Executive Header -->
    <header class="space-y-3">
      <div class="space-y-2">
        <h1 class="font-montravia text-[36px] font-medium text-noble-black">Listings</h1>
        <div class="w-10 h-0.5 bg-burning-orange"></div>
      </div>
      <p class="text-[16px] font-light leading-relaxed text-noble-black/50">
        Review listings, trace ownership, and apply moderation controls.
      </p>
    </header>

    <!-- Premium Summary Cards -->
    <section class="grid gap-6 md:grid-cols-3">
      <div
        v-for="item in summaryItems"
        :key="item.label"
        class="group relative overflow-hidden rounded-[24px] border border-cinnamon-ice/20 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-500 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] hover:-translate-y-1"
      >
        <div class="relative z-10">
          <p class="text-[11px] font-bold uppercase tracking-wider text-noble-black/30 mb-4">
            {{ item.label }}
          </p>
          <p class="text-[32px] font-extrabold leading-tight text-noble-black tracking-tighter">
            {{ item.value }}
          </p>
          <p class="mt-2 text-[13px] font-medium text-noble-black/40 leading-relaxed">
            {{ item.detail }}
          </p>
        </div>
      </div>
    </section>

    <!-- Refined Filters -->
    <div
      class="bg-white p-6 rounded-[24px] border border-cinnamon-ice/20 shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
    >
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px_auto] lg:items-end">
        <div>
          <label
            class="mb-2 block text-[11px] font-black uppercase tracking-widest text-noble-black/30"
            >Search Items</label
          >
          <div class="relative w-full">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by item name, owner, or listing ID..."
              class="h-12 w-full rounded-[14px] border-[1.5px] border-gray-100 bg-gray-50/50 px-12 text-[14px] font-bold text-noble-black outline-none transition-all focus:border-burning-orange/30 focus:bg-white focus:ring-4 focus:ring-burning-orange/5 placeholder:text-gray-400 placeholder:font-medium"
            />
            <div
              class="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5"
            >
              <button
                v-if="searchQuery"
                class="text-gray-400 hover:text-burning-orange transition-colors flex items-center justify-center"
                @click="searchQuery = ''"
              >
                <Icon name="ph:x" class="w-5 h-5" />
              </button>
              <Icon v-else name="ph:magnifying-glass" class="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>

        <div>
          <label
            class="mb-2 block text-[11px] font-black uppercase tracking-widest text-noble-black/30"
            >Category</label
          >
          <div class="relative">
            <select
              v-model="activeCategory"
              class="appearance-none h-12 w-full rounded-[14px] border-[1.5px] border-gray-100 bg-gray-50/50 px-4 pr-10 text-[14px] font-bold text-noble-black outline-none transition-all focus:border-burning-orange/30 focus:bg-white"
            >
              <option value="">All Categories</option>
              <option v-for="category in CATEGORY_OPTIONS" :key="category" :value="category">
                {{ formatCategory(category) }}
              </option>
            </select>
            <Icon
              name="ph:caret-down-bold"
              class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-noble-black/40 pointer-events-none"
            />
          </div>
        </div>

        <button
          v-if="hasActiveFilters"
          class="h-12 px-6 text-[13px] font-bold text-burning-orange hover:bg-burning-orange/5 rounded-[14px] transition-all"
          @click="resetFilters"
        >
          Reset
        </button>
      </div>
    </div>

    <!-- Status Chips -->
    <div class="flex items-center gap-2 overflow-x-auto py-1 hide-scrollbar">
      <button
        v-for="option in STATUS_OPTIONS"
        :key="option.label"
        class="px-[14px] py-1.5 rounded-full text-[13px] font-bold transition-all duration-200 shrink-0 border-[1.5px]"
        :class="
          activeStatus === option.value
            ? 'bg-burning-orange/[0.12] border-burning-orange/30 text-burning-orange'
            : 'bg-white border-gray-200 text-noble-black/40 hover:border-gray-300 hover:text-noble-black/60'
        "
        @click="activeStatus = option.value"
      >
        {{ option.label }}
      </button>
    </div>

    <!-- Main List Elevation -->
    <section
      class="rounded-[32px] border border-cinnamon-ice/20 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
    >
      <div class="flex items-center justify-between mb-8">
        <div class="border-l-[3px] border-burning-orange pl-4">
          <h2 class="text-[20px] font-semibold text-noble-black tracking-tight">
            Platform Listings
          </h2>
          <p class="mt-0.5 text-[13px] font-light text-noble-black/50">
            Moderation actions are recorded to the system audit logs.
          </p>
        </div>
      </div>

      <template v-if="isInitialLoading">
        <div class="space-y-4">
          <div
            v-for="index in 4"
            :key="index"
            class="h-32 animate-pulse rounded-[24px] bg-gray-50 border border-gray-100"
          ></div>
        </div>
      </template>

      <div
        v-else-if="hasInitialError"
        class="flex flex-col items-center justify-center py-20 text-center"
      >
        <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
          <Icon name="ph:warning-circle" class="h-8 w-8 text-cinnabar-red" />
        </div>
        <p class="text-[18px] font-bold text-noble-black">Sync Failure</p>
        <p class="mt-2 text-[14px] font-medium text-noble-black/40 mb-8">{{ error }}</p>
        <button
          class="rounded-[14px] bg-burning-orange px-8 py-3 text-[15px] font-bold text-white shadow-lg shadow-burning-orange/20 transition-all hover:brightness-110"
          @click="refresh"
        >
          Retry
        </button>
      </div>

      <div
        v-else-if="hasEmptyState"
        class="flex flex-col items-center justify-center py-20 text-center"
      >
        <div
          class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gray-50 text-gray-200"
        >
          <Icon name="ph:package" class="h-10 w-10" />
        </div>
        <p class="text-[18px] font-bold text-noble-black">No listings matched</p>
        <p class="mt-2 max-w-sm text-[14px] font-medium text-noble-black/40">
          Try adjusting your search query, category, or status filters.
        </p>
      </div>

      <div v-else class="max-h-[800px] overflow-y-auto pr-4 -mr-4 custom-scrollbar space-y-6">
        <article
          v-for="listing in listings"
          :key="listing.id"
          class="group rounded-[24px] bg-white border border-cinnamon-ice/20 p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all duration-300 hover:border-cinnamon-ice/30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
        >
          <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0 flex-1 space-y-5">
              <div class="flex flex-wrap items-center gap-3">
                <p
                  class="text-[18px] font-semibold text-noble-black group-hover:text-burning-orange transition-colors"
                >
                  {{ listing.name }}
                </p>
                <span
                  class="text-[12px] font-semibold text-noble-black/40 font-mono tracking-widest uppercase"
                >
                  REF: {{ listing.id }}
                </span>
                <span
                  class="rounded-full px-3 py-1 text-[10px] font-bold tracking-widest uppercase shadow-sm border border-current bg-white"
                  :class="getRowTone(listing)"
                >
                  {{ listing.statusLabel }}
                </span>
                <span
                  v-if="listing.hasActiveTransactions"
                  class="rounded-full bg-amber-50 border border-amber-100 px-3 py-1 text-[10px] font-bold tracking-widest uppercase text-amber-600 shadow-sm flex items-center gap-1.5"
                >
                  <Icon name="ph:warning-circle-fill" class="w-3.5 h-3.5" />
                  Active Transactions
                </span>
              </div>

              <div class="flex flex-wrap items-center gap-y-4 gap-x-8 text-[14px]">
                <div class="space-y-1">
                  <p class="text-[11px] font-bold uppercase tracking-widest text-noble-black/30">
                    Category
                  </p>
                  <p class="font-medium text-noble-black">
                    {{ formatCategory(listing.category) }}
                  </p>
                </div>
                <div class="w-px h-8 bg-gray-100 hidden sm:block"></div>

                <div class="space-y-1">
                  <p class="text-[11px] font-bold uppercase tracking-widest text-noble-black/30">
                    Ownership
                  </p>
                  <div class="flex items-center gap-2">
                    <p class="font-medium text-noble-black truncate max-w-[120px]">
                      {{ listing.owner.name }}
                    </p>
                    <p class="text-[12px] font-medium text-noble-black/40">
                      @{{ listing.owner.username }}
                    </p>
                  </div>
                </div>
                <div class="w-px h-8 bg-gray-100 hidden sm:block"></div>

                <div class="space-y-1">
                  <p class="text-[11px] font-bold uppercase tracking-widest text-noble-black/30">
                    Metric Score
                  </p>
                  <div class="flex items-center gap-1.5">
                    <span class="font-medium text-noble-black">{{
                      listing.rating.toFixed(1)
                    }}</span>
                    <Icon name="ph:star-fill" class="w-3.5 h-3.5 text-burning-orange" />
                  </div>
                </div>
                <div class="w-px h-8 bg-gray-100 hidden lg:block"></div>

                <div class="space-y-1">
                  <p class="text-[11px] font-bold uppercase tracking-widest text-noble-black/30">
                    Synchronization
                  </p>
                  <p class="font-medium text-noble-black">
                    {{ formatDateTime(listing.createdAt) }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Actions Dropdown -->
            <div class="relative group/menu flex-shrink-0 self-start">
              <button
                class="h-10 w-10 flex items-center justify-center rounded-full text-noble-black/40 hover:bg-gray-50 hover:text-noble-black transition-colors focus:outline-none"
              >
                <Icon name="ph:dots-three-bold" class="w-6 h-6" />
              </button>

              <div
                class="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white p-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-100 opacity-0 invisible translate-y-2 group-hover/menu:opacity-100 group-hover/menu:visible group-hover/menu:translate-y-0 transition-all duration-200 z-10 focus-within:opacity-100 focus-within:visible focus-within:translate-y-0"
              >
                <button
                  v-if="listing.status !== 'REMOVED_BY_ADMIN' && listing.status !== 'ACTIVE'"
                  class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px] font-semibold text-noble-black hover:bg-gray-50 transition-colors"
                  @click="openConfirmation(listing, 'activate')"
                >
                  <Icon name="ph:check-circle" class="w-5 h-5 text-emerald-600" />
                  Reactivate Listing
                </button>

                <button
                  v-if="listing.status === 'ACTIVE' || listing.status === 'INACTIVE'"
                  class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px] font-semibold text-noble-black hover:bg-gray-50 transition-colors"
                  @click="openConfirmation(listing, 'deactivate')"
                >
                  <Icon name="ph:pause-circle" class="w-5 h-5 text-burning-orange" />
                  Deactivate Listing
                </button>

                <div
                  v-if="listing.status !== 'REMOVED_BY_ADMIN'"
                  class="h-px bg-gray-50 my-1"
                ></div>

                <button
                  v-if="listing.status !== 'REMOVED_BY_ADMIN'"
                  class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px] font-semibold transition-colors"
                  :class="
                    listing.hasActiveTransactions
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-cinnabar-red hover:bg-red-50/50'
                  "
                  :disabled="listing.hasActiveTransactions"
                  @click="openConfirmation(listing, 'remove')"
                >
                  <Icon name="ph:trash" class="w-5 h-5" />
                  Remove Record
                </button>

                <div
                  v-if="listing.hasActiveTransactions"
                  class="px-4 py-2 mt-1 rounded-lg bg-amber-50 border border-amber-100"
                >
                  <p class="text-[10px] font-medium leading-snug text-amber-700 italic">
                    Archival is locked while active or upcoming transactions exist.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </article>

        <div
          v-if="hasMore || (isLoading && listings.length > 0)"
          class="mt-8 flex justify-center border-t border-gray-50 pt-6"
        >
          <button
            :disabled="isLoading"
            class="text-[13px] font-bold text-noble-black/40 hover:text-burning-orange transition-colors disabled:opacity-50"
            @click="loadMore"
          >
            <span v-if="isLoading" class="flex items-center gap-2">
              <Icon name="ph:spinner-gap" class="animate-spin w-4 h-4" />
              Loading...
            </span>
            <span v-else>Load More</span>
          </button>
        </div>
      </div>
    </section>

    <!-- Modal Polish -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="confirmationTarget"
          class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <div
            class="absolute inset-0 bg-noble-black/80 backdrop-blur-md"
            @click="closeConfirmation"
          ></div>
          <div
            class="relative w-full max-w-xl rounded-[40px] bg-white shadow-2xl p-10 border border-cinnamon-ice/10"
          >
            <div class="space-y-6">
              <div class="space-y-2">
                <h2
                  class="text-[28px] font-black text-noble-black tracking-tighter leading-none italic"
                >
                  {{ confirmationTitle }}
                </h2>
                <p class="text-[15px] font-medium text-noble-black/40 leading-relaxed">
                  {{ confirmationMessage }}
                </p>
              </div>

              <div
                class="rounded-[32px] border border-cinnamon-ice/20 bg-gray-50/50 p-8 shadow-inner"
              >
                <p class="text-[10px] font-black uppercase tracking-[3px] text-noble-black/30 mb-2">
                  Asset Identification
                </p>
                <p class="text-[20px] font-black text-noble-black tracking-tight leading-none">
                  {{ confirmationTarget.listing.name }}
                </p>
                <div class="flex items-center gap-3 mt-4">
                  <span
                    class="px-3 py-1 bg-white rounded-full border border-gray-100 text-[11px] font-black text-noble-black/60 shadow-sm"
                    >ID: {{ confirmationTarget.listing.numericId }}</span
                  >
                  <span
                    class="px-3 py-1 bg-white rounded-full border border-gray-100 text-[11px] font-black text-noble-black/60 shadow-sm"
                    >Owner: @{{ confirmationTarget.listing.owner.username }}</span
                  >
                </div>
              </div>

              <p
                v-if="actionError"
                class="p-4 rounded-2xl bg-red-50 text-cinnabar-red text-[13px] font-bold border border-red-100"
              >
                {{ actionError }}
              </p>
            </div>

            <div class="mt-10 flex gap-4">
              <button
                class="flex-1 h-14 rounded-[18px] bg-gray-50 text-noble-black/60 text-[14px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all"
                :disabled="isActionLoading"
                @click="closeConfirmation"
              >
                Abort
              </button>
              <button
                class="flex-2 h-14 px-8 rounded-[18px] text-white text-[14px] font-black uppercase tracking-widest shadow-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30"
                :class="
                  confirmationTarget.action === 'remove'
                    ? 'bg-cinnabar-red shadow-cinnabar-red/20'
                    : 'bg-burning-orange shadow-burning-orange/20'
                "
                :disabled="isActionLoading"
                @click="confirmAction"
              >
                <span v-if="isActionLoading" class="flex items-center gap-2">
                  <Icon name="ph:circle-notch" class="animate-spin w-4 h-4" />
                  Executing...
                </span>
                <span v-else>{{ confirmationButtonLabel }}</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
