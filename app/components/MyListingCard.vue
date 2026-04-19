<script setup lang="ts">
import type { MyListingItem } from "../composables/use-my-listings"

const props = defineProps<{
  item: MyListingItem
  isToggling?: boolean
}>()

const emit = defineEmits<{
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

const hasActiveBoost = computed(() => props.item.hasActiveBoost)
const boostLabel = computed(() => (hasActiveBoost.value ? "Boost Active" : "Boost 50 pts"))
</script>

<template>
  <ItemCard v-bind="cardProps">
    <template #image-overlay>
      <!-- Dark blurred overlay with a smooth fade-in transition -->
      <div
        class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-noble-black/70 px-4 backdrop-blur-sm transition-opacity duration-300 ease-in-out opacity-0 group-hover:opacity-100"
      >
        <!-- Edit Button (Primary) -->
        <NuxtLink
          :to="`/account/listings/${item.id}/edit`"
          class="w-full max-w-[140px] rounded-full bg-burning-orange py-2 text-center font-geist text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:bg-burning-orange/90 active:scale-95 cursor-pointer"
          @click.stop
        >
          Edit Listing
        </NuxtLink>

        <button
          :disabled="hasActiveBoost"
          class="w-full max-w-[140px] rounded-full bg-blue-estate py-2 text-center font-geist text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:bg-blue-estate/90 active:scale-95 disabled:cursor-not-allowed disabled:bg-blue-estate/40"
          @click.stop="emit('boostListing', item.id)"
        >
          {{ boostLabel }}
        </button>
      </div>

      <div
        v-if="hasActiveBoost"
        class="absolute left-3 top-3 z-20 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
      >
        Boosted
      </div>
    </template>
  </ItemCard>
</template>
