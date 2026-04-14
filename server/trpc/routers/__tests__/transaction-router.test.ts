import { TRPCError } from "@trpc/server"
import { describe, expect, it, vi } from "vitest"
import { transactionRouter } from "../transaction"

const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const ITEM_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const TX_ID_1 = "11111111-1111-1111-1111-111111111111"
const TX_ID_2 = "22222222-2222-2222-2222-222222222222"

const mockUser = { id: USER_ID, email: "user@up.edu.ph", name: "Test User" }

const makeTx = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  bookingId: "booking-1",
  itemId: ITEM_ID,
  borrowerId: USER_ID,
  lenderId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  startDate: new Date("2026-04-01T00:00:00.000Z"),
  endDate: new Date("2026-04-03T00:00:00.000Z"),
  totalAmount: 500,
  status: "PENDING",
  createdAt: new Date("2026-03-15T00:00:00.000Z"),
  updatedAt: new Date("2026-03-15T00:00:00.000Z"),
  item: { id: ITEM_ID, name: "Camera", thumbnailImage: null, rateOption: "PER_DAY" },
  reviews: [],
  borrower: {
    user: { username: "borrower1", firstName: "Borrow", middleName: null, lastName: "Er" },
  },
  lender: { user: { username: "lender1", firstName: "Lend", middleName: null, lastName: "Er" } },
  ...overrides,
})

const makeContext = (user = mockUser, findMany = vi.fn().mockResolvedValue([])) => {
  const prisma = {
    $transaction: vi.fn(),
    rentalTransaction: {
      findMany,
      findUnique: vi.fn(),
    },
    transactionReview: {
      create: vi.fn(),
      aggregate: vi.fn().mockResolvedValue({
        _avg: {
          rating: 5,
        },
      }),
    },
    transactionReviewDraft: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    item: {
      update: vi.fn().mockResolvedValue({ id: ITEM_ID }),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: USER_ID,
          username: "borrower1",
          firstName: "Borrow",
          middleName: null,
          lastName: "Er",
        },
        {
          id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
          username: "lender1",
          firstName: "Lend",
          middleName: null,
          lastName: "Er",
        },
      ]),
    },
  }

  prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
    callback(prisma),
  )

  return {
    event: { context: {} } as never,
    prisma,
    user,
  }
}

describe("transactionRouter", () => {
  describe("list", () => {
    it("returns transactions for the authenticated user (no role filter uses OR clause)", async () => {
      const findMany = vi.fn().mockResolvedValue([makeTx(TX_ID_1)])
      const caller = transactionRouter.createCaller(makeContext(mockUser, findMany) as never)

      const result = await caller.list({})

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: [{ lenderId: USER_ID }, { borrowerId: USER_ID }],
              }),
            ]),
          }),
        }),
      )
      expect(result.transactions).toHaveLength(1)
      expect(result.nextCursor).toBeNull()
      expect(result.transactions[0]?.reviewState.canSubmitAny).toBe(false)
    })

    it("filters by role LENDER", async () => {
      const findMany = vi.fn().mockResolvedValue([])
      const caller = transactionRouter.createCaller(makeContext(mockUser, findMany) as never)

      await caller.list({ role: "LENDER" })

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ lenderId: USER_ID }]),
          }),
        }),
      )
    })

    it("filters by role BORROWER", async () => {
      const findMany = vi.fn().mockResolvedValue([])
      const caller = transactionRouter.createCaller(makeContext(mockUser, findMany) as never)

      await caller.list({ role: "BORROWER" })

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ borrowerId: USER_ID }]),
          }),
        }),
      )
    })

    it("filters by status", async () => {
      const findMany = vi.fn().mockResolvedValue([])
      const caller = transactionRouter.createCaller(makeContext(mockUser, findMany) as never)

      await caller.list({ status: "COMPLETED" })

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ status: { in: ["COMPLETED"] } }]),
          }),
        }),
      )
    })

    it("filters by startDateFrom and startDateTo", async () => {
      const findMany = vi.fn().mockResolvedValue([])
      const caller = transactionRouter.createCaller(makeContext(mockUser, findMany) as never)
      const from = new Date("2026-04-01")
      const to = new Date("2026-04-30")

      await caller.list({ startDateFrom: from, startDateTo: to })

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ startDate: { gte: from, lte: to } }]),
          }),
        }),
      )
    })

    it("returns nextCursor when there are more results than the limit", async () => {
      const tx1 = makeTx(TX_ID_1)
      const tx2 = makeTx(TX_ID_2)
      // Return limit + 1 records (limit defaults to 20; we test with limit: 1)
      const findMany = vi.fn().mockResolvedValue([tx1, tx2])
      const caller = transactionRouter.createCaller(makeContext(mockUser, findMany) as never)

      const result = await caller.list({ limit: 1 })

      expect(result.transactions).toHaveLength(1)
      expect(result.nextCursor).toEqual({
        id: tx1.id,
        createdAt: tx1.createdAt,
      })
    })

    it("returns null nextCursor when results fit within the limit", async () => {
      const findMany = vi.fn().mockResolvedValue([makeTx(TX_ID_1)])
      const caller = transactionRouter.createCaller(makeContext(mockUser, findMany) as never)

      const result = await caller.list({ limit: 20 })

      expect(result.transactions).toHaveLength(1)
      expect(result.nextCursor).toBeNull()
    })

    it("applies cursor pagination where clause when cursor is provided", async () => {
      const findMany = vi.fn().mockResolvedValue([])
      const caller = transactionRouter.createCaller(makeContext(mockUser, findMany) as never)
      const cursor = { id: TX_ID_1, createdAt: new Date("2026-03-15T00:00:00.000Z") }

      await caller.list({ cursor })

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              },
            ]),
          }),
        }),
      )
    })

    it("throws UNAUTHORIZED when the user is not authenticated", async () => {
      const caller = transactionRouter.createCaller(makeContext(null as never) as never)

      await expect(caller.list({})).rejects.toThrow(TRPCError)
      await expect(caller.list({})).rejects.toMatchObject({ code: "UNAUTHORIZED" })
    })

    it("marks completed transactions as reviewable only when the current user has not submitted yet", async () => {
      const findMany = vi.fn().mockResolvedValue([
        makeTx(TX_ID_1, { status: "COMPLETED", reviews: [] }),
        makeTx(TX_ID_2, {
          status: "COMPLETED",
          reviews: [{ reviewType: "ITEM_REVIEW" }],
        }),
      ])
      const caller = transactionRouter.createCaller(makeContext(mockUser, findMany) as never)

      const result = await caller.list({})

      expect(result.transactions[0]?.reviewState.canSubmitAny).toBe(true)
      expect(result.transactions[0]?.reviewState.actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ reviewType: "ITEM_REVIEW", canSubmit: true }),
          expect.objectContaining({ reviewType: "LENDER_REVIEW", canSubmit: true }),
        ]),
      )
      expect(result.transactions[1]?.reviewState.actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ reviewType: "ITEM_REVIEW", hasSubmitted: true }),
          expect.objectContaining({ reviewType: "LENDER_REVIEW", canSubmit: true }),
        ]),
      )
    })
  })

  describe("createReview", () => {
    it("creates a review for a completed transaction participant", async () => {
      const ctx = makeContext()
      ctx.prisma.rentalTransaction.findUnique.mockResolvedValue({
        id: TX_ID_1,
        itemId: ITEM_ID,
        status: "COMPLETED",
        borrowerId: USER_ID,
        lenderId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        reviews: [],
      })
      ctx.prisma.transactionReview.create.mockResolvedValue({
        id: "review-1",
        transactionId: TX_ID_1,
        reviewerUserId: USER_ID,
        reviewType: "ITEM_REVIEW",
        revieweeUserId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        itemId: ITEM_ID,
        rating: 5,
        reviewText: "Smooth and easy.",
        images: [
          "https://example.supabase.co/storage/v1/object/public/item-images/reviews/u/r1.jpg",
        ],
        isAnonymous: false,
        createdAt: new Date("2026-04-14T00:00:00.000Z"),
        reviewerUser: {
          id: USER_ID,
          username: "borrower1",
          firstName: "Borrow",
          middleName: null,
          lastName: "Er",
          avatarUrl: null,
        },
        revieweeUser: {
          id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
          username: "lender1",
          firstName: "Lend",
          middleName: null,
          lastName: "Er",
          avatarUrl: null,
        },
      })

      const caller = transactionRouter.createCaller(ctx as never)
      const result = await caller.createReview({
        transactionId: TX_ID_1,
        reviewType: "ITEM_REVIEW",
        rating: 5,
        reviewText: "Smooth and easy.",
        images: [
          "https://example.supabase.co/storage/v1/object/public/item-images/reviews/u/r1.jpg",
        ],
        isAnonymous: false,
      })

      expect(ctx.prisma.transactionReview.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            transactionId: TX_ID_1,
            reviewerUserId: USER_ID,
            reviewType: "ITEM_REVIEW",
            revieweeUserId: null,
            itemId: ITEM_ID,
            rating: 5,
            images: [
              "https://example.supabase.co/storage/v1/object/public/item-images/reviews/u/r1.jpg",
            ],
          }),
        }),
      )
      expect(ctx.prisma.item.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ITEM_ID },
        }),
      )
      expect(ctx.prisma.transactionReviewDraft.deleteMany).toHaveBeenCalledWith({
        where: {
          transactionId: TX_ID_1,
          reviewerUserId: USER_ID,
          reviewType: "ITEM_REVIEW",
        },
      })
      expect(result.reviewer.displayName).toBe("Borrow E.")
    })

    it("rejects review creation for non-completed transactions", async () => {
      const ctx = makeContext()
      ctx.prisma.rentalTransaction.findUnique.mockResolvedValue({
        id: TX_ID_1,
        itemId: ITEM_ID,
        status: "RETURNED",
        borrowerId: USER_ID,
        lenderId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        reviews: [],
      })

      const caller = transactionRouter.createCaller(ctx as never)

      await expect(
        caller.createReview({
          transactionId: TX_ID_1,
          reviewType: "ITEM_REVIEW",
          rating: 4,
          reviewText: "Too early",
          images: [],
        }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Reviews can only be submitted for completed transactions.",
      })
    })

    it("rejects duplicate review submissions", async () => {
      const ctx = makeContext()
      ctx.prisma.rentalTransaction.findUnique.mockResolvedValue({
        id: TX_ID_1,
        itemId: ITEM_ID,
        status: "COMPLETED",
        borrowerId: USER_ID,
        lenderId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        reviews: [{ reviewType: "ITEM_REVIEW" }],
      })

      const caller = transactionRouter.createCaller(ctx as never)

      await expect(
        caller.createReview({
          transactionId: TX_ID_1,
          reviewType: "ITEM_REVIEW",
          rating: 5,
          reviewText: "Already sent",
          images: [],
        }),
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message: "You have already submitted this review for the transaction.",
      })
    })

    it("rejects users who are not part of the transaction", async () => {
      const ctx = makeContext()
      ctx.prisma.rentalTransaction.findUnique.mockResolvedValue({
        id: TX_ID_1,
        itemId: ITEM_ID,
        status: "COMPLETED",
        borrowerId: "other-borrower",
        lenderId: "other-lender",
        reviews: [],
      })

      const caller = transactionRouter.createCaller(ctx as never)

      await expect(
        caller.createReview({
          transactionId: TX_ID_1,
          reviewType: "ITEM_REVIEW",
          rating: 5,
          reviewText: "Not mine",
          images: [],
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Only transaction participants can submit a review.",
      })
    })

    it("allows borrowers to submit lender review separately after item review", async () => {
      const ctx = makeContext()
      ctx.prisma.rentalTransaction.findUnique.mockResolvedValue({
        id: TX_ID_1,
        itemId: ITEM_ID,
        status: "COMPLETED",
        borrowerId: USER_ID,
        lenderId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        reviews: [{ reviewType: "ITEM_REVIEW" }],
      })
      ctx.prisma.transactionReview.create.mockResolvedValue({
        id: "review-2",
        transactionId: TX_ID_1,
        reviewerUserId: USER_ID,
        reviewType: "LENDER_REVIEW",
        revieweeUserId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        itemId: null,
        rating: 4,
        reviewText: "Helpful lender.",
        images: [],
        isAnonymous: false,
        createdAt: new Date("2026-04-14T00:00:00.000Z"),
        reviewerUser: {
          id: USER_ID,
          username: "borrower1",
          firstName: "Borrow",
          middleName: null,
          lastName: "Er",
          avatarUrl: null,
        },
        revieweeUser: {
          id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
          username: "lender1",
          firstName: "Lend",
          middleName: null,
          lastName: "Er",
          avatarUrl: null,
        },
      })

      const caller = transactionRouter.createCaller(ctx as never)
      await caller.createReview({
        transactionId: TX_ID_1,
        reviewType: "LENDER_REVIEW",
        rating: 4,
        reviewText: "Helpful lender.",
        images: [],
      })

      expect(ctx.prisma.transactionReview.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reviewType: "LENDER_REVIEW",
            revieweeUserId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
            itemId: null,
            images: [],
          }),
        }),
      )
      expect(ctx.prisma.item.update).not.toHaveBeenCalled()
    })

    it("rejects invalid review types for the lender role", async () => {
      const lenderContext = makeContext({
        id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        email: "lender@up.edu.ph",
        name: "Lender User",
      })
      lenderContext.prisma.rentalTransaction.findUnique.mockResolvedValue({
        id: TX_ID_1,
        itemId: ITEM_ID,
        status: "COMPLETED",
        borrowerId: USER_ID,
        lenderId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        reviews: [],
      })

      const caller = transactionRouter.createCaller(lenderContext as never)

      await expect(
        caller.createReview({
          transactionId: TX_ID_1,
          reviewType: "ITEM_REVIEW",
          rating: 5,
          reviewText: "Not allowed",
          images: [],
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "This review type is not allowed for your role in the transaction.",
      })
    })

    it("returns a saved review draft for the current user", async () => {
      const ctx = makeContext()
      ctx.prisma.rentalTransaction.findUnique.mockResolvedValue({
        id: TX_ID_1,
        itemId: ITEM_ID,
        status: "COMPLETED",
        borrowerId: USER_ID,
        lenderId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        reviews: [],
      })
      ctx.prisma.transactionReviewDraft.findUnique.mockResolvedValue({
        transactionId: TX_ID_1,
        reviewType: "ITEM_REVIEW",
        rating: 5,
        reviewText: "Draft text",
        images: [
          "https://example.supabase.co/storage/v1/object/public/item-images/reviews/u/r1.jpg",
        ],
        isAnonymous: false,
        updatedAt: new Date("2026-04-15T00:00:00.000Z"),
      })

      const caller = transactionRouter.createCaller(ctx as never)
      const result = await caller.getReviewDraft({
        transactionId: TX_ID_1,
        reviewType: "ITEM_REVIEW",
      })

      expect(result).toMatchObject({
        transactionId: TX_ID_1,
        reviewType: "ITEM_REVIEW",
        images: [
          "https://example.supabase.co/storage/v1/object/public/item-images/reviews/u/r1.jpg",
        ],
      })
    })

    it("upserts a review draft for the current user", async () => {
      const ctx = makeContext()
      ctx.prisma.rentalTransaction.findUnique.mockResolvedValue({
        id: TX_ID_1,
        itemId: ITEM_ID,
        status: "COMPLETED",
        borrowerId: USER_ID,
        lenderId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        reviews: [],
      })
      ctx.prisma.transactionReviewDraft.upsert.mockResolvedValue({
        transactionId: TX_ID_1,
        reviewType: "ITEM_REVIEW",
        rating: 4,
        reviewText: "Saved draft",
        images: [
          "https://example.supabase.co/storage/v1/object/public/item-images/reviews/u/r2.jpg",
        ],
        isAnonymous: true,
        updatedAt: new Date("2026-04-15T00:00:00.000Z"),
      })

      const caller = transactionRouter.createCaller(ctx as never)
      const result = await caller.upsertReviewDraft({
        transactionId: TX_ID_1,
        reviewType: "ITEM_REVIEW",
        rating: 4,
        reviewText: "Saved draft",
        images: [
          "https://example.supabase.co/storage/v1/object/public/item-images/reviews/u/r2.jpg",
        ],
        isAnonymous: true,
      })

      expect(ctx.prisma.transactionReviewDraft.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            transactionId: TX_ID_1,
            reviewerUserId: USER_ID,
            reviewType: "ITEM_REVIEW",
          }),
          update: expect.objectContaining({
            reviewText: "Saved draft",
          }),
        }),
      )
      expect(result).toMatchObject({
        transactionId: TX_ID_1,
        reviewType: "ITEM_REVIEW",
        isAnonymous: true,
      })
    })
  })
})
