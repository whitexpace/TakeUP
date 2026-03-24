import { describe, expect, it, vi } from "vitest"
import { bookingRouter } from "../booking"

const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const ITEM_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const LENDER_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"
const BOOKING_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd"

const mockUser = { id: USER_ID, email: "user@up.edu.ph", name: "Test User" }

const makeBooking = (overrides: Record<string, unknown> = {}) => ({
  id: BOOKING_ID,
  borrowerId: USER_ID,
  lenderId: LENDER_ID,
  itemId: ITEM_ID,
  startDate: new Date("2026-04-01T00:00:00.000Z"),
  endDate: new Date("2026-04-03T00:00:00.000Z"),
  totalFee: 450,
  platformCommission: 50,
  paymentMethod: "GCASH",
  status: "PENDING",
  paymentStatus: "PENDING",
  cancellationReason: null,
  requestedAt: new Date("2026-03-20T00:00:00.000Z"),
  confirmedAt: null,
  cancelledAt: null,
  completedAt: null,
  disputeOpenedAt: null,
  paymentProcessedAt: null,
  createdAt: new Date("2026-03-20T00:00:00.000Z"),
  updatedAt: new Date("2026-03-20T00:00:00.000Z"),
  item: {
    id: ITEM_ID,
    name: "Camera",
    lenderId: LENDER_ID,
    rateOption: "PER_DAY",
    rentalFee: 200,
    freeToBorrow: false,
    status: "AVAILABLE",
    images: [
      {
        path: "/images/camera-primary.jpg",
        isPrimary: true,
        sortOrder: 0,
      },
      {
        path: "/images/camera-secondary.jpg",
        isPrimary: false,
        sortOrder: 1,
      },
    ],
  },
  borrower: {
    user: {
      username: "borrower",
      firstName: "Borrow",
      middleName: null,
      lastName: "Er",
      email: "borrower@up.edu.ph",
    },
  },
  lender: {
    user: {
      username: "lender",
      firstName: "Lend",
      middleName: null,
      lastName: "Er",
      email: "lender@up.edu.ph",
    },
  },
  ...overrides,
})

const makeContext = () => {
  const booking = {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn(),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(makeBooking()),
    update: vi.fn(),
    delete: vi.fn(),
  }

  const prisma = {
    $transaction: vi.fn(),
    borrower: {
      upsert: vi.fn().mockResolvedValue({ userId: USER_ID }),
    },
    lender: {
      upsert: vi.fn().mockResolvedValue({ userId: LENDER_ID }),
    },
    item: {
      findUnique: vi.fn().mockResolvedValue({
        id: ITEM_ID,
        lenderId: LENDER_ID,
        rateOption: "PER_DAY",
        rentalFee: 200,
        freeToBorrow: false,
        status: "AVAILABLE",
      }),
      update: vi.fn().mockResolvedValue({ id: ITEM_ID }),
    },
    itemAvailability: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    rentalTransaction: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "txn-1" }),
      update: vi.fn().mockResolvedValue({ id: "txn-1" }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    booking,
  }

  prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
    callback(prisma),
  )

  return {
    event: { context: {} } as never,
    prisma,
    user: mockUser,
  }
}

describe("bookingRouter", () => {
  it("creates a booking using the authenticated user as borrower and item owner as lender", async () => {
    const ctx = makeContext()
    const caller = bookingRouter.createCaller(ctx as never)

    const createdBooking = await caller.create({
      itemId: ITEM_ID,
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2026-04-03T00:00:00.000Z"),
      platformCommission: 50,
      paymentMethod: "GCASH",
    })

    expect(ctx.prisma.borrower.upsert).toHaveBeenCalled()
    expect(ctx.prisma.lender.upsert).toHaveBeenCalledWith({
      where: { userId: LENDER_ID },
      create: { userId: LENDER_ID, lenderRating: 0 },
      update: {},
    })
    expect(ctx.prisma.rentalTransaction.upsert).not.toHaveBeenCalled()
    expect(ctx.prisma.item.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ITEM_ID },
        data: { bookingCount: { increment: 1 } },
      }),
    )
    expect(ctx.prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          borrowerId: USER_ID,
          lenderId: LENDER_ID,
          itemId: ITEM_ID,
          totalFee: 450,
          platformCommission: 50,
          status: "PENDING",
          paymentStatus: "PENDING",
        }),
      }),
    )
    expect(ctx.prisma.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["CONFIRMED", "IN_DISPUTE"] },
        }),
      }),
    )
    expect(createdBooking.item.thumbnailImage).toBe("/images/camera-primary.jpg")
  })

  it("filters list by borrower role", async () => {
    const ctx = makeContext()
    const caller = bookingRouter.createCaller(ctx as never)

    const result = await caller.list({ role: "BORROWER" })

    expect(ctx.prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ borrowerId: USER_ID }]),
        }),
      }),
    )
    expect(result.bookings).toEqual([])
  })

  it("rejects create when the requested dates fall outside listing availability", async () => {
    const ctx = makeContext()
    ctx.prisma.itemAvailability.findMany.mockResolvedValueOnce([
      {
        startDate: new Date("2026-04-01T00:00:00.000Z"),
        endDate: new Date("2026-04-02T00:00:00.000Z"),
        status: "AVAILABLE",
      },
    ])
    const caller = bookingRouter.createCaller(ctx as never)

    await expect(
      caller.create({
        itemId: ITEM_ID,
        startDate: new Date("2026-04-01T00:00:00.000Z"),
        endDate: new Date("2026-04-03T00:00:00.000Z"),
        platformCommission: 50,
        paymentMethod: "GCASH",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "The selected dates are not fully available for this listing.",
    })

    expect(ctx.prisma.booking.create).not.toHaveBeenCalled()
  })

  it("rejects create when the requested window overlaps an existing active booking", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findFirst.mockResolvedValueOnce({ id: "existing-booking-id" })
    const caller = bookingRouter.createCaller(ctx as never)

    await expect(
      caller.create({
        itemId: ITEM_ID,
        startDate: new Date("2026-04-01T00:00:00.000Z"),
        endDate: new Date("2026-04-03T00:00:00.000Z"),
        platformCommission: 50,
        paymentMethod: "GCASH",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "The requested booking window overlaps an existing booking.",
    })

    expect(ctx.prisma.booking.create).not.toHaveBeenCalled()
  })

  it("rejects update when the resulting endDate is not later than startDate", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findUnique.mockResolvedValueOnce({
      id: BOOKING_ID,
      borrowerId: USER_ID,
      lenderId: LENDER_ID,
      itemId: ITEM_ID,
      startDate: new Date("2026-04-03T00:00:00.000Z"),
      endDate: new Date("2026-04-04T00:00:00.000Z"),
      totalFee: 450,
      platformCommission: 50,
      paymentMethod: "GCASH",
      status: "PENDING",
      paymentStatus: "PENDING",
      cancellationReason: null,
      confirmedAt: null,
      cancelledAt: null,
      completedAt: null,
      disputeOpenedAt: null,
      paymentProcessedAt: null,
      item: {
        id: ITEM_ID,
        lenderId: LENDER_ID,
        rateOption: "PER_DAY",
        rentalFee: 200,
        freeToBorrow: false,
        status: "AVAILABLE",
      },
    })
    const caller = bookingRouter.createCaller(ctx as never)

    await expect(
      caller.update({
        id: BOOKING_ID,
        endDate: new Date("2026-04-02T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "endDate must be later than startDate.",
    })

    expect(ctx.prisma.booking.update).not.toHaveBeenCalled()
  })

  it("forbids access to a booking when the user is not a participant", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        borrowerId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
        lenderId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      }),
    )
    const caller = bookingRouter.createCaller(ctx as never)

    await expect(caller.byId({ id: BOOKING_ID })).rejects.toMatchObject({
      code: "FORBIDDEN",
    })
  })

  it("creates a transaction only after the lender accepts the booking request", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findUnique.mockResolvedValueOnce({
      id: BOOKING_ID,
      borrowerId: USER_ID,
      lenderId: LENDER_ID,
      itemId: ITEM_ID,
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2026-04-03T00:00:00.000Z"),
      totalFee: 450,
      platformCommission: 50,
      paymentMethod: "GCASH",
      status: "PENDING",
      paymentStatus: "PENDING",
      cancellationReason: null,
      confirmedAt: null,
      cancelledAt: null,
      completedAt: null,
      disputeOpenedAt: null,
      paymentProcessedAt: null,
      item: {
        id: ITEM_ID,
        lenderId: LENDER_ID,
        rateOption: "PER_DAY",
        rentalFee: 200,
        freeToBorrow: false,
        status: "AVAILABLE",
      },
    })
    ctx.prisma.booking.update.mockResolvedValueOnce(
      makeBooking({
        status: "CONFIRMED",
        confirmedAt: new Date("2026-03-21T00:00:00.000Z"),
      }),
    )

    const caller = bookingRouter.createCaller({
      ...ctx,
      user: { ...mockUser, id: LENDER_ID, email: "lender@up.edu.ph" },
    } as never)

    await caller.update({
      id: BOOKING_ID,
      status: "CONFIRMED",
    })

    expect(ctx.prisma.rentalTransaction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          bookingId: BOOKING_ID,
          borrowerId: USER_ID,
          lenderId: LENDER_ID,
          itemId: ITEM_ID,
          rentalFee: 400,
          platformFee: 50,
          status: "PENDING",
        }),
      }),
    )
  })

  it("forbids borrowers from accepting booking requests", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findUnique.mockResolvedValueOnce({
      id: BOOKING_ID,
      borrowerId: USER_ID,
      lenderId: LENDER_ID,
      itemId: ITEM_ID,
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2026-04-03T00:00:00.000Z"),
      totalFee: 450,
      platformCommission: 50,
      paymentMethod: "GCASH",
      status: "PENDING",
      paymentStatus: "PENDING",
      cancellationReason: null,
      confirmedAt: null,
      cancelledAt: null,
      completedAt: null,
      disputeOpenedAt: null,
      paymentProcessedAt: null,
      item: {
        id: ITEM_ID,
        lenderId: LENDER_ID,
        rateOption: "PER_DAY",
        rentalFee: 200,
        freeToBorrow: false,
        status: "AVAILABLE",
      },
    })
    const caller = bookingRouter.createCaller(ctx as never)

    await expect(
      caller.update({
        id: BOOKING_ID,
        status: "CONFIRMED",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only the lender can accept this booking request.",
    })

    expect(ctx.prisma.booking.update).not.toHaveBeenCalled()
  })
})
