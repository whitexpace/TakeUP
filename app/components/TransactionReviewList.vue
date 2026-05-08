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
    showStatus?: boolean
  }>(),
  {
    title: "Reviews",
    emptyMessage: "No reviews yet.",
    showStatus: false,
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
  <div class="space-y-4">
    <div v-if="props.reviews.length === 0" class="text-sm text-noble-black/60 py-4 italic">
      {{ props.emptyMessage }}
    </div>

    <div v-else class="space-y-4">
      <article
        v-for="review in props.reviews"
        :key="review.id"
        class="rounded-[16px] bg-white border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all duration-300"
      >
        <div class="flex items-start justify-between gap-4 mb-6">
          <div class="flex items-center gap-4 min-w-0">
            <img
              v-if="review.reviewer.avatarUrl"
              :src="review.reviewer.avatarUrl"
              :alt="review.reviewer.displayName"
              class="w-12 h-12 rounded-full object-cover border border-gray-100 shadow-sm"
            />
            <div
              v-else
              class="w-12 h-12 rounded-full bg-burning-orange text-white flex items-center justify-center text-sm font-bold shadow-sm"
            >
              {{ initialsFor(review.reviewer.displayName) }}
            </div>

            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-[16px] font-bold text-noble-black truncate">
                  {{ review.reviewer.displayName }}
                </p>
                <span
                  class="inline-flex items-center rounded-full bg-burning-orange/[0.08] px-2.5 py-0.5 text-[10px] font-bold text-burning-orange uppercase tracking-wider border border-burning-orange/10"
                >
                  {{ review.typeLabel }}
                </span>
              </div>
              <p class="text-[12px] text-noble-black/40 font-medium mt-1.5">
                {{ formatDate(review.createdAt) }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-0.5 text-burning-orange shrink-0 pt-1">
            <Icon
              v-for="star in 5"
              :key="star"
              :name="star <= review.rating ? 'ph:star-fill' : 'ph:star-light'"
              class="w-4 h-4"
            />
          </div>
        </div>

        <p class="text-[14px] leading-relaxed text-[#374151] font-medium">
          {{ review.reviewText }}
        </p>

        <div v-if="review.images.length > 0" class="mt-4 flex flex-wrap gap-2">
          <img
            v-for="image in review.images"
            :key="image"
            :src="getReviewImageUrl(image)"
            :alt="`${review.typeLabel} image`"
            class="h-16 w-16 rounded-[10px] object-cover border border-gray-100 shadow-sm transition-transform hover:scale-105"
            loading="lazy"
          />
        </div>
      </article>
    </div>
  </div>
</template>
