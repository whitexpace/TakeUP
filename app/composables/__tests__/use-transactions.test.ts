import { ref } from "vue"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useTransactions } from "../use-transactions"
import type { TransactionStatus } from "#shared/schemas/transaction"

const BORROWER_USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const LENDER_USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const TX_ID_1 = "11111111-1111-1111-1111-111111111111"
const TX_ID_2 = "22222222-2222-2222-2222-222222222222"

const makeTx = (id: string, overrides = {}) => ({
  id,
  bookingId: "booking-1",
  itemId: "item-1",
  borrowerId: BORROWER_USER_ID,
  lenderId: LENDER_USER_ID,
  startDate: new Date("2026-04-01"),
  endDate: new Date("2026-04-03"),
  totalAmount: 500,
  status: "ACTIVE" as TransactionStatus,
  createdAt: new Date("2026-03-15"),
  updatedAt: new Date("2026-03-15"),
  item: {
    id: "item-1",
    name: "Camera",
    thumbnailImage: null,
    rateOption: "PER_DAY",
    rentalFee: 250,
    freeToBorrow: false,
  },
  borrower: {
    user: { username: "borrower1", firstName: "Juan", middleName: null, lastName: "Cruz" },
  },
  lender: {
    user: { username: "lender1", firstName: "Issa", middleName: null, lastName: "Santos" },
  },
  ...overrides,
})

let fetchMock = vi.fn().mockResolvedValue({ transactions: [], nextCursor: null })

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ transactions: [], nextCursor: null })
  vi.stubGlobal("$fetch", fetchMock)
  vi.stubGlobal("navigateTo", vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("useTransactions", () => {
  it("fetches transactions from /api/transactions with role and limit", async () => {
    const role = ref<"LENDER" | "BORROWER">("BORROWER")
    const { fetchPage } = useTransactions({ role, status: ref(null), searchQuery: ref("") })
    await fetchPage()

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/transactions",
      expect.objectContaining({ query: expect.objectContaining({ role: "BORROWER", limit: 20 }) }),
    )
  })

  it("stores returned transactions", async () => {
    fetchMock = vi.fn().mockResolvedValue({ transactions: [makeTx(TX_ID_1)], nextCursor: null })
    vi.stubGlobal("$fetch", fetchMock)

    const { transactions, fetchPage } = useTransactions({
      role: ref("BORROWER"),
      status: ref(null),
      searchQuery: ref(""),
    })

    await fetchPage()
    expect(transactions.value).toHaveLength(1)
    expect(transactions.value[0]!.id).toBe(TX_ID_1)
  })

  it("sets hasMore to true when nextCursor is returned", async () => {
    fetchMock = vi.fn().mockResolvedValue({
      transactions: [makeTx(TX_ID_1)],
      nextCursor: { id: TX_ID_1, createdAt: new Date() },
    })
    vi.stubGlobal("$fetch", fetchMock)

    const { hasMore, fetchPage } = useTransactions({
      role: ref("BORROWER"),
      status: ref(null),
      searchQuery: ref(""),
    })

    await fetchPage()
    expect(hasMore.value).toBe(true)
  })

  it("appends transactions on loadMore", async () => {
    fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        transactions: [makeTx(TX_ID_1)],
        nextCursor: { id: TX_ID_1, createdAt: new Date("2026-03-15") },
      })
      .mockResolvedValueOnce({ transactions: [makeTx(TX_ID_2)], nextCursor: null })
    vi.stubGlobal("$fetch", fetchMock)

    const { transactions, hasMore, loadMore, fetchPage } = useTransactions({
      role: ref("BORROWER"),
      status: ref(null),
      searchQuery: ref(""),
    })

    await fetchPage()
    expect(transactions.value).toHaveLength(1)
    await loadMore()
    expect(transactions.value).toHaveLength(2)
    expect(hasMore.value).toBe(false)
  })

  it("passes cursor as JSON string on loadMore", async () => {
    const cursor = { id: TX_ID_1, createdAt: new Date("2026-03-15") }
    fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ transactions: [makeTx(TX_ID_1)], nextCursor: cursor })
      .mockResolvedValueOnce({ transactions: [], nextCursor: null })
    vi.stubGlobal("$fetch", fetchMock)

    const { loadMore, fetchPage } = useTransactions({
      role: ref("BORROWER"),
      status: ref(null),
      searchQuery: ref(""),
    })

    await fetchPage()
    await loadMore()

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/transactions",
      expect.objectContaining({
        query: expect.objectContaining({ cursor: JSON.stringify(cursor) }),
      }),
    )
  })

  it("sets error message when the fetch rejects", async () => {
    fetchMock = vi.fn().mockRejectedValue(new Error("Network error"))
    vi.stubGlobal("$fetch", fetchMock)

    const { error, fetchPage } = useTransactions({
      role: ref("BORROWER"),
      status: ref(null),
      searchQuery: ref(""),
    })

    await fetchPage()
    expect(error.value).toBeTruthy()
  })

  it("filters transactions by searchQuery against item name", async () => {
    fetchMock = vi.fn().mockResolvedValue({
      transactions: [
        makeTx(TX_ID_1, {
          item: {
            id: "i1",
            name: "Camera",
            thumbnailImage: null,
            rateOption: "PER_DAY",
            rentalFee: 100,
            freeToBorrow: false,
          },
        }),
        makeTx(TX_ID_2, {
          item: {
            id: "i2",
            name: "Keyboard",
            thumbnailImage: null,
            rateOption: "PER_DAY",
            rentalFee: 50,
            freeToBorrow: false,
          },
        }),
      ],
      nextCursor: null,
    })
    vi.stubGlobal("$fetch", fetchMock)

    const searchQuery = ref("")
    const { filteredTransactions, fetchPage } = useTransactions({
      role: ref("BORROWER"),
      status: ref(null),
      searchQuery,
    })

    await fetchPage()
    expect(filteredTransactions.value).toHaveLength(2)

    searchQuery.value = "camera"
    expect(filteredTransactions.value).toHaveLength(1)
    expect(filteredTransactions.value[0]!.item.name).toBe("Camera")
  })
})
