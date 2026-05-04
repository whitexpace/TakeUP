<script setup lang="ts">
import type { MyListingItem } from "../composables/use-my-listings"

const props = defineProps<{
  item: MyListingItem
  isToggling?: boolean
}>()

const emit = defineEmits<{
  toggleStatus: [id: string, status: "AVAILABLE" | "DEACTIVATED"]
  boostListing: [itemId: string]
}>()

const cardProps = computed(() => {
  const image =
    props.item.images.find((image) => image.isPrimary)?.path ??
    props.item.images[0]?.path ??
    props.item.thumbnailImage ??
    "https://placehold.co/289x200"

  return {
    id: props.item.id,
    type: (props.item.freeToBorrow ? "Borrow" : "Rent") as "Borrow" | "Rent",
    status: props.item.status,
    image,
    category: formatCategory(props.item.categories[0] ?? "OTHER"),
    name: props.item.name,
    rating: props.item.rating.toFixed(1),
    reviews: props.item.bookingCount,
    price: props.item.freeToBorrow ? undefined : props.item.rentalFee,
    priceUnit: (props.item.rateOption === "PER_HOUR" ? "hour" : "day") as "hour" | "day",
    owner: "You",
    isManagement: true,
    allowNavigation: true,
    customPath: `/account/listings/${props.item.id}/edit`,
  }
})

function formatCategory(category: string) {
  return category
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

const boostExpiresAt = computed(() => {
  if (!props.item.boostExpiresAt) {
    return null
  }

  const value =
    props.item.boostExpiresAt instanceof Date
      ? props.item.boostExpiresAt
      : new Date(props.item.boostExpiresAt)

  return Number.isNaN(value.getTime()) ? null : value
})
const hasActiveBoost = computed(() => {
  if (!boostExpiresAt.value) {
    return false
  }

  return boostExpiresAt.value.getTime() > Date.now()
})
const isBoostEligible = computed(
  () => props.item.displayStatus === "ACTIVE" && !hasActiveBoost.value,
)
const boostLabel = computed(() => {
  if (hasActiveBoost.value) {
    return "Boost Active"
  }

  if (!isBoostEligible.value) {
    return "Boost Unavailable"
  }

  return "Boost 50 pts"
})
</script>

<template>
  <ItemCard v-bind="cardProps" class="group/mcard">
    <template #image-overlay>
      <!-- Dark blurred overlay with a smooth fade-in transition -->
      <div
        class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2.5 bg-noble-black/75 px-5 backdrop-blur-[2px] transition-all duration-300 ease-in-out opacity-0 group-hover/mcard:opacity-100"
      >
        <!-- Edit Button (Primary) -->
        <NuxtLink
          :to="`/account/listings/${item.id}/edit`"
          class="w-full h-10 flex items-center justify-center rounded-[10px] bg-gradient-to-br from-burning-orange to-orange-500 text-[13px] font-bold text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
          @click.stop
        >
          Edit Listing
        </NuxtLink>

        <button
          :disabled="!isBoostEligible || isToggling"
          class="w-full h-10 flex items-center justify-center rounded-[10px] bg-blue-estate text-[13px] font-bold text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:bg-blue-estate/30 disabled:hover:translate-y-0"
          @click.stop="emit('boostListing', item.id)"
        >
          {{ boostLabel }}
        </button>
      </div>

      <div
        v-if="hasActiveBoost"
        class="absolute right-3 top-3 z-20 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-500/30 flex items-center gap-1"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="4"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m5 12 5 5L20 7" />
        </svg>
        Boosted
      </div>
    </template>
  </ItemCard>
</template>
