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
  <div class="space-y-10 font-geist">
    <!-- Elegant Executive Header -->
    <header class="space-y-3">
      <div class="space-y-2">
        <h1 class="font-montravia text-[36px] font-medium text-noble-black">System Logs</h1>
        <div class="w-10 h-0.5 bg-burning-orange"></div>
      </div>
      <p class="text-[16px] font-light leading-relaxed text-noble-black/50">
        Trace administrator actions across platform records and ensure accountability.
      </p>
    </header>

    <!-- Refined Filters -->
    <div
      class="bg-white p-6 rounded-[24px] border border-cinnamon-ice/20 shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
    >
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px_auto] lg:items-end">
        <div>
          <label
            class="mb-2 block text-[11px] font-black uppercase tracking-widest text-noble-black/30"
            >Search</label
          >
          <div class="relative w-full">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Admin name, target ID, or action type..."
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
            >Target Type</label
          >
          <div class="relative">
            <select
              v-model="activeTargetType"
              class="appearance-none h-12 w-full rounded-[14px] border-[1.5px] border-gray-100 bg-gray-50/50 px-4 pr-10 text-[14px] font-bold text-noble-black outline-none transition-all focus:border-burning-orange/30 focus:bg-white"
            >
              <option :value="'LISTING'">Marketplace Listings</option>
              <option :value="'USER'">User Accounts</option>
              <option :value="null">All Entities</option>
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

    <!-- Main Audit Elevation -->
    <section
      class="rounded-[32px] border border-cinnamon-ice/20 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
    >
      <div class="flex items-center justify-between mb-8">
        <div class="border-l-[3px] border-burning-orange pl-4">
          <h2 class="text-[20px] font-semibold text-noble-black tracking-tight">Audit Trail</h2>
          <p class="mt-0.5 text-[13px] font-light text-noble-black/50">
            Every administrative state change is persisted here.
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
          <Icon name="ph:clock-counter-clockwise" class="h-10 w-10" />
        </div>
        <p class="text-[18px] font-bold text-noble-black">No activity found</p>
        <p class="mt-2 max-w-sm text-[14px] font-medium text-noble-black/40">
          Try adjusting your target type or broadening your search query.
        </p>
      </div>

      <div v-else class="space-y-6">
        <article
          v-for="entry in logs"
          :key="entry.id"
          class="group rounded-[24px] bg-cream/30 border border-transparent p-6 transition-all duration-300 hover:bg-white hover:border-cinnamon-ice/20 hover:shadow-lg"
        >
          <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0 flex-1 space-y-4">
              <div class="flex flex-wrap items-center gap-3">
                <p
                  class="text-[18px] font-black text-noble-black group-hover:text-burning-orange transition-colors"
                >
                  {{ formatActionLabel(entry.actionType) }}
                </p>
                <span
                  class="rounded-full bg-white border border-gray-100 px-3 py-1 text-[10px] font-black tracking-widest uppercase text-noble-black/30 shadow-sm"
                >
                  TARGET: {{ entry.targetType }}
                </span>
              </div>

              <div class="p-4 rounded-2xl bg-white/50 border border-gray-100/50">
                <p
                  class="text-[10px] font-black uppercase tracking-[2px] text-noble-black/25 mb-1.5 italic"
                >
                  Official Memo
                </p>
                <p class="text-[15px] font-medium text-noble-black/70 leading-relaxed italic">
                  "{{ entry.description || entry.targetLabel || entry.targetId }}"
                </p>
              </div>

              <div class="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                <div class="p-4 rounded-2xl bg-white/50 border border-gray-100/50">
                  <p
                    class="text-[10px] font-black uppercase tracking-[2px] text-noble-black/25 mb-1.5"
                  >
                    Acting Administrator
                  </p>
                  <p class="text-[14px] font-bold text-noble-black">
                    {{ entry.admin.name || entry.admin.username }}
                  </p>
                  <p class="text-[12px] font-medium text-noble-black/40">
                    @{{ entry.admin.username }}
                  </p>
                </div>
                <div class="p-4 rounded-2xl bg-white/50 border border-gray-100/50">
                  <p
                    class="text-[10px] font-black uppercase tracking-[2px] text-noble-black/25 mb-1.5"
                  >
                    Entity Reference
                  </p>
                  <p class="font-mono text-[12px] font-bold text-noble-black truncate">
                    {{ entry.targetLabel || "Anonymous Object" }}
                  </p>
                </div>
                <div class="p-4 rounded-2xl bg-white/50 border border-gray-100/50">
                  <p
                    class="text-[10px] font-black uppercase tracking-[2px] text-noble-black/25 mb-1.5"
                  >
                    Object ID
                  </p>
                  <p class="font-mono text-[12px] font-bold text-noble-black truncate">
                    {{ entry.targetId?.split("-")[0]?.toUpperCase() ?? "N/A" }}...
                  </p>
                </div>
                <div class="p-4 rounded-2xl bg-white/50 border border-gray-100/50">
                  <p
                    class="text-[10px] font-black uppercase tracking-[2px] text-noble-black/25 mb-1.5"
                  >
                    Event Horizon
                  </p>
                  <p class="text-[14px] font-bold text-noble-black">
                    {{ formatDateTime(entry.createdAt) }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div v-if="hasMore || (isLoading && logs.length > 0)" class="mt-10 flex justify-center">
        <button
          :disabled="isLoading"
          class="h-12 px-10 rounded-[14px] bg-noble-black text-white text-[14px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          @click="loadMore"
        >
          <span v-if="isLoading" class="flex items-center gap-2">
            <Icon name="ph:circle-notch" class="animate-spin w-4 h-4" />
            Loading...
          </span>
          <span v-else>Load More Logs</span>
        </button>
      </div>
    </section>
  </div>
</template>
