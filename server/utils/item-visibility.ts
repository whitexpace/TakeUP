import type {
  BookingStatus,
  ItemAvailabilityStatus,
  ItemStatus,
  Prisma,
  UserStatus,
} from "@prisma/client"

export const PUBLIC_VISIBLE_ITEM_STATUS = "AVAILABLE" satisfies ItemStatus
export const PUBLIC_VISIBLE_LENDER_STATUS = "ACTIVE" satisfies UserStatus
export const ITEM_VISIBILITY_BLOCKING_BOOKING_STATUSES = [
  "CONFIRMED",
  "IN_DISPUTE",
] as const satisfies readonly BookingStatus[]

type VisibilityRange = {
  startDate: Date
  endDate: Date
  status?: ItemAvailabilityStatus | BookingStatus | string | null
}

type VisibilityWindow = {
  startDate: Date
  endDate: Date
}

export type ItemVisibilityCandidate = {
  status?: ItemStatus | string | null
  availability?: VisibilityRange[] | null
  bookings?: VisibilityRange[] | null
  lender?: {
    user?: {
      status?: UserStatus | string | null
    } | null
  } | null
}

const isValidDate = (value: Date) => value instanceof Date && !Number.isNaN(value.getTime())

const toRange = (range: VisibilityRange, now: Date) => {
  if (!isValidDate(range.startDate) || !isValidDate(range.endDate)) return null
  if (range.endDate <= range.startDate) return null
  if (range.endDate <= now) return null

  return {
    startMs: Math.max(range.startDate.getTime(), now.getTime()),
    endMs: range.endDate.getTime(),
  }
}

const isRangeFullyCovered = (
  range: { startMs: number; endMs: number },
  blockers: Array<{ startMs: number; endMs: number }>,
) => {
  let coveredUntil = range.startMs

  for (const blocker of blockers) {
    if (blocker.endMs <= coveredUntil) continue
    if (blocker.startMs > coveredUntil) return false

    coveredUntil = Math.max(coveredUntil, blocker.endMs)
    if (coveredUntil >= range.endMs) return true
  }

  return coveredUntil >= range.endMs
}

const rangesOverlap = (
  left: { startMs: number; endMs: number },
  right: { startMs: number; endMs: number },
) => left.startMs < right.endMs && left.endMs > right.startMs

export const buildPublicVisibleItemWhere = (now = new Date()): Prisma.ItemWhereInput => ({
  status: PUBLIC_VISIBLE_ITEM_STATUS,
  lender: {
    user: {
      status: PUBLIC_VISIBLE_LENDER_STATUS,
    },
  },
  availability: {
    some: {
      status: "AVAILABLE",
      endDate: { gt: now },
    },
  },
})

export const isPublicVisibleItem = (
  item: ItemVisibilityCandidate,
  now = new Date(),
  options: { requiredWindow?: VisibilityWindow | null } = {},
) => {
  if (item.status !== PUBLIC_VISIBLE_ITEM_STATUS) return false

  if (
    item.lender?.user?.status !== undefined &&
    item.lender.user.status !== null &&
    item.lender.user.status !== PUBLIC_VISIBLE_LENDER_STATUS
  ) {
    return false
  }

  const futureAvailableRanges = (item.availability ?? [])
    .filter((range) => range.status === "AVAILABLE")
    .map((range) => toRange(range, now))
    .filter((range): range is { startMs: number; endMs: number } => range !== null)

  if (futureAvailableRanges.length === 0) return false

  const availabilityBlockers = (item.availability ?? [])
    .filter((range) => range.status !== "AVAILABLE")
    .map((range) => toRange(range, now))
    .filter((range): range is { startMs: number; endMs: number } => range !== null)

  const bookingBlockers = (item.bookings ?? [])
    .filter(
      (booking) =>
        !booking.status ||
        (ITEM_VISIBILITY_BLOCKING_BOOKING_STATUSES as readonly string[]).includes(booking.status),
    )
    .map((booking) => toRange(booking, now))
    .filter((range): range is { startMs: number; endMs: number } => range !== null)

  const blockers = [...availabilityBlockers, ...bookingBlockers].sort(
    (left, right) => left.startMs - right.startMs,
  )

  const hasRequiredWindow = Boolean(options.requiredWindow)
  const requiredWindow = options.requiredWindow
    ? toRange({ ...options.requiredWindow, status: "AVAILABLE" }, now)
    : null

  if (hasRequiredWindow) {
    if (!requiredWindow) return false

    return futureAvailableRanges.some(
      (range) =>
        range.startMs <= requiredWindow.startMs &&
        range.endMs >= requiredWindow.endMs &&
        !blockers.some((blocker) => rangesOverlap(requiredWindow, blocker)),
    )
  }

  return futureAvailableRanges.some((range) => !isRangeFullyCovered(range, blockers))
}
