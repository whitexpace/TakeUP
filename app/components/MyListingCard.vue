<script setup lang="ts">
import type { MyListingItem } from "../composables/use-my-listings"

const props = defineProps<{
  item: MyListingItem
  isToggling?: boolean
}>()

const emit = defineEmits<{
  toggleStatus: [id: string, status: "AVAILABLE" | "DEACTIVATED"]
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
  }
})

function formatCategory(category: string) {
  return category
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

const isInUse = computed(() => props.item.displayStatus === "IN_USE")
const isDeactivated = computed(() => props.item.status === "DEACTIVATED")

const toggleLabel = computed(() => (isDeactivated.value ? "Activate" : "Deactivate"))
const toggleTarget = computed<"AVAILABLE" | "DEACTIVATED">(() =>
  isDeactivated.value ? "AVAILABLE" : "DEACTIVATED",
)
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
          class="w-full max-w-[140px] rounded-full bg-burning-orange py-2 text-center font-geist text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:bg-burning-orange/90 active:scale-95"
          @click.stop
        >
          Edit Listing
        </NuxtLink>

        <!-- Deactivate/Activate Button -->
        <div class="relative group/tooltip w-full max-w-[140px]">
          <button
            :disabled="isInUse || isToggling"
            class="w-full rounded-full py-2 font-geist text-sm font-semibold shadow-lg transition-all duration-300 active:scale-95 disabled:cursor-not-allowed"
            :class="[
              isInUse
                ? 'bg-white/10 text-white/30 border border-white/10 backdrop-blur-sm'
                : 'bg-white text-noble-black hover:bg-cream',
              isDeactivated ? 'border-burning-orange text-burning-orange' : '',
            ]"
            @click.stop="emit('toggleStatus', item.id, toggleTarget)"
          >
            {{ isToggling ? "..." : toggleLabel }}
          </button>

          <!-- Contextual Tooltip for "In Use" state -->
          <div
            v-if="isInUse"
            class="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 rounded-lg bg-noble-black px-3 py-1.5 text-[11px] font-medium text-white opacity-0 transition-opacity duration-200 group-hover/tooltip:opacity-100 whitespace-nowrap z-30 shadow-xl border border-white/10"
          >
            Item is currently In Use
            <!-- Tooltip arrow -->
            <div
              class="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-noble-black border-r border-b border-white/10"
            />
          </div>
        </div>
      </div>
    </template>
  </ItemCard>
</template>
