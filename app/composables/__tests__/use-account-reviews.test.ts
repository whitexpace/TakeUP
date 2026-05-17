import { ref } from "vue"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useAccountReviews } from "../use-account-reviews"

vi.mock("#app", () => ({
  useState: (key: string, init: () => unknown) =>
    (
      globalThis as unknown as {
        useState: (stateKey: string, stateInit: () => unknown) => ReturnType<typeof ref>
      }
    ).useState(key, init),
}))

vi.mock("../use-account-prefetch", () => ({
  useAccountPrefetch: () => ({
    warmAccount: vi.fn().mockResolvedValue(undefined),
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

describe("useAccountReviews", () => {
  beforeEach(() => {
    vi.stubGlobal("useState", createStateMock())
    vi.stubGlobal("navigateTo", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("fetches completed review transactions and reuses the cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      transactions: [{ id: "txn-1", reviewState: { canSubmitAny: true, actions: [] } }],
      nextCursor: null,
    })
    vi.stubGlobal("$fetch", fetchMock)

    const { transactionsData, fetchReviewTransactions } = useAccountReviews()

    await fetchReviewTransactions()
    await fetchReviewTransactions()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("/api/transactions", {
      query: {
        status: "COMPLETED",
        limit: 10,
      },
      credentials: "same-origin",
    })
    expect(transactionsData.value?.transactions).toHaveLength(1)
  })

  it("fetches secondary review data separately from pending transactions", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/my-reviews/drafts") {
        return Promise.resolve({ items: [{ id: "draft-1" }], nextCursor: null })
      }
      if (url === "/api/my-reviews/submitted") {
        return Promise.resolve({ items: [{ id: "review-1" }], nextCursor: null })
      }
      if (url === "/api/reviews/leaderboard/borrowers") {
        return Promise.resolve({ leaderboard: [{ userId: "borrower-1" }] })
      }
      if (url === "/api/reviews/leaderboard/lenders") {
        return Promise.resolve({ leaderboard: [{ userId: "lender-1" }] })
      }
      return Promise.resolve({})
    })
    vi.stubGlobal("$fetch", fetchMock)

    const { draftsData, historyData, leaderboardData, fetchSecondaryReviewsData } =
      useAccountReviews()

    await fetchSecondaryReviewsData()

    expect(fetchMock).toHaveBeenCalledWith("/api/my-reviews/drafts", {
      query: {
        limit: 10,
      },
      credentials: "same-origin",
    })
    expect(fetchMock).toHaveBeenCalledWith("/api/my-reviews/submitted", {
      query: {
        limit: 10,
      },
      credentials: "same-origin",
    })
    expect(fetchMock).toHaveBeenCalledWith("/api/reviews/leaderboard/borrowers", {
      credentials: "same-origin",
    })
    expect(fetchMock).toHaveBeenCalledWith("/api/reviews/leaderboard/lenders", {
      credentials: "same-origin",
    })
    expect(draftsData.value?.items).toHaveLength(1)
    expect(historyData.value?.items).toHaveLength(1)
    expect(leaderboardData.value?.borrowers).toHaveLength(1)
    expect(leaderboardData.value?.lenders).toHaveLength(1)
  })
})
