import { TRPCError } from "@trpc/server"
import { describe, expect, it, vi } from "vitest"
import { disputeRouter } from "../dispute"
import {
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
  finalDecision: null,
  finalDecisionNotes: null,
  finalDecisionAt: null,
  requiredActionCount: 0,
  closedAt: null,
  createdAt: new Date("2026-04-10T09:00:00.000Z"),
  raisedBy: {
    id: USER_ID,
    username: "borrower1",
    email: "borrower@up.edu.ph",
    firstName: "Borrow",
    middleName: null,
    lastName: "Er",
    status: "ACTIVE",
    points: 40,
  },
  reviewedBy: null,
  finalDecisionBy: null,
  actions: [],
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
      status: "ACTIVE",
      points: 40,
    },
    lender: {
      id: OTHER_USER_ID,
      username: "lender1",
      email: "lender@up.edu.ph",
      firstName: "Lend",
      middleName: null,
      lastName: "Er",
      status: "ACTIVE",
      points: 25,
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
      status: "ACTIVE",
      points: 40,
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
      status: "ACTIVE",
      points: 25,
    },
  },
  ...overrides,
})

const makeContext = (options?: { accountType?: "ADMIN" | "BORROWER"; userId?: string }) => {
  const rentalTransaction = {
    findUnique: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({ id: TRANSACTION_ID }),
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

  const transactionDisputeAction = {
    create: vi.fn().mockResolvedValue({ id: "action-1" }),
  }

  const appNotification = {
    create: vi.fn().mockResolvedValue({ id: "notif-1" }),
  }

  const prisma = {
    $transaction: vi.fn(),
    user: {
      findUnique: vi.fn().mockResolvedValue({ accountType: options?.accountType ?? "BORROWER" }),
      findMany: vi.fn().mockResolvedValue([
        { id: USER_ID, status: "ACTIVE", points: 40 },
        { id: OTHER_USER_ID, status: "ACTIVE", points: 25 },
      ]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    rentalTransaction,
    booking,
    transactionDispute,
    transactionDisputeAction,
    appNotification,
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
  it("opens a dispute immediately for a transaction participant with a recent completed booking", async () => {
    const ctx = makeContext()
    ctx.prisma.transactionDispute.create.mockResolvedValue(
      makeDisputeRecord({
        status: OPEN_DISPUTE_STATUS,
      }),
    )
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
      },
      select: { id: true },
    })
    expect(ctx.prisma.transactionDispute.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionId: TRANSACTION_ID,
          raisedById: USER_ID,
          status: OPEN_DISPUTE_STATUS,
          reason: "Item was already damaged when I received it.",
        }),
      }),
    )
    expect(ctx.prisma.appNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipientUserId: OTHER_USER_ID,
          actorUserId: USER_ID,
          bookingId: BOOKING_ID,
          type: "DISPUTE_OPENED",
          actionPath: `/account/transactions/${BOOKING_ID}?action=rebuttal`,
        }),
      }),
    )
    expect(result.status).toBe("OPEN")
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

  it("blocks duplicate dispute records for the same transaction", async () => {
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
      message: "A dispute has already been filed for this transaction.",
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
          {
            OR: [{ transaction: { borrowerId: USER_ID } }, { transaction: { lenderId: USER_ID } }],
          },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: expect.any(Object),
    })
    expect(result.disputes).toHaveLength(1)
    expect(result.disputes[0]).toMatchObject({
      id: DISPUTE_ID,
      status: "OPEN",
      counterpartName: "Lend E.",
    })
  })

  it("exposes another user's submitted concern to the counterparty in temporary direct-open mode", async () => {
    const ctx = makeContext({ userId: OTHER_USER_ID })
    ctx.prisma.transactionDispute.findMany.mockResolvedValue([makeDisputeRecord()])

    const caller = disputeRouter.createCaller(ctx as never)
    const result = await caller.mine()

    expect(ctx.prisma.transactionDispute.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { raisedById: OTHER_USER_ID },
          {
            OR: [
              { transaction: { borrowerId: OTHER_USER_ID } },
              { transaction: { lenderId: OTHER_USER_ID } },
            ],
          },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: expect.any(Object),
    })
    expect(result.disputes).toMatchObject([
      {
        id: DISPUTE_ID,
        status: "OPEN",
        canSubmitRebuttal: true,
      },
    ])
  })
  it("lists only recent completed transactions without dispute records as reportable", async () => {
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
        status: {
          in: [SUBMITTED_DISPUTE_STATUS, "APPEALED"],
        },
        finalDecisionAt: null,
        closedAt: null,
      },
      data: expect.objectContaining({
        status: OPEN_DISPUTE_STATUS,
        reviewedById: ADMIN_ID,
      }),
    })
    expect(ctx.prisma.appNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipientUserId: OTHER_USER_ID,
          actorUserId: USER_ID,
          bookingId: BOOKING_ID,
          type: "DISPUTE_OPENED",
          actionPath: `/account/transactions/${BOOKING_ID}?action=rebuttal`,
        }),
      }),
    )
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
      message: "Only disputes that are under review or under appeal can be approved or rejected.",
    })
  })

  it("records final judgment and applies multiple actions before closure", async () => {
    const ctx = makeContext({ accountType: "ADMIN", userId: ADMIN_ID })
    ctx.prisma.transactionDispute.findUnique
      .mockResolvedValueOnce({
        id: DISPUTE_ID,
        status: OPEN_DISPUTE_STATUS,
        transactionId: TRANSACTION_ID,
        finalDecisionAt: null,
        closedAt: null,
        transaction: {
          borrowerId: USER_ID,
          lenderId: OTHER_USER_ID,
        },
      })
      .mockResolvedValueOnce(
        makeDisputeRecord({
          status: "OPEN",
          finalDecision: "APPROVED",
          finalDecisionNotes: "The lender withheld the return without valid evidence.",
          finalDecisionAt: new Date("2026-04-20T04:00:00.000Z"),
          requiredActionCount: 2,
          actions: [
            {
              id: "action-1",
              type: "POINT_DEDUCTION",
              targetUserId: OTHER_USER_ID,
              pointsDelta: -5,
              note: "Late handover and unsupported damage claim.",
              appliedAt: new Date("2026-04-20T04:00:00.000Z"),
              targetUser: {
                id: OTHER_USER_ID,
                username: "lender1",
                email: "lender@up.edu.ph",
                firstName: "Lend",
                middleName: null,
                lastName: "Er",
                status: "SUSPENDED",
                points: 20,
              },
              appliedBy: {
                id: ADMIN_ID,
                username: "admin1",
                email: "admin@up.edu.ph",
                firstName: "Admin",
                middleName: null,
                lastName: "User",
                status: "ACTIVE",
                points: 0,
              },
            },
            {
              id: "action-2",
              type: "SUSPENSION",
              targetUserId: OTHER_USER_ID,
              pointsDelta: null,
              note: "Repeat policy violations.",
              appliedAt: new Date("2026-04-20T04:01:00.000Z"),
              targetUser: {
                id: OTHER_USER_ID,
                username: "lender1",
                email: "lender@up.edu.ph",
                firstName: "Lend",
                middleName: null,
                lastName: "Er",
                status: "SUSPENDED",
                points: 20,
              },
              appliedBy: {
                id: ADMIN_ID,
                username: "admin1",
                email: "admin@up.edu.ph",
                firstName: "Admin",
                middleName: null,
                lastName: "User",
                status: "ACTIVE",
                points: 0,
              },
            },
          ],
        }),
      )

    const caller = disputeRouter.createCaller(ctx as never)
    const result = await caller.finalJudgment({
      id: DISPUTE_ID,
      decision: "APPROVED",
      decisionNotes: "The lender withheld the return without valid evidence.",
      actions: [
        {
          type: "POINT_DEDUCTION",
          targetUserId: OTHER_USER_ID,
          points: 5,
          note: "Late handover and unsupported damage claim.",
        },
        {
          type: "SUSPENSION",
          targetUserId: OTHER_USER_ID,
          note: "Repeat policy violations.",
        },
      ],
    })

    expect(ctx.prisma.transactionDispute.updateMany).toHaveBeenCalledWith({
      where: {
        id: DISPUTE_ID,
        status: OPEN_DISPUTE_STATUS,
        finalDecisionAt: null,
        closedAt: null,
      },
      data: expect.objectContaining({
        finalDecision: "APPROVED",
        finalDecisionNotes: "The lender withheld the return without valid evidence.",
        finalDecisionById: ADMIN_ID,
        requiredActionCount: 2,
      }),
    })
    expect(ctx.prisma.user.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          id: OTHER_USER_ID,
          points: { gte: 5 },
        }),
      }),
    )
    expect(ctx.prisma.user.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          id: OTHER_USER_ID,
          status: { in: ["ACTIVE", "PENDING"] },
        }),
      }),
    )
    expect(ctx.prisma.transactionDisputeAction.create).toHaveBeenCalledTimes(2)
    expect(result.finalDecision).toBe("APPROVED")
    expect(result.canClose).toBe(true)
  })

  it("closes a judged dispute and notifies both parties", async () => {
    const ctx = makeContext({ accountType: "ADMIN", userId: ADMIN_ID })
    ctx.prisma.transactionDispute.findUnique
      .mockResolvedValueOnce({
        id: DISPUTE_ID,
        status: OPEN_DISPUTE_STATUS,
        transactionId: TRANSACTION_ID,
        finalDecision: "APPROVED",
        finalDecisionNotes: "The lender withheld the return without valid evidence.",
        finalDecisionAt: new Date("2026-04-20T04:00:00.000Z"),
        requiredActionCount: 1,
        closedAt: null,
        transaction: {
          id: TRANSACTION_ID,
          bookingId: BOOKING_ID,
          borrowerId: USER_ID,
          lenderId: OTHER_USER_ID,
        },
        actions: [{ id: "action-1" }],
      })
      .mockResolvedValueOnce(
        makeDisputeRecord({
          status: "CLOSED",
          reviewedAt: new Date("2026-04-10T10:00:00.000Z"),
          finalDecision: "APPROVED",
          finalDecisionNotes: "The lender withheld the return without valid evidence.",
          finalDecisionAt: new Date("2026-04-20T04:00:00.000Z"),
          requiredActionCount: 1,
          closedAt: new Date("2026-04-20T04:05:00.000Z"),
          actions: [
            {
              id: "action-1",
              type: "WARNING",
              targetUserId: OTHER_USER_ID,
              pointsDelta: null,
              note: "Documented for policy enforcement.",
              appliedAt: new Date("2026-04-20T04:00:00.000Z"),
              targetUser: {
                id: OTHER_USER_ID,
                username: "lender1",
                email: "lender@up.edu.ph",
                firstName: "Lend",
                middleName: null,
                lastName: "Er",
                status: "ACTIVE",
                points: 25,
              },
              appliedBy: {
                id: ADMIN_ID,
                username: "admin1",
                email: "admin@up.edu.ph",
                firstName: "Admin",
                middleName: null,
                lastName: "User",
                status: "ACTIVE",
                points: 0,
              },
            },
          ],
        }),
      )

    const caller = disputeRouter.createCaller(ctx as never)
    const result = await caller.close({
      id: DISPUTE_ID,
    })

    expect(ctx.prisma.transactionDispute.updateMany).toHaveBeenCalledWith({
      where: {
        id: DISPUTE_ID,
        status: OPEN_DISPUTE_STATUS,
        finalDecisionAt: { not: null },
        closedAt: null,
      },
      data: expect.objectContaining({
        status: "CLOSED",
      }),
    })
    expect(ctx.prisma.rentalTransaction.update).toHaveBeenCalledWith({
      where: { id: TRANSACTION_ID },
      data: { status: "COMPLETED" },
    })
    expect(ctx.prisma.appNotification.create).toHaveBeenCalledTimes(2)
    expect(result.status).toBe("CLOSED")
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

  it("allows the counterparty to submit one rebuttal for a legacy submitted dispute in temporary direct-open mode", async () => {
    const ctx = makeContext({ userId: OTHER_USER_ID })
    ctx.prisma.transactionDispute.findUnique
      .mockResolvedValueOnce({
        id: DISPUTE_ID,
        status: SUBMITTED_DISPUTE_STATUS,
        raisedById: USER_ID,
        rebuttalSubmittedAt: null,
        finalDecisionAt: null,
        closedAt: null,
        transaction: {
          borrowerId: USER_ID,
          lenderId: OTHER_USER_ID,
        },
      })
      .mockResolvedValueOnce(
        makeDisputeRecord({
          status: "OPEN",
          rebuttalById: OTHER_USER_ID,
          rebuttalText: "The item was returned on time and in the agreed condition.",
          rebuttalNotes: "Chat screenshots were already shared with admin.",
          rebuttalSubmittedAt: new Date("2026-04-18T08:00:00.000Z"),
          rebuttalBy: {
            id: OTHER_USER_ID,
            username: "lender1",
            email: "lender@up.edu.ph",
            firstName: "Lend",
            middleName: null,
            lastName: "Er",
          },
        }),
      )

    const caller = disputeRouter.createCaller(ctx as never)
    const result = await caller.submitRebuttal({
      id: DISPUTE_ID,
      rebuttalText: "The item was returned on time and in the agreed condition.",
      rebuttalNotes: "Chat screenshots were already shared with admin.",
    })

    expect(ctx.prisma.transactionDispute.updateMany).toHaveBeenCalledWith({
      where: {
        id: DISPUTE_ID,
        status: {
          in: [OPEN_DISPUTE_STATUS, SUBMITTED_DISPUTE_STATUS],
        },
        finalDecisionAt: null,
        closedAt: null,
        rebuttalSubmittedAt: null,
      },
      data: expect.objectContaining({
        status: OPEN_DISPUTE_STATUS,
        rebuttalById: OTHER_USER_ID,
        rebuttalText: "The item was returned on time and in the agreed condition.",
      }),
    })
    expect(ctx.prisma.appNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipientUserId: USER_ID,
          actorUserId: OTHER_USER_ID,
          bookingId: BOOKING_ID,
          type: "DISPUTE_REBUTTAL_SUBMITTED",
          actionPath: `/account/transactions/${BOOKING_ID}`,
        }),
      }),
    )
    expect(result.hasRebuttal).toBe(true)
    expect(result.canSubmitRebuttal).toBe(false)
  })

  it("blocks the original submitter from rebutting their own dispute", async () => {
    const ctx = makeContext()
    ctx.prisma.transactionDispute.findUnique.mockResolvedValue({
      id: DISPUTE_ID,
      status: OPEN_DISPUTE_STATUS,
      raisedById: USER_ID,
      rebuttalSubmittedAt: null,
      finalDecisionAt: null,
      closedAt: null,
      transaction: {
        borrowerId: USER_ID,
        lenderId: OTHER_USER_ID,
      },
    })

    const caller = disputeRouter.createCaller(ctx as never)

    await expect(
      caller.submitRebuttal({
        id: DISPUTE_ID,
        rebuttalText: "I should not be able to rebut this.",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "You cannot submit a rebuttal to your own dispute.",
    })
  })

  it("blocks duplicate rebuttal submission", async () => {
    const ctx = makeContext({ userId: OTHER_USER_ID })
    ctx.prisma.transactionDispute.findUnique.mockResolvedValue({
      id: DISPUTE_ID,
      status: OPEN_DISPUTE_STATUS,
      raisedById: USER_ID,
      rebuttalSubmittedAt: new Date("2026-04-18T08:00:00.000Z"),
      finalDecisionAt: null,
      closedAt: null,
      transaction: {
        borrowerId: USER_ID,
        lenderId: OTHER_USER_ID,
      },
    })

    const caller = disputeRouter.createCaller(ctx as never)

    await expect(
      caller.submitRebuttal({
        id: DISPUTE_ID,
        rebuttalText: "Trying to submit again.",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "A rebuttal has already been submitted for this dispute.",
    })
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
