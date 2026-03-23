<script setup lang="ts">
import type { MyListingItem } from "../composables/use-my-listings"

const props = defineProps<{
  item: MyListingItem
  isToggling?: boolean
}>()

const emit = defineEmits<{
  toggleStatus: [id: string, status: "AVAILABLE" | "DEACTIVATED"]
}>()

const typeBadge = computed(() => {
  if (props.item.freeToBorrow) return { label: "Borrow", class: "bg-indigo-900 text-orange-50" }
  return { label: "Rent", class: "bg-red-300 text-neutral-800" }
})

const statusLabel = computed(() => {
  switch (props.item.status) {
    case "AVAILABLE":
      return "ACTIVE"
    case "RENTED":
      return "IN USE"
    case "DEACTIVATED":
      return "INACTIVE"
    default:
      return props.item.status
  }
})

const priceDisplay = computed(() => {
  if (props.item.freeToBorrow) return "₱Free"
  const rate = props.item.rateOption === "PER_HOUR" ? "/hr" : "/day"
  return `₱${props.item.rentalFee.toLocaleString()}${rate}`
})

const primaryCategory = computed(() =>
  props.item.categories.length > 0 ? props.item.categories[0] : "OTHER",
)

const formattedCategory = computed(() =>
  String(primaryCategory.value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase()),
)

const canToggle = computed(() => props.item.status !== "RENTED")
const toggleLabel = computed(() =>
  props.item.status === "DEACTIVATED" ? "Activate" : "Deactivate",
)
const toggleTarget = computed<"AVAILABLE" | "DEACTIVATED">(() =>
  props.item.status === "DEACTIVATED" ? "AVAILABLE" : "DEACTIVATED",
)

const coverImage = computed(
  () =>
    props.item.images.find((image) => image.isPrimary)?.path ??
    props.item.images[0]?.path ??
    props.item.thumbnailImage ??
    "https://placehold.co/289x200",
)
</script>

<template>
  <div
    class="flex flex-col rounded-[20px] overflow-hidden border border-orange-500/30 bg-white hover:shadow-md transition-shadow duration-200"
  >
    <!-- Image with type badge -->
    <div class="relative">
      <img :src="coverImage" :alt="item.name" class="w-full h-40 sm:h-48 object-cover" />
      <span
        class="absolute top-2 left-2 px-2 py-0.5 rounded-md text-sm font-normal font-geist tracking-wide"
        :class="typeBadge.class"
      >
        {{ typeBadge.label }}
      </span>
    </div>

    <!-- Card Info -->
    <div class="p-3 flex flex-col gap-1 flex-1">
      <!-- Category + Status row -->
      <div class="flex justify-between items-center">
        <span class="text-orange-500 text-xs font-medium font-geist uppercase">{{
          formattedCategory
        }}</span>
        <span class="text-indigo-900 text-xs font-medium font-geist">{{ statusLabel }}</span>
      </div>

      <!-- Item name -->
      <p class="text-blue-950 text-sm sm:text-base font-semibold font-geist line-clamp-1">
        {{ item.name }}
      </p>

      <!-- Rating row -->
      <div class="flex items-center gap-1">
        <span class="w-2.5 h-2.5 bg-orange-500 inline-block" />
        <span class="text-neutral-800/80 text-xs font-medium font-geist">{{
          item.rating.toFixed(1)
        }}</span>
        <span class="text-neutral-800/60 text-xs font-light font-geist"
          >({{ item.bookingCount }})</span
        >
      </div>

      <!-- Divider -->
      <hr class="border-red-300/50 my-1" />

      <!-- Price -->
      <p class="text-orange-500 text-base sm:text-lg font-bold font-geist">{{ priceDisplay }}</p>

      <!-- Action buttons -->
      <div class="flex gap-2 mt-2">
        <NuxtLink
          :to="`/account/listings/${item.id}/edit`"
          class="flex-1 py-1.5 text-center text-sm font-medium font-geist text-white bg-indigo-900 rounded-lg hover:bg-indigo-800 transition-colors"
        >
          Edit
        </NuxtLink>
        <button
          :disabled="!canToggle || isToggling"
          class="flex-1 py-1.5 text-sm font-medium font-geist rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :class="
            item.status === 'DEACTIVATED'
              ? 'text-white bg-burning-orange hover:bg-orange-600'
              : 'text-neutral-800 border border-neutral-300 hover:bg-neutral-50'
          "
          @click="emit('toggleStatus', item.id, toggleTarget)"
        >
          {{ isToggling ? "..." : toggleLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
