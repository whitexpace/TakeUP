<template>
  <div
    class="bg-white rounded-[14px] overflow-hidden border border-[#F0EDE8] flex flex-col h-full hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-300 w-full min-w-[220px] max-w-[260px] mx-auto relative group"
    :class="canNavigate ? 'cursor-pointer' : ''"
    @click="navigateToDetails"
  >
    <!-- Image Section (Compact: 180px) -->
    <div class="relative h-[180px] w-full bg-gray-50 overflow-hidden rounded-t-[12px]">
      <img
        v-if="image"
        :src="image"
        :alt="name"
        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div
        v-else
        class="flex h-full w-full items-center justify-center bg-cream px-6 text-center font-geist text-[12px] font-medium text-noble-black/45"
      >
        No image uploaded
      </div>

      <!-- Rent/Borrow Badge (Modern Solid Style) -->
      <div
        class="absolute top-[10px] left-[10px] z-10 px-2 py-1 rounded-[6px] font-geist text-[10px] font-bold uppercase tracking-[0.5px] shadow-sm whitespace-nowrap"
        :class="topBadge.className"
      >
        {{ topBadge.label }}
      </div>

      <div v-if="!isManagement" class="absolute top-[10px] right-[10px] z-10">
        <!-- Favorite Button (Blurred Circle) -->
        <button
          class="w-8 h-8 rounded-full bg-white/90 backdrop-blur-[4px] shadow-[0_2px_6px_rgba(0,0,0,0.1)] flex items-center justify-center transition-all duration-200 active:scale-90 group/heart"
          title="Favorite"
          :aria-pressed="isLiked"
          @click.stop="toggleLike"
        >
          <svg
            class="w-4 h-4 transition-all duration-200"
            :class="
              isLiked
                ? 'fill-burning-orange stroke-burning-orange scale-110'
                : 'stroke-noble-black group-hover/heart:fill-burning-orange/20 group-hover/heart:stroke-burning-orange'
            "
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>

      <!-- Management Overlay Slot -->
      <slot name="image-overlay" />
    </div>

    <!-- Content Area (Tightened: 12px padding) -->
    <div class="p-3 flex-1 flex flex-col justify-between bg-white min-h-0">
      <!-- Row 1: Category & Trending -->
      <div class="flex items-center justify-between gap-2 mb-1 min-w-0">
        <div class="text-[11px] font-bold text-burning-orange truncate uppercase tracking-wider">
          {{ category }}
        </div>

        <div v-if="isTrending" class="group/trending relative shrink-0 flex items-center">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class="text-blue-estate"
          >
            <path
              d="M22 7L13.5 15.5L8.5 10.5L2 17"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M16 7H22V13"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <!-- Custom Tooltip -->
          <div
            class="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-noble-black px-2 py-1 text-[10px] font-bold text-white opacity-0 shadow-lg transition-opacity group-hover/trending:opacity-100 z-30"
          >
            Trending
            <div
              class="absolute -bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rotate-45 bg-noble-black"
            />
          </div>
        </div>
      </div>

      <!-- Row 2: Item Name (14px truncated) -->
      <h3 class="text-[14px] font-semibold text-noble-black leading-tight truncate mb-2">
        {{ name }}
      </h3>

      <!-- Row 3: Price & Rating (Unified Row) -->
      <div class="flex items-center justify-between gap-2 mt-auto">
        <div class="flex items-center gap-1 min-w-0">
          <span class="text-[15px] font-bold text-burning-orange">₱{{ price }}</span>
          <span class="text-[11px] font-medium text-noble-black/40">/{{ displayPriceUnit }}</span>
        </div>

        <!-- Refined Rating -->
        <div v-if="hasGoodRating" class="flex items-center gap-1 shrink-0">
          <span class="text-[13px] text-[#E8650A]">★</span>
          <span class="text-[13px] font-semibold text-[#111]">{{ rating }}</span>
          <span class="text-[12px] font-normal text-[#9CA3AF]">({{ reviews }})</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { buildItemDetailPath } from "../utils/item-detail-route"
import { resetPaginatedItemsCache } from "../composables/use-paginated-items"
import { useLikes } from "../composables/use-likes"

const props = defineProps<{
  id: string | number
  type: "Rent" | "Borrow"
  status?: string
  isTrending?: boolean
  image: string | null
  category: string
  name: string
  rating: number | string
  reviews: number | string
  price?: string | number
  priceUnit?: "hour" | "day"
  owner: string
  ownerUsername?: string
  isLiked?: boolean
  fromPage?: "likes" | "dashboard"
  isManagement?: boolean
  allowNavigation?: boolean
  customPath?: string
}>()
const emit = defineEmits<{
  likeChanged: [payload: { itemId: string; isLiked: boolean }]
}>()

const { incrementLikes, decrementLikes } = useLikes()
const isLiked = ref(Boolean(props.isLiked))
const isTogglingLike = ref(false)
const router = useRouter()

watch(
  () => props.isLiked,
  (nextValue) => {
    if (typeof nextValue === "boolean") {
      isLiked.value = nextValue
    }
  },
)

const itemDetailPath = computed(
  () =>
    props.customPath ||
    buildItemDetailPath({
      id: String(props.id),
      name: props.name,
    }),
)

const normalizedStatus = computed(() => props.status?.toUpperCase() ?? "")
const displayPriceUnit = computed(() => props.priceUnit ?? "day")
const canNavigate = computed(() => !props.isManagement || props.allowNavigation)

const hasGoodRating = computed(() => {
  const score = parseFloat(String(props.rating))
  return !isNaN(score) && score >= 3.0
})

const topBadge = computed(() => {
  if (normalizedStatus.value === "RENTED") {
    return {
      label: props.type === "Borrow" ? "Borrowed" : "Rented",
      className: "bg-noble-black text-white",
    }
  }

  if (normalizedStatus.value && normalizedStatus.value !== "AVAILABLE") {
    return {
      label: "Unavailable",
      className: "bg-white text-noble-black border border-noble-black/10",
    }
  }

  return {
    label: props.type,
    className: props.type === "Rent" ? "bg-cinnamon-ice text-black" : "bg-blue-estate text-white",
  }
})

const navigateToDetails = () => {
  if (!canNavigate.value) return

  if (props.fromPage) {
    router.push({
      path: itemDetailPath.value,
      query: { from: props.fromPage },
    })
    return
  }

  router.push(itemDetailPath.value)
}

const toggleLike = async () => {
  if (isTogglingLike.value) return

  let previousValue: boolean | null = null

  try {
    const user = useSupabaseUser()
    const supabase = useSupabaseClient()
    if (!user.value) {
      console.error("User not authenticated. Please log in first.")
      return
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (!accessToken) {
      console.error("No active Supabase session token found.")
      return
    }

    previousValue = isLiked.value
    isLiked.value = !previousValue
    isTogglingLike.value = true

    const response = await $fetch("/api/trpc/item.toggleLike", {
      method: "POST",
      body: {
        json: {
          itemId: String(props.id),
        },
      },
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    })

    const typedResponse = response as {
      result?: { data?: { isLiked?: boolean; json?: { isLiked?: boolean } } }
    }
    const nextIsLiked =
      typedResponse.result?.data?.isLiked ?? typedResponse.result?.data?.json?.isLiked

    if (typeof nextIsLiked === "boolean") {
      isLiked.value = nextIsLiked
      resetPaginatedItemsCache()

      if (nextIsLiked) {
        incrementLikes()
      } else {
        decrementLikes()
      }

      emit("likeChanged", {
        itemId: String(props.id),
        isLiked: nextIsLiked,
      })
    }
  } catch (error) {
    if (previousValue !== null) {
      isLiked.value = previousValue
    }

    if (error instanceof Error) {
      console.error("Failed to toggle like:", error.message)
    } else {
      console.error("Failed to toggle like:", error)
    }
  } finally {
    isTogglingLike.value = false
  }
}
</script>

<style scoped>
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
