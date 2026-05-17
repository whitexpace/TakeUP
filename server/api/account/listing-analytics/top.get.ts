import {
  BookingStatus,
  ItemAvailabilityStatus,
  ItemStatus,
  TransactionStatus,
  type Prisma,
} from "@prisma/client"
import { createError, getQuery, setHeader } from "h3"
import { createContext } from "../../../trpc/context"
import { listingAnalyticsQuerySchema } from "#shared/schemas/listing-analytics"

const DAY_MS = 24 * 60 * 60 * 1000
const PREVIEW_LIMIT = 6

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
  itemId: string
  startDate: Date
  endDate: Date
}

type DateWindow = {
  start: Date | null
  end: Date | null
}

const getDateWindow = (range: keyof typeof rangeDays | "all"): DateWindow => {
  if (range === "all") return { start: null, end: null }

  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(start.getUTCDate() - rangeDays[range] + 1)

  return { start, end: new Date() }
}

const getPrimaryImage = (images: Array<{ path: string; isPrimary: boolean }>) =>
  images.find((image) => image.isPrimary)?.path ?? images[0]?.path ?? null

const countMergedDays = (ranges: Array<Omit<DateRange, "itemId">>, window: DateWindow) => {
  const intervals = ranges
    .map((range) => {
      const start = Math.max(
        range.startDate.getTime(),
        window.start?.getTime() ?? Number.NEGATIVE_INFINITY,
      )
      const end = Math.min(
        range.endDate.getTime(),
        window.end?.getTime() ?? Number.POSITIVE_INFINITY,
      )

      return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null
    })
    .filter((interval): interval is { start: number; end: number } => Boolean(interval))
    .sort((left, right) => left.start - right.start)

  if (!intervals.length) return 0

  const merged: Array<{ start: number; end: number }> = []
  for (const interval of intervals) {
    const previous = merged[merged.length - 1]
    if (!previous || interval.start > previous.end) {
      merged.push({ ...interval })
      continue
    }

    previous.end = Math.max(previous.end, interval.end)
  }

  return merged.reduce(
    (total, interval) => total + Math.ceil((interval.end - interval.start) / DAY_MS),
    0,
  )
}

const safeRate = (numerator: number, denominator: number) => {
  if (denominator <= 0) return 0
  return Number(((numerator / denominator) * 100).toFixed(1))
}

const countByItem = (rows: Array<{ itemId: string | null; _count: { _all: number } }>) => {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (row.itemId) counts.set(row.itemId, row._count._all)
  }
  return counts
}

const rangesByItem = (rows: DateRange[]) => {
  const ranges = new Map<string, Array<Omit<DateRange, "itemId">>>()
  for (const row of rows) {
    const current = ranges.get(row.itemId) ?? []
    current.push({ startDate: row.startDate, endDate: row.endDate })
    ranges.set(row.itemId, current)
  }
  return ranges
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const result = listingAnalyticsQuerySchema.safeParse({
    range: typeof query.range === "string" ? query.range : undefined,
  })

  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid analytics query parameters." })
  }

  const ctx = await createContext(event)
  if (!ctx.user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized." })
  }

  const dateWindow = getDateWindow(result.data.range)
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
      viewCount: true,
      rating: true,
      images: {
        select: {
          path: true,
          isPrimary: true,
          sortOrder: true,
        },
        orderBy: itemImageOrderBy,
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  })

  if (!listings.length) {
    const emptySummary = {
      totalViews: 0,
      totalBookings: 0,
      totalBookingRequests: 0,
      totalCompletedTransactions: 0,
      totalRevenue: 0,
      availabilityDays: 0,
      bookedDays: 0,
      bookingRate: 0,
      completionRate: 0,
      utilizationRate: 0,
      overallItemRating: 0,
    }

    setHeader(event, "Cache-Control", "private, max-age=10")
    return {
      summary: emptySummary,
      listingCount: 0,
      chartItems: [],
      topItems: [],
      range: result.data.range,
    }
  }

  const listingIds = listings.map((listing) => listing.id)

  const [bookingCounts, bookingRequestCounts, transactionTotals, bookedRanges, availabilityRanges] =
    await Promise.all([
      ctx.prisma.booking.groupBy({
        by: ["itemId"],
        where: {
          lenderId: ctx.user.id,
          itemId: { in: listingIds },
          status: { in: acceptedBookingStatuses },
          ...bookingDateWhere,
        },
        _count: { _all: true },
      }),
      ctx.prisma.booking.groupBy({
        by: ["itemId"],
        where: {
          lenderId: ctx.user.id,
          itemId: { in: listingIds },
          status: { in: nonCancelledBookingStatuses },
          ...bookingDateWhere,
        },
        _count: { _all: true },
      }),
      ctx.prisma.rentalTransaction.groupBy({
        by: ["itemId"],
        where: {
          lenderId: ctx.user.id,
          itemId: { in: listingIds },
          status: TransactionStatus.COMPLETED,
          ...transactionDateWhere,
        },
        _count: { _all: true },
        _sum: { rentalFee: true },
      }),
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

  const acceptedCountByItem = countByItem(bookingCounts)
  const requestCountByItem = countByItem(bookingRequestCounts)
  const bookedRangesByItem = rangesByItem(bookedRanges)
  const availabilityRangesByItem = rangesByItem(availabilityRanges)
  const transactionByItem = new Map<string, { count: number; revenue: number }>()

  for (const row of transactionTotals) {
    if (!row.itemId) continue
    transactionByItem.set(row.itemId, {
      count: row._count._all,
      revenue: Number(row._sum.rentalFee ?? 0),
    })
  }

  const previewItems = listings.map((listing) => {
    const totalBookings = acceptedCountByItem.get(listing.id) ?? 0
    const transactionTotal = transactionByItem.get(listing.id) ?? { count: 0, revenue: 0 }

    return {
      listingId: listing.id,
      itemName: listing.name,
      thumbnailImage: getPrimaryImage(listing.images),
      totalViews: listing.viewCount,
      totalBookings,
      totalRevenue: Number(transactionTotal.revenue.toFixed(2)),
    }
  })

  const summarySeed = listings.reduce(
    (totals, listing) => {
      const transactions = transactionByItem.get(listing.id) ?? { count: 0, revenue: 0 }

      totals.totalViews += listing.viewCount
      totals.totalBookings += acceptedCountByItem.get(listing.id) ?? 0
      totals.totalBookingRequests += requestCountByItem.get(listing.id) ?? 0
      totals.totalCompletedTransactions += transactions.count
      totals.totalRevenue += transactions.revenue
      totals.availabilityDays += countMergedDays(
        availabilityRangesByItem.get(listing.id) ?? [],
        dateWindow,
      )
      totals.bookedDays += countMergedDays(bookedRangesByItem.get(listing.id) ?? [], dateWindow)

      return totals
    },
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

  const ratedItems = listings.filter((listing) => listing.rating > 0)
  const overallItemRating = ratedItems.length
    ? Number(
        (ratedItems.reduce((sum, listing) => sum + listing.rating, 0) / ratedItems.length).toFixed(
          1,
        ),
      )
    : 0

  setHeader(event, "Cache-Control", "private, max-age=10")
  return {
    summary: {
      ...summarySeed,
      totalRevenue: Number(summarySeed.totalRevenue.toFixed(2)),
      bookingRate: safeRate(summarySeed.totalBookings, summarySeed.totalViews),
      completionRate: safeRate(summarySeed.totalCompletedTransactions, summarySeed.totalBookings),
      utilizationRate: safeRate(summarySeed.bookedDays, summarySeed.availabilityDays),
      overallItemRating,
    },
    listingCount: listings.length,
    chartItems: [...previewItems]
      .filter((item) => item.totalViews > 0)
      .sort((left, right) => right.totalViews - left.totalViews)
      .slice(0, PREVIEW_LIMIT),
    topItems: [...previewItems]
      .sort(
        (left, right) =>
          right.totalViews - left.totalViews ||
          right.totalBookings - left.totalBookings ||
          right.totalRevenue - left.totalRevenue,
      )
      .filter((item) => item.totalViews > 0 || item.totalBookings > 0 || item.totalRevenue > 0)
      .slice(0, 5),
    range: result.data.range,
  }
})
