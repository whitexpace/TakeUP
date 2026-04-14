import {
  BookingStatus,
  ItemAvailabilityStatus,
  ItemStatus,
  TransactionStatus,
  type ItemCategory,
  type Prisma,
} from "@prisma/client"
import { router } from "../init"
import { protectedProcedure } from "../procedures"
import { listingAnalyticsQuerySchema } from "../../../shared/schemas/listing-analytics"

const DAY_MS = 24 * 60 * 60 * 1000

const acceptedBookingStatuses = [
  BookingStatus.CONFIRMED,
  BookingStatus.RETURNED,
  BookingStatus.COMPLETED,
  BookingStatus.IN_DISPUTE,
]

const itemImageOrderBy: Prisma.ItemImageOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { createdAt: "asc" },
]

type DateRange = {
  startDate: Date
  endDate: Date
}

type Interval = {
  start: number
  end: number
}

type DateWindow = {
  start: Date | null
  end: Date | null
}

type MetricSeed = {
  totalViews: number
  totalBookings: number
  totalCompletedTransactions: number
  totalRevenue: number
  availabilityDays: number
  bookedDays: number
}

type ListingMetricSeed = MetricSeed & {
  listingId: string
  itemName: string
  status: ItemStatus
  thumbnailImage: string | null
  categories: ItemCategory[]
}

const rangeDays = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
} as const

const getDateWindow = (range: keyof typeof rangeDays | "all"): DateWindow => {
  if (range === "all") return { start: null, end: null }

  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(start.getUTCDate() - rangeDays[range] + 1)

  const end = new Date()
  return { start, end }
}

const getPrimaryImage = (images: Array<{ path: string; isPrimary: boolean }>) =>
  images.find((image) => image.isPrimary)?.path ?? images[0]?.path ?? null

const toValidInterval = (
  { startDate, endDate }: DateRange,
  window: DateWindow,
): Interval | null => {
  const start = Math.max(startDate.getTime(), window.start?.getTime() ?? Number.NEGATIVE_INFINITY)
  const end = Math.min(endDate.getTime(), window.end?.getTime() ?? Number.POSITIVE_INFINITY)

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null
  }

  return { start, end }
}

const countMergedDays = (ranges: DateRange[], window: DateWindow = { start: null, end: null }) => {
  const intervals = ranges
    .map((range) => toValidInterval(range, window))
    .filter((interval): interval is Interval => Boolean(interval))
    .sort((left, right) => left.start - right.start)

  if (intervals.length === 0) return 0

  const merged: Interval[] = []

  for (const interval of intervals) {
    const previous = merged[merged.length - 1]
    if (!previous || interval.start > previous.end) {
      merged.push({ ...interval })
      continue
    }

    previous.end = Math.max(previous.end, interval.end)
  }

  return merged.reduce(
    (days, interval) => days + Math.ceil((interval.end - interval.start) / DAY_MS),
    0,
  )
}

const safeRate = (numerator: number, denominator: number) => {
  if (denominator <= 0) return 0
  return Number(((numerator / denominator) * 100).toFixed(1))
}

const withRates = <T extends MetricSeed>(metrics: T) => ({
  ...metrics,
  bookingRate: safeRate(metrics.totalBookings, metrics.totalViews),
  completionRate: safeRate(metrics.totalCompletedTransactions, metrics.totalBookings),
  utilizationRate: safeRate(metrics.bookedDays, metrics.availabilityDays),
})

const emptySummary = () =>
  withRates({
    totalViews: 0,
    totalBookings: 0,
    totalCompletedTransactions: 0,
    totalRevenue: 0,
    availabilityDays: 0,
    bookedDays: 0,
  })

export const listingAnalyticsRouter = router({
  list: protectedProcedure.input(listingAnalyticsQuerySchema).query(async ({ ctx, input }) => {
    const dateWindow = getDateWindow(input.range)
    const bookingDateWhere = dateWindow.start ? { requestedAt: { gte: dateWindow.start } } : {}
    const transactionDateWhere = dateWindow.start ? { updatedAt: { gte: dateWindow.start } } : {}
    const availabilityDateWhere = dateWindow.start
      ? {
          endDate: { gte: dateWindow.start },
          startDate: dateWindow.end ? { lte: dateWindow.end } : undefined,
        }
      : {}

    const listings = await ctx.prisma.item.findMany({
      where: {
        lenderId: ctx.user.id,
        status: { not: ItemStatus.DELETED },
      },
      select: {
        id: true,
        name: true,
        status: true,
        viewCount: true,
        images: {
          select: {
            path: true,
            isPrimary: true,
            sortOrder: true,
          },
          orderBy: itemImageOrderBy,
        },
        categories: {
          select: {
            category: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    })

    if (listings.length === 0) {
      return {
        summary: emptySummary(),
        listings: [],
        categoryBreakdown: [],
        range: input.range,
      }
    }

    const listingIds = listings.map((listing) => listing.id)

    const [bookings, completedTransactions, availability] = await Promise.all([
      ctx.prisma.booking.findMany({
        where: {
          lenderId: ctx.user.id,
          itemId: { in: listingIds },
          status: { in: acceptedBookingStatuses },
          ...bookingDateWhere,
        },
        select: {
          itemId: true,
          startDate: true,
          endDate: true,
        },
      }),
      ctx.prisma.rentalTransaction.findMany({
        where: {
          lenderId: ctx.user.id,
          itemId: { in: listingIds },
          status: TransactionStatus.COMPLETED,
          ...transactionDateWhere,
        },
        select: {
          itemId: true,
          rentalFee: true,
        },
      }),
      ctx.prisma.itemAvailability.findMany({
        where: {
          itemId: { in: listingIds },
          status: ItemAvailabilityStatus.AVAILABLE,
          ...availabilityDateWhere,
        },
        select: {
          itemId: true,
          startDate: true,
          endDate: true,
        },
      }),
    ])

    const bookingsByItem = new Map<string, DateRange[]>()
    for (const booking of bookings) {
      const ranges = bookingsByItem.get(booking.itemId) ?? []
      ranges.push({ startDate: booking.startDate, endDate: booking.endDate })
      bookingsByItem.set(booking.itemId, ranges)
    }

    const availabilityByItem = new Map<string, DateRange[]>()
    for (const slot of availability) {
      const ranges = availabilityByItem.get(slot.itemId) ?? []
      ranges.push({ startDate: slot.startDate, endDate: slot.endDate })
      availabilityByItem.set(slot.itemId, ranges)
    }

    const transactionsByItem = new Map<string, { count: number; revenue: number }>()
    for (const transaction of completedTransactions) {
      if (!transaction.itemId) continue

      const current = transactionsByItem.get(transaction.itemId) ?? { count: 0, revenue: 0 }
      current.count += 1
      current.revenue += Number(transaction.rentalFee)
      transactionsByItem.set(transaction.itemId, current)
    }

    const analytics = listings.map((listing) => {
      const bookingRanges = bookingsByItem.get(listing.id) ?? []
      const availabilityRanges = availabilityByItem.get(listing.id) ?? []
      const transactionTotals = transactionsByItem.get(listing.id) ?? { count: 0, revenue: 0 }

      const metrics: ListingMetricSeed = {
        listingId: listing.id,
        itemName: listing.name,
        status: listing.status,
        thumbnailImage: getPrimaryImage(listing.images),
        categories: listing.categories.map((entry) => entry.category),
        totalViews: listing.viewCount,
        totalBookings: bookingRanges.length,
        totalCompletedTransactions: transactionTotals.count,
        totalRevenue: Number(transactionTotals.revenue.toFixed(2)),
        availabilityDays: countMergedDays(availabilityRanges, dateWindow),
        bookedDays: countMergedDays(bookingRanges, dateWindow),
      }

      return withRates(metrics)
    })

    const summary = analytics.reduce<MetricSeed>(
      (totals, listing) => ({
        totalViews: totals.totalViews + listing.totalViews,
        totalBookings: totals.totalBookings + listing.totalBookings,
        totalCompletedTransactions:
          totals.totalCompletedTransactions + listing.totalCompletedTransactions,
        totalRevenue: totals.totalRevenue + listing.totalRevenue,
        availabilityDays: totals.availabilityDays + listing.availabilityDays,
        bookedDays: totals.bookedDays + listing.bookedDays,
      }),
      {
        totalViews: 0,
        totalBookings: 0,
        totalCompletedTransactions: 0,
        totalRevenue: 0,
        availabilityDays: 0,
        bookedDays: 0,
      },
    )

    const categoryCounts = new Map<ItemCategory, number>()
    for (const listing of analytics) {
      for (const category of listing.categories) {
        categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1)
      }
    }

    return {
      summary: withRates({ ...summary, totalRevenue: Number(summary.totalRevenue.toFixed(2)) }),
      listings: analytics,
      categoryBreakdown: Array.from(categoryCounts.entries())
        .map(([category, count]) => ({ category, count }))
        .sort(
          (left, right) => right.count - left.count || left.category.localeCompare(right.category),
        ),
      range: input.range,
    }
  }),
})
