<script setup lang="ts">
import { normalizeReviewImageUrl } from "../utils/review-image"

type ReviewEntry = {
  id: string
  reviewType: "ITEM_REVIEW" | "LENDER_REVIEW" | "BORROWER_REVIEW"
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

const props = withDefaults(
  defineProps<{
    title?: string
    reviews: ReviewEntry[]
    emptyMessage?: string
  }>(),
  {
    title: "Reviews",
    emptyMessage: "No reviews yet.",
  },
)

const runtimeConfig = useRuntimeConfig()
const reviewImageBucket = runtimeConfig.public.itemImageBucket
const supabaseUrl = runtimeConfig.public.supabase.url

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
</script>

<template>
  <section class="bg-cream border border-cinnamon-ice rounded-3xl p-6">
    <div class="flex items-center justify-between gap-3 mb-5">
      <h2 class="text-lg font-bold text-noble-black">{{ props.title }}</h2>
      <span class="text-sm text-noble-black/50">{{ props.reviews.length }} total</span>
    </div>

    <div v-if="props.reviews.length === 0" class="text-sm text-noble-black/60">
      {{ props.emptyMessage }}
    </div>

    <div v-else class="space-y-4">
      <article
        v-for="review in props.reviews"
        :key="review.id"
        class="rounded-2xl bg-white border border-cinnamon-ice/60 p-4"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <img
              v-if="review.reviewer.avatarUrl"
              :src="review.reviewer.avatarUrl"
              :alt="review.reviewer.displayName"
              class="w-10 h-10 rounded-full object-cover"
            />
            <div
              v-else
              class="w-10 h-10 rounded-full bg-burning-orange/10 text-burning-orange flex items-center justify-center text-xs font-bold"
            >
              {{ initialsFor(review.reviewer.displayName) }}
            </div>

            <div class="min-w-0">
              <p class="text-sm font-semibold text-noble-black truncate">
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
              class="w-4 h-4"
              viewBox="0 0 24 24"
              :fill="star <= review.rating ? 'currentColor' : 'none'"
              :stroke="star <= review.rating ? 'currentColor' : 'currentColor'"
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

        <p class="mt-3 text-sm leading-6 text-noble-black/80">
          {{ review.reviewText }}
        </p>

        <div v-if="review.images.length > 0" class="mt-4 flex flex-wrap gap-3">
          <img
            v-for="image in review.images"
            :key="image"
            :src="getReviewImageUrl(image)"
            :alt="`${review.typeLabel} image`"
            class="h-20 w-20 rounded-2xl object-cover border border-cinnamon-ice/70"
            loading="lazy"
          />
        </div>
      </article>
    </div>
  </section>
</template>
