type PerfEventType =
  | "persist-restore-hit"
  | "persist-restore-miss"
  | "persist-restore-error"
  | "persist-write"
  | "persist-clear"
  | "cache-hit"
  | "cache-miss"
  | "cache-stale"
  | "cache-bypass"
  | "request-dedup-hit"
  | "network-request"
  | "background-refresh"

type PerfEvent = {
  scope: string
  key: string
  type: PerfEventType
  durationMs?: number
  detail?: string
  at: string
}

type PerfSummary = {
  hits: number
  misses: number
  stale: number
  bypasses: number
  dedupHits: number
  persistRestores: number
  persistWrites: number
  requests: number
  totalRequestMs: number
  lastEventAt: string
}

type PerfStore = {
  events: PerfEvent[]
  summary: Record<string, PerfSummary>
  summaryKeys: string[]
  printSummary: () => void
}

const PERF_STORE_KEY = "__UPERF__"
const MAX_EVENTS = 500
const MAX_SUMMARIES = 200

const isPerfEnabled = () => import.meta.env.DEV || import.meta.env.MODE === "test"

const createEmptySummary = (): PerfSummary => ({
  hits: 0,
  misses: 0,
  stale: 0,
  bypasses: 0,
  dedupHits: 0,
  persistRestores: 0,
  persistWrites: 0,
  requests: 0,
  totalRequestMs: 0,
  lastEventAt: new Date(0).toISOString(),
})

const getPerfHost = () => {
  if (import.meta.client && typeof window !== "undefined") {
    return window as Window & { [PERF_STORE_KEY]?: PerfStore }
  }

  return globalThis as typeof globalThis & { [PERF_STORE_KEY]?: PerfStore }
}

const getPerfStore = (): PerfStore | null => {
  if (!isPerfEnabled()) {
    return null
  }

  const host = getPerfHost()
  if (!host[PERF_STORE_KEY]) {
    host[PERF_STORE_KEY] = {
      events: [],
      summary: {},
      summaryKeys: [],
      printSummary: () => {
        const currentStore = getPerfStore()
        if (!currentStore) {
          return
        }

        console.warn(
          "[perf-summary]",
          Object.entries(currentStore.summary).map(([metricKey, summary]) => ({
            metricKey,
            ...summary,
            averageRequestMs:
              summary.requests > 0
                ? Number((summary.totalRequestMs / summary.requests).toFixed(2))
                : 0,
          })),
        )
      },
    }
  }

  const store = host[PERF_STORE_KEY] ?? null
  if (!store) {
    return null
  }

  if (!Array.isArray(store.summaryKeys)) {
    store.summaryKeys = Object.keys(store.summary)
  }

  while (store.summaryKeys.length > MAX_SUMMARIES) {
    const evictedKey = store.summaryKeys.shift()
    if (evictedKey) {
      Reflect.deleteProperty(store.summary, evictedKey)
    }
  }

  return store
}

const storeSummary = (store: PerfStore, summaryKey: string, event: PerfEvent) => {
  let summary = store.summary[summaryKey]

  if (!summary) {
    if (store.summaryKeys.length >= MAX_SUMMARIES) {
      const evictedKey = store.summaryKeys.shift()
      if (evictedKey) {
        Reflect.deleteProperty(store.summary, evictedKey)
      }
    }

    summary = createEmptySummary()
    store.summary[summaryKey] = summary
    store.summaryKeys.push(summaryKey)
  }

  updateSummary(summary, event)
}

const updateSummary = (summary: PerfSummary, event: PerfEvent) => {
  summary.lastEventAt = event.at

  switch (event.type) {
    case "persist-restore-hit":
      summary.persistRestores += 1
      summary.hits += 1
      return
    case "persist-restore-miss":
      summary.misses += 1
      return
    case "persist-restore-error":
      summary.misses += 1
      return
    case "persist-write":
      summary.persistWrites += 1
      return
    case "persist-clear":
      summary.bypasses += 1
      return
    case "cache-hit":
      summary.hits += 1
      return
    case "cache-miss":
      summary.misses += 1
      return
    case "cache-stale":
      summary.stale += 1
      return
    case "cache-bypass":
      summary.bypasses += 1
      return
    case "request-dedup-hit":
      summary.dedupHits += 1
      return
    case "background-refresh":
      summary.bypasses += 1
      return
    case "network-request":
      summary.requests += 1
      summary.totalRequestMs += event.durationMs ?? 0
      return
  }
}

export const recordPerfEvent = (
  scope: string,
  key: string,
  type: PerfEventType,
  options: { durationMs?: number; detail?: string; log?: boolean } = {},
) => {
  const store = getPerfStore()
  if (!store) {
    return
  }

  const event: PerfEvent = {
    scope,
    key,
    type,
    durationMs: options.durationMs,
    detail: options.detail,
    at: new Date().toISOString(),
  }

  store.events.push(event)
  if (store.events.length > MAX_EVENTS) {
    store.events.shift()
  }

  const summaryKey = `${scope}:${key}`
  storeSummary(store, summaryKey, event)

  if (options.log) {
    const durationSuffix =
      typeof options.durationMs === "number" ? ` ${options.durationMs.toFixed(1)}ms` : ""
    const detailSuffix = options.detail ? ` ${options.detail}` : ""
    console.warn(`[perf] ${scope}:${key} ${type}${durationSuffix}${detailSuffix}`)
  }
}

export const withPerfTimer = async <T>(
  scope: string,
  key: string,
  run: () => Promise<T>,
  options: { detail?: string; log?: boolean } = {},
) => {
  if (!isPerfEnabled()) {
    return run()
  }

  const start = performance.now()
  const result = await run()
  recordPerfEvent(scope, key, "network-request", {
    durationMs: performance.now() - start,
    detail: options.detail,
    log: options.log,
  })
  return result
}
