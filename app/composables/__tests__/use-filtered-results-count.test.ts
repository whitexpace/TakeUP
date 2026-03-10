import { ref } from "vue"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  resetFilteredResultsCountCache,
  useFilteredResultsCount,
} from "../use-filtered-results-count"

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
}

const createDeferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })

  return { promise, resolve } satisfies Deferred<T>
}

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe("useFilteredResultsCount", () => {
  afterEach(() => {
    resetFilteredResultsCountCache()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("debounces scheduled refreshes and uses the latest filter state", async () => {
    vi.useFakeTimers()

    const fetchMock = vi.fn().mockResolvedValue({ count: 12 })
    vi.stubGlobal("$fetch", fetchMock)

    const searchQuery = ref("camera")
    const filterParams = ref<Record<string, string | undefined>>({ freeToBorrow: "true" })
    const resultsCount = useFilteredResultsCount({
      searchQuery,
      filterParams,
      debounceMs: 200,
    })

    resultsCount.scheduleResultsCountRefresh()
    await vi.advanceTimersByTimeAsync(199)
    expect(fetchMock).not.toHaveBeenCalled()

    filterParams.value = { freeToBorrow: "false", minRating: "4" }
    resultsCount.scheduleResultsCountRefresh()

    await vi.advanceTimersByTimeAsync(200)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("/api/items/count", {
      query: {
        search: "camera",
        freeToBorrow: "false",
        minRating: "4",
      },
    })
    expect(resultsCount.totalResultsCount.value).toBe(12)
  })

  it("ignores stale responses from older count requests", async () => {
    const firstResponse = createDeferred<{ count: number }>()
    const secondResponse = createDeferred<{ count: number }>()

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => firstResponse.promise)
      .mockImplementationOnce(() => secondResponse.promise)
    vi.stubGlobal("$fetch", fetchMock)

    const searchQuery = ref("camera")
    const filterParams = ref<Record<string, string | undefined>>({})
    const resultsCount = useFilteredResultsCount({ searchQuery, filterParams })

    const firstRefresh = resultsCount.refreshResultsCount()
    searchQuery.value = "tripod"
    const secondRefresh = resultsCount.refreshResultsCount()

    firstResponse.resolve({ count: 1 })
    await flushPromises()
    expect(resultsCount.totalResultsCount.value).toBeNull()

    secondResponse.resolve({ count: 2 })
    await secondRefresh

    expect(resultsCount.totalResultsCount.value).toBe(2)

    await firstRefresh
  })

  it("reuses cached counts for identical filter queries", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ count: 12 })
    vi.stubGlobal("$fetch", fetchMock)

    const firstResultsCount = useFilteredResultsCount({
      searchQuery: ref("camera"),
      filterParams: ref({ freeToBorrow: "true", minRating: "4" }),
    })
    await firstResultsCount.refreshResultsCount()

    const secondResultsCount = useFilteredResultsCount({
      searchQuery: ref("camera"),
      filterParams: ref({ freeToBorrow: "true", minRating: "4" }),
    })
    await secondResultsCount.refreshResultsCount()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(secondResultsCount.totalResultsCount.value).toBe(12)
  })
})
