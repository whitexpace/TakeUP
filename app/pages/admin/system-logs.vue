<script setup lang="ts">
import { computed, ref } from "vue"
import { useAdminActionLogs } from "~/composables/use-admin-action-logs"

definePageMeta({
  layout: "admin",
  middleware: "admin-auth",
})

const activeTargetType = ref<"LISTING" | "USER" | null>("LISTING")
const searchQuery = ref("")

const { logs, isLoading, error, hasMore, loadMore, refresh } = useAdminActionLogs({
  targetType: activeTargetType,
  searchQuery,
})

const hasActiveFilters = computed(() => Boolean(activeTargetType.value || searchQuery.value.trim()))
const isInitialLoading = computed(() => !logs.value.length && isLoading.value)
const hasInitialError = computed(
  () => !logs.value.length && !isLoading.value && Boolean(error.value),
)
const hasEmptyState = computed(() => !logs.value.length && !isLoading.value && !error.value)

const formatDateTime = (value: string | Date) =>
  new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))

const formatActionLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")

const resetFilters = async () => {
  activeTargetType.value = "LISTING"
  searchQuery.value = ""
  await refresh()
}
</script>

<template>
  <div class="space-y-5 font-geist">
    <section class="space-y-3">
      <div class="space-y-2">
        <h1 class="text-[28px] font-semibold text-noble-black">System Logs</h1>
        <div class="h-0.5 w-10 bg-burning-orange"></div>
      </div>
      <p class="max-w-3xl text-[16px] font-medium leading-relaxed text-noble-black/50">
        Trace administrator actions across platform records, with a dedicated focus on listing
        moderation activity.
      </p>
    </section>

    <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">
      <div>
        <label class="mb-2 block text-[12px] font-bold text-noble-black/50">Search</label>
        <div
          class="flex h-12 items-center gap-3 rounded-[12px] border-[1.5px] border-gray-200 bg-white px-5 transition-all focus-within:border-burning-orange focus-within:shadow-[0_0_0_3px_rgba(232,101,10,0.05)]"
        >
          <Icon name="ph:magnifying-glass-light" class="h-5 w-5 shrink-0 text-gray-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by admin, listing, target ID, or action"
            class="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-noble-black outline-none placeholder:text-gray-400"
          />
        </div>
      </div>

      <label>
        <span class="mb-2 block text-[12px] font-bold text-noble-black/50">Target Type</span>
        <select
          v-model="activeTargetType"
          class="h-12 w-full rounded-[12px] border-[1.5px] border-gray-200 bg-white px-4 text-[14px] font-medium text-noble-black outline-none transition-all focus:border-burning-orange focus:shadow-[0_0_0_3px_rgba(232,101,10,0.05)]"
        >
          <option :value="'LISTING'">Listings</option>
          <option :value="'USER'">Users</option>
          <option :value="null">All Targets</option>
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
          <h2 class="text-[18px] font-bold text-noble-black">Audit Trail</h2>
          <p class="mt-1 max-w-2xl text-[14px] font-medium leading-relaxed text-noble-black/50">
            Every row includes the acting admin, the affected target, and the timestamp of the
            change.
          </p>
        </div>
      </div>

      <template v-if="isInitialLoading">
        <div
          v-for="index in 4"
          :key="index"
          class="mt-4 h-24 animate-pulse rounded-2xl bg-cinnamon-ice/20"
        />
      </template>

      <div
        v-else-if="hasInitialError"
        class="flex flex-col items-center justify-center py-14 text-center"
      >
        <p class="text-[16px] font-semibold text-noble-black">System logs unavailable</p>
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
        <p class="text-[18px] font-bold text-noble-black">No log entries matched your filters</p>
        <p class="mt-2 max-w-sm text-[14px] font-medium text-noble-black/40">
          Try another target type or a broader search query.
        </p>
      </div>

      <div v-else class="mt-5 space-y-4">
        <article
          v-for="entry in logs"
          :key="entry.id"
          class="rounded-[18px] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
        >
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0 space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-[16px] font-bold text-noble-black">
                  {{ formatActionLabel(entry.actionType) }}
                </p>
                <span
                  class="rounded-full bg-cinnamon-ice/15 px-2.5 py-1 text-[11px] font-bold uppercase text-noble-black/45"
                >
                  {{ entry.targetType }}
                </span>
              </div>

              <p class="text-[14px] font-medium text-noble-black/60">
                {{ entry.targetLabel || entry.targetId }}
              </p>
              <p v-if="entry.description" class="text-[13px] font-medium text-noble-black/45">
                {{ entry.description }}
              </p>

              <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p class="text-[11px] font-bold uppercase text-noble-black/35">Admin</p>
                  <p class="mt-1 text-[14px] font-medium text-noble-black">
                    {{ entry.admin.name || entry.admin.username }}
                  </p>
                </div>
                <div>
                  <p class="text-[11px] font-bold uppercase text-noble-black/35">Username</p>
                  <p class="mt-1 text-[14px] font-medium text-noble-black">
                    @{{ entry.admin.username }}
                  </p>
                </div>
                <div>
                  <p class="text-[11px] font-bold uppercase text-noble-black/35">Target ID</p>
                  <p class="mt-1 break-all text-[13px] font-medium text-noble-black">
                    {{ entry.targetId }}
                  </p>
                </div>
                <div>
                  <p class="text-[11px] font-bold uppercase text-noble-black/35">Timestamp</p>
                  <p class="mt-1 text-[14px] font-medium text-noble-black">
                    {{ formatDateTime(entry.createdAt) }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div v-if="hasMore || (isLoading && logs.length > 0)" class="mt-6 flex justify-center">
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
  </div>
</template>
