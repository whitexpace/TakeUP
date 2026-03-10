import { ref } from "vue"
import { afterEach, describe, expect, it, vi } from "vitest"
import { resetPaginatedItemsCache, usePaginatedItems } from "../use-paginated-items"
import type { ListedItem, PaginatedItemsResponse } from "../../types/item-listing"

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
  thumbnailImage: null,
  photos: [],
  isTrending: false,
  viewCount: 0,
  bookingCount: 0,
  likeCount: 0,
  rating: 4,
  lenderId: "lender-1",
  borrowerId: null,
  categories: ["ELECTRONICS"],
  tags: [],
  ...overrides,
})

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe("usePaginatedItems", () => {
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
          id: repeatedItem.id,
          bookingCount: repeatedItem.bookingCount,
          createdAt: repeatedItem.createdAt,
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
})
