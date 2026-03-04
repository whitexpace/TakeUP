<script setup lang="ts">
import { ref, computed } from "vue"

interface Review {
  id: number
  userName: string
  userAvatar?: string
  userColor?: string
  rating: number
  date: string
  description?: string
  visuals?: string[]
  helpfulCount: number
  isLiked?: boolean
}

defineProps<{
  rating: number
  reviewsCount: number
}>()

const avatarColors = ["bg-cinnamon-ice", "bg-burning-orange", "bg-blue-estate", "bg-wahoo"]

const getRandomColor = () => avatarColors[Math.floor(Math.random() * avatarColors.length)]

const mockReviews = ref<Review[]>([
  {
    id: 1,
    userName: "Mika A.",
    userColor: avatarColors[0],
    rating: 5,
    date: "2 days ago",
    description:
      "The camera was in perfect condition! Issa was very helpful and explained how to use the extra batteries. Highly recommended for any professional shoot.",
    visuals: ["/images/popular/camera.jpg", "/images/popular/macbook.jpg"],
    helpfulCount: 5,
    isLiked: false,
  },
  {
    id: 2,
    userName: "Nicole T.",
    userColor: avatarColors[1],
    rating: 5,
    date: "1 week ago",
    description:
      "Great experience renting this camera. The quality is top-notch and everything included in the kit was very useful.",
    helpfulCount: 2,
    isLiked: false,
  },
  {
    id: 3,
    userName: "John D.",
    userColor: avatarColors[2],
    rating: 4,
    date: "2 weeks ago",
    description:
      "Good kit, but the bag was a bit smaller than expected. Still, the camera performed flawlessly.",
    visuals: ["/images/popular/scical.jpg"],
    helpfulCount: 0,
    isLiked: false,
  },
  {
    id: 4,
    userName: "Maria L.",
    userColor: avatarColors[3],
    rating: 5,
    date: "1 month ago",
    description:
      "Used this for a wedding and the results were amazing. The autofocus on the A7 IV is a game changer.",
    helpfulCount: 8,
    isLiked: false,
  },
  {
    id: 5,
    userName: "Kevin O.",
    userColor: avatarColors[0],
    rating: 5,
    date: "1 month ago",
    description: "Super smooth transaction. Will definitely rent again!",
    helpfulCount: 1,
    isLiked: false,
  },
  {
    id: 6,
    userName: "Sarah M.",
    userColor: avatarColors[1],
    rating: 5,
    date: "2 months ago",
    description: "Excellent camera and great service.",
    helpfulCount: 3,
    isLiked: false,
  },
  {
    id: 7,
    userName: "Robert B.",
    userColor: avatarColors[2],
    rating: 5,
    date: "3 months ago",
    description: "Best rental experience so far. The A7 IV is a beast.",
    helpfulCount: 4,
    isLiked: false,
  },
])

const ratingsDistribution = [
  { stars: 5, count: 34 },
  { stars: 4, count: 1 },
  { stars: 3, count: 0 },
  { stars: 2, count: 0 },
  { stars: 1, count: 0 },
]

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

const openLightbox = (images: string[], index: number) => {
  lightboxImages.value = images
  currentLightboxIndex.value = index
  isLightboxOpen.value = true
  document.body.style.overflow = "hidden"
}

const closeLightbox = () => {
  isLightboxOpen.value = false
  document.body.style.overflow = "auto"
}

const nextLightboxImage = () => {
  currentLightboxIndex.value = (currentLightboxIndex.value + 1) % lightboxImages.value.length
}

const prevLightboxImage = () => {
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
  window.addEventListener("keydown", handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown)
})

const filteredReviews = computed(() => {
  let reviews = [...mockReviews.value]
  if (selectedFilter.value === "visuals") {
    reviews = reviews.filter((r) => r.visuals && r.visuals.length > 0)
  } else if (!isNaN(Number(selectedFilter.value))) {
    reviews = reviews.filter((r) => r.rating === Number(selectedFilter.value))
  }

  if (sortBy.value === "Most Liked") {
    reviews.sort((a, b) => b.helpfulCount - a.helpfulCount)
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

const markHelpful = (reviewId: number) => {
  const review = mockReviews.value.find((r) => r.id === reviewId)
  if (review) {
    if (review.isLiked) {
      review.helpfulCount--
      review.isLiked = false
    } else {
      review.helpfulCount++
      review.isLiked = true
    }
  }
}
</script>

<template>
  <section class="w-full mt-16 pt-12 border-t border-cinnamon-ice">
    <h2 class="text-lg font-semibold mb-6">Ratings & Reviews</h2>

    <!-- Summary Row -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-12 pb-12 mb-8 border-b border-cinnamon-ice">
      <!-- Part 1: Rating Overview -->
      <div class="flex flex-col items-center md:items-start justify-center">
        <div class="text-6xl font-bold text-noble-black mb-2">
          {{ rating.toFixed(1) }}
        </div>
        <div class="flex items-center gap-1 text-burning-orange mb-2">
          <svg
            v-for="i in 5"
            :key="i"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            :fill="i <= Math.round(rating) ? 'currentColor' : 'none'"
            :stroke="i <= Math.round(rating) ? 'none' : 'currentColor'"
            stroke-width="1.5"
          >
            <polygon
              points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
            />
          </svg>
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
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              class="text-burning-orange"
            >
              <polygon
                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
              />
            </svg>
          </div>
          <div class="flex-1 h-3 bg-cream rounded-full overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-burning-orange via-blue-estate to-wahoo rounded-full transition-all duration-500"
              :style="{ width: `${(dist.count / 35) * 100}%` }"
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
              : 'bg-white border-cinnamon-ice text-noble-black hover:border-burning-orange hover:text-burning-orange',
          ]"
          @click="selectedFilter = filter.value"
        >
          <span class="flex items-center gap-1.5">
            <svg
              v-if="filter.value === 'visuals'"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"
              />
              <circle cx="12" cy="13" r="3" />
            </svg>
            {{ filter.label }}
            <svg
              v-if="filter.isStar"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              :class="selectedFilter === filter.value ? 'text-white' : 'text-burning-orange'"
            >
              <polygon
                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
              />
            </svg>
          </span>
        </button>
      </div>

      <div class="relative shrink-0 w-full sm:w-auto">
        <button
          class="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto px-2 py-2.5 bg-transparent text-sm font-medium"
          @click="toggleSort"
        >
          <span class="text-burning-orange font-semibold">{{ sortBy }}</span>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="transition-transform text-noble-black/40"
            :class="{ 'rotate-180': isSortOpen }"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
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
            class="absolute right-0 mt-2 w-full sm:w-48 bg-white border border-cinnamon-ice rounded-2xl shadow-xl overflow-hidden z-20"
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
              :class="{ 'text-burning-orange font-bold': sortBy === 'Most Liked' }"
              @click="selectSort('Most Liked')"
            >
              Most Liked
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Review Cards -->
    <div class="space-y-4">
      <div
        v-for="review in displayedReviews"
        :key="review.id"
        class="bg-cream/50 rounded-2xl p-5 border border-cinnamon-ice/10 hover:border-cinnamon-ice/30 transition-colors"
      >
        <div class="flex justify-between items-start mb-4">
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base overflow-hidden shrink-0"
              :class="review.userColor || getRandomColor()"
            >
              <img
                v-if="review.userAvatar"
                :src="review.userAvatar"
                :alt="review.userName"
                class="w-full h-full object-cover"
              />
              <span v-else
                >{{ review.userName.substring(0, 1)
                }}{{ review.userName.split(" ")[1]?.[0] || "" }}</span
              >
            </div>
            <div>
              <h4 class="font-bold text-noble-black text-sm">
                {{ review.userName }}
              </h4>
              <p class="text-[10px] text-noble-black/40 font-medium">
                {{ review.date }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-0.5 text-burning-orange">
            <svg
              v-for="i in 5"
              :key="i"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              :fill="i <= review.rating ? 'currentColor' : 'none'"
              :stroke="i <= review.rating ? 'none' : 'currentColor'"
              stroke-width="2"
            >
              <polygon
                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
              />
            </svg>
          </div>
        </div>

        <p
          v-if="review.description"
          class="text-sm text-noble-black/80 leading-relaxed mb-4 font-normal"
        >
          {{ review.description }}
        </p>

        <div v-if="review.visuals && review.visuals.length" class="flex flex-wrap gap-2 mb-4">
          <div
            v-for="(img, idx) in review.visuals"
            :key="idx"
            class="w-20 h-20 rounded-xl overflow-hidden shadow-sm cursor-pointer"
            @click="openLightbox(review.visuals, idx)"
          >
            <img :src="img" class="w-full h-full object-cover" />
          </div>
        </div>

        <div class="flex items-center justify-between mt-4 pt-4 border-t border-cinnamon-ice/10">
          <button
            class="flex items-center gap-2 px-1 py-1 rounded-full text-xs font-semibold transition-all group active:scale-95"
            :class="
              review.isLiked
                ? 'text-burning-orange'
                : 'text-noble-black/60 hover:text-burning-orange'
            "
            @click="markHelpful(review.id)"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="transition-all"
              :class="
                review.isLiked
                  ? 'fill-burning-orange/20 stroke-burning-orange'
                  : 'group-hover:fill-burning-orange/10'
              "
            >
              <path d="M7 10v12" />
              <path
                d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"
              />
            </svg>
            <span>Helpful ({{ review.helpfulCount }})</span>
          </button>
        </div>
      </div>
    </div>

    <!-- View More -->
    <div v-if="hasMore" class="mt-12 flex justify-center pb-12">
      <button
        class="px-10 py-4 text-sm font-bold text-noble-black hover:text-burning-orange transition-colors flex items-center gap-2 active:scale-95"
        @click="loadMore"
      >
        View more reviews
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
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
          class="fixed inset-0 z-[2000] bg-noble-black/95 flex items-center justify-center p-4 md:p-12"
          @click="closeLightbox"
        >
          <button
            class="absolute top-6 right-6 text-white/70 hover:text-white transition-colors p-2 z-[2010]"
            @click.stop="closeLightbox"
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <button
            v-if="lightboxImages.length > 1"
            class="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-4 z-[2010]"
            @click.stop="prevLightboxImage"
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <button
            v-if="lightboxImages.length > 1"
            class="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-4 z-[2010]"
            @click.stop="nextLightboxImage"
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>

          <div class="relative w-full h-full flex items-center justify-center" @click.stop>
            <img
              :src="lightboxImages[currentLightboxIndex]"
              class="max-w-full max-h-full object-contain select-none shadow-2xl"
              @click.stop
            />
            <div
              v-if="lightboxImages.length > 1"
              class="absolute bottom-0 left-1/2 -translate-x-1/2 text-white/60 text-sm font-medium pb-4"
            >
              {{ currentLightboxIndex + 1 }} / {{ lightboxImages.length }}
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>
