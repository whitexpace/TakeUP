<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue"
import { normalizeReviewImageUrl } from "../utils/review-image"

type ReviewEntry = {
  id: string
  typeLabel: string
  rating: number
  reviewText: string
  images: string[]
  createdAt: Date | string
  reviewer: {
    id: string | null
    displayName: string
    username: string | null
    avatarUrl: string | null
  }
}

const props = defineProps<{
  rating: number
  reviewsCount: number
  reviews: ReviewEntry[]
}>()

const runtimeConfig = useRuntimeConfig()
const reviewImageBucket = runtimeConfig.public.itemImageBucket
const supabaseUrl = runtimeConfig.public.supabase.url

const getReviewImageUrl = (image: string) =>
  normalizeReviewImageUrl(image, {
    supabaseUrl,
    bucket: reviewImageBucket,
  })

const ratingsDistribution = computed(() =>
  [5, 4, 3, 2, 1].map((stars) => {
    const count = props.reviews.filter((review) => review.rating === stars).length
    return {
      stars,
      count,
    }
  }),
)

const filters = [
  { label: "All Reviews", value: "all" },
  { label: "With Visuals", value: "visuals" },
  { label: "5", value: "5", isStar: true },
  { label: "4", value: "4", isStar: true },
  { label: "3", value: "3", isStar: true },
  { label: "2", value: "2", isStar: true },
  { label: "1", value: "1", isStar: true },
]

const selectedFilter = ref("all")
const sortBy = ref("Most Recent")
const isSortOpen = ref(false)
const visibleReviewsCount = ref(5)

// Lightbox logic
const isLightboxOpen = ref(false)
const lightboxImages = ref<string[]>([])
const currentLightboxIndex = ref(0)
const lightboxTitle = ref("Review image")

const openLightbox = (review: ReviewEntry, index: number) => {
  if (review.images.length === 0) return
  lightboxImages.value = review.images.map((img) => getReviewImageUrl(img))
  currentLightboxIndex.value = index
  lightboxTitle.value = review.typeLabel
  isLightboxOpen.value = true
  if (import.meta.client) {
    document.body.style.overflow = "hidden"
  }
}

const closeLightbox = () => {
  isLightboxOpen.value = false
  if (import.meta.client) {
    document.body.style.overflow = "auto"
  }
}

const nextLightboxImage = () => {
  if (lightboxImages.value.length <= 1) return
  currentLightboxIndex.value = (currentLightboxIndex.value + 1) % lightboxImages.value.length
}

const prevLightboxImage = () => {
  if (lightboxImages.value.length <= 1) return
  currentLightboxIndex.value =
    (currentLightboxIndex.value - 1 + lightboxImages.value.length) % lightboxImages.value.length
}

const handleKeydown = (e: KeyboardEvent) => {
  if (!isLightboxOpen.value) return
  if (e.key === "ArrowRight") nextLightboxImage()
  if (e.key === "ArrowLeft") prevLightboxImage()
  if (e.key === "Escape") closeLightbox()
}

onMounted(() => {
  if (import.meta.client) {
    window.addEventListener("keydown", handleKeydown)
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener("keydown", handleKeydown)
  }
})

const filteredReviews = computed(() => {
  let reviews = [...props.reviews]

  if (selectedFilter.value === "visuals") {
    reviews = reviews.filter((r) => r.images && r.images.length > 0)
  } else if (!isNaN(Number(selectedFilter.value))) {
    reviews = reviews.filter((r) => r.rating === Number(selectedFilter.value))
  }

  if (sortBy.value === "Most Recent") {
    reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } else if (sortBy.value === "Rating") {
    reviews.sort((a, b) => b.rating - a.rating)
  }

  return reviews
})

const displayedReviews = computed(() => {
  return filteredReviews.value.slice(0, visibleReviewsCount.value)
})

const hasMore = computed(() => {
  return visibleReviewsCount.value < filteredReviews.value.length
})

const loadMore = () => {
  visibleReviewsCount.value += 5
}

const toggleSort = () => {
  isSortOpen.value = !isSortOpen.value
}

const selectSort = (option: string) => {
  sortBy.value = option
  isSortOpen.value = false
}

const formatDate = (value: Date | string) => {
  const date = new Date(value)
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

  if (diffInDays === 0) return "Today"
  if (diffInDays === 1) return "Yesterday"
  if (diffInDays < 7) return `${diffInDays} days ago`
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const initialsFor = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase()
</script>

<template>
  <section class="w-full mt-16 pt-12 border-t border-cinnamon-ice/15">
    <h2 class="text-lg font-semibold mb-6">Ratings & Reviews</h2>

    <!-- Summary Row -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-12 pb-12 mb-8 border-b border-cinnamon-ice/15">
      <!-- Part 1: Rating Overview -->
      <div class="flex flex-col items-center md:items-start justify-center">
        <div class="text-6xl font-bold text-noble-black mb-2">
          {{ rating.toFixed(1) }}
        </div>
        <div class="flex items-center gap-1 text-burning-orange mb-2">
          <Icon
            v-for="i in 5"
            :key="i"
            :name="i <= Math.round(rating) ? 'ph:star-fill' : 'ph:star-light'"
            class="w-6 h-6"
          />
        </div>
        <div class="text-sm text-noble-black/60 font-medium">
          Based on {{ reviewsCount }} reviews
        </div>
      </div>

      <!-- Part 2: Distribution Bars -->
      <div class="space-y-4">
        <div v-for="dist in ratingsDistribution" :key="dist.stars" class="flex items-center gap-4">
          <div class="flex items-center gap-1.5 w-10 shrink-0">
            <span class="text-sm font-semibold text-noble-black">{{ dist.stars }}</span>
            <Icon name="ph:star-fill" class="w-3.5 h-3.5 text-burning-orange" />
          </div>
          <div class="flex-1 h-3 bg-cream rounded-full overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-burning-orange to-blue-estate rounded-full transition-all duration-500"
              :style="{ width: reviewsCount > 0 ? `${(dist.count / reviewsCount) * 100}%` : '0%' }"
            />
          </div>
          <div class="w-8 text-right shrink-0">
            <span class="text-xs font-bold text-noble-black/60">{{ dist.count }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters and Sort -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
      <div class="flex flex-wrap gap-2.5">
        <button
          v-for="filter in filters"
          :key="filter.value"
          class="px-5 py-2.5 rounded-full text-sm font-medium transition-all border shadow-sm"
          :class="[
            selectedFilter === filter.value
              ? 'bg-burning-orange border-burning-orange text-white shadow-burning-orange/20'
              : 'bg-white border-cinnamon-ice/15 text-noble-black hover:border-burning-orange hover:text-burning-orange',
          ]"
          @click="selectedFilter = filter.value"
        >
          <span class="flex items-center gap-1.5">
            <Icon v-if="filter.value === 'visuals'" name="ph:camera-light" class="w-3.5 h-3.5" />
            {{ filter.label }}
            <Icon
              v-if="filter.isStar"
              name="ph:star-fill"
              class="w-3.5 h-3.5"
              :class="selectedFilter === filter.value ? 'text-white' : 'text-burning-orange'"
            />
          </span>
        </button>
      </div>

      <div class="relative shrink-0 w-full sm:w-auto">
        <button
          class="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto px-2 py-2.5 bg-transparent text-sm font-medium"
          @click="toggleSort"
        >
          <span class="text-burning-orange font-semibold">{{ sortBy }}</span>
          <Icon
            name="ph:caret-down-light"
            class="w-4.5 h-4.5 transition-transform text-noble-black/40"
            :class="{ 'rotate-180': isSortOpen }"
          />
        </button>
        <Transition
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="transform scale-95 opacity-0"
          enter-to-class="transform scale-100 opacity-100"
          leave-active-class="transition duration-75 ease-in"
          leave-from-class="transform scale-100 opacity-100"
          leave-to-class="transform scale-95 opacity-0"
        >
          <div
            v-if="isSortOpen"
            class="absolute right-0 mt-2 w-full sm:w-48 bg-white border border-cinnamon-ice/15 rounded-2xl shadow-xl overflow-hidden z-20"
          >
            <div
              class="px-5 py-3 text-sm text-noble-black hover:text-burning-orange cursor-pointer transition-colors"
              :class="{ 'text-burning-orange font-bold': sortBy === 'Most Recent' }"
              @click="selectSort('Most Recent')"
            >
              Most Recent
            </div>
            <div
              class="px-5 py-3 text-sm text-noble-black hover:text-burning-orange cursor-pointer transition-colors"
              :class="{ 'text-burning-orange font-bold': sortBy === 'Rating' }"
              @click="selectSort('Rating')"
            >
              Rating
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Review Cards -->
    <div v-if="displayedReviews.length > 0" class="space-y-4">
      <div
        v-for="review in displayedReviews"
        :key="review.id"
        class="bg-cream/50 rounded-2xl p-5 border border-cinnamon-ice/15 hover:border-cinnamon-ice/20 transition-colors"
      >
        <div class="flex justify-between items-start mb-4">
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base overflow-hidden shrink-0"
            >
              <img
                v-if="review.reviewer.avatarUrl"
                :src="review.reviewer.avatarUrl"
                :alt="review.reviewer.displayName"
                class="w-full h-full object-cover"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center bg-burning-orange/10 text-burning-orange text-sm"
              >
                {{ initialsFor(review.reviewer.displayName) }}
              </div>
            </div>
            <div>
              <h4 class="font-bold text-noble-black text-sm">
                {{ review.reviewer.displayName }}
              </h4>
              <div class="flex items-center gap-2">
                <p class="text-[10px] text-noble-black/40 font-medium">
                  {{ formatDate(review.createdAt) }}
                </p>
                <span class="text-[10px] font-bold text-burning-orange/70 uppercase tracking-wider">
                  {{ review.typeLabel }}
                </span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-0.5 text-burning-orange">
            <Icon
              v-for="i in 5"
              :key="i"
              :name="i <= review.rating ? 'ph:star-fill' : 'ph:star-light'"
              class="w-3 h-3"
            />
          </div>
        </div>

        <p
          v-if="review.reviewText"
          class="text-sm text-noble-black/80 leading-relaxed mb-4 font-normal"
        >
          {{ review.reviewText }}
        </p>

        <div v-if="review.images && review.images.length" class="flex flex-wrap gap-2 mb-4">
          <div
            v-for="(img, idx) in review.images"
            :key="idx"
            class="w-20 h-20 rounded-xl overflow-hidden shadow-sm cursor-pointer border border-cinnamon-ice/15"
            @click="openLightbox(review, idx)"
          >
            <img :src="getReviewImageUrl(img)" class="w-full h-full object-cover" />
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="rounded-3xl bg-gray-50/50 border border-dashed border-cinnamon-ice/15 px-6 py-16 text-center"
    >
      <p class="text-base font-semibold text-noble-black">No reviews found</p>
      <p class="mt-2 text-sm text-noble-black/60">
        Try adjusting your filters to see more feedback.
      </p>
    </div>

    <!-- View More -->
    <div v-if="hasMore" class="mt-12 flex justify-center pb-12">
      <button
        class="px-10 py-4 text-sm font-bold text-noble-black hover:text-burning-orange transition-colors flex items-center gap-2 active:scale-95"
        @click="loadMore"
      >
        View more reviews
        <Icon name="ph:caret-down-light" class="w-4 h-4" />
      </button>
    </div>

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
          v-if="isLightboxOpen"
          class="fixed inset-0 z-[3000] bg-noble-black/95 flex items-center justify-center p-4 md:p-12"
          @click="closeLightbox"
        >
          <button
            class="absolute top-6 right-6 text-white/70 hover:text-white transition-colors p-2 z-[3010]"
            @click.stop="closeLightbox"
          >
            <Icon name="ph:x-light" class="w-8 h-8" />
          </button>

          <button
            v-if="lightboxImages.length > 1"
            class="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-4 z-[3010]"
            @click.stop="prevLightboxImage"
          >
            <Icon name="ph:caret-left-light" class="w-12 h-12" />
          </button>

          <button
            v-if="lightboxImages.length > 1"
            class="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-4 z-[3010]"
            @click.stop="nextLightboxImage"
          >
            <Icon name="ph:caret-right-light" class="w-12 h-12" />
          </button>

          <div class="relative w-full h-full flex items-center justify-center" @click.stop>
            <img
              :src="lightboxImages[currentLightboxIndex]"
              class="max-w-full max-h-full object-contain select-none shadow-2xl"
              @click.stop
            />
            <div
              class="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-8 py-6 text-white/90"
            >
              <div class="flex flex-col">
                <span class="text-sm font-bold uppercase tracking-widest">{{ lightboxTitle }}</span>
                <span v-if="lightboxImages.length > 1" class="text-xs opacity-60">
                  {{ currentLightboxIndex + 1 }} / {{ lightboxImages.length }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>
