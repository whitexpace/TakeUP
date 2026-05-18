import { beforeEach, describe, expect, it, vi } from "vitest"
import { bookingRouter } from "../booking"
import { REJECTED_DISPUTE_STATUS, SUBMITTED_DISPUTE_STATUS } from "../../../utils/dispute-status"

const {
  creditToWalletMock,
  creditCommissionToSystemWalletMock,
  findSystemCommissionTransactionMock,
} = vi.hoisted(() => ({
  creditToWalletMock: vi.fn(),
  creditCommissionToSystemWalletMock: vi.fn(),
  findSystemCommissionTransactionMock: vi.fn(),
}))

vi.mock("../../../utils/wallet", async () => {
  const actual =
    await vi.importActual<typeof import("../../../utils/wallet")>("../../../utils/wallet")

  return {
    ...actual,
    creditToWallet: creditToWalletMock,
    creditCommissionToSystemWallet: creditCommissionToSystemWalletMock,
    findSystemCommissionTransaction: findSystemCommissionTransactionMock,
  }
})

const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const ITEM_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const LENDER_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"
const BOOKING_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd"
const DAY_IN_MS = 24 * 60 * 60 * 1000

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
  returnedAt: null,
  cancelledAt: null,
  completedAt: null,
  disputeOpenedAt: null,
  paymentProcessedAt: null,
  lenderHandoffProofUrl: null,
  lenderHandoffProofUploadedAt: null,
  borrowerReturnProofUrl: null,
  borrowerReturnProofUploadedAt: null,
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
        name: "Camera",
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
      upsert: vi.fn().mockResolvedValue({ id: "txn-1" }),
      create: vi.fn().mockResolvedValue({ id: "txn-1" }),
      update: vi.fn().mockResolvedValue({ id: "txn-1" }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    conversation: {
      upsert: vi.fn().mockResolvedValue({ id: "conv-1", transactionId: "txn-1" }),
    },
    walletTransaction: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    appNotification: {
      create: vi.fn().mockResolvedValue({ id: "notif-1" }),
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
  beforeEach(() => {
    creditToWalletMock.mockReset()
    creditCommissionToSystemWalletMock.mockReset()
    findSystemCommissionTransactionMock.mockReset()
    creditToWalletMock.mockResolvedValue(null)
    creditCommissionToSystemWalletMock.mockResolvedValue(null)
    findSystemCommissionTransactionMock.mockResolvedValue(null)
  })

  it("creates a booking using the authenticated user as borrower and item owner as lender", async () => {
    const ctx = makeContext()
    const caller = bookingRouter.createCaller(ctx as never)

    const createdBooking = await caller.create({
      itemId: ITEM_ID,
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2026-04-03T00:00:00.000Z"),
      paymentMethod: "GCASH",
    })

    expect(ctx.prisma.borrower.upsert).toHaveBeenCalled()
    expect(ctx.prisma.lender.upsert).toHaveBeenCalledWith({
      where: { userId: LENDER_ID },
      create: { userId: LENDER_ID, lenderRating: 0 },
      update: {},
    })
    expect(ctx.prisma.rentalTransaction.create).not.toHaveBeenCalled()
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
          totalFee: 400,
          platformCommission: 20,
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
    expect(ctx.prisma.appNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipientUserId: LENDER_ID,
          actorUserId: USER_ID,
          bookingId: BOOKING_ID,
          type: "BOOKING_REQUESTED",
          title: "New booking request",
          actionPath: `/account/transactions/${BOOKING_ID}`,
        }),
      }),
    )
    expect(createdBooking.item.thumbnailImage).toBe("/images/camera-primary.jpg")
  })

  it("rejects create when the borrower owns the item", async () => {
    const ctx = makeContext()
    ctx.prisma.item.findUnique.mockResolvedValueOnce({
      id: ITEM_ID,
      lenderId: USER_ID,
      rateOption: "PER_DAY",
      rentalFee: 200,
      freeToBorrow: false,
      status: "AVAILABLE",
    })
    const caller = bookingRouter.createCaller(ctx as never)

    await expect(
      caller.create({
        itemId: ITEM_ID,
        startDate: new Date("2026-04-01T00:00:00.000Z"),
        endDate: new Date("2026-04-03T00:00:00.000Z"),
        paymentMethod: "GCASH",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "You cannot book your own item.",
    })

    expect(ctx.prisma.lender.upsert).not.toHaveBeenCalled()
    expect(ctx.prisma.booking.create).not.toHaveBeenCalled()
    expect(ctx.prisma.item.update).not.toHaveBeenCalled()
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

  it("returns the latest dispute state and blocks resubmission while it is active", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        status: "COMPLETED",
        completedAt: new Date(Date.now() - 2 * DAY_IN_MS),
      }),
    )
    ctx.prisma.rentalTransaction.findUnique.mockResolvedValueOnce({
      id: "txn-1",
      status: "COMPLETED",
      borrowerId: USER_ID,
      lenderId: LENDER_ID,
      disputes: [
        {
          id: "dispute-1",
          raisedById: USER_ID,
          reason: "Item came back with damage.",
          description: "The issue was found during inspection.",
          status: SUBMITTED_DISPUTE_STATUS,
          createdAt: new Date("2026-04-05T00:00:00.000Z"),
          reviewedAt: null,
          reviewedBy: null,
        },
      ],
      reviews: [],
    })

    const caller = bookingRouter.createCaller(ctx as never)
    const result = await caller.byId({ id: BOOKING_ID })

    expect(result?.canRaiseDispute).toBe(false)
    expect(result?.latestDispute).toMatchObject({
      id: "dispute-1",
      status: "OPEN",
      isActive: true,
    })
  })

  it("shows a submitted concern to the counterparty in temporary direct-open mode", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        status: "COMPLETED",
        completedAt: new Date(Date.now() - 2 * DAY_IN_MS),
      }),
    )
    ctx.prisma.rentalTransaction.findUnique.mockResolvedValueOnce({
      id: "txn-1",
      status: "COMPLETED",
      borrowerId: USER_ID,
      lenderId: LENDER_ID,
      disputes: [
        {
          id: "dispute-hidden",
          raisedById: USER_ID,
          reason: "Item came back with damage.",
          description: "The issue was found during inspection.",
          status: SUBMITTED_DISPUTE_STATUS,
          createdAt: new Date("2026-04-05T00:00:00.000Z"),
          reviewedAt: null,
          rebuttalById: null,
          rebuttalText: null,
          rebuttalNotes: null,
          rebuttalSubmittedAt: null,
          rebuttalBy: null,
          reviewedBy: null,
        },
      ],
      reviews: [],
    })

    const caller = bookingRouter.createCaller({
      ...ctx,
      user: { ...mockUser, id: LENDER_ID, email: "lender@up.edu.ph" },
    } as never)
    const result = await caller.byId({ id: BOOKING_ID })

    expect(result?.canRaiseDispute).toBe(false)
    expect(result?.latestDispute).toMatchObject({
      id: "dispute-hidden",
      status: "OPEN",
      canSubmitRebuttal: true,
    })
    expect(result?.reviewState.canSubmitAny).toBe(false)
    expect(result?.reviewState.isCompleted).toBe(false)
  })

  it("shows an opened dispute to the counterparty and allows one rebuttal", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        status: "COMPLETED",
        completedAt: new Date(Date.now() - 2 * DAY_IN_MS),
      }),
    )
    ctx.prisma.rentalTransaction.findUnique.mockResolvedValueOnce({
      id: "txn-1",
      status: "IN_DISPUTE",
      borrowerId: USER_ID,
      lenderId: LENDER_ID,
      disputes: [
        {
          id: "dispute-open",
          raisedById: USER_ID,
          reason: "Item came back with damage.",
          description: "The issue was found during inspection.",
          status: "OPEN",
          createdAt: new Date("2026-04-05T00:00:00.000Z"),
          reviewedAt: new Date("2026-04-06T00:00:00.000Z"),
          rebuttalById: null,
          rebuttalText: null,
          rebuttalNotes: null,
          rebuttalSubmittedAt: null,
          rebuttalBy: null,
          reviewedBy: {
            id: "admin-1",
            firstName: "Admin",
            middleName: null,
            lastName: "User",
          },
        },
      ],
      reviews: [],
    })

    const caller = bookingRouter.createCaller({
      ...ctx,
      user: { ...mockUser, id: LENDER_ID, email: "lender@up.edu.ph" },
    } as never)
    const result = await caller.byId({ id: BOOKING_ID })

    expect(result?.latestDispute).toMatchObject({
      id: "dispute-open",
      status: "OPEN",
      canSubmitRebuttal: true,
    })
    expect(result?.reviewState.canSubmitAny).toBe(false)
  })
  it("keeps dispute submission disabled after a rejected concern already exists", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        status: "COMPLETED",
        completedAt: new Date(Date.now() - 2 * DAY_IN_MS),
      }),
    )
    ctx.prisma.rentalTransaction.findUnique.mockResolvedValueOnce({
      id: "txn-1",
      status: "COMPLETED",
      borrowerId: USER_ID,
      lenderId: LENDER_ID,
      disputes: [
        {
          id: "dispute-2",
          raisedById: USER_ID,
          reason: "Initial request was rejected.",
          description: null,
          status: REJECTED_DISPUTE_STATUS,
          createdAt: new Date("2026-04-06T00:00:00.000Z"),
          reviewedAt: new Date("2026-04-07T00:00:00.000Z"),
          reviewedBy: {
            id: "admin-1",
            firstName: "Admin",
            middleName: null,
            lastName: "User",
          },
        },
      ],
      reviews: [],
    })

    const caller = bookingRouter.createCaller(ctx as never)
    const result = await caller.byId({ id: BOOKING_ID })

    expect(result?.canRaiseDispute).toBe(false)
    expect(result?.latestDispute).toMatchObject({
      id: "dispute-2",
      status: "REJECTED",
      isActive: false,
    })
  })

  it("hides dispute submission once the completed transaction is older than 15 days", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        status: "COMPLETED",
        completedAt: new Date(Date.now() - 20 * DAY_IN_MS),
      }),
    )
    ctx.prisma.rentalTransaction.findUnique.mockResolvedValueOnce({
      id: "txn-1",
      status: "COMPLETED",
      borrowerId: USER_ID,
      lenderId: LENDER_ID,
      disputes: [
        {
          id: "dispute-3",
          raisedById: USER_ID,
          reason: "Older dispute request was rejected.",
          description: null,
          status: REJECTED_DISPUTE_STATUS,
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          reviewedAt: new Date("2026-04-02T00:00:00.000Z"),
          reviewedBy: null,
        },
      ],
      reviews: [],
    })

    const caller = bookingRouter.createCaller(ctx as never)
    const result = await caller.byId({ id: BOOKING_ID })

    expect(result?.canRaiseDispute).toBe(false)
    expect(result?.latestDispute).toMatchObject({
      id: "dispute-3",
      status: "REJECTED",
    })
  })

  it("builds the detail timeline from exact booking timestamps and transaction status logs", async () => {
    const ctx = makeContext()
    const bookingReturnedAt = new Date("2026-04-03T00:00:00.000Z")
    const loggedReturnedAt = new Date("2026-04-03T08:15:30.000Z")

    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        status: "RETURNED",
        confirmedAt: new Date("2026-03-21T02:30:00.000Z"),
        returnedAt: bookingReturnedAt,
      }),
    )
    ctx.prisma.rentalTransaction.findUnique.mockResolvedValueOnce({
      id: "txn-1",
      status: "RETURNED",
      borrowerId: USER_ID,
      lenderId: LENDER_ID,
      createdAt: new Date("2026-03-21T02:30:05.000Z"),
      statusLogs: [
        {
          id: "log-returned",
          oldStatus: "CONFIRMED",
          newStatus: "RETURNED",
          changedByRole: "BORROWER",
          remarks: "Borrower initiated item return.",
          createdAt: loggedReturnedAt,
        },
      ],
      disputes: [],
      reviews: [],
    })
    const caller = bookingRouter.createCaller(ctx as never)

    const result = await caller.byId({ id: BOOKING_ID })

    expect(result?.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "booking-requested",
          occurredAt: new Date("2026-03-20T00:00:00.000Z"),
          source: "BOOKING",
        }),
        expect.objectContaining({
          key: "booking-confirmed",
          occurredAt: new Date("2026-03-21T02:30:00.000Z"),
          source: "BOOKING",
        }),
        expect.objectContaining({
          key: "transaction-status-log-log-returned",
          label: "Returned",
          description: "Borrower initiated item return.",
          occurredAt: loggedReturnedAt,
          source: "TRANSACTION_STATUS_LOG",
        }),
      ]),
    )
    expect(
      result?.timeline.some((entry) => entry.occurredAt.getTime() === bookingReturnedAt.getTime()),
    ).toBe(false)
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
        paymentMethod: "GCASH",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "The selected dates are not fully available for this listing.",
    })

    expect(ctx.prisma.booking.create).not.toHaveBeenCalled()
  })

  it("allows create for any time-of-day inside an available calendar day", async () => {
    const ctx = makeContext()
    ctx.prisma.itemAvailability.findMany.mockResolvedValueOnce([
      {
        startDate: new Date("2026-04-01T05:30:00.000Z"),
        endDate: new Date("2026-04-01T06:30:00.000Z"),
        status: "AVAILABLE",
      },
    ])
    const caller = bookingRouter.createCaller(ctx as never)

    await caller.create({
      itemId: ITEM_ID,
      startDate: new Date("2026-04-01T18:00:00.000Z"),
      endDate: new Date("2026-04-01T19:00:00.000Z"),
      paymentMethod: "GCASH",
    })

    expect(ctx.prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startDate: new Date("2026-04-01T18:00:00.000Z"),
          endDate: new Date("2026-04-01T19:00:00.000Z"),
        }),
      }),
    )
  })

  it("allows create when the requested time is contained by a same-day availability window", async () => {
    const ctx = makeContext()
    ctx.prisma.itemAvailability.findMany.mockResolvedValueOnce([
      {
        startDate: new Date("2026-04-01T05:30:00.000Z"),
        endDate: new Date("2026-04-01T06:30:00.000Z"),
        status: "AVAILABLE",
      },
    ])
    const caller = bookingRouter.createCaller(ctx as never)

    await caller.create({
      itemId: ITEM_ID,
      startDate: new Date("2026-04-01T05:45:00.000Z"),
      endDate: new Date("2026-04-01T06:15:00.000Z"),
      paymentMethod: "GCASH",
    })

    expect(ctx.prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startDate: new Date("2026-04-01T05:45:00.000Z"),
          endDate: new Date("2026-04-01T06:15:00.000Z"),
        }),
      }),
    )
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
      returnedAt: null,
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

  it("rejects update when the resulting day moves outside listing availability", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findUnique.mockResolvedValueOnce({
      ...makeBooking({
        startDate: new Date("2026-04-01T05:45:00.000Z"),
        endDate: new Date("2026-04-01T06:15:00.000Z"),
      }),
      item: {
        id: ITEM_ID,
        lenderId: LENDER_ID,
        rateOption: "PER_HOUR",
        rentalFee: 200,
        freeToBorrow: false,
        status: "AVAILABLE",
      },
    })
    ctx.prisma.itemAvailability.findMany.mockResolvedValueOnce([
      {
        startDate: new Date("2026-04-01T05:30:00.000Z"),
        endDate: new Date("2026-04-01T06:30:00.000Z"),
        status: "AVAILABLE",
      },
    ])
    const caller = bookingRouter.createCaller(ctx as never)

    await expect(
      caller.update({
        id: BOOKING_ID,
        endDate: new Date("2026-04-03T05:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "The selected dates are not fully available for this listing.",
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
      returnedAt: null,
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
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        status: "CONFIRMED",
        confirmedAt: new Date("2026-03-21T00:00:00.000Z"),
      }),
    )
    ctx.prisma.booking.update.mockResolvedValueOnce(
      makeBooking({
        status: "CONFIRMED",
        confirmedAt: new Date("2026-03-21T00:00:00.000Z"),
      }),
    )
    ctx.prisma.rentalTransaction.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "txn-1",
      status: "CONFIRMED",
    })

    const caller = bookingRouter.createCaller({
      ...ctx,
      user: { ...mockUser, id: LENDER_ID, email: "lender@up.edu.ph" },
    } as never)

    await caller.update({
      id: BOOKING_ID,
      status: "CONFIRMED",
    })

    expect(ctx.prisma.rentalTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: BOOKING_ID,
          borrowerId: USER_ID,
          lenderId: LENDER_ID,
          itemId: ITEM_ID,
          startDate: new Date("2026-04-01T00:00:00.000Z"),
          endDate: new Date("2026-04-03T00:00:00.000Z"),
          rentalFee: 400,
          platformFee: 50,
          status: "CONFIRMED",
        }),
      }),
    )
    expect(ctx.prisma.conversation.upsert).toHaveBeenCalledWith({
      where: { transactionId: "txn-1" },
      update: {},
      create: { transactionId: "txn-1" },
    })
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
      returnedAt: null,
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

  it("allows the borrower to cancel a pending booking request", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(makeBooking({ status: "PENDING" }))
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        status: "CANCELLED",
        cancellationReason: "Cancelled by borrower.",
        cancelledAt: new Date("2026-03-21T00:00:00.000Z"),
      }),
    )
    ctx.prisma.booking.update.mockResolvedValueOnce(
      makeBooking({
        status: "CANCELLED",
        cancellationReason: "Cancelled by borrower.",
        cancelledAt: new Date("2026-03-21T00:00:00.000Z"),
      }),
    )
    const caller = bookingRouter.createCaller(ctx as never)

    const cancelledBooking = await caller.update({
      id: BOOKING_ID,
      status: "CANCELLED",
      cancellationReason: "Cancelled by borrower.",
    })

    expect(ctx.prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BOOKING_ID },
        data: expect.objectContaining({
          status: "CANCELLED",
          cancellationReason: "Cancelled by borrower.",
        }),
      }),
    )
    expect(cancelledBooking.status).toBe("CANCELLED")
  })

  it("rejects cancelling a booking after it is accepted", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        status: "CONFIRMED",
        confirmedAt: new Date("2026-03-21T00:00:00.000Z"),
      }),
    )
    const caller = bookingRouter.createCaller(ctx as never)

    await expect(
      caller.update({
        id: BOOKING_ID,
        status: "CANCELLED",
        cancellationReason: "Cancelled by borrower.",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Only pending booking requests can be cancelled.",
    })

    expect(ctx.prisma.booking.update).not.toHaveBeenCalled()
  })

  it("allows the lender to upload handoff proof and mark the transaction ongoing", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        status: "CONFIRMED",
        confirmedAt: new Date("2026-03-21T00:00:00.000Z"),
      }),
    )
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        status: "CONFIRMED",
        confirmedAt: new Date("2026-03-21T00:00:00.000Z"),
      }),
    )
    ctx.prisma.booking.update.mockResolvedValueOnce(
      makeBooking({
        status: "CONFIRMED",
        confirmedAt: new Date("2026-03-21T00:00:00.000Z"),
        lenderHandoffProofUrl: "https://example.com/handoff.jpg",
        lenderHandoffProofUploadedAt: new Date("2026-04-01T00:00:00.000Z"),
      }),
    )
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        status: "CONFIRMED",
        confirmedAt: new Date("2026-03-21T00:00:00.000Z"),
        lenderHandoffProofUrl: "https://example.com/handoff.jpg",
        lenderHandoffProofUploadedAt: new Date("2026-04-01T00:00:00.000Z"),
      }),
    )
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        status: "CONFIRMED",
        confirmedAt: new Date("2026-03-21T00:00:00.000Z"),
        lenderHandoffProofUrl: "https://example.com/handoff.jpg",
        lenderHandoffProofUploadedAt: new Date("2026-04-01T00:00:00.000Z"),
      }),
    )
    ctx.prisma.rentalTransaction.findUnique
      .mockResolvedValueOnce({ id: "txn-1", status: "CONFIRMED" })
      .mockResolvedValueOnce({ id: "txn-1", status: "CONFIRMED" })

    const caller = bookingRouter.createCaller({
      ...ctx,
      user: { ...mockUser, id: LENDER_ID, email: "lender@up.edu.ph" },
    } as never)

    await caller.markHandoffProof({
      id: BOOKING_ID,
      proofImageUrl: "https://example.com/handoff.jpg",
    })

    expect(ctx.prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BOOKING_ID },
        data: expect.objectContaining({
          lenderHandoffProofUrl: "https://example.com/handoff.jpg",
          lenderHandoffProofUploadedAt: expect.any(Date),
        }),
      }),
    )
    expect(ctx.prisma.rentalTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "txn-1" },
        data: { status: "ONGOING" },
      }),
    )
  })

  it("allows the borrower to mark a confirmed booking as returned", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        status: "CONFIRMED",
        confirmedAt: new Date("2026-03-21T00:00:00.000Z"),
        lenderHandoffProofUrl: "https://example.com/handoff.jpg",
        lenderHandoffProofUploadedAt: new Date("2026-04-01T00:00:00.000Z"),
      }),
    )
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        status: "CONFIRMED",
        confirmedAt: new Date("2026-03-21T00:00:00.000Z"),
        lenderHandoffProofUrl: "https://example.com/handoff.jpg",
        lenderHandoffProofUploadedAt: new Date("2026-04-01T00:00:00.000Z"),
      }),
    )
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        status: "RETURNED",
        confirmedAt: new Date("2026-03-21T00:00:00.000Z"),
        returnedAt: new Date("2026-04-03T00:00:00.000Z"),
      }),
    )
    ctx.prisma.booking.update.mockResolvedValueOnce(
      makeBooking({
        status: "RETURNED",
        confirmedAt: new Date("2026-03-21T00:00:00.000Z"),
        returnedAt: new Date("2026-04-03T00:00:00.000Z"),
      }),
    )
    ctx.prisma.rentalTransaction.findUnique.mockResolvedValueOnce({
      id: "txn-1",
      status: "CONFIRMED",
    })

    const caller = bookingRouter.createCaller(ctx as never)

    const returnedBooking = await caller.returnItem({
      id: BOOKING_ID,
      proofImageUrl: "https://example.com/return.jpg",
    })

    expect(ctx.prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BOOKING_ID },
        data: expect.objectContaining({
          status: "RETURNED",
        }),
      }),
    )
    expect(ctx.prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BOOKING_ID },
        data: expect.objectContaining({
          borrowerReturnProofUrl: "https://example.com/return.jpg",
          borrowerReturnProofUploadedAt: expect.any(Date),
        }),
      }),
    )
    expect(ctx.prisma.appNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipientUserId: LENDER_ID,
          actorUserId: USER_ID,
          bookingId: BOOKING_ID,
          type: "BOOKING_RETURN_REQUESTED",
        }),
      }),
    )
    expect(returnedBooking.status).toBe("RETURNED")
  })

  it("rejects duplicate return submission", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        status: "RETURNED",
        returnedAt: new Date("2026-04-03T00:00:00.000Z"),
      }),
    )
    const caller = bookingRouter.createCaller(ctx as never)

    await expect(
      caller.returnItem({ id: BOOKING_ID, proofImageUrl: "https://example.com/return.jpg" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "This booking has already been marked as returned.",
    })

    expect(ctx.prisma.appNotification.create).not.toHaveBeenCalled()
  })

  it("rejects return submission before the rental period starts", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        status: "CONFIRMED",
        confirmedAt: new Date("2026-03-21T00:00:00.000Z"),
        lenderHandoffProofUrl: "https://example.com/handoff.jpg",
        lenderHandoffProofUploadedAt: new Date("2026-04-01T00:00:00.000Z"),
        startDate: new Date("2099-04-30T01:00:00.000Z"),
        endDate: new Date("2099-04-30T10:00:00.000Z"),
      }),
    )
    const caller = bookingRouter.createCaller(ctx as never)

    await expect(
      caller.returnItem({ id: BOOKING_ID, proofImageUrl: "https://example.com/return.jpg" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "This booking cannot be returned before the rental period starts.",
    })

    expect(ctx.prisma.booking.update).not.toHaveBeenCalled()
  })

  it("rejects return initiation when another overlapping booking exists for the same item", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        status: "CONFIRMED",
        confirmedAt: new Date("2026-03-21T00:00:00.000Z"),
        lenderHandoffProofUrl: "https://example.com/handoff.jpg",
        lenderHandoffProofUploadedAt: new Date("2026-04-01T00:00:00.000Z"),
      }),
    )
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        status: "CONFIRMED",
        confirmedAt: new Date("2026-03-21T00:00:00.000Z"),
        lenderHandoffProofUrl: "https://example.com/handoff.jpg",
        lenderHandoffProofUploadedAt: new Date("2026-04-01T00:00:00.000Z"),
      }),
    )
    ctx.prisma.booking.findFirst.mockResolvedValueOnce({ id: "overlap-booking" })
    const caller = bookingRouter.createCaller(ctx as never)

    await expect(
      caller.returnItem({ id: BOOKING_ID, proofImageUrl: "https://example.com/return.jpg" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message:
        "Return cannot be recorded because another overlapping booking exists for this item.",
    })
  })

  it("allows only the lender to complete a returned booking", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        status: "RETURNED",
        confirmedAt: new Date("2026-03-21T00:00:00.000Z"),
        returnedAt: new Date("2026-04-03T00:00:00.000Z"),
      }),
    )
    const caller = bookingRouter.createCaller(ctx as never)

    await expect(
      caller.update({
        id: BOOKING_ID,
        status: "COMPLETED",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only the lender can complete this booking after the item is returned.",
    })
  })

  it("credits lender earnings and centralized commission when a wallet booking is completed", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findUnique
      .mockResolvedValueOnce(
        makeBooking({
          status: "RETURNED",
          paymentMethod: "WALLET",
          paymentStatus: "PAID",
          totalFee: 400,
          platformCommission: 20,
          confirmedAt: new Date("2026-03-21T00:00:00.000Z"),
          returnedAt: new Date("2026-04-03T00:00:00.000Z"),
        }),
      )
      .mockResolvedValueOnce(
        makeBooking({
          status: "COMPLETED",
          paymentMethod: "WALLET",
          paymentStatus: "PAID",
          totalFee: 400,
          platformCommission: 20,
          confirmedAt: new Date("2026-03-21T00:00:00.000Z"),
          returnedAt: new Date("2026-04-03T00:00:00.000Z"),
          completedAt: new Date("2026-04-03T01:00:00.000Z"),
        }),
      )
    ctx.prisma.booking.update.mockResolvedValueOnce({
      id: BOOKING_ID,
      borrowerId: USER_ID,
      lenderId: LENDER_ID,
      itemId: ITEM_ID,
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2026-04-03T00:00:00.000Z"),
      totalFee: 400,
      platformCommission: 20,
      status: "COMPLETED",
      paymentStatus: "PAID",
      refundAmount: 0,
      confirmedAt: new Date("2026-03-21T00:00:00.000Z"),
      returnedAt: new Date("2026-04-03T00:00:00.000Z"),
      cancellationReason: null,
      cancelledAt: null,
    })
    ctx.prisma.rentalTransaction.findUnique
      .mockResolvedValueOnce({ id: "txn-1", status: "RETURNED" })
      .mockResolvedValueOnce({ id: "txn-1", status: "COMPLETED" })

    const caller = bookingRouter.createCaller({
      ...ctx,
      user: { ...mockUser, id: LENDER_ID, email: "lender@up.edu.ph" },
    } as never)

    const completedBooking = await caller.update({
      id: BOOKING_ID,
      status: "COMPLETED",
    })

    expect(findSystemCommissionTransactionMock).toHaveBeenCalledWith(
      BOOKING_ID,
      undefined,
      ctx.prisma,
    )
    expect(creditCommissionToSystemWalletMock).toHaveBeenCalledWith(
      20,
      expect.objectContaining({
        relatedEntityType: "BOOKING",
        relatedEntityId: BOOKING_ID,
        metadata: expect.objectContaining({
          sourceTransactionId: "txn-1",
          grossAmount: 400,
          commissionRatePercent: 5,
        }),
      }),
      ctx.prisma,
    )
    expect(creditToWalletMock).toHaveBeenCalledWith(
      LENDER_ID,
      380,
      expect.objectContaining({
        type: "EARNING",
        relatedEntityType: "BOOKING",
        relatedEntityId: BOOKING_ID,
      }),
      ctx.prisma,
    )
    expect(completedBooking.status).toBe("COMPLETED")
  })

  it("rejects completion when the recorded return happened before the rental period starts", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findUnique.mockResolvedValueOnce(
      makeBooking({
        lenderId: LENDER_ID,
        status: "RETURNED",
        confirmedAt: new Date("2026-04-20T04:27:50.025Z"),
        startDate: new Date("2026-04-30T01:00:00.000Z"),
        endDate: new Date("2026-04-30T10:00:00.000Z"),
        returnedAt: new Date("2026-04-20T04:36:08.194Z"),
      }),
    )
    const caller = bookingRouter.createCaller({
      ...ctx,
      user: { ...mockUser, id: LENDER_ID, email: "lender@up.edu.ph" },
    } as never)

    await expect(
      caller.update({
        id: BOOKING_ID,
        status: "COMPLETED",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Only bookings returned after the rental period starts can be completed.",
    })

    expect(ctx.prisma.booking.update).not.toHaveBeenCalled()
  })
})
