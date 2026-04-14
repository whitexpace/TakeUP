import type { PrismaClient } from "@prisma/client"

export type DeactivationBlockerCode = "ACTIVE_RENTAL" | "FUTURE_CONFIRMED_BOOKING" | "OPEN_DISPUTE"

export type DeactivationBlocker = {
  code: DeactivationBlockerCode
  message: string
  count: number
}

export type DeactivationEligibility = {
  allowed: boolean
  blockers: DeactivationBlocker[]
}

const ACTIVE_RENTAL_STATUSES = ["CONFIRMED", "IN_DISPUTE"] as const
const OPEN_DISPUTE_STATUSES = ["OPEN", "UNDER_REVIEW", "APPEALED"] as const

export async function getDeactivationEligibility(
  prisma: PrismaClient,
  userId: string,
  now = new Date(),
): Promise<DeactivationEligibility> {
  const [activeRentalCount, futureConfirmedBookingCount, openDisputeCount] = await Promise.all([
    prisma.booking.count({
      where: {
        OR: [{ borrowerId: userId }, { lenderId: userId }],
        status: { in: [...ACTIVE_RENTAL_STATUSES] },
        startDate: { lte: now },
        endDate: { gte: now },
      },
    }),
    prisma.booking.count({
      where: {
        OR: [{ borrowerId: userId }, { lenderId: userId }],
        status: "CONFIRMED",
        startDate: { gt: now },
      },
    }),
    prisma.transactionDispute.count({
      where: {
        status: { in: [...OPEN_DISPUTE_STATUSES] },
        OR: [
          { filedByUserId: userId },
          { transaction: { borrowerId: userId } },
          { transaction: { lenderId: userId } },
        ],
      },
    }),
  ])

  const blockers: DeactivationBlocker[] = []

  if (activeRentalCount > 0) {
    blockers.push({
      code: "ACTIVE_RENTAL",
      count: activeRentalCount,
      message:
        activeRentalCount === 1
          ? "You have 1 active rental. Complete or resolve it before deactivating."
          : `You have ${activeRentalCount} active rentals. Complete or resolve them before deactivating.`,
    })
  }

  if (futureConfirmedBookingCount > 0) {
    blockers.push({
      code: "FUTURE_CONFIRMED_BOOKING",
      count: futureConfirmedBookingCount,
      message:
        futureConfirmedBookingCount === 1
          ? "You have 1 future confirmed booking. Cancel or complete it before deactivating."
          : `You have ${futureConfirmedBookingCount} future confirmed bookings. Cancel or complete them before deactivating.`,
    })
  }

  if (openDisputeCount > 0) {
    blockers.push({
      code: "OPEN_DISPUTE",
      count: openDisputeCount,
      message:
        openDisputeCount === 1
          ? "You have 1 open dispute. Resolve it before deactivating."
          : `You have ${openDisputeCount} open disputes. Resolve them before deactivating.`,
    })
  }

  return {
    allowed: blockers.length === 0,
    blockers,
  }
}
