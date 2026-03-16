<script setup lang="ts">
import type { inferRouterOutputs } from "@trpc/server"
import { computed, ref, watch } from "vue"
import { buildItemDetailPath, extractItemIdFromSlug } from "../../utils/item-detail-route"
import type { AppRouter } from "../../../server/trpc/routers"

definePageMeta({
  layout: false,
  auth: false,
})

const route = useRoute()
type RouterOutputs = inferRouterOutputs<AppRouter>
type ItemDetail = RouterOutputs["item"]["byId"]

const slugParam = computed(() => {
  const slug = route.params.slug
  return Array.isArray(slug) ? (slug[0] ?? "") : (slug ?? "")
})

const itemId = computed(() => extractItemIdFromSlug(slugParam.value))
const isFromLikesPage = computed(() => route.query.from === "likes")
const backNavigationPath = computed(() => (isFromLikesPage.value ? "/likes" : "/dashboard"))
const backNavigationLabel = computed(() =>
  isFromLikesPage.value ? "Back to liked items" : "Back to listings",
)

const { data, pending, error } = await useAsyncData(
  () => `item:${itemId.value ?? "missing"}`,
  async () => {
    if (!itemId.value) {
      throw createError({
        statusCode: 404,
        statusMessage: "Item not found",
      })
    }

    return await $fetch<ItemDetail>(`/api/items/${itemId.value}`)
  },
  { watch: [itemId] },
)

if (error.value) {
  throw error.value
}

const item = computed(() => data.value)
const selectedImageIndex = ref(0)

const formatPhpAmount = (value: number) => {
  return new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 0,
  }).format(value)
}

const formatPesoAmount = (value: number) => {
  return `₱${formatPhpAmount(value)}`
}

const imageGallery = computed(() => {
  if (!item.value) return []

  const images = [...item.value.photos]
  if (item.value.thumbnailImage && !images.includes(item.value.thumbnailImage)) {
    images.unshift(item.value.thumbnailImage)
  }

  return images
})

watch(imageGallery, (images) => {
  if (selectedImageIndex.value >= images.length) {
    selectedImageIndex.value = 0
  }
})

const selectedImage = computed(() => imageGallery.value[selectedImageIndex.value] ?? null)

const priceAmount = computed(() => {
  if (!item.value) return ""
  if (item.value.freeToBorrow) return "Free"
  return formatPesoAmount(item.value.rentalFee)
})

const priceUnitLabel = computed(() => {
  if (!item.value) return ""
  if (item.value.freeToBorrow) return "to borrow"
  return `/ ${item.value.rateOption === "PER_HOUR" ? "hour" : "day"}`
})

const replacementCostLabel = computed(() => {
  if (!item.value?.replacementCost) return "Not specified"
  return formatPesoAmount(item.value.replacementCost)
})

const statusLabel = computed(() => {
  if (!item.value) return ""
  return item.value.status.toLowerCase().replace(/_/g, " ")
})

const formattedCondition = computed(() => {
  if (!item.value) return ""
  return item.value.condition.toLowerCase().replace(/_/g, " ")
})

const formattedCategories = computed(
  () =>
    item.value?.categories.map((category: string) =>
      category
        .toLowerCase()
        .split("_")
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
    ) ?? [],
)

const canonicalPath = computed(() => {
  if (!item.value) return null
  return buildItemDetailPath({ id: item.value.id, name: item.value.name })
})

watch(
  [slugParam, canonicalPath],
  ([slug, canonical]) => {
    if (canonical && `/items/${slug}` !== canonical) {
      void navigateTo({ path: canonical, query: route.query }, { replace: true })
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="min-h-screen bg-[#f6f1e7] text-noble-black">
    <div class="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <NuxtLink
        :to="backNavigationPath"
        class="inline-flex items-center gap-2 rounded-full border border-cinnamon-ice bg-white px-4 py-2 font-geist text-sm transition-colors hover:bg-cream"
      >
        <span aria-hidden="true">←</span>
        <span>{{ backNavigationLabel }}</span>
      </NuxtLink>

      <div v-if="pending" class="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div class="aspect-[4/3] animate-pulse rounded-[28px] bg-white/70"></div>
        <div class="space-y-4 rounded-[28px] bg-white/70 p-8">
          <div class="h-6 w-32 animate-pulse rounded bg-cream"></div>
          <div class="h-10 w-full animate-pulse rounded bg-cream"></div>
          <div class="h-24 w-full animate-pulse rounded bg-cream"></div>
        </div>
      </div>

      <div v-else-if="item" class="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <section class="space-y-5">
          <div
            class="relative overflow-hidden rounded-[28px] bg-white shadow-[0_20px_60px_rgba(77,61,44,0.08)]"
          >
            <div class="aspect-[4/3] bg-[#ece5d9]">
              <img
                v-if="selectedImage"
                :src="selectedImage"
                :alt="item.name"
                class="h-full w-full object-cover"
              />
              <div
                v-else
                class="flex h-full items-center justify-center font-geist text-sm uppercase tracking-[0.3em] text-noble-black/40"
              >
                No image available
              </div>
            </div>

            <div class="absolute left-5 top-5 flex items-center gap-2">
              <span
                class="rounded-full bg-blue-estate px-3 py-1 font-geist text-xs font-medium uppercase tracking-[0.2em] text-white"
              >
                {{ item.freeToBorrow ? "Borrow" : "Rent" }}
              </span>
              <span
                v-if="item.isTrending"
                class="rounded-full bg-burning-orange px-3 py-1 font-geist text-xs font-medium uppercase tracking-[0.2em] text-white"
              >
                Trending
              </span>
            </div>
          </div>

          <div v-if="imageGallery.length > 1" class="grid grid-cols-4 gap-3 sm:grid-cols-5">
            <button
              v-for="(image, index) in imageGallery"
              :key="`${image}-${index}`"
              type="button"
              class="overflow-hidden rounded-[18px] border-2 transition-colors"
              :class="index === selectedImageIndex ? 'border-burning-orange' : 'border-transparent'"
              @click="selectedImageIndex = index"
            >
              <img
                :src="image"
                :alt="`${item.name} preview ${index + 1}`"
                class="aspect-square w-full object-cover"
              />
            </button>
          </div>

          <div class="rounded-[28px] bg-white p-8 shadow-[0_20px_60px_rgba(77,61,44,0.08)]">
            <div class="flex flex-wrap items-center gap-3">
              <span
                v-for="category in formattedCategories"
                :key="category"
                class="rounded-full bg-cream px-3 py-1 font-geist text-xs font-medium uppercase tracking-[0.18em] text-burning-orange"
              >
                {{ category }}
              </span>
            </div>

            <h1 class="mt-5 font-rewon text-4xl leading-tight sm:text-5xl">
              {{ item.name }}
            </h1>

            <p class="mt-5 max-w-3xl font-geist text-base leading-7 text-noble-black/75 sm:text-lg">
              {{ item.description || "No description provided for this item yet." }}
            </p>

            <div v-if="item.tags.length" class="mt-6 flex flex-wrap gap-2">
              <span
                v-for="tag in item.tags"
                :key="tag"
                class="rounded-full border border-cinnamon-ice px-3 py-1 font-geist text-sm text-noble-black/70"
              >
                #{{ tag }}
              </span>
            </div>

            <div class="mt-8 grid gap-4 sm:grid-cols-2">
              <div class="rounded-[22px] bg-cream p-5">
                <p class="font-geist text-xs uppercase tracking-[0.2em] text-noble-black/45">
                  What this item offers
                </p>
                <p class="mt-2 font-geist text-sm leading-6 text-noble-black/75">
                  {{ item.whatItemOffers || "No details provided." }}
                </p>
              </div>
              <div class="rounded-[22px] bg-cream p-5">
                <p class="font-geist text-xs uppercase tracking-[0.2em] text-noble-black/45">
                  What's included
                </p>
                <p class="mt-2 font-geist text-sm leading-6 text-noble-black/75">
                  {{ item.whatIsIncluded || "No details provided." }}
                </p>
              </div>
              <div class="rounded-[22px] bg-cream p-5">
                <p class="font-geist text-xs uppercase tracking-[0.2em] text-noble-black/45">
                  Known issues
                </p>
                <p class="mt-2 font-geist text-sm leading-6 text-noble-black/75">
                  {{ item.knownIssues || "No known issues listed." }}
                </p>
              </div>
              <div class="rounded-[22px] bg-cream p-5">
                <p class="font-geist text-xs uppercase tracking-[0.2em] text-noble-black/45">
                  Usage limitations
                </p>
                <p class="mt-2 font-geist text-sm leading-6 text-noble-black/75">
                  {{ item.usageLimitations || "No usage limitations listed." }}
                </p>
              </div>
            </div>
          </div>
        </section>

        <aside class="space-y-5">
          <div class="rounded-[28px] bg-white p-8 shadow-[0_20px_60px_rgba(77,61,44,0.08)]">
            <p class="font-geist text-xs uppercase tracking-[0.2em] text-noble-black/45">Pricing</p>
            <div class="mt-3 flex flex-wrap items-end gap-2 text-burning-orange">
              <p class="font-geist text-4xl font-semibold leading-none tracking-tight tabular-nums">
                {{ priceAmount }}
              </p>
              <p
                class="font-geist text-sm font-medium uppercase tracking-[0.18em] text-burning-orange/80 sm:text-base"
              >
                {{ priceUnitLabel }}
              </p>
            </div>

            <dl class="mt-6 space-y-4">
              <div
                class="flex items-center justify-between gap-4 border-b border-cinnamon-ice/60 pb-4"
              >
                <dt class="font-geist text-sm text-noble-black/55">Status</dt>
                <dd class="font-geist text-sm font-medium capitalize text-noble-black">
                  {{ statusLabel }}
                </dd>
              </div>
              <div
                class="flex items-center justify-between gap-4 border-b border-cinnamon-ice/60 pb-4"
              >
                <dt class="font-geist text-sm text-noble-black/55">Condition</dt>
                <dd class="font-geist text-sm font-medium capitalize text-noble-black">
                  {{ formattedCondition }}
                </dd>
              </div>
              <div
                class="flex items-center justify-between gap-4 border-b border-cinnamon-ice/60 pb-4"
              >
                <dt class="font-geist text-sm text-noble-black/55">Rating</dt>
                <dd class="font-geist text-sm font-medium text-noble-black">
                  {{ item.rating.toFixed(1) }}
                </dd>
              </div>
              <div
                class="flex items-center justify-between gap-4 border-b border-cinnamon-ice/60 pb-4"
              >
                <dt class="font-geist text-sm text-noble-black/55">Bookings</dt>
                <dd class="font-geist text-sm font-medium text-noble-black">
                  {{ item.bookingCount }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-4">
                <dt class="font-geist text-sm text-noble-black/55">Replacement cost</dt>
                <dd class="font-geist text-sm font-medium text-noble-black">
                  {{ replacementCostLabel }}
                </dd>
              </div>
            </dl>
          </div>

          <div class="rounded-[28px] bg-white p-8 shadow-[0_20px_60px_rgba(77,61,44,0.08)]">
            <p class="font-geist text-xs uppercase tracking-[0.2em] text-noble-black/45">
              Availability
            </p>

            <ul v-if="item.availability.length" class="mt-4 space-y-3">
              <li
                v-for="slot in item.availability"
                :key="slot.id"
                class="rounded-[18px] bg-cream px-4 py-3"
              >
                <p class="font-geist text-sm font-medium text-noble-black">
                  {{ new Date(slot.startDate).toLocaleDateString() }} -
                  {{ new Date(slot.endDate).toLocaleDateString() }}
                </p>
                <p class="mt-1 font-geist text-xs uppercase tracking-[0.18em] text-noble-black/45">
                  {{ slot.status }}
                </p>
              </li>
            </ul>

            <p v-else class="mt-4 font-geist text-sm text-noble-black/65">
              No availability windows listed yet.
            </p>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>
