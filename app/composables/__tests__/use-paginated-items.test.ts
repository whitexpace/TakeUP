import { ref } from "vue"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetPaginatedItemsCache, usePaginatedItems } from "../use-paginated-items"
import type { ListedItem, PaginatedItemsResponse } from "../../types/item-listing"

vi.mock("#app", () => ({
  useState: (key: string, init: () => unknown) =>
    (
      globalThis as unknown as {
        useState: (stateKey: string, stateInit: () => unknown) => ReturnType<typeof ref>
      }
    ).useState(key, init),
}))

vi.mock("../use-viewer-session", () => ({
  useViewerSession: () => ({
    session: { value: null },
    getAccessToken: vi.fn().mockResolvedValue(undefined),
  }),
}))

const createStateMock = () => {
  const store = new Map<string, ReturnType<typeof ref>>()

  return (key: string, init: () => unknown) => {
    if (!store.has(key)) {
      store.set(key, ref(init()))
    }

    return store.get(key)!
  }
}

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

const makeItem = (id: string, overrides: Partial<ListedItem> = {}): ListedItem => ({
  id,
  name: `Item ${id}`,
  description: null,
  condition: "GOOD",
  status: "AVAILABLE",
  rateOption: "PER_DAY",
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  rentalFee: 100,
  replacementCost: null,
  freeToBorrow: false,
  availability: [],
  whatItemOffers: null,
  whatIsIncluded: null,
  knownIssues: null,
  usageLimitations: null,
  images: [],
  thumbnailImage: null,
  photos: [],
  isTrending: false,
  viewCount: 0,
  bookingCount: 0,
  likeCount: 0,
  boostScore: 0,
  rating: 4,
  lenderId: "lender-1",
  ownerName: "lender-1",
  categories: ["ELECTRONICS"],
  tags: [],
  ...overrides,
})

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe("usePaginatedItems", () => {
  beforeEach(() => {
    vi.stubGlobal("useState", createStateMock())
  })

  afterEach(() => {
    resetPaginatedItemsCache()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("passes search and filter params to the items API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
    } satisfies PaginatedItemsResponse)
    vi.stubGlobal("$fetch", fetchMock)

    const searchQuery = ref("camera")
    const filterParams = ref<Record<string, string | undefined>>({
      freeToBorrow: "true",
      minRating: "4",
    })

    const paginatedItems = usePaginatedItems({ searchQuery, filterParams })
    await paginatedItems.refresh()

    expect(fetchMock).toHaveBeenCalledWith("/api/items", {
      query: expect.objectContaining({
        limit: 12,
        search: "camera",
        freeToBorrow: "true",
        minRating: "4",
      }),
    })
  })

  it("deduplicates items returned across pages", async () => {
    const repeatedItem = makeItem("11111111-1111-1111-1111-111111111111", { bookingCount: 2 })
    const uniqueItem = makeItem("22222222-2222-2222-2222-222222222222", { bookingCount: 1 })

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        items: [repeatedItem],
        nextCursor: {
          version: 1,
          scanExhausted: true,
          scanCursor: null,
          pendingIds: [uniqueItem.id],
        },
      } satisfies PaginatedItemsResponse)
      .mockResolvedValueOnce({
        items: [repeatedItem, uniqueItem],
        nextCursor: null,
      } satisfies PaginatedItemsResponse)
    vi.stubGlobal("$fetch", fetchMock)

    const paginatedItems = usePaginatedItems({ searchQuery: ref(""), filterParams: ref({}) })

    await paginatedItems.refresh()
    await paginatedItems.fetchNextPage()

    expect(paginatedItems.items.value).toHaveLength(2)
    expect(new Set(paginatedItems.items.value.map((item) => item.id))).toEqual(
      new Set([repeatedItem.id, uniqueItem.id]),
    )
  })

  it("preserves server-provided feed order instead of re-ranking on the client", async () => {
    const lowerRankedFirst = makeItem("11111111-1111-1111-1111-111111111111", { bookingCount: 1 })
    const higherRankedSecond = makeItem("22222222-2222-2222-2222-222222222222", { bookingCount: 9 })
    const fetchMock = vi.fn().mockResolvedValue({
      items: [lowerRankedFirst, higherRankedSecond],
      nextCursor: null,
    } satisfies PaginatedItemsResponse)
    vi.stubGlobal("$fetch", fetchMock)

    const paginatedItems = usePaginatedItems({ searchQuery: ref(""), filterParams: ref({}) })

    await paginatedItems.refresh()

    expect(paginatedItems.items.value.map((item) => item.id)).toEqual([
      lowerRankedFirst.id,
      higherRankedSecond.id,
    ])
  })

  it("ignores stale responses from older refresh calls", async () => {
    const firstResponse = createDeferred<PaginatedItemsResponse>()
    const secondResponse = createDeferred<PaginatedItemsResponse>()

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => firstResponse.promise)
      .mockImplementationOnce(() => secondResponse.promise)
    vi.stubGlobal("$fetch", fetchMock)

    const searchQuery = ref("camera")
    const paginatedItems = usePaginatedItems({ searchQuery, filterParams: ref({}) })

    const firstRefresh = paginatedItems.refresh()
    searchQuery.value = "tripod"
    const secondRefresh = paginatedItems.refresh()

    secondResponse.resolve({
      items: [makeItem("22222222-2222-2222-2222-222222222222")],
      nextCursor: null,
    })
    await secondRefresh

    firstResponse.resolve({
      items: [makeItem("11111111-1111-1111-1111-111111111111")],
      nextCursor: null,
    })
    await flushPromises()

    expect(paginatedItems.items.value.map((item) => item.id)).toEqual([
      "22222222-2222-2222-2222-222222222222",
    ])

    await firstRefresh
  })

  it("reuses cached responses for identical dashboard item queries", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      items: [makeItem("33333333-3333-3333-3333-333333333333")],
      nextCursor: null,
    } satisfies PaginatedItemsResponse)
    vi.stubGlobal("$fetch", fetchMock)

    const firstPaginatedItems = usePaginatedItems({
      searchQuery: ref("camera"),
      filterParams: ref({ minRating: "4" }),
    })
    await firstPaginatedItems.refresh()

    const secondPaginatedItems = usePaginatedItems({
      searchQuery: ref("camera"),
      filterParams: ref({ minRating: "4" }),
    })
    await secondPaginatedItems.refresh()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(secondPaginatedItems.items.value.map((item) => item.id)).toEqual([
      "33333333-3333-3333-3333-333333333333",
    ])
  })

  it("deduplicates identical in-flight dashboard item queries", async () => {
    const response = createDeferred<PaginatedItemsResponse>()
    const fetchMock = vi.fn().mockImplementation(() => response.promise)
    vi.stubGlobal("$fetch", fetchMock)

    const firstPaginatedItems = usePaginatedItems({
      searchQuery: ref("camera"),
      filterParams: ref({ minRating: "4" }),
    })
    const secondPaginatedItems = usePaginatedItems({
      searchQuery: ref("camera"),
      filterParams: ref({ minRating: "4" }),
    })

    const firstRefresh = firstPaginatedItems.refresh()
    const secondRefresh = secondPaginatedItems.refresh()

    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    response.resolve({
      items: [makeItem("44444444-4444-4444-4444-444444444444")],
      nextCursor: null,
    })

    await Promise.all([firstRefresh, secondRefresh])

    expect(firstPaginatedItems.items.value.map((item) => item.id)).toEqual([
      "44444444-4444-4444-4444-444444444444",
    ])
    expect(secondPaginatedItems.items.value.map((item) => item.id)).toEqual([
      "44444444-4444-4444-4444-444444444444",
    ])
  })

  it("persists cursor state for keyed lists across re-instantiation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        items: [makeItem("11111111-1111-1111-1111-111111111111")],
        nextCursor: {
          version: 1,
          scanExhausted: true,
          scanCursor: null,
          pendingIds: [],
        },
      } satisfies PaginatedItemsResponse)
      .mockResolvedValueOnce({
        items: [makeItem("22222222-2222-2222-2222-222222222222")],
        nextCursor: null,
      } satisfies PaginatedItemsResponse)
    vi.stubGlobal("$fetch", fetchMock)

    const firstInstance = usePaginatedItems({
      searchQuery: ref(""),
      filterParams: ref({}),
      stateKey: "dashboard-items-test",
    })
    await firstInstance.refresh()

    const secondInstance = usePaginatedItems({
      searchQuery: ref(""),
      filterParams: ref({}),
      stateKey: "dashboard-items-test",
    })
    await secondInstance.fetchNextPage()

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/items",
      expect.objectContaining({
        query: expect.objectContaining({
          cursor: JSON.stringify({
            version: 1,
            scanExhausted: true,
            scanCursor: null,
            pendingIds: [],
          }),
        }),
      }),
    )
  })
})
