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
  rating?: number
  bookingCount?: number
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
const typeLabel = computed(() => (props.data.freeToBorrow ? "Borrow" : "Rent"))

const availabilityBadge = computed(() => {
  return {
    label: typeLabel.value,
    className: props.data.freeToBorrow
      ? "bg-blue-estate text-white"
      : "bg-cinnamon-ice text-noble-black",
  }
})

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

const ratingLabel = computed(() => (props.data.rating ?? 5.0).toFixed(1))
const bookingCountLabel = computed(() => `${props.data.bookingCount ?? 0} booking(s)`)

const offerHighlights = computed(() => splitDetailList(props.data.whatItemOffers))
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
        class="fixed inset-0 z-[100] flex items-center justify-center bg-noble-black/40 p-4 backdrop-blur-sm sm:p-10"
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
              class="p-2 text-noble-black/50 hover:text-noble-black transition-all hover:scale-110 active:scale-95"
              @click="emit('close')"
            >
              <Icon name="ph:x-light" class="w-5 h-5" />
            </button>
          </div>

          <!-- Scrollable Page Container -->
          <div class="custom-main-scrollbar flex-1 overflow-y-auto bg-white font-geist">
            <div class="mx-auto max-w-7xl px-4 py-8 sm:px-8">
              <!-- Back Link Placeholder -->
              <div class="mb-6 flex items-center gap-2 text-noble-black/30">
                <Icon name="ph:caret-left-light" class="w-5 h-5" />
                <span class="text-sm">Back to listings</span>
              </div>

              <!-- Title & Actions -->
              <div class="mb-2 flex items-start justify-between">
                <div>
                  <div class="mb-3 flex flex-wrap gap-2">
                    <span
                      v-for="category in formattedCategories"
                      :key="category"
                      class="rounded-full border border-cinnamon-ice bg-cream px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-burning-orange"
                    >
                      {{ category }}
                    </span>
                  </div>
                  <h1 class="text-3xl font-bold text-noble-black">
                    {{ data.name || "Untitled Item" }}
                  </h1>
                </div>
                <div class="flex items-center gap-4 text-noble-black/30">
                  <Icon name="ph:share-network-light" class="w-[22px] h-[22px]" />
                  <Icon name="ph:heart-light" class="w-[22px] h-[22px]" />
                </div>
              </div>

              <!-- Rating Row -->
              <div class="mb-8 flex items-center gap-2 text-sm">
                <div class="flex items-center gap-1 text-burning-orange">
                  <Icon name="ph:star-fill" class="w-4 h-4" />
                  <span class="font-bold">{{ ratingLabel }}</span>
                </div>
                <span class="text-noble-black/60">({{ bookingCountLabel }})</span>
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
                      <div
                        class="absolute left-4 top-4 flex h-[32px] min-w-[80px] items-center justify-center rounded-full px-4 font-geist text-[15px] font-normal tracking-wide shadow-sm"
                        :class="availabilityBadge.className"
                      >
                        {{ availabilityBadge.label }}
                      </div>
                      <button
                        class="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        @click="prevImage"
                      >
                        <Icon name="ph:caret-left-light" class="w-6 h-6" />
                      </button>
                      <button
                        class="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        @click="nextImage"
                      >
                        <Icon name="ph:caret-right-light" class="w-6 h-6" />
                      </button>
                      <div
                        class="absolute bottom-4 left-4 px-3 py-1.5 bg-white/80 backdrop-blur-sm text-[13px] font-medium rounded-full shadow-sm"
                      >
                        {{ currentImageIndex + 1 }} / {{ imageGallery.length }}
                      </div>
                    </div>
                    <div v-if="imageGallery.length > 1" class="relative mt-4 overflow-hidden">
                      <div
                        ref="scrollContainer"
                        class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide px-4"
                        :style="maskStyle"
                        @scroll="updateScrollStatus"
                      >
                        <div
                          v-for="(img, idx) in imageGallery"
                          :key="idx"
                          class="h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 transition-all"
                          :class="
                            currentImageIndex === idx
                              ? 'border-burning-orange opacity-100'
                              : 'border-transparent opacity-40'
                          "
                          @click="currentImageIndex = idx"
                        >
                          <img :src="img" class="h-full w-full object-cover" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Unified Metadata Container -->
                  <div
                    class="mb-10 rounded-2xl border-[0.5px] border-cinnamon-ice bg-white p-7 md:p-8 shadow-sm"
                  >
                    <div class="grid grid-cols-2 gap-y-8 md:grid-cols-4 md:gap-y-0">
                      <div
                        class="flex flex-col gap-3 pr-4 md:border-r-[0.5px] border-cinnamon-ice/60"
                      >
                        <span
                          class="text-[11px] font-bold uppercase tracking-widest text-noble-black/50"
                          >Status</span
                        >
                        <div
                          class="flex w-fit items-center gap-2 rounded-full bg-burning-orange/10 px-3 py-1 text-burning-orange"
                        >
                          <div class="h-1.5 w-1.5 rounded-full bg-current" />
                          <span class="text-xs font-bold">{{ statusLabel }}</span>
                        </div>
                      </div>
                      <div
                        class="flex flex-col gap-3 px-0 md:px-6 md:border-r-[0.5px] border-cinnamon-ice/60"
                      >
                        <span
                          class="text-[11px] font-bold uppercase tracking-widest text-noble-black/50"
                          >Condition</span
                        >
                        <div
                          class="flex w-fit items-center rounded-full bg-noble-black/5 px-3 py-1"
                        >
                          <span class="text-xs font-bold text-noble-black/70">{{
                            formattedCondition
                          }}</span>
                        </div>
                      </div>
                      <div
                        class="flex flex-col gap-3 px-0 md:px-6 md:border-r-[0.5px] border-cinnamon-ice/60"
                      >
                        <span
                          class="text-[11px] font-bold uppercase tracking-widest text-noble-black/50"
                          >Replacement</span
                        >
                        <span class="text-base font-semibold text-noble-black">{{
                          replacementCostLabel
                        }}</span>
                      </div>
                      <div class="flex flex-col gap-3 pl-0 md:pl-6">
                        <span
                          class="text-[11px] font-bold uppercase tracking-widest text-noble-black/50"
                          >Tags</span
                        >
                        <div v-if="data.tags.length" class="flex flex-wrap gap-2">
                          <span
                            v-for="tag in data.tags"
                            :key="tag"
                            class="rounded-full border border-cinnamon-ice/60 bg-cinnamon-ice/10 px-2.5 py-0.5 text-[11px] font-medium text-noble-black/60"
                            >#{{ tag }}</span
                          >
                        </div>
                        <span v-else class="text-sm italic text-noble-black/30">None</span>
                      </div>
                    </div>
                    <div class="my-8 h-[0.5px] bg-cinnamon-ice/60" />
                    <div class="grid grid-cols-1 gap-10 md:grid-cols-2">
                      <div class="flex flex-col gap-3">
                        <span
                          class="text-[11px] font-bold uppercase tracking-widest text-noble-black/50"
                          >Known Issues</span
                        >
                        <div v-if="knownIssuesList.length" class="space-y-2">
                          <p
                            v-for="issue in knownIssuesList"
                            :key="issue"
                            class="flex items-start gap-2 text-sm leading-relaxed text-noble-black/80"
                          >
                            <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-burning-orange" />
                            {{ issue }}
                          </p>
                        </div>
                        <p v-else class="text-sm italic text-noble-black/40">No known issues</p>
                      </div>
                      <div class="flex flex-col gap-3">
                        <span
                          class="text-[11px] font-bold uppercase tracking-widest text-noble-black/50"
                          >Usage Limitations</span
                        >
                        <div v-if="usageLimitationsList.length" class="space-y-2">
                          <p
                            v-for="lim in usageLimitationsList"
                            :key="lim"
                            class="flex items-start gap-2 text-sm leading-relaxed text-noble-black/80"
                          >
                            <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-burning-orange" />
                            {{ lim }}
                          </p>
                        </div>
                        <p v-else class="text-sm italic text-noble-black/40">
                          No usage limitations
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- Description & Details -->
                  <div class="border-b border-cinnamon-ice py-8">
                    <h2 class="mb-3 text-lg font-semibold">Description</h2>
                    <p class="text-sm leading-relaxed text-noble-black/80 whitespace-pre-wrap">
                      {{ data.description || "No description provided." }}
                    </p>
                  </div>
                  <div class="border-b border-cinnamon-ice py-8">
                    <h2 class="mb-3 text-lg font-semibold">What This Item Offers</h2>
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                      <div
                        v-for="(offer, idx) in offerHighlights"
                        :key="idx"
                        class="flex items-center gap-2.5 rounded-xl border border-cinnamon-ice/20 bg-cream px-3 py-2"
                      >
                        <div class="shrink-0 scale-90 text-burning-orange">
                          <Icon name="ph:plus-light" class="w-[18px] h-[18px]" />
                        </div>
                        <span class="text-sm text-noble-black/90">{{ offer }}</span>
                      </div>
                    </div>
                  </div>
                  <div v-if="includedItems.length" class="border-b border-cinnamon-ice py-8 mb-12">
                    <h2 class="mb-3 text-lg font-semibold">What's Included</h2>
                    <ul class="space-y-2">
                      <li
                        v-for="(included, idx) in includedItems"
                        :key="idx"
                        class="flex items-center gap-2.5 text-sm text-noble-black/90"
                      >
                        <Icon
                          name="ph:check-circle-light"
                          class="w-[18px] h-[18px] text-burning-orange"
                        />
                        {{ included }}
                      </li>
                    </ul>
                  </div>

                  <!-- Seller Card -->
                  <div
                    class="mt-16 flex items-center justify-between gap-4 rounded-3xl border border-cinnamon-ice/30 bg-cream p-5 sm:p-6"
                  >
                    <div class="flex items-center gap-4 sm:gap-5">
                      <div
                        class="flex h-12 w-12 items-center justify-center rounded-full bg-cinnamon-ice text-lg font-bold text-white sm:h-16 sm:w-16 sm:text-xl shrink-0"
                      >
                        {{ ownerInitials }}
                      </div>
                      <div class="flex flex-col">
                        <h3 class="text-base font-semibold text-noble-black sm:text-lg">
                          {{ ownerName }}
                        </h3>
                        <div class="flex items-center gap-1.5 text-sm">
                          <div class="flex items-center gap-1 text-burning-orange">
                            <Icon name="ph:star-fill" class="w-3.5 h-3.5" />
                            <span class="font-bold">{{ ratingLabel }}</span>
                          </div>
                          <span class="text-noble-black/60">({{ bookingCountLabel }})</span>
                        </div>
                      </div>
                    </div>
                    <button
                      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-estate shadow-sm"
                    >
                      <Icon name="ph:chat-centered-text-light" class="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>

                <!-- Sidebar mirroring [slug].vue -->
                <div class="hidden lg:block space-y-6">
                  <div
                    class="rounded-3xl border border-cinnamon-ice bg-cream p-6 shadow-sm overflow-hidden"
                  >
                    <div class="mb-6 flex items-center justify-between">
                      <h3 class="font-semibold text-noble-black">
                        {{ monthNames[viewMonth] }} {{ viewYear }}
                      </h3>
                      <div class="flex gap-2 text-noble-black/40">
                        <Icon name="ph:caret-left-light" class="w-5 h-5" />
                        <Icon name="ph:caret-right-light" class="w-5 h-5" />
                      </div>
                    </div>
                    <div class="grid grid-cols-7 text-center mb-2">
                      <div
                        v-for="day in daysOfWeek"
                        :key="day"
                        class="text-[10px] font-bold uppercase tracking-wider text-noble-black/40 py-2"
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
                          class="relative flex h-9 w-9 items-center justify-center rounded-full text-sm transition-all"
                          :class="
                            dayObj.isToday
                              ? 'text-burning-orange font-bold'
                              : 'text-noble-black opacity-40'
                          "
                        >
                          {{ dayObj.day }}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-1.5">
                      <span
                        class="ml-1 text-[10px] font-bold uppercase tracking-wider text-noble-black/40"
                        >Start Time</span
                      >
                      <div
                        class="flex h-12 w-full items-center justify-between rounded-2xl border border-cinnamon-ice bg-cream px-4 text-sm font-medium text-noble-black/40"
                      >
                        09:00 AM
                        <Icon name="ph:caret-down-light" class="w-4 h-4" />
                      </div>
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <span
                        class="ml-1 text-[10px] font-bold uppercase tracking-wider text-noble-black/40"
                        >End Time</span
                      >
                      <div
                        class="flex h-12 w-full items-center justify-between rounded-2xl border border-cinnamon-ice bg-cream px-4 text-sm font-medium text-noble-black/40"
                      >
                        06:00 PM
                        <Icon name="ph:caret-down-light" class="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                  <div class="rounded-3xl border border-cinnamon-ice bg-cream p-6 shadow-sm">
                    <div class="mb-4 flex items-baseline gap-1">
                      <span class="text-3xl font-bold text-noble-black">{{ priceAmount }}</span>
                      <span class="text-sm font-medium text-noble-black/60">{{
                        priceUnitLabel
                      }}</span>
                    </div>
                    <div class="relative mb-6 grid grid-cols-2">
                      <div class="absolute left-1/2 top-1 bottom-1 w-px bg-cinnamon-ice/30" />
                      <div class="flex flex-col gap-1 pr-4">
                        <span
                          class="text-[10px] font-bold uppercase tracking-wider text-noble-black/40"
                          >Start</span
                        ><span class="text-sm font-semibold text-noble-black/40">Select date</span>
                      </div>
                      <div class="flex flex-col gap-1 pl-4">
                        <span
                          class="text-[10px] font-bold uppercase tracking-wider text-noble-black/40"
                          >End</span
                        ><span class="text-sm font-semibold text-noble-black/40">Select date</span>
                      </div>
                    </div>
                    <button
                      class="mb-2.5 w-full rounded-2xl bg-burning-orange py-3 text-base font-bold text-white shadow-md shadow-burning-orange/10 transition-all hover:bg-blue-estate"
                    >
                      Request Booking
                    </button>
                    <p class="text-center text-[11px] text-noble-black/40">
                      You won't be charged yet.
                    </p>
                    <div class="my-4 h-px bg-cinnamon-ice/30" />
                    <div class="flex items-center justify-center gap-2 text-noble-black/40">
                      <Icon name="ph:shield-check-light" class="w-3.5 h-3.5" />
                      <span class="text-[11px] font-normal">Protected by TakeUP Guarantee</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ReviewsSection Mirror -->
              <div class="mt-20 border-t border-cinnamon-ice pt-16 pb-20">
                <div class="flex items-center gap-4 mb-10">
                  <h2 class="text-2xl font-bold text-noble-black">Reviews</h2>
                  <div
                    class="flex items-center gap-1.5 px-3 py-1 bg-burning-orange/10 rounded-full"
                  >
                    <Icon name="ph:star-fill" class="w-4 h-4 text-burning-orange" />
                    <span class="text-sm font-bold text-burning-orange">{{ ratingLabel }}</span>
                    <span class="text-xs text-burning-orange/60 font-medium"
                      >({{ bookingCountLabel }})</span
                    >
                  </div>
                </div>
                <div
                  class="rounded-3xl border border-cinnamon-ice/30 bg-cream/30 px-6 py-12 text-center"
                >
                  <p class="text-sm text-noble-black/40 italic">
                    No reviews yet for this listing preview.
                  </p>
                </div>
              </div>
            </div>

            <!-- Mobile Sticky Bottom Bar -->
            <div
              class="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-cinnamon-ice p-4 px-6 z-[100] shadow-[0_-10px_30px_rgba(0,0,0,0.08)]"
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
</style>
