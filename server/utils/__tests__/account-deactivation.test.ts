import { describe, expect, it, vi } from "vitest"
import { getDeactivationEligibility } from "../account-deactivation"
import { ACTIVE_DISPUTE_STATUSES } from "../dispute-status"

const NOW = new Date("2026-04-14T12:00:00.000Z")

const createPrismaMock = (counts: [number, number, number]) => ({
  booking: {
    count: vi.fn().mockResolvedValueOnce(counts[0]).mockResolvedValueOnce(counts[1]),
  },
  transactionDispute: {
    count: vi.fn().mockResolvedValueOnce(counts[2]),
  },
})

describe("getDeactivationEligibility", () => {
  it("allows deactivation when the account has no active obligations", async () => {
    const prisma = createPrismaMock([0, 0, 0])

    const result = await getDeactivationEligibility(prisma as never, "user-1", NOW)

    expect(result).toEqual({ allowed: true, blockers: [] })
    expect(prisma.booking.count).toHaveBeenNthCalledWith(1, {
      where: {
        OR: [{ borrowerId: "user-1" }, { lenderId: "user-1" }],
        status: { in: ["CONFIRMED", "IN_DISPUTE"] },
        startDate: { lte: NOW },
        endDate: { gte: NOW },
      },
    })
    expect(prisma.booking.count).toHaveBeenNthCalledWith(2, {
      where: {
        OR: [{ borrowerId: "user-1" }, { lenderId: "user-1" }],
        status: "CONFIRMED",
        startDate: { gt: NOW },
      },
    })
    expect(prisma.transactionDispute.count).toHaveBeenCalledWith({
      where: {
        status: { in: [...ACTIVE_DISPUTE_STATUSES] },
        OR: [
          { raisedById: "user-1" },
          { transaction: { borrowerId: "user-1" } },
          { transaction: { lenderId: "user-1" } },
        ],
      },
    })
  })

  it("explains every blocker that prevents deactivation", async () => {
    const prisma = createPrismaMock([1, 2, 3])

    const result = await getDeactivationEligibility(prisma as never, "user-1", NOW)

    expect(result.allowed).toBe(false)
    expect(result.blockers).toEqual([
      expect.objectContaining({ code: "ACTIVE_RENTAL", count: 1 }),
      expect.objectContaining({ code: "FUTURE_CONFIRMED_BOOKING", count: 2 }),
      expect.objectContaining({ code: "OPEN_DISPUTE", count: 3 }),
    ])
  })
})
