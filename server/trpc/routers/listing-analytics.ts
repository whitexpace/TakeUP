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
const RANKING_LIMIT = 5

const acceptedBookingStatuses = [
  BookingStatus.CONFIRMED,
  BookingStatus.RETURNED,
  BookingStatus.COMPLETED,
  BookingStatus.IN_DISPUTE,
]

const nonCancelledBookingStatuses = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.RETURNED,
  BookingStatus.COMPLETED,
  BookingStatus.IN_DISPUTE,
]

const itemImageOrderBy: Prisma.ItemImageOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { createdAt: "asc" },
]

const rangeDays = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
} as const

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
  totalBookingRequests: number
  totalCompletedTransactions: number
  totalRevenue: number
  availabilityDays: number
  bookedDays: number
}

type ListingMetricSeed = MetricSeed & {
  listingId: string
  itemName: string
  status: ItemStatus
  rating: number
  rentalFee: number
  freeToBorrow: boolean
  thumbnailImage: string | null
  categories: ItemCategory[]
}

type RankedItem = {
  itemId: string
  name: string
  thumbnailImage: string | null
  bookingCount: number
  rentalFee: number
  freeToBorrow: boolean
}

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
    totalBookingRequests: 0,
    totalCompletedTransactions: 0,
    totalRevenue: 0,
    availabilityDays: 0,
    bookedDays: 0,
  })

const emptyRankings = () => ({
  topViewedItems: [] as Array<RankedItem & { viewCount: number }>,
  topRequestedItems: [] as Array<RankedItem & { requestCount: number }>,
  topBookedItems: [] as Array<RankedItem>,
  itemRatings: [] as Array<RankedItem & { rating: number }>,
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
        rating: true,
        rentalFee: true,
        freeToBorrow: true,
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
        summary: { ...emptySummary(), overallItemRating: 0 },
        listings: [],
        ...emptyRankings(),
        categoryBreakdown: [],
        range: input.range,
      }
    }

    const listingIds = listings.map((listing) => listing.id)

    const [bookings, bookingRequests, completedTransactions, availability] = await Promise.all([
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
      ctx.prisma.booking.findMany({
        where: {
          lenderId: ctx.user.id,
          itemId: { in: listingIds },
          status: { in: nonCancelledBookingStatuses },
          ...bookingDateWhere,
        },
        select: {
          itemId: true,
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

    const requestCountByItem = new Map<string, number>()
    for (const request of bookingRequests) {
      requestCountByItem.set(request.itemId, (requestCountByItem.get(request.itemId) ?? 0) + 1)
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
      const requestCount = requestCountByItem.get(listing.id) ?? 0

      const metrics: ListingMetricSeed = {
        listingId: listing.id,
        itemName: listing.name,
        status: listing.status,
        rating: listing.rating,
        rentalFee: listing.rentalFee,
        freeToBorrow: listing.freeToBorrow,
        thumbnailImage: getPrimaryImage(listing.images),
        categories: listing.categories.map((entry) => entry.category),
        totalViews: listing.viewCount,
        totalBookings: bookingRanges.length,
        totalBookingRequests: requestCount,
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
        totalBookingRequests: totals.totalBookingRequests + listing.totalBookingRequests,
        totalCompletedTransactions:
          totals.totalCompletedTransactions + listing.totalCompletedTransactions,
        totalRevenue: totals.totalRevenue + listing.totalRevenue,
        availabilityDays: totals.availabilityDays + listing.availabilityDays,
        bookedDays: totals.bookedDays + listing.bookedDays,
      }),
      {
        totalViews: 0,
        totalBookings: 0,
        totalBookingRequests: 0,
        totalCompletedTransactions: 0,
        totalRevenue: 0,
        availabilityDays: 0,
        bookedDays: 0,
      },
    )

    const ratedItems = analytics.filter((listing) => listing.rating > 0)
    const overallItemRating =
      ratedItems.length > 0
        ? Number(
            (ratedItems.reduce((sum, item) => sum + item.rating, 0) / ratedItems.length).toFixed(1),
          )
        : 0

    const categoryCounts = new Map<ItemCategory, number>()
    for (const listing of analytics) {
      for (const category of listing.categories) {
        categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1)
      }
    }

    const toRankedItem = (listing: (typeof analytics)[number]): RankedItem => ({
      itemId: listing.listingId,
      name: listing.itemName,
      thumbnailImage: listing.thumbnailImage,
      bookingCount: listing.totalBookings,
      rentalFee: listing.rentalFee,
      freeToBorrow: listing.freeToBorrow,
    })

    const topViewedItems = [...analytics]
      .sort((a, b) => b.totalViews - a.totalViews)
      .filter((item) => item.totalViews > 0)
      .slice(0, RANKING_LIMIT)
      .map((item) => ({
        ...toRankedItem(item),
        viewCount: item.totalViews,
      }))

    const topRequestedItems = [...analytics]
      .sort((a, b) => b.totalBookingRequests - a.totalBookingRequests)
      .filter((item) => item.totalBookingRequests > 0)
      .slice(0, RANKING_LIMIT)
      .map((item) => ({
        ...toRankedItem(item),
        requestCount: item.totalBookingRequests,
      }))

    const topBookedItems = [...analytics]
      .sort((a, b) => b.totalBookings - a.totalBookings)
      .filter((item) => item.totalBookings > 0)
      .slice(0, RANKING_LIMIT)
      .map((item) => toRankedItem(item))

    const itemRatings = [...analytics]
      .sort((a, b) => b.rating - a.rating)
      .filter((item) => item.rating > 0)
      .slice(0, RANKING_LIMIT)
      .map((item) => ({
        ...toRankedItem(item),
        rating: item.rating,
      }))

    return {
      summary: {
        ...withRates({ ...summary, totalRevenue: Number(summary.totalRevenue.toFixed(2)) }),
        overallItemRating,
      },
      listings: analytics,
      topViewedItems,
      topRequestedItems,
      topBookedItems,
      itemRatings,
      categoryBreakdown: Array.from(categoryCounts.entries())
        .map(([category, count]) => ({ category, count }))
        .sort(
          (left, right) => right.count - left.count || left.category.localeCompare(right.category),
        ),
      range: input.range,
    }
  }),
})
