import { computed, onMounted } from "vue"
import { usePersistedSessionState } from "./use-persisted-session-state"
import { recordPerfEvent, withPerfTimer } from "../utils/performance-telemetry"
import { useViewerSession } from "./use-viewer-session"

export interface BagItem {
  id: string
  itemId: string
  name: string
  price: number
  priceUnit: "hour" | "day"
  image: string
  startAt: Date
  endAt: Date
  startDate: Date | null
  endDate: Date | null
  startTime: string
  endTime: string
  lenderId: string
  lenderName: string
  lenderAvatarUrl?: string | null
  listingType: "Rent" | "Borrow"
  createdAt: Date
}

type AddToBagInput = {
  itemId: string
  startAt: Date
  endAt: Date
}

type RawBagItem = Omit<
  BagItem,
  "startAt" | "endAt" | "startDate" | "endDate" | "startTime" | "endTime" | "createdAt"
> & {
  startAt: Date | string
  endAt: Date | string
  createdAt: Date | string
}

type CartListResponse = {
  items: RawBagItem[]
}

let pendingLoad: Promise<void> | null = null
let bagMutationVersion = 0
let activeLoadId = 0
const BAG_CACHE_TTL_MS = 30_000

const formatTimeLabel = (value: Date) =>
  value.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })

const normalizeBagItem = (item: RawBagItem): BagItem => {
  const startAt = item.startAt instanceof Date ? item.startAt : new Date(item.startAt)
  const endAt = item.endAt instanceof Date ? item.endAt : new Date(item.endAt)
  const createdAt = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt)

  return {
    ...item,
    startAt,
    endAt,
    startDate: startAt,
    endDate: endAt,
    startTime: formatTimeLabel(startAt),
    endTime: formatTimeLabel(endAt),
    lenderAvatarUrl: item.lenderAvatarUrl ?? null,
    createdAt,
  }
}

const markBagMutation = () => {
  bagMutationVersion += 1
}

export const useBag = () => {
  const bagItems = usePersistedSessionState<BagItem[]>("bag-items", () => [], {
    deserialize: (value) => JSON.parse(value).map(normalizeBagItem),
  })
  const isLoading = useState<boolean>("bag-loading", () => false)
  const hasLoaded = usePersistedSessionState<boolean>("bag-loaded", () => false)
  const errorMessage = usePersistedSessionState<string | null>("bag-error-message", () => null)
  const lastLoadedAt = usePersistedSessionState<number | null>("bag-last-loaded-at", () => null)
  const { getAuthHeaders } = useViewerSession()

  const loadBag = async (options: { force?: boolean } = {}) => {
    if (pendingLoad && !options.force) {
      await pendingLoad
      return
    }

    const isCacheFresh =
      hasLoaded.value &&
      lastLoadedAt.value !== null &&
      Date.now() - lastLoadedAt.value < BAG_CACHE_TTL_MS

    if (isCacheFresh && !options.force) {
      recordPerfEvent("bag", "cart", "cache-hit")
      return
    }

    if (hasLoaded.value && !options.force) {
      recordPerfEvent("bag", "cart", "cache-stale")
    } else if (options.force) {
      recordPerfEvent("bag", "cart", "cache-bypass")
    } else {
      recordPerfEvent("bag", "cart", "cache-miss")
    }

    const loadMutationVersion = bagMutationVersion
    activeLoadId += 1
    const loadId = activeLoadId
    pendingLoad = (async () => {
      isLoading.value = true

      try {
        const headers = await getAuthHeaders()
        const result = await withPerfTimer("bag", "cart", () =>
          $fetch<CartListResponse>("/api/cart", { headers }),
        )
        if (loadMutationVersion !== bagMutationVersion) return

        bagItems.value = result.items.map(normalizeBagItem)
        errorMessage.value = null
        lastLoadedAt.value = Date.now()
      } catch (error: unknown) {
        if (loadMutationVersion !== bagMutationVersion) return

        const statusCode = (error as { statusCode?: number })?.statusCode

        if (statusCode === 401) {
          bagItems.value = []
          errorMessage.value = null
          lastLoadedAt.value = Date.now()
          return
        }

        if (statusCode === 403) {
          bagItems.value = []
          errorMessage.value = "You are not authorized to use the bag."
          lastLoadedAt.value = Date.now()
          return
        }

        errorMessage.value = "Unable to load your bag right now."
      } finally {
        if (loadMutationVersion === bagMutationVersion) {
          hasLoaded.value = true
        }

        if (activeLoadId === loadId) {
          isLoading.value = false
          pendingLoad = null
        }
      }
    })()

    await pendingLoad
  }

  const addToBag = async (input: AddToBagInput) => {
    const headers = await getAuthHeaders()
    const entry = await $fetch<RawBagItem>("/api/cart", {
      method: "POST",
      body: {
        itemId: input.itemId,
        startAt: input.startAt.toISOString(),
        endAt: input.endAt.toISOString(),
      },
      headers,
    })

    const normalizedEntry = normalizeBagItem(entry)
    markBagMutation()
    const existingIndex = bagItems.value.findIndex((item) => item.id === normalizedEntry.id)

    if (existingIndex === -1) {
      bagItems.value = [normalizedEntry, ...bagItems.value]
    } else {
      bagItems.value.splice(existingIndex, 1, normalizedEntry)
    }

    hasLoaded.value = true
    errorMessage.value = null
    lastLoadedAt.value = Date.now()

    return normalizedEntry
  }

  const removeFromBag = async (id: string) => {
    const headers = await getAuthHeaders()

    await $fetch(`/api/cart/${id}`, {
      method: "DELETE",
      headers,
    })

    markBagMutation()
    bagItems.value = bagItems.value.filter((item) => item.id !== id)
    lastLoadedAt.value = Date.now()
  }

  const hasItemWithWindow = (itemId: string, startAt: Date, endAt: Date) =>
    bagItems.value.some(
      (item) =>
        item.itemId === itemId &&
        item.startAt.getTime() === startAt.getTime() &&
        item.endAt.getTime() === endAt.getTime(),
    )

  onMounted(() => {
    void loadBag()
  })

  return {
    bagItems,
    isLoading,
    errorMessage,
    bagCount: computed(() => bagItems.value.length),
    addToBag,
    removeFromBag,
    loadBag,
    hasItemWithWindow,
  }
}
