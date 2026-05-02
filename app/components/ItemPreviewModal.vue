<script setup lang="ts">
import { computed } from "vue"

interface PreviewItem {
  id?: string
  name: string
  description?: string | null
  rentalFee: number | null
  rateOption: "PER_DAY" | "PER_HOUR"
  freeToBorrow?: boolean | null
  thumbnailImage?: string | null
  condition: string | null
  categories: string[]
  images?: Array<{ path: string; isPrimary: boolean }>
  lender?: {
    user: {
      firstName: string
      lastName: string
      avatarUrl: string | null
    }
    lenderRating: number | null
  }
  ownerName?: string
  rating?: number
}

const props = defineProps<{
  show: boolean
  data: PreviewItem | null
}>()

const emit = defineEmits<{
  close: []
}>()

const formattedRentalFee = computed(() => {
  if (props.data?.freeToBorrow) return "Free"
  return `₱${props.data?.rentalFee ?? 0}`
})

const rateLabel = computed(() => {
  return props.data?.rateOption === "PER_DAY" ? "/ day" : "/ hour"
})

const primaryImage = computed(() => {
  if (!props.data) return ""
  return (
    props.data.images?.find((img) => img.isPrimary)?.path ||
    props.data.images?.[0]?.path ||
    props.data.thumbnailImage ||
    ""
  )
})

const otherImages = computed(() => {
  if (!props.data?.images) return []
  const primary = primaryImage.value
  return props.data.images.filter((img) => img.path !== primary).map((img) => img.path)
})

const conditionLabel = computed(() => {
  const condition = props.data?.condition
  if (!condition) return "Unknown"
  return condition
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c: string) => c.toUpperCase())
})

const lenderName = computed(() => {
  if (props.data?.lender?.user) {
    const u = props.data.lender.user
    return `${u.firstName} ${u.lastName?.[0] || ""}.`
  }
  return props.data?.ownerName || "You"
})

const lenderAvatar = computed(() => {
  return props.data?.lender?.user?.avatarUrl || null
})

const lenderRating = computed(() => {
  return props.data?.lender?.lenderRating ?? props.data?.rating ?? 5.0
})

function formatCategory(category: string) {
  return category
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="show"
        class="fixed inset-0 z-[1300] flex items-center justify-center bg-noble-black/40 p-4 backdrop-blur-sm sm:p-10"
      >
        <!-- Modal Container -->
        <div
          class="relative flex h-full max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl shadow-noble-black/20"
        >
          <!-- Floating Close/Header for Preview -->
          <div
            class="sticky top-0 z-[110] flex items-center justify-between border-b border-cinnamon-ice/10 bg-white/95 px-6 py-4 shadow-sm backdrop-blur-md"
          >
            <div class="flex items-center gap-3">
              <div
                class="rounded-full bg-burning-orange px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white"
              >
                Preview Mode
              </div>
              <p class="hidden text-sm font-medium text-noble-black/60 sm:block">
                This is how your listing will appear to others
              </p>
            </div>
            <button
              class="flex h-10 w-10 items-center justify-center rounded-full bg-noble-black text-white shadow-lg transition-all hover:scale-110 active:scale-95"
              @click="emit('close')"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Scrollable Page Container -->
          <div class="custom-main-scrollbar flex-1 overflow-y-auto bg-white font-geist">
            <div class="mx-auto max-w-7xl px-4 py-8 sm:px-8">
              <!-- Back Link Placeholder -->
              <div class="mb-6 flex items-center gap-2 text-noble-black/30">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
                <span class="text-sm">Back to listings</span>
              </div>

              <!-- Main Content Grid -->
              <div class="grid grid-cols-1 gap-12 lg:grid-cols-12">
                <!-- Left: Media Gallery (7 columns) -->
                <div class="space-y-6 lg:col-span-7">
                  <div
                    class="group relative aspect-[4/3] overflow-hidden rounded-[24px] bg-gray-50"
                  >
                    <img
                      v-if="primaryImage"
                      :src="primaryImage"
                      class="h-full w-full object-cover"
                      alt="Primary item image"
                    />
                    <div
                      v-else
                      class="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400"
                    >
                      No images provided
                    </div>
                  </div>

                  <!-- Thumbnails -->
                  <div v-if="otherImages.length > 0" class="flex flex-wrap gap-4">
                    <div
                      v-for="(img, idx) in otherImages"
                      :key="idx"
                      class="aspect-square w-24 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 transition hover:scale-105"
                    >
                      <img :src="img" class="h-full w-full object-cover" alt="Gallery image" />
                    </div>
                  </div>
                </div>

                <!-- Right: Details & Booking (5 columns) -->
                <div class="space-y-10 lg:col-span-5">
                  <div class="space-y-4">
                    <!-- Category & Status -->
                    <div class="flex items-center gap-3">
                      <span
                        v-for="cat in data?.categories ?? []"
                        :key="cat"
                        class="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-500"
                      >
                        {{ formatCategory(cat) }}
                      </span>
                    </div>

                    <h1 class="text-4xl font-extrabold tracking-tight text-noble-black">
                      {{ data?.name ?? "Loading..." }}
                    </h1>

                    <div class="flex items-center gap-4 text-sm font-medium">
                      <div class="flex items-center gap-1.5 text-burning-orange">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <polygon
                            points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                          />
                        </svg>
                        <span>New listing</span>
                      </div>
                      <span class="text-noble-black/20">•</span>
                      <span class="text-noble-black/60">{{ conditionLabel }}</span>
                    </div>
                  </div>

                  <!-- Price Card -->
                  <div class="rounded-3xl border border-cinnamon-ice/15 bg-cream/40 p-6">
                    <div class="flex items-baseline gap-1.5">
                      <span class="text-3xl font-black text-noble-black">{{
                        formattedRentalFee
                      }}</span>
                      <span
                        v-if="!data?.freeToBorrow"
                        class="text-base font-bold text-noble-black/40"
                        >{{ rateLabel }}</span
                      >
                    </div>
                    <p class="mt-4 text-xs font-medium leading-relaxed text-noble-black/50">
                      Standard TakeUP terms apply. Items are held securely until return is
                      confirmed.
                    </p>
                  </div>

                  <!-- Description -->
                  <div class="space-y-3">
                    <h3 class="text-sm font-bold uppercase tracking-widest text-noble-black/40">
                      Description
                    </h3>
                    <p class="text-base leading-relaxed text-noble-black/70">
                      {{ data?.description || "No description provided." }}
                    </p>
                  </div>

                  <!-- Owner Card -->
                  <div class="flex items-center justify-between rounded-3xl bg-gray-50 p-6">
                    <div class="flex items-center gap-4">
                      <div class="h-12 w-12 overflow-hidden rounded-full bg-burning-orange">
                        <img
                          v-if="lenderAvatar"
                          :src="lenderAvatar"
                          class="h-full w-full object-cover"
                        />
                        <div
                          v-else
                          class="flex h-full w-full items-center justify-center text-white font-bold"
                        >
                          {{ lenderName[0] }}
                        </div>
                      </div>
                      <div>
                        <p class="text-xs font-bold uppercase tracking-wider text-noble-black/40">
                          Listed by
                        </p>
                        <p class="text-base font-bold text-noble-black">
                          {{ lenderName }}
                        </p>
                      </div>
                    </div>
                    <div class="text-right">
                      <div class="flex items-center gap-1 text-sm font-bold text-burning-orange">
                        <span>{{ lenderRating?.toFixed(1) }}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <polygon
                            points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                          />
                        </svg>
                      </div>
                      <p class="text-[10px] font-bold text-noble-black/30">Lender Score</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Sticky/Mobile Footer -->
              <div
                class="mt-12 flex items-center justify-between border-t border-cinnamon-ice/10 pt-8"
              >
                <div class="flex flex-col">
                  <div class="flex items-center gap-1 text-lg font-bold text-noble-black">
                    <span>{{ formattedRentalFee }}</span>
                    <span v-if="!data?.freeToBorrow" class="text-xs text-noble-black/40">{{
                      rateLabel
                    }}</span>
                  </div>
                  <span class="text-[11px] font-bold text-burning-orange">Select dates</span>
                </div>
                <button
                  class="px-6 py-2.5 bg-burning-orange text-white rounded-xl font-bold text-sm shadow-md"
                >
                  Add to Bag
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.custom-main-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-main-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-main-scrollbar::-webkit-scrollbar-thumb {
  background: theme("colors.noble-black / 10%");
  border-radius: 20px;
}

.custom-main-scrollbar::-webkit-scrollbar-thumb:hover {
  background: theme("colors.noble-black / 20%");
}

/* Firefox support */
.custom-main-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: theme("colors.noble-black / 10%") transparent;
}
</style>
