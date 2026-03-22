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
  borrower: {
    user: { username: "borrower1", firstName: "Borrow", middleName: null, lastName: "Er" },
  },
  lender: { user: { username: "lender1", firstName: "Lend", middleName: null, lastName: "Er" } },
  ...overrides,
})

const makeContext = (user = mockUser, findMany = vi.fn().mockResolvedValue([])) => ({
  event: { context: {} } as never,
  prisma: { rentalTransaction: { findMany } } as never,
  user,
})

describe("transactionRouter", () => {
  describe("list", () => {
    it("returns transactions for the authenticated user (no role filter uses OR clause)", async () => {
      const findMany = vi.fn().mockResolvedValue([makeTx(TX_ID_1)])
      const caller = transactionRouter.createCaller(makeContext(mockUser, findMany))

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
    })

    it("filters by role LENDER", async () => {
      const findMany = vi.fn().mockResolvedValue([])
      const caller = transactionRouter.createCaller(makeContext(mockUser, findMany))

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
      const caller = transactionRouter.createCaller(makeContext(mockUser, findMany))

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
      const caller = transactionRouter.createCaller(makeContext(mockUser, findMany))

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
      const caller = transactionRouter.createCaller(makeContext(mockUser, findMany))
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
      const caller = transactionRouter.createCaller(makeContext(mockUser, findMany))

      const result = await caller.list({ limit: 1 })

      expect(result.transactions).toHaveLength(1)
      expect(result.nextCursor).toEqual({
        id: tx1.id,
        createdAt: tx1.createdAt,
      })
    })

    it("returns null nextCursor when results fit within the limit", async () => {
      const findMany = vi.fn().mockResolvedValue([makeTx(TX_ID_1)])
      const caller = transactionRouter.createCaller(makeContext(mockUser, findMany))

      const result = await caller.list({ limit: 20 })

      expect(result.transactions).toHaveLength(1)
      expect(result.nextCursor).toBeNull()
    })

    it("applies cursor pagination where clause when cursor is provided", async () => {
      const findMany = vi.fn().mockResolvedValue([])
      const caller = transactionRouter.createCaller(makeContext(mockUser, findMany))
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
      const caller = transactionRouter.createCaller(makeContext(null as never))

      await expect(caller.list({})).rejects.toThrow(TRPCError)
      await expect(caller.list({})).rejects.toMatchObject({ code: "UNAUTHORIZED" })
    })
  })
})
