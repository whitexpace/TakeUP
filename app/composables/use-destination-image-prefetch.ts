import type { ListedItem } from "../types/item-listing"
import { setBoundedMapEntry } from "../utils/bounded-cache"

type DestinationImageMetadata = {
  src?: string
  srcset?: string
  sizes?: string
  alt?: string
  loading?: "eager" | "lazy"
}

type DestinationImagePrefetchResponse = {
  images?: DestinationImageMetadata[]
}

const ITEM_ID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_DESTINATION_IMAGE_METADATA_ENTRIES = 96
const MAX_DESTINATION_ITEM_SHELL_CACHE_ENTRIES = 64
const MAX_WARMED_DESTINATION_IMAGES = 96
const metadataCache = new Map<
  string,
  Promise<DestinationImageMetadata[]> | DestinationImageMetadata[]
>()
const itemShellCache = new Map<string, unknown | null>()
const pendingItemShellRequests = new Map<string, Promise<unknown | null>>()
const warmedImages = new Map<string, HTMLImageElement>()

const normalizeSameOriginPath = (target: string) => {
  if (!import.meta.client) return null

  try {
    const url = new URL(target, window.location.origin)
    if (url.origin !== window.location.origin) return null
    return url.pathname
  } catch {
    return null
  }
}

const fetchDestinationImages = (path: string) => {
  const cached = metadataCache.get(path)
  if (cached) {
    return Promise.resolve(cached)
  }

  const pending = $fetch<DestinationImagePrefetchResponse>(`/api/prefetch-images${path}`)
    .then((response) => {
      const images = Array.isArray(response.images) ? response.images : []
      setBoundedMapEntry(metadataCache, path, images, MAX_DESTINATION_IMAGE_METADATA_ENTRIES)
      return images
    })
    .catch((error: unknown) => {
      metadataCache.delete(path)
      throw error
    })

  setBoundedMapEntry(metadataCache, path, pending, MAX_DESTINATION_IMAGE_METADATA_ENTRIES)
  return pending
}

const extractItemIdFromPath = (path: string) => {
  const slug = path.split("/").filter(Boolean)[1] ?? ""
  const match = slug.match(ITEM_ID_PATTERN)
  return match ? match[0] : null
}

const seedNuxtItemData = (itemId: string, data: unknown) => {
  const key = `item:${itemId}`
  const nuxtApp = useNuxtApp() as typeof useNuxtApp extends () => infer T
    ? T & {
        static?: { data?: Record<string, unknown> }
        _asyncData?: Record<
          string,
          {
            data: { value: unknown }
            error: { value: unknown }
            pending?: { value: boolean }
            status: { value: string }
          }
        >
      }
    : never

  nuxtApp.payload.data[key] = data

  if (nuxtApp.static?.data) {
    nuxtApp.static.data[key] = data
  }

  const asyncData = nuxtApp._asyncData?.[key]
  if (asyncData) {
    asyncData.data.value = data
    asyncData.error.value = undefined
    if (asyncData.pending) {
      asyncData.pending.value = false
    }
    asyncData.status.value = "success"
  }
}

const buildListedItemShell = (item: ListedItem) => ({
  ...item,
  lenderRating: item.lenderRating ?? item.rating ?? 0,
  lenderBookingCount: item.lenderBookingCount ?? 0,
  lenderAvatarUrl: item.lenderAvatarUrl ?? null,
  bookingBlocks: [],
  reviews: [],
  reviewsCount: 0,
})

export const seedPrefetchedItemDetail = (itemId: string, data: unknown | null) => {
  setBoundedMapEntry(itemShellCache, itemId, data, MAX_DESTINATION_ITEM_SHELL_CACHE_ENTRIES)

  if (data) {
    seedNuxtItemData(itemId, data)
  }
}

export const getPrefetchedItemDetail = <T = unknown>(itemId: string) => {
  return itemShellCache.get(itemId) as T | null | undefined
}

export const hasPrefetchedItemDetail = (itemId: string) => itemShellCache.has(itemId)

export const prefetchDestinationItemData = (path: string, item?: ListedItem | null) => {
  const itemId = extractItemIdFromPath(path)
  if (!itemId) return Promise.resolve(null)

  if (item) {
    seedPrefetchedItemDetail(itemId, buildListedItemShell(item))
  }

  const pending = pendingItemShellRequests.get(itemId)
  if (pending) {
    return pending
  }

  const request = $fetch<unknown | null>(`/api/items/${itemId}/prefetch`, {
    credentials: "same-origin",
  })
    .then((data) => {
      seedPrefetchedItemDetail(itemId, data)

      return data
    })
    .catch((error: unknown) => {
      if (!itemShellCache.has(itemId)) {
        itemShellCache.delete(itemId)
      }
      throw error
    })
    .finally(() => {
      if (pendingItemShellRequests.get(itemId) === request) {
        pendingItemShellRequests.delete(itemId)
      }
    })

  pendingItemShellRequests.set(itemId, request)
  return request
}

const warmImages = (images: DestinationImageMetadata[]) => {
  for (const image of images) {
    if (image.loading === "lazy") continue

    const key = image.srcset || image.src
    if (!key || warmedImages.has(key)) continue

    const browserImage = new Image()
    const priorityImage = browserImage as HTMLImageElement & {
      fetchPriority?: "high" | "low" | "auto"
    }

    browserImage.decoding = "async"
    browserImage.alt = image.alt ?? ""

    if ("fetchPriority" in priorityImage) {
      priorityImage.fetchPriority = "low"
    }

    if (image.sizes) {
      browserImage.sizes = image.sizes
    }

    if (image.srcset) {
      browserImage.srcset = image.srcset
    }

    if (image.src) {
      browserImage.src = image.src
    }

    setBoundedMapEntry(warmedImages, key, browserImage, MAX_WARMED_DESTINATION_IMAGES)
  }
}

export const useDestinationImagePrefetch = () => {
  const warmDestination = (target: string | null | undefined, item?: ListedItem | null) => {
    if (!target) return

    const path = normalizeSameOriginPath(target)
    if (!path) return

    void preloadRouteComponents(path).catch(() => {})
    void prefetchDestinationItemData(path, item).catch(() => {})
    void fetchDestinationImages(path)
      .then(warmImages)
      .catch(() => {})
  }

  return {
    warmDestination,
    warmDestinationImages: warmDestination,
  }
}
