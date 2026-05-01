<template>
  <div
    class="bg-white rounded-[15px] sm:rounded-[20px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.08)] flex flex-col h-full hover:shadow-lg transition-shadow duration-300 w-full min-w-[260px] max-w-[360px] mx-auto relative group"
    :class="canNavigate ? 'cursor-pointer' : ''"
    @click="navigateToDetails"
  >
    <!-- Image Section (~70% of card) -->
    <div class="relative aspect-square w-full bg-gray-50">
      <img v-if="image" :src="image" :alt="name" class="w-full h-full object-cover" />
      <div
        v-else
        class="flex h-full w-full items-center justify-center bg-cream px-6 text-center font-geist text-[14px] font-medium text-noble-black/45"
      >
        No image uploaded
      </div>

      <!-- Type Tag -->
      <div
        class="absolute top-2 sm:top-4 left-2 sm:left-4 px-2 sm:px-4 py-1 sm:py-1.5 min-w-[50px] sm:min-w-[80px] h-[24px] sm:h-[32px] rounded-full font-geist text-[11px] sm:text-[15px] font-normal tracking-wide flex items-center justify-center shadow-sm whitespace-nowrap"
        :class="topBadge.className"
      >
        {{ topBadge.label }}
      </div>

      <div
        v-if="!isManagement"
        class="absolute top-2 sm:top-4 right-2 sm:right-4 flex items-center gap-1.5 sm:gap-2"
      >
        <!-- Like Button -->
        <button
          class="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-all duration-150 group active:scale-90"
          title="Favorite"
          :aria-pressed="isLiked"
          @click.stop="toggleLike"
        >
          <svg
            class="w-4 h-4 sm:w-5 sm:h-5 transition-colors duration-150"
            :class="
              isLiked
                ? 'fill-cinnabar-red/90 stroke-cinnabar-red/90'
                : 'stroke-noble-black group-hover:fill-noble-black/10'
            "
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>

      <!-- Management Overlay Slot -->
      <slot name="image-overlay" />
    </div>

    <!-- Details Section -->
    <div class="p-3 sm:p-5 flex-1 flex flex-col bg-white">
      <div
        class="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-1.5 min-w-0 font-geist font-medium text-[11px] sm:text-[13px] uppercase tracking-wide"
      >
        <div class="text-burning-orange min-w-0 truncate">
          {{ category }}
        </div>

        <template v-if="isTrending">
          <span class="h-1 w-1 shrink-0 rounded-full bg-noble-black/30" aria-hidden="true" />
          <span class="inline-flex shrink-0 items-center gap-1 text-blue-estate normal-case">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M4 16L10 10L14 14L20 8"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M14 8H20V14"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span>Trending</span>
          </span>
        </template>
      </div>

      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-1 sm:gap-2">
        <h3
          class="font-geist font-semibold text-[14px] sm:text-[17px] text-noble-black leading-tight truncate w-full"
        >
          {{ name }}
        </h3>
        <div class="flex items-center gap-1 shrink-0 sm:pt-0.5">
          <svg
            class="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-burning-orange"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
            />
          </svg>
          <span
            class="font-geist font-medium text-[11px] sm:text-[13px] text-noble-black opacity-80"
            >{{ rating }}</span
          >
          <span class="font-geist font-light text-[11px] sm:text-[13px] text-noble-black opacity-60"
            >({{ reviews }})</span
          >
        </div>
      </div>

      <div class="mt-auto">
        <div v-if="price" class="flex items-baseline gap-1">
          <span class="font-geist font-bold text-[15px] sm:text-[19px] text-burning-orange"
            >₱{{ price }}</span
          >
          <span
            class="font-geist font-normal text-[12px] sm:text-[15px] text-noble-black opacity-70"
            >/{{ displayPriceUnit }}</span
          >
        </div>
      </div>
    </div>

    <!-- Divider -->
    <div v-if="!isManagement" class="h-[1px] bg-cinnamon-ice/30 w-full"></div>

    <!-- Owner Section -->
    <div v-if="!isManagement" class="px-3 py-2 sm:px-5 sm:py-4 flex items-center bg-white">
      <span
        class="font-geist font-normal text-[12px] sm:text-[15px] text-noble-black opacity-80 truncate"
        >by {{ owner }}</span
      >
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

const topBadge = computed(() => {
  if (normalizedStatus.value === "RENTED") {
    return {
      label: props.type === "Borrow" ? "Borrowed" : "Rented",
      className: "bg-noble-black/90 text-white",
    }
  }

  if (normalizedStatus.value && normalizedStatus.value !== "AVAILABLE") {
    return {
      label: "Unavailable",
      className: "bg-white/90 text-noble-black border border-noble-black/10",
    }
  }

  return {
    label: props.type,
    className:
      props.type === "Rent" ? "bg-cinnamon-ice text-noble-black" : "bg-blue-estate text-white",
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
    // Check if user is authenticated via Supabase
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

      // Update global count
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

    // Log more details about the error
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
