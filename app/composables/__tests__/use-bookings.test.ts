import { nextTick, ref } from "vue"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useBookings } from "../use-bookings"
import type { BookingRole, BookingStatus } from "#shared/schemas/booking"

const BOOKING_ID_1 = "11111111-1111-1111-1111-111111111111"
const BOOKING_ID_2 = "22222222-2222-2222-2222-222222222222"

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const makeBooking = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  status: "PENDING" as BookingStatus,
  item: {
    id: "item-1",
    name: "Camera",
    thumbnailImage: null,
    rateOption: "PER_DAY",
    rentalFee: 250,
    freeToBorrow: false,
  },
  borrower: {
    user: { firstName: "Juan", middleName: null, lastName: "Cruz" },
  },
  lender: {
    user: { firstName: "Issa", middleName: null, lastName: "Santos" },
  },
  ...overrides,
})

let fetchMock = vi.fn().mockResolvedValue({ bookings: [], nextCursor: null })

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ bookings: [], nextCursor: null })
  vi.stubGlobal("$fetch", fetchMock)
  vi.stubGlobal("navigateTo", vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("useBookings", () => {
  it("fetches bookings with role, status, and limit", async () => {
    const role = ref<BookingRole>("BORROWER")
    const status = ref<BookingStatus | null>("CONFIRMED")
    const { fetchPage } = useBookings({ role, status, searchQuery: ref("") })

    await fetchPage()

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bookings",
      expect.objectContaining({
        query: expect.objectContaining({
          role: "BORROWER",
          status: "CONFIRMED",
          limit: 20,
        }),
      }),
    )
  })

  it("appends bookings when loading more pages and passes the cursor", async () => {
    const cursor = { id: BOOKING_ID_1, createdAt: new Date("2026-04-01T00:00:00.000Z") }
    fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ bookings: [makeBooking(BOOKING_ID_1)], nextCursor: cursor })
      .mockResolvedValueOnce({ bookings: [makeBooking(BOOKING_ID_2)], nextCursor: null })
    vi.stubGlobal("$fetch", fetchMock)

    const { bookings, hasMore, fetchPage, loadMore } = useBookings({
      role: ref("BORROWER"),
      status: ref(null),
      searchQuery: ref(""),
    })

    await fetchPage()
    await loadMore()

    expect(bookings.value.map((booking) => booking.id)).toEqual([BOOKING_ID_1, BOOKING_ID_2])
    expect(hasMore.value).toBe(false)
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/bookings",
      expect.objectContaining({
        query: expect.objectContaining({
          cursor: JSON.stringify(cursor),
        }),
      }),
    )
  })

  it("filters bookings by item name, counterpart, and booking id", async () => {
    fetchMock = vi.fn().mockResolvedValue({
      bookings: [
        makeBooking(BOOKING_ID_1, {
          item: {
            id: "item-1",
            name: "Camera",
            thumbnailImage: null,
            rateOption: "PER_DAY",
            rentalFee: 250,
            freeToBorrow: false,
          },
        }),
        makeBooking(BOOKING_ID_2, {
          item: {
            id: "item-2",
            name: "Keyboard",
            thumbnailImage: null,
            rateOption: "PER_DAY",
            rentalFee: 100,
            freeToBorrow: false,
          },
          lender: {
            user: { firstName: "Lia", middleName: null, lastName: "Reyes" },
          },
        }),
      ],
      nextCursor: null,
    })
    vi.stubGlobal("$fetch", fetchMock)

    const searchQuery = ref("")
    const { filteredBookings, fetchPage } = useBookings({
      role: ref("BORROWER"),
      status: ref(null),
      searchQuery,
    })

    await fetchPage()
    expect(filteredBookings.value).toHaveLength(2)

    searchQuery.value = "lia"
    expect(filteredBookings.value.map((booking) => booking.id)).toEqual([BOOKING_ID_2])

    searchQuery.value = BOOKING_ID_1.slice(0, 16)
    expect(filteredBookings.value.map((booking) => booking.id)).toEqual([BOOKING_ID_1])

    searchQuery.value = "camera"
    expect(filteredBookings.value.map((booking) => booking.id)).toEqual([BOOKING_ID_1])
  })

  it("redirects to home when the API returns unauthorized", async () => {
    const navigateTo = vi.fn()
    vi.stubGlobal("navigateTo", navigateTo)
    vi.stubGlobal("$fetch", vi.fn().mockRejectedValue({ statusCode: 401 }))

    const { fetchPage, error } = useBookings({
      role: ref("BORROWER"),
      status: ref(null),
      searchQuery: ref(""),
    })

    await fetchPage()

    expect(navigateTo).toHaveBeenCalledWith("/")
    expect(error.value).toBeNull()
  })

  it("reloads the first page when role or status changes", async () => {
    fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ bookings: [makeBooking(BOOKING_ID_1)], nextCursor: null })
      .mockResolvedValueOnce({
        bookings: [makeBooking(BOOKING_ID_2, { status: "CONFIRMED" as BookingStatus })],
        nextCursor: null,
      })
    vi.stubGlobal("$fetch", fetchMock)

    const role = ref<BookingRole>("BORROWER")
    const status = ref<BookingStatus | null>(null)
    const { bookings, fetchPage } = useBookings({ role, status, searchQuery: ref("") })

    await fetchPage()
    status.value = "CONFIRMED"

    await nextTick()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/bookings",
      expect.objectContaining({
        query: expect.objectContaining({
          role: "BORROWER",
          status: "CONFIRMED",
        }),
      }),
    )
    expect(bookings.value.map((booking) => booking.id)).toEqual([BOOKING_ID_2])
  })
})
