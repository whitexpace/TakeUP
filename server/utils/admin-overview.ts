import type { Prisma, PrismaClient } from "@prisma/client"
import { buildPublicVisibleItemWhere } from "./item-visibility"
import { toUiTransactionStatus, transactionStatusGroups } from "./transaction-status"
import { getSystemCommissionAudit, runSystemWalletSelfHealing } from "./wallet"

const ACTIVE_USER_WINDOW_DAYS = 30
const PREVIEW_LIMIT = 5
const TOP_ITEMS_LIMIT = 5

const decimalToNumber = (value: Prisma.Decimal | number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value)
  return Number(value.toString())
}

export const collectDistinctUserIds = (
  ...groups: Array<Array<string | null | undefined>>
): string[] => {
  const ids = new Set<string>()

  for (const group of groups) {
    for (const value of group) {
      if (!value) continue
      ids.add(value)
    }
  }

  return [...ids]
}

export const summarizeNonZeroAverage = (values: Array<number | null | undefined>) => {
  const filtered = values.filter((value): value is number => typeof value === "number" && value > 0)

  if (filtered.length === 0) {
    return {
      average: null,
      count: 0,
    }
  }

  const total = filtered.reduce((sum, value) => sum + value, 0)
  return {
    average: Number((total / filtered.length).toFixed(2)),
    count: filtered.length,
  }
}

export type AdminOverviewResponse = Awaited<ReturnType<typeof getAdminOverview>>

export async function getAdminOverview(prisma: PrismaClient) {
  const now = new Date()
  const activityWindowStart = new Date(now)
  activityWindowStart.setDate(activityWindowStart.getDate() - ACTIVE_USER_WINDOW_DAYS)

  try {
    await runSystemWalletSelfHealing()
  } catch (error) {
    console.error("System wallet self-healing failed during overview refresh:", error)
  }

  const [
    totalUsers,
    totalTransactions,
    activeTransactions,
    completedTransactions,
    disputedTransactions,
    totalListings,
    activeListings,
    borrowerRatings,
    lenderRatings,
    bookingBorrowers,
    bookingLenders,
    transactionBorrowers,
    transactionLenders,
    disputeUsers,
    listingUsers,
    requestUsers,
    messageUsers,
    topItemsRaw,
    recentTransactionsRaw,
    recentDisputesRaw,
    recentListingsRaw,
    commissionAudit,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.rentalTransaction.count(),
    prisma.rentalTransaction.count({
      where: { status: { in: transactionStatusGroups.ACTIVE } },
    }),
    prisma.rentalTransaction.count({
      where: { status: { in: transactionStatusGroups.COMPLETED } },
    }),
    prisma.rentalTransaction.count({
      where: { status: { in: transactionStatusGroups.IN_DISPUTE } },
    }),
    prisma.item.count({
      where: {
        status: {
          not: "DELETED",
        },
      },
    }),
    prisma.item.count({
      where: buildPublicVisibleItemWhere(now),
    }),
    prisma.borrower.findMany({
      select: { borrowerRating: true },
      where: { borrowerRating: { gt: 0 } },
    }),
    prisma.lender.findMany({
      select: { lenderRating: true },
      where: { lenderRating: { gt: 0 } },
    }),
    prisma.booking.findMany({
      where: { createdAt: { gte: activityWindowStart } },
      select: { borrowerId: true },
      distinct: ["borrowerId"],
    }),
    prisma.booking.findMany({
      where: { createdAt: { gte: activityWindowStart } },
      select: { lenderId: true },
      distinct: ["lenderId"],
    }),
    prisma.rentalTransaction.findMany({
      where: { createdAt: { gte: activityWindowStart } },
      select: { borrowerId: true },
      distinct: ["borrowerId"],
    }),
    prisma.rentalTransaction.findMany({
      where: { createdAt: { gte: activityWindowStart } },
      select: { lenderId: true },
      distinct: ["lenderId"],
    }),
    prisma.transactionDispute.findMany({
      where: { createdAt: { gte: activityWindowStart } },
      select: { raisedById: true },
      distinct: ["raisedById"],
    }),
    prisma.item.findMany({
      where: { createdAt: { gte: activityWindowStart } },
      select: { lenderId: true },
      distinct: ["lenderId"],
    }),
    prisma.requestPost.findMany({
      where: { createdAt: { gte: activityWindowStart } },
      select: { requesterId: true },
      distinct: ["requesterId"],
    }),
    prisma.message.findMany({
      where: { createdAt: { gte: activityWindowStart } },
      select: { senderUserId: true },
      distinct: ["senderUserId"],
    }),
    prisma.item.findMany({
      where: {
        ...buildPublicVisibleItemWhere(now),
        rating: { gt: 0 },
      },
      orderBy: [{ rating: "desc" }, { bookingCount: "desc" }, { createdAt: "desc" }],
      take: TOP_ITEMS_LIMIT,
      select: {
        id: true,
        name: true,
        rating: true,
        bookingCount: true,
        images: {
          select: { path: true },
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
          take: 1,
        },
        _count: {
          select: {
            transactionReviews: {
              where: {
                reviewType: "ITEM_REVIEW",
              },
            },
          },
        },
      },
    }),
    prisma.rentalTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: PREVIEW_LIMIT,
      select: {
        id: true,
        bookingId: true,
        status: true,
        createdAt: true,
        totalAmount: true,
        item: {
          select: {
            name: true,
          },
        },
        borrower: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        lender: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    prisma.transactionDispute.findMany({
      orderBy: { createdAt: "desc" },
      take: PREVIEW_LIMIT,
      select: {
        id: true,
        reason: true,
        status: true,
        createdAt: true,
        transactionId: true,
        raisedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        transaction: {
          select: {
            item: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.item.findMany({
      where: {
        status: {
          not: "DELETED",
        },
      },
      orderBy: { createdAt: "desc" },
      take: PREVIEW_LIMIT,
      select: {
        id: true,
        name: true,
        status: true,
        rating: true,
        bookingCount: true,
        createdAt: true,
        images: {
          select: { path: true },
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
          take: 1,
        },
      },
    }),
    getSystemCommissionAudit(undefined, { limit: 1 }),
  ])

  const activeUserIds = collectDistinctUserIds(
    bookingBorrowers.map((entry) => entry.borrowerId),
    bookingLenders.map((entry) => entry.lenderId),
    transactionBorrowers.map((entry) => entry.borrowerId),
    transactionLenders.map((entry) => entry.lenderId),
    disputeUsers.map((entry) => entry.raisedById),
    listingUsers.map((entry) => entry.lenderId),
    requestUsers.map((entry) => entry.requesterId),
    messageUsers.map((entry) => entry.senderUserId),
  )

  const activeUsers = activeUserIds.length
    ? await prisma.user.count({
        where: {
          id: { in: activeUserIds },
          status: "ACTIVE",
        },
      })
    : 0

  const borrowerSummary = summarizeNonZeroAverage(
    borrowerRatings.map((entry) => entry.borrowerRating),
  )
  const lenderSummary = summarizeNonZeroAverage(lenderRatings.map((entry) => entry.lenderRating))

  return {
    summary: {
      totalUsers,
      activeUsers,
      activeUsersWindowDays: ACTIVE_USER_WINDOW_DAYS,
      activeUsersDefinition:
        "Distinct ACTIVE users with recent bookings, transactions, disputes, listings, request posts, or sent messages in the last 30 days.",
      totalTransactions,
      activeTransactions,
      completedTransactions,
      disputedTransactions,
      totalListings,
      activeListings,
      totalCommissionCollected: commissionAudit.summary.totalCommissionCollected,
      currentSystemWalletBalance: commissionAudit.summary.currentCommissionBalance,
      currency: commissionAudit.summary.currency,
    },
    ratings: {
      averageBorrowerRating: borrowerSummary.average,
      ratedBorrowerCount: borrowerSummary.count,
      averageLenderRating: lenderSummary.average,
      ratedLenderCount: lenderSummary.count,
    },
    topItems: topItemsRaw.map((item) => ({
      id: item.id,
      name: item.name,
      averageRating: item.rating,
      reviewCount: item._count.transactionReviews,
      bookingCount: item.bookingCount,
      thumbnailImage: item.images[0]?.path ?? null,
    })),
    previews: {
      recentTransactions: recentTransactionsRaw.map((transaction) => ({
        id: transaction.id,
        bookingId: transaction.bookingId,
        itemName: transaction.item?.name ?? "Unknown item",
        borrowerName: [transaction.borrower?.firstName, transaction.borrower?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim(),
        lenderName: [transaction.lender?.firstName, transaction.lender?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim(),
        status: toUiTransactionStatus(transaction.status),
        totalAmount: decimalToNumber(transaction.totalAmount),
        createdAt: transaction.createdAt,
      })),
      recentDisputes: recentDisputesRaw.map((dispute) => ({
        id: dispute.id,
        transactionId: dispute.transactionId,
        itemName: dispute.transaction.item?.name ?? "Unknown item",
        reason: dispute.reason,
        status: dispute.status,
        raisedByName: [dispute.raisedBy.firstName, dispute.raisedBy.lastName]
          .filter(Boolean)
          .join(" ")
          .trim(),
        createdAt: dispute.createdAt,
      })),
      recentListings: recentListingsRaw.map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status,
        rating: item.rating,
        bookingCount: item.bookingCount,
        thumbnailImage: item.images[0]?.path ?? null,
        createdAt: item.createdAt,
      })),
    },
    generatedAt: now,
  }
}
