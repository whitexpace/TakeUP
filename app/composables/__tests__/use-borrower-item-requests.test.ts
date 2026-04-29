import { ref } from "vue"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useBorrowerItemRequests } from "../use-borrower-item-requests"
import type { BookingStatus } from "../../../shared/schemas/booking"

const BOOKING_ID_1 = "11111111-1111-1111-1111-111111111111"
const BOOKING_ID_2 = "22222222-2222-2222-2222-222222222222"

const makeBooking = (
  id: string,
  status: BookingStatus,
  overrides: Record<string, unknown> = {},
) => ({
  id,
  status,
  requestedAt: new Date("2026-04-01T08:00:00.000Z"),
  startDate: new Date("2026-04-05T01:00:00.000Z"),
  endDate: new Date("2026-04-05T09:00:00.000Z"),
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  item: {
    id: "item-1",
    name: "Camera",
    thumbnailImage: "/images/camera.jpg",
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

describe("useBorrowerItemRequests", () => {
  it("fetches borrower requests for the requested booking statuses", async () => {
    fetchMock = vi.fn().mockImplementation((_url, options: { query: { status: BookingStatus } }) =>
      Promise.resolve({
        bookings: [makeBooking(`booking-${options.query.status}`, options.query.status)],
        nextCursor: null,
      }),
    )
    vi.stubGlobal("$fetch", fetchMock)

    const { requests, fetchRequests } = useBorrowerItemRequests({
      enabled: ref(true),
      statuses: ref<BookingStatus[]>(["PENDING", "CONFIRMED", "CANCELLED"]),
      searchQuery: ref(""),
    })

    await fetchRequests()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/bookings",
      expect.objectContaining({
        query: expect.objectContaining({ role: "BORROWER", status: "PENDING", limit: 100 }),
      }),
    )
    expect(requests.value.map((request) => request.requestStatusLabel).sort()).toEqual([
      "Approved",
      "Cancelled",
      "Pending",
    ])
  })

  it("filters request cards by item name, lender name, and request id", async () => {
    fetchMock = vi.fn().mockResolvedValue({
      bookings: [
        makeBooking(BOOKING_ID_1, "PENDING"),
        makeBooking(BOOKING_ID_2, "PENDING", {
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
    const { filteredRequests, fetchRequests } = useBorrowerItemRequests({
      enabled: ref(true),
      statuses: ref<BookingStatus[]>(["PENDING"]),
      searchQuery,
    })

    await fetchRequests()
    expect(filteredRequests.value).toHaveLength(2)

    searchQuery.value = "lia"
    expect(filteredRequests.value.map((request) => request.id)).toEqual([BOOKING_ID_2])

    searchQuery.value = BOOKING_ID_1.slice(0, 16)
    expect(filteredRequests.value.map((request) => request.id)).toEqual([BOOKING_ID_1])
  })
})
