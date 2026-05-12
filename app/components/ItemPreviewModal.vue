<script setup lang="ts">
import { computed, ref, nextTick, watch } from "vue"

interface PreviewData {
  name: string
  description?: string
  condition?: string
  categories: string[]
  tags: string[]
  rentalFee: number
  replacementCost?: number
  freeToBorrow: boolean | null
  rateOption: "PER_HOUR" | "PER_DAY"
  whatItemOffers?: string
  whatIsIncluded?: string
  knownIssues?: string
  usageLimitations?: string
  thumbnailImage?: string
  photos: string[]
  ownerName?: string
  ownerAvatarUrl?: string | null
  rating?: number
  lenderRating?: number
  bookingCount?: number
  lenderBookingCount?: number
}

const props = defineProps<{
  show: boolean
  data: PreviewData
}>()

const emit = defineEmits<{
  close: []
}>()

// --- Logic mirrored from [slug].vue ---
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]
const daysOfWeek = ["S", "M", "T", "W", "T", "F", "S"]
const currentDate = new Date()
const viewMonth = ref(currentDate.getMonth())
const viewYear = ref(currentDate.getFullYear())
const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())

const currentImageIndex = ref(0)
const scrollContainer = ref<HTMLElement | null>(null)
const isAtStart = ref(true)
const isAtEnd = ref(false)

const formatPhpAmount = (value: number) =>
  new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(value)

const formatPesoAmount = (value: number) => `₱${formatPhpAmount(value)}`

const humanizeEnum = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")

const splitDetailList = (value?: string | null) =>
  (value ?? "")
    .split(/\r?\n|•|·/)
    .map((entry) => entry.replace(/^[\s\-*•·]+/, "").trim())
    .filter(Boolean)

const imageGallery = computed(() => {
  const photos = props.data.photos ?? []
  const gallery = [...photos]
  if (props.data.thumbnailImage && !gallery.includes(props.data.thumbnailImage)) {
    gallery.unshift(props.data.thumbnailImage)
  }
  return gallery.length > 0 ? gallery : ["https://placehold.co/800x450?text=No+Image"]
})

const currentImage = computed(() => imageGallery.value[currentImageIndex.value] ?? null)

const updateScrollStatus = () => {
  if (!scrollContainer.value) return
  isAtStart.value = scrollContainer.value.scrollLeft <= 1
  isAtEnd.value =
    scrollContainer.value.scrollLeft + scrollContainer.value.clientWidth >=
    scrollContainer.value.scrollWidth - 1
}

const handleScroll = () => updateScrollStatus()

const scrollOnce = (direction: "left" | "right") => {
  if (!scrollContainer.value) return
  scrollContainer.value.scrollBy({
    left: direction === "left" ? -260 : 260,
    behavior: "smooth",
  })
}

const nextImage = () => {
  if (!imageGallery.value.length) return
  currentImageIndex.value = (currentImageIndex.value + 1) % imageGallery.value.length
}

const prevImage = () => {
  if (!imageGallery.value.length) return
  currentImageIndex.value =
    (currentImageIndex.value - 1 + imageGallery.value.length) % imageGallery.value.length
}

const maskStyle = computed(() => {
  if (isAtStart.value && isAtEnd.value) return {}
  if (isAtStart.value)
    return { maskImage: "linear-gradient(to right, black 84%, transparent 100%)" }
  if (isAtEnd.value) return { maskImage: "linear-gradient(to left, black 84%, transparent 100%)" }
  return {
    maskImage: "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
  }
})

const priceAmount = computed(() => {
  if (props.data.freeToBorrow) return "Free"
  return formatPesoAmount(props.data.rentalFee)
})

const priceUnitLabel = computed(() => {
  if (props.data.freeToBorrow) return "to borrow"
  return `/ ${props.data.rateOption === "PER_HOUR" ? "hour" : "day"}`
})

const replacementCostLabel = computed(() => {
  if (!props.data.replacementCost) return "Not specified"
  return formatPesoAmount(props.data.replacementCost)
})

const statusLabel = "Available"
const formattedCondition = computed(() => humanizeEnum(props.data.condition || "GOOD"))
const formattedCategories = computed(() => props.data.categories.map(humanizeEnum))

const isTrending = computed(() => props.data.bookingCount && props.data.bookingCount > 5)

const ownerName = computed(() => props.data.ownerName ?? "You (Preview)")
const ownerInitials = computed(() => {
  const parts = ownerName.value.split(/\s+/).filter(Boolean)
  return (
    parts
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "TU"
  )
})

const ratingLabel = computed(() => (props.data.rating ?? 0).toFixed(1))
const lenderRatingLabel = computed(() => (props.data.lenderRating ?? 0).toFixed(1))
const bookingCountLabel = computed(() => {
  const count = props.data.bookingCount ?? 0
  return `${count.toLocaleString()} ${count === 1 ? "booking" : "bookings"}`
})

const lenderBookingCountLabel = computed(() => {
  const count = props.data.lenderBookingCount ?? 0
  return `${count.toLocaleString()} ${count === 1 ? "booking" : "bookings"}`
})

const offerHighlights = computed(() => {
  const explicitOffers = splitDetailList(props.data.whatItemOffers)
  if (explicitOffers.length) return explicitOffers

  return [
    props.data.freeToBorrow
      ? "Available to borrow for free"
      : `${priceAmount.value} ${priceUnitLabel.value}`,
    `${formattedCondition.value} condition`,
    `Status: ${statusLabel}`,
    ...formattedCategories.value.slice(0, 2),
  ].filter(Boolean)
})

const includedItems = computed(() => splitDetailList(props.data.whatIsIncluded))
const knownIssuesList = computed(() => splitDetailList(props.data.knownIssues))
const usageLimitationsList = computed(() => splitDetailList(props.data.usageLimitations))

const days = computed(() => {
  const date = new Date(viewYear.value, viewMonth.value, 1)
  const daysArray = []
  const firstDay = date.getDay()
  for (let i = 0; i < firstDay; i++) daysArray.push({ day: null })
  const daysInMonth = new Date(viewYear.value, viewMonth.value + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    daysArray.push({
      day: d,
      isToday: d === today.getDate() && viewMonth.value === today.getMonth(),
    })
  }
  return daysArray
})

watch(
  () => props.show,
  async (newVal) => {
    if (newVal) {
      await nextTick()
      updateScrollStatus()
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "auto"
    }
  },
)

const changeMonth = (delta: number) => {
  viewMonth.value += delta
  if (viewMonth.value > 11) {
    viewMonth.value = 0
    viewYear.value++
  } else if (viewMonth.value < 0) {
    viewMonth.value = 11
    viewYear.value--
  }
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
        class="fixed inset-0 z-[3000] flex items-center justify-center bg-noble-black/40 p-4 backdrop-blur-sm sm:p-10"
      >
        <!-- Modal Container -->
        <div
          class="relative flex h-full max-h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl shadow-noble-black/20"
        >
          <!-- Floating Close/Header for Preview -->
          <div
            class="sticky top-0 z-[110] flex items-center justify-between border-b border-cinnamon-ice/10 bg-white px-6 py-4 shadow-sm backdrop-blur-md"
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
              class="p-2 text-noble-black/50 hover:text-noble-black transition-all hover:scale-110 active:scale-95"
              @click="emit('close')"
            >
              <Icon name="ph:x" class="shrink-0 w-6 h-6" />
            </button>
          </div>

          <!-- Scrollable Page Container -->
          <div class="custom-main-scrollbar flex-1 overflow-y-auto bg-white font-geist">
            <div class="mx-auto max-w-7xl px-4 py-8 sm:px-8">
              <!-- Back Link Placeholder -->
              <div
                class="mb-6 flex items-center gap-2 text-noble-black/70 hover:text-burning-orange transition-colors group cursor-default"
              >
                <Icon
                  name="ph:caret-left"
                  size="20"
                  class="transition-transform group-hover:-translate-x-1"
                />
                <span class="font-normal">Back to listings</span>
              </div>

              <!-- Title & Actions -->
              <div class="mb-2 flex items-start justify-between">
                <div>
                  <div class="mb-3 flex flex-wrap gap-2">
                    <span
                      v-for="category in formattedCategories"
                      :key="category"
                      class="rounded-full border-[0.5px] border-cinnamon-ice/30 bg-noble-black/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-noble-black/70"
                    >
                      {{ category }}
                    </span>
                    <span
                      v-if="isTrending"
                      class="rounded-full bg-burning-orange px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white"
                    >
                      Trending
                    </span>
                  </div>
                  <h1 class="text-3xl font-bold text-noble-black">
                    {{ data.name || "Untitled Item" }}
                  </h1>
                </div>
                <div class="flex items-center gap-4">
                  <div class="relative flex items-stretch group/tooltip">
                    <button
                      class="p-2 text-noble-black/70 hover:text-noble-black transition-all duration-300 ease-in-out group/btn"
                    >
                      <Icon
                        name="ph:share-network"
                        size="22"
                        class="group-hover/btn:stroke-[2] transition-all duration-300 ease-in-out"
                      />
                    </button>
                    <div class="custom-tooltip">
                      Share
                      <div class="tooltip-arrow"></div>
                    </div>
                  </div>

                  <div class="relative flex items-stretch group/tooltip">
                    <button
                      class="p-2 text-noble-black/70 hover:text-noble-black transition-all duration-300 ease-in-out group/btn"
                    >
                      <Icon
                        name="ph:heart"
                        size="22"
                        class="group-hover/btn:stroke-[2] transition-all duration-300 ease-in-out"
                      />
                    </button>
                    <div class="custom-tooltip">
                      Like
                      <div class="tooltip-arrow"></div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Rating Row -->
              <div class="mb-8 flex items-center gap-2 text-sm">
                <div class="flex items-center gap-1 text-burning-orange">
                  <Icon name="ph:star-fill" size="16" class="-translate-y-[0.5px]" />
                  <span class="font-bold leading-none">{{ ratingLabel }}</span>
                </div>
                <span class="text-noble-black/60 leading-none">({{ bookingCountLabel }})</span>
              </div>

              <!-- Main Grid -->
              <div class="grid grid-cols-1 gap-12 lg:grid-cols-3">
                <div class="lg:col-span-2">
                  <!-- Image Section -->
                  <div class="mb-10">
                    <div class="relative aspect-video overflow-hidden rounded-2xl bg-cream group">
                      <img
                        v-if="currentImage"
                        :src="currentImage"
                        class="h-full w-full object-cover"
                      />
                      <button
                        v-if="imageGallery.length > 1"
                        class="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/80 hover:bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        @click="prevImage"
                      >
                        <Icon name="ph:caret-left" size="24" />
                      </button>
                      <button
                        v-if="imageGallery.length > 1"
                        class="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/80 hover:bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        @click="nextImage"
                      >
                        <Icon name="ph:caret-right" size="24" />
                      </button>
                      <div
                        class="absolute bottom-4 left-4 px-3 py-1.5 bg-white/80 backdrop-blur-sm text-noble-black text-[13px] font-medium rounded-full shadow-sm"
                      >
                        {{ imageGallery.length ? currentImageIndex + 1 : 0 }} /
                        {{ imageGallery.length }}
                      </div>
                      <button
                        class="absolute bottom-4 right-4 w-9 h-9 flex items-center justify-center bg-white/80 backdrop-blur-sm text-noble-black rounded-full hover:bg-white transition-colors shadow-sm z-10"
                      >
                        <Icon name="ph:arrows-out" size="18" />
                      </button>
                    </div>
                    <div
                      v-if="imageGallery.length > 1"
                      class="relative mt-4 group/scroll overflow-hidden"
                    >
                      <div
                        v-if="!isAtStart"
                        class="absolute top-0 left-0 h-20 w-16 bg-gradient-to-r from-white via-white/80 to-transparent flex items-center justify-start pl-2 cursor-pointer z-10"
                        @click="scrollOnce('left')"
                      >
                        <div class="text-noble-black/20 group-hover/scroll:text-noble-black/40">
                          <Icon name="ph:caret-left" size="20" />
                        </div>
                      </div>
                      <div
                        ref="scrollContainer"
                        class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide scroll-smooth px-4"
                        :style="maskStyle"
                        @scroll="handleScroll"
                      >
                        <div
                          v-for="(img, idx) in imageGallery"
                          :key="idx"
                          class="w-20 h-20 rounded-xl overflow-hidden cursor-pointer border-2 transition-all duration-300 shrink-0 group/thumb"
                          :class="
                            currentImageIndex === idx
                              ? 'border-burning-orange opacity-100'
                              : 'border-transparent opacity-40 hover:opacity-100'
                          "
                          @click="currentImageIndex = idx"
                        >
                          <img
                            :src="img"
                            class="w-full h-full object-cover transition-all duration-300"
                            :class="
                              currentImageIndex === idx ? '' : 'blur-[1px] group-hover/thumb:blur-0'
                            "
                          />
                        </div>
                      </div>
                      <div
                        v-if="!isAtEnd"
                        class="absolute top-0 right-0 h-20 w-24 bg-gradient-to-l from-white via-white/80 to-transparent flex items-center justify-end pr-2 cursor-pointer z-10"
                        @click="scrollOnce('right')"
                      >
                        <div class="text-noble-black/20 group-hover/scroll:text-noble-black/40">
                          <Icon name="ph:caret-right" size="20" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Redesigned Metadata Container -->
                  <div
                    class="mb-10 rounded-[14px] border border-cinnamon-ice/30 bg-white p-5 shadow-sm"
                  >
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-y-8 md:gap-y-0 items-start">
                      <!-- Status -->
                      <div
                        class="flex flex-col gap-1 pr-4 md:border-r-[0.5px] border-cinnamon-ice/20"
                      >
                        <span
                          class="text-[10px] font-bold uppercase tracking-[1.5px] text-noble-black/40"
                          >Status</span
                        >
                        <div class="flex items-center gap-2">
                          <div class="h-1.5 w-1.5 rounded-full bg-success-green" />
                          <span class="text-[14px] font-semibold text-noble-black">{{
                            statusLabel
                          }}</span>
                        </div>
                      </div>
                      <!-- Condition -->
                      <div
                        class="flex flex-col gap-1 px-0 md:px-6 md:border-r-[0.5px] border-cinnamon-ice/20"
                      >
                        <span
                          class="text-[10px] font-bold uppercase tracking-[1.5px] text-noble-black/40"
                          >Condition</span
                        >
                        <span
                          class="text-[14px] font-semibold"
                          :class="
                            props.data.condition === 'POOR'
                              ? 'text-burning-orange'
                              : 'text-noble-black'
                          "
                          >{{ formattedCondition }}</span
                        >
                      </div>
                      <!-- Replacement Cost -->
                      <div
                        class="flex flex-col gap-1 px-0 md:px-6 md:border-r-[0.5px] border-cinnamon-ice/20"
                      >
                        <span
                          class="text-[10px] font-bold uppercase tracking-[1.5px] text-noble-black/40"
                          >Replacement</span
                        >
                        <span class="text-[14px] font-semibold text-noble-black">{{
                          replacementCostLabel
                        }}</span>
                      </div>
                      <!-- Tags -->
                      <div class="flex flex-col gap-1 pl-0 md:pl-6">
                        <span
                          class="text-[10px] font-bold uppercase tracking-[1.5px] text-noble-black/40"
                          >Tags</span
                        >
                        <div v-if="data.tags.length" class="flex flex-wrap gap-2">
                          <span
                            v-for="tag in data.tags"
                            :key="tag"
                            class="rounded-[12px] rounded-tl-[999px] rounded-br-[999px] bg-noble-black/5 px-2.5 py-1 text-[11px] font-medium text-noble-black/60 hover:bg-noble-black/10 transition-colors cursor-default"
                          >
                            {{ tag }}
                          </span>
                        </div>
                        <span v-else class="text-[14px] font-semibold text-noble-black/30"
                          >None</span
                        >
                      </div>
                    </div>

                    <!-- Horizontal Divider -->
                    <div class="my-8 h-[0.5px] bg-gray-100" />

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <!-- Known Issues -->
                      <div class="flex flex-col gap-3">
                        <span
                          class="text-[10px] font-bold uppercase tracking-[1.5px] text-noble-black/40"
                          >Known Issues</span
                        >
                        <div v-if="knownIssuesList.length" class="space-y-1">
                          <p
                            v-for="issue in knownIssuesList"
                            :key="issue"
                            class="text-[13px] text-noble-black/70 flex items-start gap-2"
                          >
                            <span class="flex items-center justify-center h-6 shrink-0">
                              <span class="w-1 h-1 rounded-full bg-burning-orange" />
                            </span>
                            <span class="leading-6">{{ issue }}</span>
                          </p>
                        </div>
                        <p
                          v-else
                          class="text-[13px] font-medium text-success-green flex items-center gap-1.5"
                        >
                          No known issues reported
                          <Icon name="ph:check-circle-fill" size="14" class="shrink-0" />
                        </p>
                      </div>
                      <!-- Usage Limitations -->
                      <div class="flex flex-col gap-3">
                        <span
                          class="text-[10px] font-bold uppercase tracking-[1.5px] text-noble-black/40"
                          >Usage Limitations</span
                        >
                        <div v-if="usageLimitationsList.length" class="space-y-1">
                          <p
                            v-for="limitation in usageLimitationsList"
                            :key="limitation"
                            class="text-[13px] text-noble-black/70 flex items-start gap-2"
                          >
                            <span class="flex items-center justify-center h-6 shrink-0">
                              <span class="w-1 h-1 rounded-full bg-burning-orange" />
                            </span>
                            <span class="leading-6">{{ limitation }}</span>
                          </p>
                        </div>
                        <p v-else class="text-[13px] italic text-noble-black/40">
                          No usage limitations listed
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- Description & Details -->
                  <div class="border-b border-cinnamon-ice/15 py-8">
                    <div class="border-l-[3px] border-burning-orange pl-4 mb-4">
                      <h2 class="text-lg font-semibold">Description</h2>
                    </div>
                    <p class="text-sm leading-relaxed text-noble-black/80 whitespace-pre-wrap">
                      {{ data.description || "No description provided." }}
                    </p>
                  </div>
                  <div class="border-b border-cinnamon-ice/15 py-8">
                    <div class="border-l-[3px] border-burning-orange pl-4 mb-4">
                      <h2 class="text-lg font-semibold">What This Item Offers</h2>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-y-2 sm:gap-x-10">
                      <div
                        v-for="(offer, idx) in offerHighlights"
                        :key="idx"
                        class="flex items-start gap-3"
                      >
                        <div
                          class="flex items-center justify-center h-6 shrink-0 text-burning-orange"
                        >
                          <Icon name="ph:plus-bold" size="15" />
                        </div>
                        <span class="text-sm text-noble-black/90 leading-6">{{ offer }}</span>
                      </div>
                    </div>
                  </div>
                  <div
                    v-if="includedItems.length"
                    class="border-b border-cinnamon-ice/15 py-8 mb-12"
                  >
                    <div class="border-l-[3px] border-burning-orange pl-4 mb-4">
                      <h2 class="text-lg font-semibold">What's Included</h2>
                    </div>
                    <ul class="space-y-2">
                      <li
                        v-for="(included, idx) in includedItems"
                        :key="idx"
                        class="flex items-start gap-3"
                      >
                        <div
                          class="flex items-center justify-center h-6 shrink-0 text-burning-orange"
                        >
                          <Icon name="ph:check-circle-fill" size="17" />
                        </div>
                        <span class="text-sm text-noble-black/90 leading-6">{{ included }}</span>
                      </li>
                    </ul>
                  </div>

                  <!-- Redesigned Seller Card -->
                  <div
                    class="bg-white rounded-[16px] p-5 border border-cinnamon-ice/30 flex items-center justify-between mt-16 shadow-sm"
                  >
                    <div class="flex items-center gap-4">
                      <div
                        class="w-[52px] h-[52px] rounded-full border border-cinnamon-ice/40 bg-cinnamon-ice/10 flex items-center justify-center text-noble-black/70 text-lg font-bold shrink-0 overflow-hidden"
                      >
                        <img
                          v-if="data.ownerAvatarUrl"
                          :src="data.ownerAvatarUrl"
                          class="w-full h-full object-cover"
                        />
                        <span v-else>{{ ownerInitials }}</span>
                      </div>

                      <div class="flex flex-col">
                        <h3 class="text-[16px] font-semibold text-noble-black leading-tight">
                          {{ ownerName }}
                        </h3>
                        <div class="flex items-center gap-1.5 text-[13px] text-noble-black/60 mt-1">
                          <div class="flex items-center gap-1 text-burning-orange">
                            <Icon name="ph:star-fill" size="14" class="fill-current" />
                            <span class="font-bold">{{ lenderRatingLabel }}</span>
                          </div>
                          <span class="text-noble-black/30">·</span>
                          <span>{{ lenderBookingCountLabel }}</span>
                        </div>
                        <p class="text-[12px] text-noble-black/40 mt-0.5">Item owner on TakeUP</p>
                      </div>
                    </div>

                    <div
                      class="text-[14px] font-semibold text-burning-orange hover:underline cursor-default"
                    >
                      View Profile →
                    </div>
                  </div>
                </div>

                <!-- Sidebar mirroring [slug].vue -->
                <div class="hidden lg:block space-y-6">
                  <div
                    class="bg-white border border-cinnamon-ice/30 rounded-2xl p-5 shadow-sm overflow-hidden"
                  >
                    <div class="flex items-center justify-between mb-6">
                      <h3 class="text-base font-semibold text-noble-black">
                        {{ monthNames[viewMonth] }} {{ viewYear }}
                      </h3>
                      <div class="flex gap-1">
                        <button
                          class="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors text-noble-black/60"
                          @click="changeMonth(-1)"
                        >
                          <Icon name="ph:caret-left" size="20" />
                        </button>
                        <button
                          class="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors text-noble-black/60"
                          @click="changeMonth(1)"
                        >
                          <Icon name="ph:caret-right" size="20" />
                        </button>
                      </div>
                    </div>
                    <div class="grid grid-cols-7 text-center mb-2">
                      <div
                        v-for="day in daysOfWeek"
                        :key="day"
                        class="text-[11px] uppercase tracking-[1px] text-gray-400 font-bold py-2"
                      >
                        {{ day }}
                      </div>
                    </div>
                    <div class="grid grid-cols-7">
                      <div
                        v-for="(dayObj, idx) in days"
                        :key="idx"
                        class="relative flex items-center justify-center py-1"
                      >
                        <div
                          v-if="dayObj.day"
                          class="relative flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-all select-none font-semibold"
                          :class="
                            dayObj.isToday
                              ? 'border-[1.5px] border-burning-orange text-burning-orange font-bold'
                              : 'text-noble-black opacity-40'
                          "
                        >
                          {{ dayObj.day }}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    <div class="relative">
                      <span
                        class="text-[10px] uppercase font-bold text-gray-400 tracking-[1.5px] mb-1.5 block ml-1"
                        >Start Time</span
                      >
                      <div
                        class="w-full bg-white border-[1.5px] border-cinnamon-ice/30 rounded-[10px] px-4 py-3 text-[14px] font-semibold text-noble-black flex items-center justify-between"
                      >
                        09:00 AM
                        <Icon name="ph:caret-down" size="16" class="text-gray-400" />
                      </div>
                    </div>
                    <div class="relative">
                      <span
                        class="text-[10px] uppercase font-bold text-gray-400 tracking-[1.5px] mb-1.5 block ml-1"
                        >End Time</span
                      >
                      <div
                        class="w-full bg-white border-[1.5px] border-cinnamon-ice/30 rounded-[10px] px-4 py-3 text-[14px] font-semibold text-noble-black flex items-center justify-between"
                      >
                        06:00 PM
                        <Icon name="ph:caret-down" size="16" class="text-gray-400" />
                      </div>
                    </div>
                  </div>
                  <div
                    class="bg-white border border-cinnamon-ice/30 rounded-[20px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.08)]"
                  >
                    <div class="flex items-baseline gap-1 mb-6">
                      <span class="text-[32px] font-bold text-noble-black">{{ priceAmount }}</span>
                      <span class="text-[16px] text-noble-black/40 font-medium">{{
                        priceUnitLabel
                      }}</span>
                    </div>

                    <div class="grid grid-cols-2 mb-6 relative">
                      <div class="absolute left-1/2 top-1 bottom-1 w-px bg-gray-100" />
                      <div class="flex flex-col gap-1 pr-4">
                        <span class="text-[10px] uppercase font-bold text-gray-400 tracking-[1.5px]"
                          >Start</span
                        >
                        <div class="flex flex-col">
                          <span class="text-[14px] font-semibold text-noble-black/40"
                            >Select date</span
                          >
                        </div>
                      </div>
                      <div class="flex flex-col gap-1 pl-4">
                        <span class="text-[10px] uppercase font-bold text-gray-400 tracking-[1.5px]"
                          >End</span
                        >
                        <div class="flex flex-col">
                          <span class="text-[14px] font-semibold text-noble-black/40"
                            >Select date</span
                          >
                        </div>
                      </div>
                    </div>

                    <div class="space-y-2 mb-4">
                      <div
                        class="flex justify-between items-center text-[13px] text-noble-black/60"
                      >
                        <span
                          >Rate ({{
                            props.data.freeToBorrow
                              ? "Free"
                              : formatPesoAmount(props.data.rentalFee)
                          }}
                          x 1 {{ props.data.rateOption === "PER_HOUR" ? "hour" : "day" }})</span
                        >
                        <span class="font-medium">{{ priceAmount }}</span>
                      </div>
                    </div>

                    <div class="border-t border-dashed border-cinnamon-ice/30 my-4" />

                    <div class="flex justify-between items-center mb-6">
                      <span class="text-[16px] font-bold text-noble-black">Total</span>
                      <span class="text-[16px] font-bold text-noble-black">{{ priceAmount }}</span>
                    </div>

                    <button
                      class="mb-2.5 w-full rounded-2xl bg-burning-orange py-3 text-base font-bold text-white shadow-md shadow-burning-orange/10 transition-all hover:brightness-110 active:scale-[0.98]"
                    >
                      Request Booking
                    </button>
                    <button
                      class="w-full py-3 rounded-2xl border border-burning-orange text-burning-orange font-bold text-base transition-all duration-300 active:scale-[0.98] hover:bg-burning-orange/5"
                    >
                      Add to Bag
                    </button>
                    <p class="mt-4 text-center text-[11px] text-noble-black/40">
                      You won't be charged yet.
                    </p>
                  </div>
                </div>
              </div>

              <!-- ReviewsSection Mirror -->
              <div class="mt-20 border-t border-cinnamon-ice/15 pt-12">
                <h2 class="text-lg font-semibold mb-6">Ratings & Reviews</h2>

                <!-- Summary Row -->
                <div
                  class="grid grid-cols-1 md:grid-cols-2 gap-12 pb-12 mb-8 border-b border-cinnamon-ice/15"
                >
                  <!-- Part 1: Rating Overview -->
                  <div class="flex flex-col items-center md:items-start justify-center">
                    <div class="text-6xl font-bold text-noble-black mb-2">
                      {{ ratingLabel }}
                    </div>
                    <div class="flex items-center gap-1 text-burning-orange mb-2">
                      <Icon
                        v-for="i in 5"
                        :key="i"
                        name="ph:star-fill"
                        class="w-6 h-6 -translate-y-[0.5px]"
                        :class="
                          i <= Math.round(props.data.rating ?? 0) ? 'opacity-100' : 'opacity-20'
                        "
                      />
                    </div>
                    <div class="text-sm text-noble-black/60 font-medium">
                      Based on {{ bookingCountLabel }}
                    </div>
                  </div>

                  <!-- Part 2: Distribution Bars Placeholder -->
                  <div class="space-y-4">
                    <div
                      v-for="star in [5, 4, 3, 2, 1]"
                      :key="star"
                      class="flex items-center gap-4"
                    >
                      <div class="flex items-center gap-1.5 w-10 shrink-0">
                        <span class="text-sm font-semibold text-noble-black leading-none">{{
                          star
                        }}</span>
                        <Icon
                          name="ph:star-fill"
                          class="w-3.5 h-3.5 text-burning-orange -translate-y-[0.5px]"
                        />
                      </div>
                      <div class="flex-1 h-3 bg-cream rounded-full overflow-hidden">
                        <div
                          class="h-full bg-gradient-to-r from-burning-orange to-blue-estate rounded-full"
                          :style="{ width: '0%' }"
                        />
                      </div>
                      <div class="w-8 text-right shrink-0">
                        <span class="text-xs font-bold text-noble-black/60">0</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  class="rounded-3xl border border-dashed border-cinnamon-ice/15 bg-gray-50/50 px-6 py-16 text-center"
                >
                  <p class="text-base font-semibold text-noble-black">No reviews found</p>
                  <p class="mt-2 text-sm text-noble-black/60">
                    No reviews yet for this listing preview.
                  </p>
                </div>
              </div>
            </div>

            <!-- Mobile Sticky Bottom Bar -->
            <div
              class="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-cinnamon-ice/15 p-4 px-6 z-[100] shadow-[0_-10px_30px_rgba(0,0,0,0.08)] pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
            >
              <div class="flex items-center justify-between gap-4">
                <div class="flex flex-col">
                  <div class="flex items-baseline gap-1">
                    <span class="text-xl font-bold text-noble-black">{{ priceAmount }}</span>
                    <span class="text-xs text-noble-black/60 font-medium">{{
                      priceUnitLabel
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

/* Tooltip Styles mirroring [slug].vue */
.group\/tooltip:hover .custom-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(14px);
}

.custom-tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(10px);
  background-color: theme("colors.cream");
  color: theme("colors.noble-black");
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid theme("colors.cinnamon-ice / 30%");
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  z-index: 1200;
  pointer-events: none;
}

.tooltip-arrow {
  position: absolute;
  top: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 5px solid theme("colors.cinnamon-ice / 30%");
}

.tooltip-arrow::after {
  content: "";
  position: absolute;
  top: 1px;
  left: -5px;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 5px solid theme("colors.cream");
}
</style>
