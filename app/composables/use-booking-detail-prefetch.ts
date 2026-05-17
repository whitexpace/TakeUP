import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../server/trpc/routers"

type RouterOutputs = inferRouterOutputs<AppRouter>
type BookingDetail = NonNullable<RouterOutputs["booking"]["byId"]>

const BOOKING_ID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_WARMED_BOOKING_IMAGE_URLS = 80
const MAX_CONCURRENT_BOOKING_DETAIL_PREFETCHES = 2
const BOOKING_DETAIL_PREFETCH_DELAY_MS = 60

type BookingDetailPrefetchOptions = {
  immediate?: boolean
  priority?: boolean
}

type PendingBookingDetailRequest = {
  bookingId: string
  controller?: AbortController
  reject: (reason?: unknown) => void
  resolve: (value: BookingDetail | null) => void
  priority: boolean
  promise: Promise<BookingDetail | null>
  sequence: number
  state: "queued" | "running"
}

const bookingDetailCache = new Map<string, BookingDetail>()
const pendingBookingDetailRequests = new Map<string, PendingBookingDetailRequest>()
const warmedBookingImageUrls = new Set<string>()
let activeBookingDetailPrefetches = 0
let bookingDetailPrefetchSequence = 0
let bookingDetailPrefetchTimer: ReturnType<typeof setTimeout> | null = null

const extractBookingId = (target: string) => {
  const directMatch = target.match(BOOKING_ID_PATTERN)
  if (directMatch && directMatch[0] === target) return directMatch[0]

  if (!import.meta.client) return null

  try {
    const url = new URL(target, window.location.origin)
    if (url.origin !== window.location.origin) return null

    const segments = url.pathname.split("/").filter(Boolean)
    if (segments.length !== 3 || segments[0] !== "account" || segments[1] !== "transactions") {
      return null
    }

    const match = segments[2]?.match(BOOKING_ID_PATTERN)
    return match ? match[0] : null
  } catch {
    return null
  }
}

const seedNuxtBookingData = (bookingId: string, data: BookingDetail) => {
  const key = `booking:${bookingId}`
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

const warmBookingImage = (src: string | null | undefined) => {
  if (!import.meta.client || !src || warmedBookingImageUrls.has(src)) return

  if (warmedBookingImageUrls.size >= MAX_WARMED_BOOKING_IMAGE_URLS) {
    const oldestUrl = warmedBookingImageUrls.values().next().value
    if (oldestUrl) warmedBookingImageUrls.delete(oldestUrl)
  }

  const browserImage = new Image()
  const priorityImage = browserImage as HTMLImageElement & {
    fetchPriority?: "high" | "low" | "auto"
  }

  browserImage.decoding = "async"
  if ("fetchPriority" in priorityImage) {
    priorityImage.fetchPriority = "low"
  }
  browserImage.src = src
  warmedBookingImageUrls.add(src)
}

export const seedPrefetchedBookingDetail = (bookingId: string, data: BookingDetail) => {
  if (!import.meta.client) return

  bookingDetailCache.set(bookingId, data)
  seedNuxtBookingData(bookingId, data)
  warmBookingImage(data.item.thumbnailImage)
}

export const getPrefetchedBookingDetail = <T = BookingDetail>(bookingId: string) => {
  if (!import.meta.client) return undefined
  return bookingDetailCache.get(bookingId) as T | undefined
}

export const hasPrefetchedBookingDetail = (bookingId: string) =>
  import.meta.client && bookingDetailCache.has(bookingId)

export const clearPrefetchedBookingDetail = (bookingId: string) => {
  if (!import.meta.client) return
  bookingDetailCache.delete(bookingId)

  const pending = pendingBookingDetailRequests.get(bookingId)
  pending?.controller?.abort()
  pendingBookingDetailRequests.delete(bookingId)
  if (pending?.state === "queued") {
    pending.resolve(null)
  }
}

const getNextQueuedBookingDetailRequest = () => {
  return [...pendingBookingDetailRequests.values()]
    .filter((pending) => pending.state === "queued")
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority ? -1 : 1
      }

      return right.sequence - left.sequence
    })[0]
}

const scheduleBookingDetailQueue = (delay = BOOKING_DETAIL_PREFETCH_DELAY_MS) => {
  if (bookingDetailPrefetchTimer !== null && delay > 0) {
    return
  }

  if (bookingDetailPrefetchTimer !== null) {
    clearTimeout(bookingDetailPrefetchTimer)
  }

  bookingDetailPrefetchTimer = setTimeout(() => {
    bookingDetailPrefetchTimer = null
    pumpBookingDetailQueue()
  }, delay)
}

const startBookingDetailRequest = (pending: PendingBookingDetailRequest) => {
  if (pending.state !== "queued") return

  pending.state = "running"
  pending.controller = new AbortController()
  activeBookingDetailPrefetches += 1

  const fetchOptions = {
    credentials: "same-origin" as const,
    signal: pending.controller.signal,
    priority: pending.priority ? "high" : "low",
  } as {
    credentials: RequestCredentials
    priority?: "high" | "low" | "auto"
    signal: AbortSignal
  }

  void $fetch<BookingDetail>(`/api/bookings/${pending.bookingId}`, fetchOptions)
    .then((data) => {
      if (pendingBookingDetailRequests.get(pending.bookingId) === pending) {
        seedPrefetchedBookingDetail(pending.bookingId, data)
      }
      pending.resolve(data)
    })
    .catch((error: unknown) => {
      if (pending.controller?.signal.aborted) {
        pending.resolve(null)
        return
      }

      pending.reject(error)
    })
    .finally(() => {
      activeBookingDetailPrefetches = Math.max(0, activeBookingDetailPrefetches - 1)

      if (pendingBookingDetailRequests.get(pending.bookingId) === pending) {
        pendingBookingDetailRequests.delete(pending.bookingId)
      }

      scheduleBookingDetailQueue(0)
    })
}

function pumpBookingDetailQueue() {
  while (activeBookingDetailPrefetches < MAX_CONCURRENT_BOOKING_DETAIL_PREFETCHES) {
    const nextRequest = getNextQueuedBookingDetailRequest()
    if (!nextRequest) return

    startBookingDetailRequest(nextRequest)
  }
}

export const prefetchBookingDetail = (
  target: string | null | undefined,
  options: BookingDetailPrefetchOptions = {},
) => {
  if (!import.meta.client || !target) return Promise.resolve(null)

  const bookingId = extractBookingId(target)
  if (!bookingId) return Promise.resolve(null)

  void preloadRouteComponents(`/account/transactions/${bookingId}`).catch(() => {})

  const cached = bookingDetailCache.get(bookingId)
  if (cached) {
    warmBookingImage(cached.item.thumbnailImage)
    return Promise.resolve(cached)
  }

  const pending = pendingBookingDetailRequests.get(bookingId)
  if (pending) {
    pending.priority = pending.priority || Boolean(options.priority)
    pending.sequence = ++bookingDetailPrefetchSequence
    if (options.immediate && pending.state === "queued") {
      startBookingDetailRequest(pending)
    } else if (pending.state === "queued") {
      scheduleBookingDetailQueue()
    }
    return pending.promise
  }

  let resolvePromise!: (value: BookingDetail | null) => void
  let rejectPromise!: (reason?: unknown) => void
  const request = new Promise<BookingDetail | null>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  const queuedRequest: PendingBookingDetailRequest = {
    bookingId,
    reject: rejectPromise,
    resolve: resolvePromise,
    priority: Boolean(options.priority),
    promise: request,
    sequence: ++bookingDetailPrefetchSequence,
    state: "queued",
  }

  pendingBookingDetailRequests.set(bookingId, queuedRequest)

  if (options.immediate) {
    startBookingDetailRequest(queuedRequest)
  } else {
    scheduleBookingDetailQueue()
  }

  return request
}

export const useBookingDetailPrefetch = () => {
  return {
    warmBookingDetail: prefetchBookingDetail,
  }
}
