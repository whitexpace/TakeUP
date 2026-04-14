<script setup lang="ts">
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

const ratingDistribution = computed(() =>
  [5, 4, 3, 2, 1].map((stars) => {
    const count = props.reviews.filter((review) => review.rating === stars).length
    return {
      stars,
      count,
      width: props.reviewsCount > 0 ? `${(count / props.reviewsCount) * 100}%` : "0%",
    }
  }),
)

const formatDate = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

const initialsFor = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase()

const getReviewImageUrl = (image: string) =>
  normalizeReviewImageUrl(image, {
    supabaseUrl,
    bucket: reviewImageBucket,
  })

const previewImageUrls = ref<string[]>([])
const previewImageIndex = ref(0)
const previewImageTitle = ref("Review image")

const hasPreview = computed(() => previewImageUrls.value.length > 0)
const currentPreviewImage = computed(() => {
  if (!hasPreview.value) return ""
  return previewImageUrls.value[previewImageIndex.value] ?? ""
})

const openImagePreview = (review: ReviewEntry, imageIndex: number) => {
  if (review.images.length === 0) return
  previewImageUrls.value = review.images.map((image) => getReviewImageUrl(image))
  previewImageIndex.value = Math.min(Math.max(imageIndex, 0), previewImageUrls.value.length - 1)
  previewImageTitle.value = review.typeLabel
}

const closeImagePreview = () => {
  previewImageUrls.value = []
  previewImageIndex.value = 0
  previewImageTitle.value = "Review image"
}

const goToPreviousPreviewImage = () => {
  if (previewImageUrls.value.length <= 1) return
  previewImageIndex.value =
    (previewImageIndex.value - 1 + previewImageUrls.value.length) % previewImageUrls.value.length
}

const goToNextPreviewImage = () => {
  if (previewImageUrls.value.length <= 1) return
  previewImageIndex.value = (previewImageIndex.value + 1) % previewImageUrls.value.length
}

const onPreviewKeydown = (event: KeyboardEvent) => {
  if (!hasPreview.value) return

  if (event.key === "Escape") {
    closeImagePreview()
    return
  }

  if (event.key === "ArrowLeft") {
    goToPreviousPreviewImage()
    return
  }

  if (event.key === "ArrowRight") {
    goToNextPreviewImage()
  }
}

if (import.meta.client) {
  watch(hasPreview, (open) => {
    if (open) {
      window.addEventListener("keydown", onPreviewKeydown)
      return
    }

    window.removeEventListener("keydown", onPreviewKeydown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", onPreviewKeydown)
  })
}
</script>

<template>
  <section class="mt-10 rounded-[32px] border border-cinnamon-ice bg-cream px-6 py-8 sm:px-8">
    <div class="grid gap-8 lg:grid-cols-[280px,1fr]">
      <div>
        <h2 class="text-2xl font-bold text-noble-black">Reviews</h2>
        <div class="mt-4 flex items-end gap-3">
          <span class="text-5xl font-bold text-noble-black">{{ rating.toFixed(1) }}</span>
          <div class="pb-1">
            <div class="flex items-center gap-1 text-burning-orange">
              <svg
                v-for="star in 5"
                :key="star"
                class="h-5 w-5"
                viewBox="0 0 24 24"
                :fill="star <= Math.round(rating) ? 'currentColor' : 'none'"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M12 3.75l2.664 5.398 5.958.866-4.311 4.202 1.018 5.934L12 17.348l-5.329 2.802 1.018-5.934-4.311-4.202 5.958-.866L12 3.75z"
                />
              </svg>
            </div>
            <p class="mt-1 text-sm text-noble-black/60">Based on {{ reviewsCount }} reviews</p>
          </div>
        </div>

        <div class="mt-6 space-y-3">
          <div
            v-for="distribution in ratingDistribution"
            :key="distribution.stars"
            class="flex items-center gap-3"
          >
            <span class="w-6 text-sm font-medium text-noble-black/70">{{
              distribution.stars
            }}</span>
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-white">
              <div
                class="h-full rounded-full bg-burning-orange transition-all"
                :style="{ width: distribution.width }"
              ></div>
            </div>
            <span class="w-8 text-right text-sm text-noble-black/50">{{ distribution.count }}</span>
          </div>
        </div>
      </div>

      <div>
        <div v-if="reviews.length === 0" class="rounded-3xl bg-white px-6 py-10 text-center">
          <p class="text-base font-semibold text-noble-black">No reviews yet</p>
          <p class="mt-2 text-sm text-noble-black/60">
            Completed transaction reviews for this item will appear here.
          </p>
        </div>

        <div v-else class="space-y-4">
          <article
            v-for="review in reviews"
            :key="review.id"
            class="rounded-3xl border border-cinnamon-ice/70 bg-white p-5"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-center gap-3 min-w-0">
                <img
                  v-if="review.reviewer.avatarUrl"
                  :src="review.reviewer.avatarUrl"
                  :alt="review.reviewer.displayName"
                  class="h-11 w-11 rounded-full object-cover"
                />
                <div
                  v-else
                  class="flex h-11 w-11 items-center justify-center rounded-full bg-burning-orange/10 text-sm font-bold text-burning-orange"
                >
                  {{ initialsFor(review.reviewer.displayName) }}
                </div>

                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-noble-black">
                    {{ review.reviewer.displayName }}
                  </p>
                  <p class="text-xs font-medium text-burning-orange/80 mt-0.5">
                    {{ review.typeLabel }}
                  </p>
                  <p class="text-xs text-noble-black/50">{{ formatDate(review.createdAt) }}</p>
                </div>
              </div>

              <div class="flex items-center gap-1 text-burning-orange shrink-0">
                <svg
                  v-for="star in 5"
                  :key="star"
                  class="h-4 w-4"
                  viewBox="0 0 24 24"
                  :fill="star <= review.rating ? 'currentColor' : 'none'"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M12 3.75l2.664 5.398 5.958.866-4.311 4.202 1.018 5.934L12 17.348l-5.329 2.802 1.018-5.934-4.311-4.202 5.958-.866L12 3.75z"
                  />
                </svg>
              </div>
            </div>

            <p class="mt-4 text-sm leading-6 text-noble-black/80">
              {{ review.reviewText }}
            </p>

            <div v-if="review.images.length > 0" class="mt-4 flex flex-wrap gap-3">
              <img
                v-for="(image, imageIndex) in review.images"
                :key="`${review.id}-${image}-${imageIndex}`"
                :src="getReviewImageUrl(image)"
                :alt="`${review.typeLabel} image`"
                class="h-24 w-24 rounded-2xl object-cover border border-cinnamon-ice/70 cursor-pointer transition-transform hover:scale-[1.03]"
                loading="lazy"
                @click="openImagePreview(review, imageIndex)"
              />
            </div>
          </article>
        </div>
      </div>
    </div>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="hasPreview" class="fixed inset-0 z-[140] flex items-center justify-center p-4">
        <button
          type="button"
          class="absolute inset-0 bg-noble-black/75 backdrop-blur-sm"
          aria-label="Close image preview"
          @click="closeImagePreview"
        ></button>

        <div class="relative z-[1] flex w-full max-w-5xl items-center justify-center gap-4">
          <button
            v-if="previewImageUrls.length > 1"
            type="button"
            class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/95 text-noble-black shadow hover:bg-white"
            aria-label="Previous image"
            @click="goToPreviousPreviewImage"
          >
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor">
              <path
                d="M15 18l-6-6 6-6"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>

          <div class="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-black/20 p-2">
            <img
              :src="currentPreviewImage"
              :alt="`${previewImageTitle} preview`"
              class="max-h-[78vh] w-full rounded-2xl object-contain"
            />

            <div
              class="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-xs text-white/90"
            >
              <span>{{ previewImageTitle }}</span>
              <span> {{ previewImageIndex + 1 }} / {{ previewImageUrls.length }} </span>
            </div>

            <button
              type="button"
              class="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/70"
              aria-label="Close image preview"
              @click="closeImagePreview"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor">
                <path d="M18 6 6 18M6 6l12 12" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <button
            v-if="previewImageUrls.length > 1"
            type="button"
            class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/95 text-noble-black shadow hover:bg-white"
            aria-label="Next image"
            @click="goToNextPreviewImage"
          >
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor">
              <path
                d="m9 6 6 6-6 6"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </Transition>
  </section>
</template>
