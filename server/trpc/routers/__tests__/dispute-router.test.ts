import { TRPCError } from "@trpc/server"
import { describe, expect, it, vi } from "vitest"
import { disputeRouter } from "../dispute"
import {
  ACTIVE_DISPUTE_STATUSES,
  OPEN_DISPUTE_STATUS,
  REJECTED_DISPUTE_STATUS,
  SUBMITTED_DISPUTE_STATUS,
} from "../../../utils/dispute-status"

const DAY_IN_MS = 24 * 60 * 60 * 1000
const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const ADMIN_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const OTHER_USER_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"
const TRANSACTION_ID = "11111111-1111-1111-1111-111111111111"
const BOOKING_ID = "44444444-4444-4444-4444-444444444444"
const DISPUTE_ID = "22222222-2222-2222-2222-222222222222"

const sessionUser = (id = USER_ID) => ({
  id,
  email: `${id}@up.edu.ph`,
  name: "Session User",
})

const makeRecentCompletedAt = () => new Date(Date.now() - 2 * DAY_IN_MS)
const makeRecentReviewedAt = () => new Date(Date.now() - 1 * DAY_IN_MS)

const makeDisputeRecord = (overrides: Record<string, unknown> = {}) => ({
  id: DISPUTE_ID,
  transactionId: TRANSACTION_ID,
  raisedById: USER_ID,
  reason: "Borrower reported an issue with the item return.",
  description: "The lender refused to acknowledge the return schedule.",
  resolution: null,
  status: SUBMITTED_DISPUTE_STATUS,
  reviewedAt: null,
  createdAt: new Date("2026-04-10T09:00:00.000Z"),
  raisedBy: {
    id: USER_ID,
    username: "borrower1",
    email: "borrower@up.edu.ph",
    firstName: "Borrow",
    middleName: null,
    lastName: "Er",
  },
  reviewedBy: null,
  transaction: {
    id: TRANSACTION_ID,
    bookingId: BOOKING_ID,
    borrowerId: USER_ID,
    lenderId: OTHER_USER_ID,
    item: {
      id: "item-1",
      name: "Camera",
      images: [],
    },
    borrower: {
      id: USER_ID,
      username: "borrower1",
      email: "borrower@up.edu.ph",
      firstName: "Borrow",
      middleName: null,
      lastName: "Er",
    },
    lender: {
      id: OTHER_USER_ID,
      username: "lender1",
      email: "lender@up.edu.ph",
      firstName: "Lend",
      middleName: null,
      lastName: "Er",
    },
  },
  ...overrides,
})

const makeReportableBooking = (overrides: Record<string, unknown> = {}) => ({
  id: BOOKING_ID,
  completedAt: makeRecentCompletedAt(),
  borrowerId: USER_ID,
  lenderId: OTHER_USER_ID,
  item: {
    id: "item-1",
    name: "Camera",
  },
  borrower: {
    user: {
      id: USER_ID,
      username: "borrower1",
      email: "borrower@up.edu.ph",
      firstName: "Borrow",
      middleName: null,
      lastName: "Er",
    },
  },
  lender: {
    user: {
      id: OTHER_USER_ID,
      username: "lender1",
      email: "lender@up.edu.ph",
      firstName: "Lend",
      middleName: null,
      lastName: "Er",
    },
  },
  ...overrides,
})

const makeContext = (options?: { accountType?: "ADMIN" | "BORROWER"; userId?: string }) => {
  const rentalTransaction = {
    findUnique: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
  }

  const booking = {
    findUnique: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
  }

  const transactionDispute = {
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn(),
    create: vi.fn().mockResolvedValue(makeDisputeRecord()),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  }

  const prisma = {
    $transaction: vi.fn(),
    user: {
      findUnique: vi.fn().mockResolvedValue({ accountType: options?.accountType ?? "BORROWER" }),
    },
    rentalTransaction,
    booking,
    transactionDispute,
  }

  prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
    callback(prisma),
  )

  return {
    event: { context: {} } as never,
    prisma,
    user: sessionUser(options?.userId ?? USER_ID),
  }
}

describe("disputeRouter", () => {
  it("creates a submitted dispute for a transaction participant with a recent completed booking", async () => {
    const ctx = makeContext()
    ctx.prisma.rentalTransaction.findUnique.mockResolvedValue({
      id: TRANSACTION_ID,
      bookingId: BOOKING_ID,
      borrowerId: USER_ID,
      lenderId: OTHER_USER_ID,
      itemId: "item-1",
    })
    ctx.prisma.booking.findUnique.mockResolvedValue({
      id: BOOKING_ID,
      status: "COMPLETED",
      completedAt: makeRecentCompletedAt(),
    })

    const caller = disputeRouter.createCaller(ctx as never)

    const result = await caller.submit({
      transactionId: TRANSACTION_ID,
      reason: "Item was already damaged when I received it.",
      description: "The issue was not disclosed in the listing details.",
    })

    expect(ctx.prisma.transactionDispute.findFirst).toHaveBeenCalledWith({
      where: {
        transactionId: TRANSACTION_ID,
        status: { in: [...ACTIVE_DISPUTE_STATUSES] },
      },
      select: { id: true },
    })
    expect(ctx.prisma.transactionDispute.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionId: TRANSACTION_ID,
          raisedById: USER_ID,
          status: SUBMITTED_DISPUTE_STATUS,
          reason: "Item was already damaged when I received it.",
        }),
      }),
    )
    expect(result.status).toBe("SUBMITTED")
  })

  it("blocks dispute submission from non-participants", async () => {
    const ctx = makeContext({ userId: ADMIN_ID })
    ctx.prisma.rentalTransaction.findUnique.mockResolvedValue({
      id: TRANSACTION_ID,
      bookingId: BOOKING_ID,
      borrowerId: USER_ID,
      lenderId: OTHER_USER_ID,
      itemId: "item-1",
    })

    const caller = disputeRouter.createCaller(ctx as never)

    await expect(
      caller.submit({
        transactionId: TRANSACTION_ID,
        reason: "I should not be allowed to do this.",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only transaction participants can submit a dispute.",
    })

    expect(ctx.prisma.transactionDispute.create).not.toHaveBeenCalled()
  })

  it("blocks duplicate active disputes for the same transaction", async () => {
    const ctx = makeContext()
    ctx.prisma.rentalTransaction.findUnique.mockResolvedValue({
      id: TRANSACTION_ID,
      bookingId: BOOKING_ID,
      borrowerId: USER_ID,
      lenderId: OTHER_USER_ID,
      itemId: "item-1",
    })
    ctx.prisma.booking.findUnique.mockResolvedValue({
      id: BOOKING_ID,
      status: "COMPLETED",
      completedAt: makeRecentCompletedAt(),
    })
    ctx.prisma.transactionDispute.findFirst.mockResolvedValue({ id: DISPUTE_ID })

    const caller = disputeRouter.createCaller(ctx as never)

    await expect(
      caller.submit({
        transactionId: TRANSACTION_ID,
        reason: "Duplicate attempt",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "An active dispute already exists for this transaction.",
    })
  })

  it("lists a user's disputes across submitted concerns and formal disputes", async () => {
    const ctx = makeContext()
    ctx.prisma.transactionDispute.findMany.mockResolvedValue([makeDisputeRecord()])

    const caller = disputeRouter.createCaller(ctx as never)
    const result = await caller.mine()

    expect(ctx.prisma.transactionDispute.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { raisedById: USER_ID },
          { transaction: { borrowerId: USER_ID } },
          { transaction: { lenderId: USER_ID } },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: expect.any(Object),
    })
    expect(result.disputes).toHaveLength(1)
    expect(result.disputes[0]).toMatchObject({
      id: DISPUTE_ID,
      status: "SUBMITTED",
      counterpartName: "Lend E.",
    })
  })

  it("lists only recent completed transactions without active disputes as reportable", async () => {
    const ctx = makeContext()
    ctx.prisma.booking.findMany.mockResolvedValue([makeReportableBooking()])
    ctx.prisma.rentalTransaction.findMany.mockResolvedValue([
      {
        id: TRANSACTION_ID,
        bookingId: BOOKING_ID,
        disputes: [],
      },
    ])

    const caller = disputeRouter.createCaller(ctx as never)
    const result = await caller.reportableTransactions()

    expect(ctx.prisma.booking.findMany).toHaveBeenCalledWith({
      where: {
        status: "COMPLETED",
        completedAt: {
          gte: expect.any(Date),
        },
        OR: [{ borrowerId: USER_ID }, { lenderId: USER_ID }],
      },
      orderBy: [{ completedAt: "desc" }, { id: "desc" }],
      select: expect.any(Object),
    })
    expect(result.transactions).toEqual([
      expect.objectContaining({
        transactionId: TRANSACTION_ID,
        bookingId: BOOKING_ID,
        viewerRole: "BORROWER",
        counterpartName: "Lend E.",
      }),
    ])
  })

  it("lists submitted disputes for admins", async () => {
    const ctx = makeContext({ accountType: "ADMIN", userId: ADMIN_ID })
    ctx.prisma.transactionDispute.findMany.mockResolvedValue([makeDisputeRecord()])

    const caller = disputeRouter.createCaller(ctx as never)
    const result = await caller.list({})

    expect(ctx.prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: ADMIN_ID },
      select: { accountType: true },
    })
    expect(ctx.prisma.transactionDispute.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: SUBMITTED_DISPUTE_STATUS },
      }),
    )
    expect(result.disputes).toHaveLength(1)
  })

  it("blocks admin queue access for non-admin users", async () => {
    const ctx = makeContext()
    const caller = disputeRouter.createCaller(ctx as never)

    await expect(caller.list({})).rejects.toThrow(TRPCError)
    await expect(caller.list({})).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only admins can access this resource.",
    })
  })

  it("approves a submitted dispute and records the reviewer", async () => {
    const ctx = makeContext({ accountType: "ADMIN", userId: ADMIN_ID })
    ctx.prisma.transactionDispute.findUnique.mockResolvedValue(
      makeDisputeRecord({
        status: "OPEN",
        reviewedAt: new Date("2026-04-10T10:00:00.000Z"),
        reviewedBy: {
          id: ADMIN_ID,
          username: "admin1",
          email: "admin@up.edu.ph",
          firstName: "Admin",
          middleName: null,
          lastName: "User",
        },
      }),
    )

    const caller = disputeRouter.createCaller(ctx as never)
    const result = await caller.review({
      id: DISPUTE_ID,
      decision: "APPROVE",
    })

    expect(ctx.prisma.transactionDispute.updateMany).toHaveBeenCalledWith({
      where: {
        id: DISPUTE_ID,
        status: SUBMITTED_DISPUTE_STATUS,
      },
      data: expect.objectContaining({
        status: OPEN_DISPUTE_STATUS,
        reviewedById: ADMIN_ID,
      }),
    })
    expect(result.status).toBe("OPEN")
  })

  it("rejects review attempts for disputes that are no longer submitted", async () => {
    const ctx = makeContext({ accountType: "ADMIN", userId: ADMIN_ID })
    ctx.prisma.transactionDispute.updateMany.mockResolvedValue({ count: 0 })
    ctx.prisma.transactionDispute.findUnique.mockResolvedValue({
      id: DISPUTE_ID,
      status: REJECTED_DISPUTE_STATUS,
    })

    const caller = disputeRouter.createCaller(ctx as never)

    await expect(
      caller.review({
        id: DISPUTE_ID,
        decision: "REJECT",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Only disputes that are under review can be approved or rejected.",
    })
  })

  it("allows participants to appeal recent rejected disputes", async () => {
    const ctx = makeContext()
    ctx.prisma.transactionDispute.findUnique
      .mockResolvedValueOnce({
        id: DISPUTE_ID,
        status: REJECTED_DISPUTE_STATUS,
        reviewedAt: makeRecentReviewedAt(),
        resolution: "Initial rejection details.",
        transaction: {
          borrowerId: USER_ID,
          lenderId: OTHER_USER_ID,
        },
      })
      .mockResolvedValueOnce(
        makeDisputeRecord({
          status: "APPEALED",
          reviewedAt: makeRecentReviewedAt(),
          resolution: "Initial rejection details.\n\nAppeal requested on 2026-04-18T00:00:00.000Z",
        }),
      )

    const caller = disputeRouter.createCaller(ctx as never)
    const result = await caller.appeal({
      id: DISPUTE_ID,
      appealReason: "New dated photos show the item condition during return.",
      evidenceFileNames: ["return-photo.png"],
    })

    expect(ctx.prisma.transactionDispute.updateMany).toHaveBeenCalledWith({
      where: {
        id: DISPUTE_ID,
        status: REJECTED_DISPUTE_STATUS,
      },
      data: expect.objectContaining({
        resolution: expect.stringContaining(
          "New dated photos show the item condition during return.",
        ),
      }),
    })
    expect(result.status).toBe("APPEALED")
  })

  it("blocks appeals for rejected disputes outside the appeal window", async () => {
    const ctx = makeContext()
    ctx.prisma.transactionDispute.findUnique.mockResolvedValue({
      id: DISPUTE_ID,
      status: REJECTED_DISPUTE_STATUS,
      reviewedAt: new Date(Date.now() - 20 * DAY_IN_MS),
      resolution: "Initial rejection details.",
      transaction: {
        borrowerId: USER_ID,
        lenderId: OTHER_USER_ID,
      },
    })

    const caller = disputeRouter.createCaller(ctx as never)

    await expect(
      caller.appeal({
        id: DISPUTE_ID,
        appealReason: "Please review again.",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Only recently rejected disputes can be appealed.",
    })
  })
})
