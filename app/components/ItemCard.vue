<template>
  <div
    class="bg-white rounded-[14px] border border-cinnamon-ice/20 flex flex-col h-full hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-300 w-full xs:min-w-[210px] max-w-[280px] mx-auto relative group"
    :class="canNavigate ? 'cursor-pointer' : ''"
    @pointerenter="warmLinkedDestination"
    @focusin="warmLinkedDestination"
    @touchstart.passive="warmLinkedDestination"
    @click="handleCardClick"
  >
    <NuxtLink
      v-if="optimizedNavigation"
      :to="linkTarget"
      :prefetch-on="{ interaction: true }"
      :aria-label="`View ${name}`"
      class="absolute inset-0 z-20 rounded-[14px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-burning-orange"
      @pointerenter="warmLinkedDestination"
      @focus="warmLinkedDestination"
      @mousedown="startMouseDownNavigation"
    />

    <!-- Image Section (Compact: 180px) -->
    <div class="relative h-[140px] xs:h-[180px] w-full bg-noble-black/5 rounded-t-[14px]">
      <!-- Dedicated container for image scale & rounded top -->
      <div class="absolute inset-0 overflow-hidden rounded-t-[14px]">
        <img
          v-if="image"
          :src="image"
          :alt="name"
          width="280"
          height="180"
          :loading="imageLoading"
          :fetchpriority="imageFetchPriority"
          decoding="async"
          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div
          v-else
          class="flex h-full w-full items-center justify-center bg-cream px-6 text-center font-geist text-[12px] font-medium text-noble-black/45"
        >
          No image uploaded
        </div>
      </div>

      <!-- Rent/Borrow Badge (Modern Solid Style) -->
      <div
        class="absolute top-[10px] left-[10px] z-10 px-2 py-1 rounded-[6px] font-geist text-[10px] font-bold uppercase tracking-[0.5px] shadow-sm whitespace-nowrap"
        :class="topBadge.className"
      >
        {{ topBadge.label }}
      </div>

      <div v-if="!isManagement" class="absolute top-[10px] right-[10px] z-30">
        <!-- Like Button (Blurred Circle) -->
        <div class="relative group/tooltip">
          <button
            class="w-8 h-8 rounded-full bg-white/90 backdrop-blur-[4px] shadow-[0_2px_6px_rgba(0,0,0,0.1)] flex items-center justify-center transition-all duration-200 active:scale-90 group/heart"
            :aria-label="isLiked ? 'Unlike' : 'Like'"
            :aria-pressed="isLiked"
            @click.stop="toggleLike"
          >
            <Icon
              :name="isLiked ? 'ph:heart-fill' : 'ph:heart'"
              class="w-4 h-4 transition-all duration-200 shrink-0"
              :class="
                isLiked
                  ? 'text-burning-orange scale-110'
                  : 'text-noble-black group-hover/heart:text-burning-orange'
              "
            />
          </button>

          <!-- Navbar-style Tooltip -->
          <div class="card-tooltip">
            Like
            <div class="tooltip-arrow"></div>
          </div>
        </div>
      </div>

      <!-- Management Overlay Slot -->
      <slot name="image-overlay" />
    </div>

    <!-- Content Area (Tightened: 12px padding) -->
    <div class="p-3 flex-1 flex flex-col justify-between bg-white min-h-0 rounded-b-[14px]">
      <!-- Row 1: Category & Trending -->
      <div class="flex items-center justify-between gap-2 mb-1 min-w-0">
        <div
          class="text-[9px] xs:text-[11px] font-bold text-burning-orange truncate uppercase tracking-wider"
        >
          {{ category }}
        </div>

        <div v-if="isTrending" class="relative group/tooltip shrink-0 flex items-center">
          <Icon
            name="ph:trend-up"
            class="w-3.5 h-3.5 text-blue-estate shrink-0 -translate-y-[0.5px]"
          />
          <!-- Navbar-style Tooltip -->
          <div class="card-tooltip">
            Trending
            <div class="tooltip-arrow"></div>
          </div>
        </div>
      </div>

      <!-- Row 2: Item Name (14px truncated) -->
      <h3
        class="text-[13px] xs:text-[14px] font-light text-noble-black leading-tight truncate mb-2"
      >
        {{ name }}
      </h3>

      <!-- Row 3: Price & Rating (Unified Row) -->
      <div class="flex items-center justify-between gap-2 mt-auto">
        <div class="flex items-center gap-1 min-w-0">
          <span class="text-[14px] xs:text-[15px] font-bold text-burning-orange leading-none"
            >₱{{ price }}</span
          >
          <span class="text-[10px] xs:text-[11px] font-light text-noble-black/40 leading-none"
            >/{{ displayPriceUnit }}</span
          >
        </div>

        <!-- Refined Rating -->
        <div
          v-if="hasGoodRating && !isManagement"
          class="flex items-center gap-1.5 xs:gap-2 shrink-0"
        >
          <Icon
            name="ph:star-fill"
            class="w-3 xs:w-3.5 h-3 xs:h-3.5 text-burning-orange shrink-0 -translate-y-[0.5px]"
          />
          <span class="text-[12px] xs:text-[13px] font-light text-noble-black leading-none">{{
            rating
          }}</span>
          <span class="text-[11px] xs:text-[12px] font-light text-noble-black/50 leading-none"
            >({{ reviews }})</span
          >
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import type { ListedItem } from "../types/item-listing"
import { buildItemDetailPath } from "../utils/item-detail-route"
import {
  clearPaginatedItemsState,
  resetPaginatedItemsCache,
} from "../composables/use-paginated-items"
import { clearPersistedSessionState } from "../composables/use-persisted-session-state"
import { useLikes } from "../composables/use-likes"

type CardImageLoading = "eager" | "lazy"
type CardImageFetchPriority = "high" | "low" | "auto"

const props = withDefaults(
  defineProps<{
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
    enableDestinationPrefetch?: boolean
    imageLoading?: CardImageLoading
    imageFetchPriority?: CardImageFetchPriority
    startNavigationOnMouseDown?: boolean
    prefetchItem?: ListedItem | null
  }>(),
  {
    status: undefined,
    price: undefined,
    priceUnit: undefined,
    ownerUsername: undefined,
    fromPage: undefined,
    customPath: undefined,
    enableDestinationPrefetch: false,
    imageLoading: "lazy",
    imageFetchPriority: "auto",
    startNavigationOnMouseDown: false,
    prefetchItem: null,
  },
)
const emit = defineEmits<{
  likeChanged: [payload: { itemId: string; isLiked: boolean }]
}>()

const { incrementLikes, decrementLikes } = useLikes()
const { warmDestination } = useDestinationImagePrefetch()
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
const optimizedNavigation = computed(() => canNavigate.value && props.enableDestinationPrefetch)
const linkTarget = computed(() => {
  if (props.fromPage) {
    return {
      path: itemDetailPath.value,
      query: { from: props.fromPage },
    }
  }

  return itemDetailPath.value
})

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

  router.push(linkTarget.value)
}

const handleCardClick = () => {
  if (optimizedNavigation.value) return
  navigateToDetails()
}

const warmLinkedDestination = () => {
  if (!optimizedNavigation.value) return
  warmDestination(itemDetailPath.value, props.prefetchItem)
}

const startMouseDownNavigation = (event: MouseEvent) => {
  warmLinkedDestination()

  if (
    !optimizedNavigation.value ||
    !props.startNavigationOnMouseDown ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return
  }

  void router.push(linkTarget.value)
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

      // Selective clearing/updating of session state
      if (props.fromPage === "likes") {
        clearPaginatedItemsState("dashboard-listed-items")
        clearPersistedSessionState("dashboard-results-count")
      } else {
        clearPaginatedItemsState("likes-listed-items")

        // Surgically update the dashboard list if we're on the dashboard
        // This ensures the shaded icon persists after navigation without a flicker-inducing clear.
        const dashboardItems = useState<ListedItem[]>("dashboard-listed-items")
        if (dashboardItems.value) {
          const itemIdx = dashboardItems.value.findIndex((i) => String(i.id) === String(props.id))
          if (itemIdx !== -1 && dashboardItems.value[itemIdx]) {
            dashboardItems.value[itemIdx].isLiked = nextIsLiked
          }
        }
      }

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

/* Custom Tooltip Styling (Mirrored from Header.vue) */
.card-tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(6px);
  background-color: theme("colors.cream");
  color: theme("colors.noble-black");
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid theme("colors.cinnamon-ice / 40%");
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease,
    visibility 0.2s;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.tooltip-arrow {
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-bottom: 4px solid theme("colors.cinnamon-ice / 40%");
}

.tooltip-arrow::after {
  content: "";
  position: absolute;
  top: 1px;
  left: -4px;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-bottom: 4px solid theme("colors.cream");
}

.group\/tooltip:hover .card-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(10px);
}
</style>
