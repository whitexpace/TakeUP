import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../server/trpc/routers"

type RouterOutputs = inferRouterOutputs<AppRouter>
type DisputeDetail = RouterOutputs["dispute"]["byId"]

const DISPUTE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DISPUTE_ID_PATH_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_WARMED_DISPUTE_IMAGE_URLS = 80
const MAX_CONCURRENT_DISPUTE_DETAIL_PREFETCHES = 2
const DISPUTE_DETAIL_PREFETCH_DELAY_MS = 60

type DisputeDetailPrefetchOptions = {
  immediate?: boolean
  priority?: boolean
}

type PendingDisputeDetailRequest = {
  controller?: AbortController
  disputeId: string
  priority: boolean
  promise: Promise<DisputeDetail | null>
  reject: (reason?: unknown) => void
  resolve: (value: DisputeDetail | null) => void
  sequence: number
  state: "queued" | "running"
}

const disputeDetailCache = new Map<string, DisputeDetail>()
const pendingDisputeDetailRequests = new Map<string, PendingDisputeDetailRequest>()
const warmedDisputeImageUrls = new Set<string>()
let activeDisputeDetailPrefetches = 0
let disputeDetailPrefetchSequence = 0
let disputeDetailPrefetchTimer: ReturnType<typeof setTimeout> | null = null

const extractDisputeId = (target: string) => {
  if (DISPUTE_ID_PATTERN.test(target)) return target

  if (!import.meta.client) return null

  try {
    const url = new URL(target, window.location.origin)
    if (url.origin !== window.location.origin) return null

    const queryDisputeId = url.searchParams.get("dispute")
    if (queryDisputeId && DISPUTE_ID_PATTERN.test(queryDisputeId)) return queryDisputeId

    if (url.pathname.startsWith("/api/disputes/")) {
      const match = url.pathname.match(DISPUTE_ID_PATH_PATTERN)
      return match ? match[0] : null
    }
  } catch {
    return null
  }

  return null
}

const seedNuxtDisputeData = (disputeId: string, data: DisputeDetail) => {
  const key = `admin:dispute:${disputeId}`
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

const warmDisputeImage = (src: string | null | undefined) => {
  if (!import.meta.client || !src || warmedDisputeImageUrls.has(src)) return

  if (warmedDisputeImageUrls.size >= MAX_WARMED_DISPUTE_IMAGE_URLS) {
    const oldestUrl = warmedDisputeImageUrls.values().next().value
    if (oldestUrl) warmedDisputeImageUrls.delete(oldestUrl)
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
  warmedDisputeImageUrls.add(src)
}

const warmDisputeDetailImages = (data: DisputeDetail) => {
  warmDisputeImage(data.item?.thumbnailImage)
  warmDisputeImage(data.rebuttalImageUrl)
}

export const seedPrefetchedDisputeDetail = (disputeId: string, data: DisputeDetail) => {
  if (!import.meta.client) return

  disputeDetailCache.set(disputeId, data)
  seedNuxtDisputeData(disputeId, data)
  warmDisputeDetailImages(data)
}

export const getPrefetchedDisputeDetail = <T = DisputeDetail>(disputeId: string) => {
  if (!import.meta.client) return undefined
  return disputeDetailCache.get(disputeId) as T | undefined
}

export const clearPrefetchedDisputeDetail = (disputeId: string) => {
  if (!import.meta.client) return

  disputeDetailCache.delete(disputeId)

  const pending = pendingDisputeDetailRequests.get(disputeId)
  pending?.controller?.abort()
  pendingDisputeDetailRequests.delete(disputeId)
  if (pending?.state === "queued") {
    pending.resolve(null)
  }
}

const getNextQueuedDisputeDetailRequest = () => {
  return [...pendingDisputeDetailRequests.values()]
    .filter((pending) => pending.state === "queued")
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority ? -1 : 1
      }

      return right.sequence - left.sequence
    })[0]
}

const scheduleDisputeDetailQueue = (delay = DISPUTE_DETAIL_PREFETCH_DELAY_MS) => {
  if (disputeDetailPrefetchTimer !== null && delay > 0) {
    return
  }

  if (disputeDetailPrefetchTimer !== null) {
    clearTimeout(disputeDetailPrefetchTimer)
  }

  disputeDetailPrefetchTimer = setTimeout(() => {
    disputeDetailPrefetchTimer = null
    pumpDisputeDetailQueue()
  }, delay)
}

const startDisputeDetailRequest = (pending: PendingDisputeDetailRequest) => {
  if (pending.state !== "queued") return

  pending.state = "running"
  pending.controller = new AbortController()
  activeDisputeDetailPrefetches += 1

  const fetchOptions = {
    credentials: "same-origin" as const,
    signal: pending.controller.signal,
    priority: pending.priority ? "high" : "low",
  } as {
    credentials: RequestCredentials
    priority?: "high" | "low" | "auto"
    signal: AbortSignal
  }

  void $fetch<DisputeDetail>(`/api/disputes/${pending.disputeId}`, fetchOptions)
    .then((data) => {
      if (pendingDisputeDetailRequests.get(pending.disputeId) === pending) {
        seedPrefetchedDisputeDetail(pending.disputeId, data)
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
      activeDisputeDetailPrefetches = Math.max(0, activeDisputeDetailPrefetches - 1)

      if (pendingDisputeDetailRequests.get(pending.disputeId) === pending) {
        pendingDisputeDetailRequests.delete(pending.disputeId)
      }

      scheduleDisputeDetailQueue(0)
    })
}

function pumpDisputeDetailQueue() {
  while (activeDisputeDetailPrefetches < MAX_CONCURRENT_DISPUTE_DETAIL_PREFETCHES) {
    const nextRequest = getNextQueuedDisputeDetailRequest()
    if (!nextRequest) return

    startDisputeDetailRequest(nextRequest)
  }
}

export const prefetchDisputeDetail = (
  target: string | null | undefined,
  options: DisputeDetailPrefetchOptions = {},
) => {
  if (!import.meta.client || !target) return Promise.resolve(null)

  const disputeId = extractDisputeId(target)
  if (!disputeId) return Promise.resolve(null)

  const cached = disputeDetailCache.get(disputeId)
  if (cached) {
    warmDisputeDetailImages(cached)
    return Promise.resolve(cached)
  }

  const pending = pendingDisputeDetailRequests.get(disputeId)
  if (pending) {
    pending.priority = pending.priority || Boolean(options.priority)
    pending.sequence = ++disputeDetailPrefetchSequence
    if (pending.state === "queued") {
      scheduleDisputeDetailQueue(options.immediate ? 0 : DISPUTE_DETAIL_PREFETCH_DELAY_MS)
    }
    return pending.promise
  }

  let resolvePromise!: (value: DisputeDetail | null) => void
  let rejectPromise!: (reason?: unknown) => void
  const request = new Promise<DisputeDetail | null>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  const queuedRequest: PendingDisputeDetailRequest = {
    disputeId,
    priority: Boolean(options.priority),
    promise: request,
    reject: rejectPromise,
    resolve: resolvePromise,
    sequence: ++disputeDetailPrefetchSequence,
    state: "queued",
  }

  pendingDisputeDetailRequests.set(disputeId, queuedRequest)
  scheduleDisputeDetailQueue(options.immediate ? 0 : DISPUTE_DETAIL_PREFETCH_DELAY_MS)

  return request
}

export const useDisputeDetailPrefetch = () => {
  return {
    warmDisputeDetail: prefetchDisputeDetail,
  }
}
