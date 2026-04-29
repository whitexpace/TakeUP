import { describe, expect, it, vi } from "vitest"
import { TransactionStatus } from "@prisma/client"
import { reviewRouter } from "../review"
import { SUBMITTED_DISPUTE_STATUS } from "../../../utils/dispute-status"

const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const OTHER_USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const BOOKING_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"
const TRANSACTION_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd"

const makeContext = () => ({
  event: { context: {} } as never,
  prisma: {
    transactionReview: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    rentalTransaction: {
      findUnique: vi.fn(),
    },
    booking: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  user: { id: USER_ID, email: "user@up.edu.ph", name: "User" },
})

describe("reviewRouter", () => {
  it("blocks review submission lookup while a concern is under review", async () => {
    const ctx = makeContext()
    ctx.prisma.rentalTransaction.findUnique.mockResolvedValue({
      id: TRANSACTION_ID,
      status: TransactionStatus.COMPLETED,
      borrowerId: USER_ID,
      lenderId: OTHER_USER_ID,
      disputes: [{ id: "dispute-1" }],
      reviews: [],
    })

    const caller = reviewRouter.createCaller(ctx as never)
    const result = await caller.byBooking({ bookingId: BOOKING_ID })

    expect(result).toEqual({
      canSubmit: false,
      review: null,
      transactionId: TRANSACTION_ID,
    })
  })

  it("rejects review submission while a dispute or concern is in progress", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findUnique.mockResolvedValue({
      id: BOOKING_ID,
      borrowerId: USER_ID,
      lenderId: OTHER_USER_ID,
      status: "COMPLETED",
    })
    ctx.prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof ctx.prisma) => unknown) =>
        callback({
          ...ctx.prisma,
          rentalTransaction: {
            findUnique: vi.fn().mockResolvedValue({
              id: TRANSACTION_ID,
              status: TransactionStatus.COMPLETED,
              itemId: "item-1",
              borrowerId: USER_ID,
              lenderId: OTHER_USER_ID,
              disputes: [{ id: "dispute-1", status: SUBMITTED_DISPUTE_STATUS }],
            }),
          },
        }),
    )

    const caller = reviewRouter.createCaller(ctx as never)

    await expect(
      caller.create({
        bookingId: BOOKING_ID,
        rating: 5,
        reviewText: "Not relevant during dispute handling.",
        isAnonymous: false,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Reviews are unavailable while a dispute or concern is in progress.",
    })
  })
})
