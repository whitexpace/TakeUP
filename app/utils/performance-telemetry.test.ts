import { afterEach, describe, expect, it } from "vitest"
import { recordPerfEvent } from "./performance-telemetry"

type TestPerfSummary = {
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

type TestPerfStore = {
  events: Array<unknown>
  summary: Record<string, TestPerfSummary>
}

const PERF_STORE_KEY = "__UPERF__"
const MAX_SUMMARIES = 200

const getPerfStore = () =>
  (globalThis as unknown as Record<string, TestPerfStore | undefined>)[PERF_STORE_KEY]

const clearPerfStore = () => {
  Reflect.deleteProperty(globalThis as Record<string, unknown>, PERF_STORE_KEY)
}

describe("performance telemetry", () => {
  afterEach(() => {
    clearPerfStore()
  })

  it("keeps the summary store bounded", () => {
    for (let index = 0; index < MAX_SUMMARIES + 1; index += 1) {
      recordPerfEvent("scope", `key-${index}`, "cache-hit")
    }

    const store = getPerfStore()
    expect(store).toBeDefined()
    expect(Object.keys(store!.summary)).toHaveLength(MAX_SUMMARIES)
    expect(store!.summary["scope:key-0"]).toBeUndefined()
    expect(store!.summary[`scope:key-${MAX_SUMMARIES}`]).toBeDefined()
  })

  it("updates the same summary entry instead of creating duplicates", () => {
    recordPerfEvent("scope", "key", "cache-hit")
    recordPerfEvent("scope", "key", "cache-miss")
    recordPerfEvent("scope", "key", "network-request", { durationMs: 25 })

    const store = getPerfStore()
    expect(store).toBeDefined()
    expect(Object.keys(store!.summary)).toHaveLength(1)
    expect(store!.summary["scope:key"]).toMatchObject({
      hits: 1,
      misses: 1,
      requests: 1,
      totalRequestMs: 25,
    })
  })
})
