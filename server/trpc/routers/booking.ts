import {
  type BookingPaymentStatus as PrismaBookingPaymentStatus,
  type BookingStatus as PrismaBookingStatus,
  type NotificationType as PrismaNotificationType,
  Prisma,
  PaymentMethod as PrismaPaymentMethod,
  TransactionStatus as PrismaTransactionStatus,
  RefundStatus,
  ReturnStatus,
  RefundReason,
  type Booking,
} from "@prisma/client"
import { randomUUID } from "node:crypto"
import { TRPCError } from "@trpc/server"
import type { Context } from "../context"
import { router } from "../init"
import { protectedProcedure } from "../procedures"
import {
  bookingIdSchema,
  bookingPaymentStatusSchema,
  bookingStatusSchema,
  createBookingSchema,
  deleteBookingSchema,
  earlyReturnBookingSchema,
  handoffProofBookingSchema,
  listBookingsSchema,
  type PaymentMethod,
  paymentMethodSchema,
  returnProofBookingSchema,
  updateBookingSchema,
} from "#shared/schemas/booking"
import {
  buildTransactionReviewState,
  mapTransactionReview,
  transactionReviewSelect,
} from "../review-helpers"
import {
  isActiveDisputeStatus,
  isCounterpartyVisibleDisputeStatus,
  isRebuttalEnabledDisputeStatus,
  toUserFacingDisputeStatus,
} from "../../utils/dispute-status"
import { isChatAvailableForTransactionStatus } from "#shared/chat-rules"
import { processTransactionRewards } from "../../utils/rewards"
import { calculateEarlyReturnRefund } from "../../utils/booking-refund"
import {
  BOOKING_ENTITY_TYPE,
  creditCommissionToSystemWallet,
  creditToWallet,
  findSystemCommissionTransaction,
} from "../../utils/wallet"
import { asWalletPrisma } from "../../utils/prisma"
import { calculatePlatformCommissionAmount } from "../../utils/platform-commission"

const bookingItemImageOrderBy: Prisma.ItemImageOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { createdAt: "asc" },
]
const DISPUTE_REPORT_WINDOW_DAYS = 15
const DAY_IN_MS = 24 * 60 * 60 * 1000

const bookingInclude = {
  item: {
    select: {
      id: true,
      name: true,
      description: true,
      condition: true,
      lenderId: true,
      rateOption: true,
      rentalFee: true,
      freeToBorrow: true,
      status: true,
      categories: {
        select: {
          category: true,
        },
      },
      images: {
        select: {
          path: true,
          isPrimary: true,
          sortOrder: true,
        },
        orderBy: bookingItemImageOrderBy,
      },
    },
  },
  borrower: {
    select: {
      borrowerRating: true,
      _count: {
        select: {
          bookings: true,
        },
      },
      user: {
        select: {
          username: true,
          firstName: true,
          middleName: true,
          lastName: true,
          email: true,
        },
      },
    },
  },
  lender: {
    select: {
      lenderRating: true,
      user: {
        select: {
          username: true,
          firstName: true,
          middleName: true,
          lastName: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.BookingInclude

type BookingRecord = Prisma.BookingGetPayload<{
  include: typeof bookingInclude
}> &
  BookingProofFields

type BookingListItem = Omit<BookingRecord, "item"> & {
  item: Omit<BookingRecord["item"], "images"> & {
    thumbnailImage: string | null
  }
}

const bookingEditableSelect = {
  id: true,
  borrowerId: true,
  lenderId: true,
  itemId: true,
  startDate: true,
  endDate: true,
  totalFee: true,
  platformCommission: true,
  paymentMethod: true,
  status: true,
  paymentStatus: true,
  cancellationReason: true,
  confirmedAt: true,
  returnedAt: true,
  cancelledAt: true,
  completedAt: true,
  disputeOpenedAt: true,
  paymentProcessedAt: true,
  refundAmount: true,
  item: {
    select: {
      id: true,
      lenderId: true,
      rateOption: true,
      rentalFee: true,
      freeToBorrow: true,
      status: true,
    },
  },
} as const

type BookingProofFields = {
  lenderHandoffProofUrl: string | null
  lenderHandoffProofUploadedAt: Date | null
  borrowerReturnProofUrl: string | null
  borrowerReturnProofUploadedAt: Date | null
}

const emptyBookingProofFields: BookingProofFields = {
  lenderHandoffProofUrl: null,
  lenderHandoffProofUploadedAt: null,
  borrowerReturnProofUrl: null,
  borrowerReturnProofUploadedAt: null,
}

type BookingProofPrismaClient = Pick<Context["prisma"], "$queryRaw" | "$executeRaw"> & {
  booking?: {
    update(args: Record<string, unknown>): Promise<unknown>
  }
}

const getFallbackBookingProofFields = (fallback?: Partial<BookingProofFields> | null) => ({
  ...emptyBookingProofFields,
  ...(fallback ?? {}),
})

const getBookingProofFields = async (
  prisma: Partial<BookingProofPrismaClient>,
  bookingId: string,
  fallback?: Partial<BookingProofFields> | null,
): Promise<BookingProofFields> => {
  if (typeof prisma.$queryRaw === "function") {
    const rows = await prisma.$queryRaw<BookingProofFields[]>(
      Prisma.sql`
        SELECT
          "lenderHandoffProofUrl",
          "lenderHandoffProofUploadedAt",
          "borrowerReturnProofUrl",
          "borrowerReturnProofUploadedAt"
        FROM "Booking"
        WHERE "id" = ${bookingId}
        LIMIT 1
      `,
    )

    return rows[0] ?? getFallbackBookingProofFields(fallback)
  }

  return getFallbackBookingProofFields(fallback)
}

const updateHandoffProofFields = async (
  prisma: Partial<BookingProofPrismaClient>,
  input: { bookingId: string; proofImageUrl: string; uploadedAt: Date },
) => {
  if (typeof prisma.$executeRaw === "function") {
    await prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Booking"
        SET
          "lenderHandoffProofUrl" = ${input.proofImageUrl},
          "lenderHandoffProofUploadedAt" = ${input.uploadedAt}
        WHERE "id" = ${input.bookingId}
      `,
    )
    return
  }

  await prisma.booking?.update({
    where: { id: input.bookingId },
    data: {
      lenderHandoffProofUrl: input.proofImageUrl,
      lenderHandoffProofUploadedAt: input.uploadedAt,
    },
  })
}

const updateReturnProofFields = async (
  prisma: Partial<BookingProofPrismaClient>,
  input: { bookingId: string; proofImageUrl: string; uploadedAt: Date },
) => {
  if (typeof prisma.$executeRaw === "function") {
    await prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Booking"
        SET
          "borrowerReturnProofUrl" = ${input.proofImageUrl},
          "borrowerReturnProofUploadedAt" = ${input.uploadedAt}
        WHERE "id" = ${input.bookingId}
      `,
    )
    return
  }

  await prisma.booking?.update({
    where: { id: input.bookingId },
    data: {
      borrowerReturnProofUrl: input.proofImageUrl,
      borrowerReturnProofUploadedAt: input.uploadedAt,
    },
  })
}

type BookingEditableRecord = Prisma.BookingGetPayload<{
  select: typeof bookingEditableSelect
}> &
  BookingProofFields

const bookingTransactionSelect = {
  id: true,
  borrowerId: true,
  lenderId: true,
  itemId: true,
  startDate: true,
  endDate: true,
  totalFee: true,
  platformCommission: true,
  status: true,
  paymentStatus: true,
  refundAmount: true,
  confirmedAt: true,
  returnedAt: true,
  cancellationReason: true,
  cancelledAt: true,
} as const

type BookingTransactionRecord = Prisma.BookingGetPayload<{
  select: typeof bookingTransactionSelect
}> &
  BookingProofFields

type BookingReviewRecord = Parameters<typeof mapTransactionReview>[0]

type BookingDetailTransaction = {
  id: string
  status: PrismaTransactionStatus
  borrowerId: string | null
  lenderId: string | null
  startDate: Date | null
  endDate: Date | null
  createdAt: Date
  statusLogs: Array<{
    id: string
    oldStatus: PrismaTransactionStatus | null
    newStatus: PrismaTransactionStatus
    changedByRole: string
    remarks: string | null
    createdAt: Date
  }>
  disputes: Array<{
    id: string
    raisedById: string
    reason: string
    description: string | null
    status: string
    createdAt: Date
    reviewedAt: Date | null
    finalDecision: "APPROVED" | "REJECTED" | null
    finalDecisionNotes: string | null
    finalDecisionAt: Date | null
    requiredActionCount: number
    closedAt: Date | null
    rebuttalById: string | null
    rebuttalText: string | null
    rebuttalNotes: string | null
    rebuttalSubmittedAt: Date | null
    rebuttalBy: {
      id: string
      firstName: string
      middleName: string | null
      lastName: string
    } | null
    reviewedBy: {
      id: string
      firstName: string
      middleName: string | null
      lastName: string
    } | null
  }>
  reviews: BookingReviewRecord[]
}

type BookingTimelineEvent = {
  key: string
  label: string
  description: string
  occurredAt: Date
  source: "BOOKING" | "TRANSACTION_STATUS_LOG" | "TRANSACTION"
}

const overlappingPendingBookingSelect = {
  id: true,
  borrowerId: true,
  startDate: true,
  endDate: true,
  totalFee: true,
  paymentMethod: true,
  paymentStatus: true,
  cancellationReason: true,
  cancelledAt: true,
} satisfies Prisma.BookingSelect

type OverlappingPendingBookingRecord = Prisma.BookingGetPayload<{
  select: typeof overlappingPendingBookingSelect
}>

type BookingDelegate = {
  findMany(args: Record<string, unknown>): Promise<BookingRecord[]>
  findUnique(args: Record<string, unknown>): Promise<BookingRecord | BookingEditableRecord | null>
  findFirst(args: Record<string, unknown>): Promise<{ id: string } | null>
  create(args: Record<string, unknown>): Promise<BookingRecord>
  update(args: Record<string, unknown>): Promise<BookingRecord>
  delete(args: Record<string, unknown>): Promise<BookingRecord>
}

type BookingPrismaClient = Context["prisma"] & {
  booking: BookingDelegate
}

type BookingMutationPrismaClient = {
  rentalTransaction: {
    findUnique(
      args: Record<string, unknown>,
    ): Promise<{ id: string; status: PrismaTransactionStatus } | null>
    create(args: Record<string, unknown>): Promise<unknown>
    update(args: Record<string, unknown>): Promise<unknown>
    deleteMany(args: Record<string, unknown>): Promise<unknown>
  }
}

const getBookingPrisma = (ctx: Pick<Context, "prisma">) =>
  ctx.prisma as unknown as BookingPrismaClient

type AvailabilityValidationPrismaClient = Pick<Context["prisma"], "itemAvailability">

type AvailabilityRangeRecord = {
  startDate: Date
  endDate: Date
  status: "AVAILABLE" | "RENTED"
}

type BookingTimeRange = {
  startDate: Date
  endDate: Date
}

const doTimeRangesOverlap = (left: BookingTimeRange, right: BookingTimeRange) =>
  left.startDate < right.endDate && left.endDate > right.startDate

const expandRangeToUtcDays = <T extends BookingTimeRange>(range: T): T => {
  const start = new Date(range.startDate)
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(range.endDate)
  if (
    end.getUTCHours() !== 0 ||
    end.getUTCMinutes() !== 0 ||
    end.getUTCSeconds() !== 0 ||
    end.getUTCMilliseconds() !== 0
  ) {
    end.setUTCHours(24, 0, 0, 0)
  }
  return { ...range, startDate: start, endDate: end }
}

const isBookingWindowFullyCoveredByAvailability = (
  bookingWindow: BookingTimeRange,
  availabilityRanges: AvailabilityRangeRecord[],
) => {
  const availableRanges = availabilityRanges
    .filter(
      (range) =>
        range.status === "AVAILABLE" &&
        range.endDate > range.startDate &&
        doTimeRangesOverlap(bookingWindow, range),
    )
    .sort((left, right) => left.startDate.getTime() - right.startDate.getTime())

  let coveredUntil = bookingWindow.startDate.getTime()
  const bookingEnd = bookingWindow.endDate.getTime()

  for (const range of availableRanges) {
    const rangeStart = range.startDate.getTime()
    const rangeEnd = range.endDate.getTime()

    if (rangeStart > coveredUntil) {
      return false
    }

    coveredUntil = Math.max(coveredUntil, rangeEnd)

    if (coveredUntil >= bookingEnd) {
      return true
    }
  }

  return false
}

const ensureBookingWindowMatchesAvailability = async (
  prisma: AvailabilityValidationPrismaClient,
  input: {
    itemId: string
    startDate: Date
    endDate: Date
  },
) => {
  const availabilityRanges = (await prisma.itemAvailability.findMany({
    where: { itemId: input.itemId },
    select: {
      startDate: true,
      endDate: true,
      status: true,
    },
  })) as AvailabilityRangeRecord[]

  if (!availabilityRanges.length) {
    return
  }

  const dayAlignedRanges = availabilityRanges.map(expandRangeToUtcDays)
  const hasAvailableRanges = dayAlignedRanges.some((range) => range.status === "AVAILABLE")

  const requestedWindow = {
    startDate: input.startDate,
    endDate: input.endDate,
  }
  const hasBlockedWindow = dayAlignedRanges.some(
    (range) => range.status !== "AVAILABLE" && doTimeRangesOverlap(requestedWindow, range),
  )

  if (
    hasBlockedWindow ||
    (hasAvailableRanges &&
      !isBookingWindowFullyCoveredByAvailability(requestedWindow, dayAlignedRanges))
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The selected dates are not fully available for this listing.",
    })
  }
}

const getBookingThumbnailImage = (item: Pick<BookingRecord["item"], "images">) =>
  item.images.find((image) => image.isPrimary)?.path ?? item.images[0]?.path ?? null

const isDateWithinWindow = (value: Date | null, days: number) =>
  Boolean(value && value.getTime() >= Date.now() - days * DAY_IN_MS)

const mapBookingRecord = (record: BookingRecord): BookingListItem => {
  const { item, ...rest } = record
  const { images, ...itemRest } = item

  return {
    ...rest,
    item: {
      ...itemRest,
      thumbnailImage: getBookingThumbnailImage({ images }),
    },
  }
}

const transactionStatusTimelineLabels: Record<
  PrismaTransactionStatus,
  { label: string; description: string }
> = {
  [PrismaTransactionStatus.PENDING]: {
    label: "Transaction pending",
    description: "Transaction status was recorded as pending.",
  },
  [PrismaTransactionStatus.AWAITING_LENDER_APPROVAL]: {
    label: "Awaiting lender approval",
    description: "Transaction is waiting for lender approval.",
  },
  [PrismaTransactionStatus.CONFIRMED]: {
    label: "Confirmed",
    description: "Lender approval was recorded for this transaction.",
  },
  [PrismaTransactionStatus.PAID]: {
    label: "Payment marked paid",
    description: "Payment status was recorded as paid.",
  },
  [PrismaTransactionStatus.ONGOING]: {
    label: "In use",
    description: "The item is in use.",
  },
  [PrismaTransactionStatus.RETURNED]: {
    label: "Returned",
    description: "The item return was recorded in the transaction log.",
  },
  [PrismaTransactionStatus.COMPLETED]: {
    label: "Completed",
    description: "Transaction completion was recorded.",
  },
  [PrismaTransactionStatus.CANCELLED]: {
    label: "Cancelled",
    description: "Transaction cancellation was recorded.",
  },
  [PrismaTransactionStatus.IN_DISPUTE]: {
    label: "Dispute opened",
    description: "Transaction status was recorded as in dispute.",
  },
  [PrismaTransactionStatus.APPEALED]: {
    label: "Dispute appealed",
    description: "Transaction status was recorded as appealed.",
  },
  [PrismaTransactionStatus.REFUNDED]: {
    label: "Refunded",
    description: "Transaction status was recorded as refunded.",
  },
  [PrismaTransactionStatus.FAILED]: {
    label: "Failed",
    description: "Transaction status was recorded as failed.",
  },
}

const getFirstStatusLogAt = (
  transaction: BookingDetailTransaction | null | undefined,
  status: PrismaTransactionStatus,
) => transaction?.statusLogs?.find((log) => log.newStatus === status)?.createdAt ?? null

const buildBookingTimeline = (
  booking: BookingRecord,
  transaction: BookingDetailTransaction | null,
): BookingTimelineEvent[] => {
  const events: BookingTimelineEvent[] = []
  const addBookingEvent = (
    key: string,
    label: string,
    description: string,
    occurredAt: Date | null | undefined,
  ) => {
    if (!occurredAt) return
    events.push({
      key,
      label,
      description,
      occurredAt,
      source: "BOOKING",
    })
  }

  addBookingEvent(
    "booking-requested",
    "Requested",
    "Booking request timestamp from the booking record.",
    booking.requestedAt,
  )
  addBookingEvent(
    "booking-confirmed",
    "Confirmed",
    "Booking confirmation timestamp from the booking record.",
    booking.confirmedAt,
  )
  addBookingEvent(
    "booking-handoff-proof",
    "In use",
    "Lender proof of item handoff upload timestamp from the booking record.",
    booking.lenderHandoffProofUploadedAt,
  )
  addBookingEvent(
    "booking-returned",
    "Returned",
    "Borrower proof of item return upload timestamp from the booking record.",
    booking.borrowerReturnProofUploadedAt ??
      (getFirstStatusLogAt(transaction, PrismaTransactionStatus.RETURNED)
        ? null
        : (booking.actualReturnedAt ?? booking.returnedAt)),
  )
  addBookingEvent(
    "booking-completed",
    "Completed",
    "Completion timestamp from the booking record.",
    getFirstStatusLogAt(transaction, PrismaTransactionStatus.COMPLETED)
      ? null
      : booking.completedAt,
  )
  addBookingEvent(
    "booking-cancelled",
    "Cancelled",
    "Cancellation timestamp from the booking record.",
    getFirstStatusLogAt(transaction, PrismaTransactionStatus.CANCELLED)
      ? null
      : booking.cancelledAt,
  )
  addBookingEvent(
    "booking-dispute-opened",
    "Dispute opened",
    "Dispute opened timestamp from the booking record.",
    getFirstStatusLogAt(transaction, PrismaTransactionStatus.IN_DISPUTE)
      ? null
      : booking.disputeOpenedAt,
  )

  if (transaction) {
    for (const log of transaction.statusLogs ?? []) {
      if (
        (log.newStatus === PrismaTransactionStatus.ONGOING &&
          booking.lenderHandoffProofUploadedAt) ||
        (log.newStatus === PrismaTransactionStatus.RETURNED &&
          booking.borrowerReturnProofUploadedAt) ||
        log.newStatus === PrismaTransactionStatus.PAID
      ) {
        continue
      }

      const timelineCopy = transactionStatusTimelineLabels[log.newStatus]
      events.push({
        key: `transaction-status-log-${log.id}`,
        label: timelineCopy.label,
        description: log.remarks ?? timelineCopy.description,
        occurredAt: log.createdAt,
        source: "TRANSACTION_STATUS_LOG",
      })
    }
  }

  return events.sort((left, right) => {
    const timeDiff = left.occurredAt.getTime() - right.occurredAt.getTime()
    if (timeDiff !== 0) return timeDiff
    return left.key.localeCompare(right.key)
  })
}

const DEFAULT_PAYMENT_METHOD: PaymentMethod = paymentMethodSchema.enum.GCASH

const prismaPaymentMethodByInput: Record<PaymentMethod, PrismaPaymentMethod> = {
  CASH: PrismaPaymentMethod.CASH,
  GCASH: PrismaPaymentMethod.GCASH,
  CARD: PrismaPaymentMethod.CARD,
  BANK_TRANSFER: PrismaPaymentMethod.BANK_TRANSFER,
  WALLET: PrismaPaymentMethod.WALLET,
}

const ITEM_BLOCKING_BOOKING_STATUSES = [
  bookingStatusSchema.enum.CONFIRMED,
  bookingStatusSchema.enum.IN_DISPUTE,
] as const

const RETURN_CONFLICT_BOOKING_STATUSES = [
  bookingStatusSchema.enum.CONFIRMED,
  bookingStatusSchema.enum.RETURNED,
  bookingStatusSchema.enum.IN_DISPUTE,
] as const

const BOOKING_MUTATION_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 15_000,
} as const

const OVERLAPPING_REQUEST_CANCELLATION_REASON =
  "Cancelled because the lender approved another overlapping request."

const assertParticipantAccess = (
  booking: Pick<BookingEditableRecord, "borrowerId" | "lenderId">,
  userId: string,
) => {
  if (booking.borrowerId !== userId && booking.lenderId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed to access this booking." })
  }
}

const calculateBookingTotal = (
  item: Pick<BookingEditableRecord["item"], "freeToBorrow" | "rateOption" | "rentalFee">,
  startDate: Date,
  endDate: Date,
) => {
  if (item.freeToBorrow) {
    return 0
  }

  const diffMs = endDate.getTime() - startDate.getTime()
  const unitMs = item.rateOption === "PER_HOUR" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  const units = Math.max(1, Math.ceil(diffMs / unitMs))

  return units * item.rentalFee
}

const calculateRentalAmount = (totalFee: number, platformCommission: number) =>
  Math.max(0, totalFee - platformCommission)

const prismaTransactionStatuses = PrismaTransactionStatus as Record<string, PrismaTransactionStatus>

const getPrismaTransactionStatus = (
  preferred: string,
  fallback: PrismaTransactionStatus,
): PrismaTransactionStatus => prismaTransactionStatuses[preferred] ?? fallback

const mapBookingToTransactionStatus = (
  status: PrismaBookingStatus,
  paymentStatus: PrismaBookingPaymentStatus,
) => {
  if (paymentStatus === bookingPaymentStatusSchema.enum.FAILED) {
    return getPrismaTransactionStatus("FAILED", PrismaTransactionStatus.CANCELLED)
  }

  if (paymentStatus === bookingPaymentStatusSchema.enum.REFUNDED) {
    return getPrismaTransactionStatus("REFUNDED", PrismaTransactionStatus.CANCELLED)
  }

  switch (status) {
    case bookingStatusSchema.enum.CONFIRMED:
      return paymentStatus === bookingPaymentStatusSchema.enum.PAID
        ? PrismaTransactionStatus.PAID
        : PrismaTransactionStatus.CONFIRMED
    case bookingStatusSchema.enum.RETURNED:
      return PrismaTransactionStatus.RETURNED
    case bookingStatusSchema.enum.CANCELLED:
      return PrismaTransactionStatus.CANCELLED
    case bookingStatusSchema.enum.COMPLETED:
      return PrismaTransactionStatus.COMPLETED
    case bookingStatusSchema.enum.IN_DISPUTE:
      return getPrismaTransactionStatus("IN_DISPUTE", PrismaTransactionStatus.PENDING)
    case bookingStatusSchema.enum.PENDING:
    default:
      return PrismaTransactionStatus.AWAITING_LENDER_APPROVAL
  }
}

const buildBookingTimestamps = (
  existing: Pick<
    BookingEditableRecord,
    | "confirmedAt"
    | "returnedAt"
    | "cancelledAt"
    | "completedAt"
    | "disputeOpenedAt"
    | "paymentProcessedAt"
    | "paymentStatus"
  >,
  nextStatus: keyof typeof bookingStatusSchema.enum | undefined,
  nextPaymentStatus: keyof typeof bookingPaymentStatusSchema.enum | undefined,
) => {
  const now = new Date()

  return {
    confirmedAt:
      nextStatus === bookingStatusSchema.enum.CONFIRMED && existing.confirmedAt === null
        ? now
        : undefined,
    returnedAt:
      nextStatus === bookingStatusSchema.enum.RETURNED && existing.returnedAt === null
        ? now
        : undefined,
    cancelledAt:
      nextStatus === bookingStatusSchema.enum.CANCELLED && existing.cancelledAt === null
        ? now
        : undefined,
    completedAt:
      nextStatus === bookingStatusSchema.enum.COMPLETED && existing.completedAt === null
        ? now
        : undefined,
    disputeOpenedAt:
      nextStatus === bookingStatusSchema.enum.IN_DISPUTE && existing.disputeOpenedAt === null
        ? now
        : undefined,
    paymentProcessedAt:
      nextPaymentStatus !== undefined &&
      nextPaymentStatus !== existing.paymentStatus &&
      existing.paymentProcessedAt === null
        ? now
        : undefined,
  }
}

const ensureBookingWindowAvailable = async (
  bookingPrisma: BookingPrismaClient,
  input: {
    itemId: string
    startDate: Date
    endDate: Date
    excludeBookingId?: string
    statuses?: readonly (keyof typeof bookingStatusSchema.enum)[]
    errorMessage?: string
  },
) => {
  const overlappingBooking = await bookingPrisma.booking.findFirst({
    where: {
      itemId: input.itemId,
      ...(input.excludeBookingId ? { id: { not: input.excludeBookingId } } : {}),
      status: { in: [...(input.statuses ?? ITEM_BLOCKING_BOOKING_STATUSES)] },
      startDate: { lt: input.endDate },
      endDate: { gt: input.startDate },
    },
    select: { id: true },
  })

  if (overlappingBooking) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: input.errorMessage ?? "The requested booking window overlaps an existing booking.",
    })
  }
}

const doBookingWindowsOverlap = doTimeRangesOverlap

type TransactionSyncActor = {
  userId: string
  role: "borrower" | "lender" | "system"
  remarks?: string
}

type TransactionStatusRunnerPrismaClient = BookingMutationPrismaClient & {
  $executeRaw?: (...args: unknown[]) => Promise<unknown>
}

const transactionTransitionGraph: Partial<
  Record<PrismaTransactionStatus, PrismaTransactionStatus[]>
> = {
  [PrismaTransactionStatus.PENDING]: [
    PrismaTransactionStatus.AWAITING_LENDER_APPROVAL,
    PrismaTransactionStatus.CANCELLED,
    PrismaTransactionStatus.FAILED,
  ],
  [PrismaTransactionStatus.AWAITING_LENDER_APPROVAL]: [
    PrismaTransactionStatus.CONFIRMED,
    PrismaTransactionStatus.CANCELLED,
    PrismaTransactionStatus.FAILED,
  ],
  [PrismaTransactionStatus.CONFIRMED]: [
    PrismaTransactionStatus.PAID,
    PrismaTransactionStatus.CANCELLED,
    PrismaTransactionStatus.FAILED,
  ],
  [PrismaTransactionStatus.PAID]: [
    PrismaTransactionStatus.ONGOING,
    PrismaTransactionStatus.IN_DISPUTE,
    PrismaTransactionStatus.REFUNDED,
    PrismaTransactionStatus.FAILED,
  ],
  [PrismaTransactionStatus.ONGOING]: [
    PrismaTransactionStatus.RETURNED,
    PrismaTransactionStatus.IN_DISPUTE,
    PrismaTransactionStatus.FAILED,
  ],
  [PrismaTransactionStatus.RETURNED]: [
    PrismaTransactionStatus.COMPLETED,
    PrismaTransactionStatus.IN_DISPUTE,
  ],
  [PrismaTransactionStatus.IN_DISPUTE]: [
    PrismaTransactionStatus.APPEALED,
    PrismaTransactionStatus.COMPLETED,
    PrismaTransactionStatus.CANCELLED,
    PrismaTransactionStatus.REFUNDED,
    PrismaTransactionStatus.FAILED,
  ],
  [PrismaTransactionStatus.APPEALED]: [
    PrismaTransactionStatus.IN_DISPUTE,
    PrismaTransactionStatus.COMPLETED,
    PrismaTransactionStatus.CANCELLED,
    PrismaTransactionStatus.REFUNDED,
    PrismaTransactionStatus.FAILED,
  ],
}

const getTransactionTransitionSteps = (
  currentStatus: PrismaTransactionStatus,
  targetStatus: PrismaTransactionStatus,
) => {
  if (currentStatus === targetStatus) {
    return []
  }

  const queue: Array<{ status: PrismaTransactionStatus; path: PrismaTransactionStatus[] }> = [
    { status: currentStatus, path: [] },
  ]
  const visited = new Set<PrismaTransactionStatus>([currentStatus])

  while (queue.length > 0) {
    const next = queue.shift()
    if (!next) break

    for (const candidate of transactionTransitionGraph[next.status] ?? []) {
      if (visited.has(candidate)) continue

      const path = [...next.path, candidate]
      if (candidate === targetStatus) {
        return path
      }

      visited.add(candidate)
      queue.push({ status: candidate, path })
    }
  }

  return [targetStatus]
}

const applyTransactionStatusStep = async (
  bookingPrisma: TransactionStatusRunnerPrismaClient,
  transactionId: string,
  step: PrismaTransactionStatus,
  actor: TransactionSyncActor,
) => {
  const transactionStatusValue = step.toLowerCase()

  if (typeof bookingPrisma.$executeRaw === "function") {
    await bookingPrisma.$executeRaw(
      Prisma.sql`SELECT set_transaction_status(
        CAST(${transactionId} AS text),
        CAST(${transactionStatusValue} AS transaction_status_enum),
        CAST(${actor.userId} AS text),
        CAST(${actor.role} AS actor_role_enum),
        CAST(${actor.remarks ?? null} AS text)
      )`,
    )
    return
  }

  await bookingPrisma.rentalTransaction.update({
    where: { id: transactionId },
    data: { status: step },
  })
}

const syncBookingTransaction = async (
  bookingPrisma: TransactionStatusRunnerPrismaClient,
  booking: Pick<
    BookingTransactionRecord,
    | "id"
    | "borrowerId"
    | "lenderId"
    | "itemId"
    | "startDate"
    | "endDate"
    | "totalFee"
    | "platformCommission"
    | "status"
    | "paymentStatus"
  >,
  actor: TransactionSyncActor,
) => {
  if (booking.status === bookingStatusSchema.enum.PENDING) {
    return
  }

  const rentalFee = calculateRentalAmount(booking.totalFee, booking.platformCommission)
  const targetStatus = mapBookingToTransactionStatus(booking.status, booking.paymentStatus)
  const transactionData = {
    borrowerId: booking.borrowerId,
    lenderId: booking.lenderId,
    itemId: booking.itemId,
    startDate: booking.startDate,
    endDate: booking.endDate,
    rentalFee,
    platformFee: booking.platformCommission,
  }

  const existingTransaction = await bookingPrisma.rentalTransaction.findUnique({
    where: { bookingId: booking.id },
    select: {
      id: true,
      status: true,
    },
  })

  if (!existingTransaction) {
    await bookingPrisma.rentalTransaction.create({
      data: {
        bookingId: booking.id,
        ...transactionData,
        status: targetStatus,
      },
    })
    return
  }

  await bookingPrisma.rentalTransaction.update({
    where: { bookingId: booking.id },
    data: transactionData,
  })

  const transitionSteps = getTransactionTransitionSteps(existingTransaction.status, targetStatus)

  for (const status of transitionSteps) {
    if (status === existingTransaction.status) continue

    await applyTransactionStatusStep(bookingPrisma, existingTransaction.id, status, actor)

    await bookingPrisma.rentalTransaction.update({
      where: { bookingId: booking.id },
      data: transactionData,
    })
  }
}

const transitionTransactionToStatus = async (
  bookingPrisma: TransactionStatusRunnerPrismaClient,
  transaction: { id: string; status: PrismaTransactionStatus },
  targetStatus: PrismaTransactionStatus,
  actor: TransactionSyncActor,
) => {
  const transitionSteps = getTransactionTransitionSteps(transaction.status, targetStatus)

  for (const status of transitionSteps) {
    if (status === transaction.status) continue
    await applyTransactionStatusStep(bookingPrisma, transaction.id, status, actor)
  }
}

type ItemStatusSyncPrismaClient = Pick<Context["prisma"], "item"> & {
  booking: {
    findFirst(args: Record<string, unknown>): Promise<{ id: string } | null>
  }
}

const syncItemStatusFromBookings = async (
  prisma: ItemStatusSyncPrismaClient,
  input: { itemId: string },
) => {
  const now = new Date()
  const item = await prisma.item.findUnique({
    where: { id: input.itemId },
    select: { status: true },
  })

  if (!item || item.status === "DELETED" || item.status === "DEACTIVATED") {
    return
  }

  const blockingBooking = await prisma.booking.findFirst({
    where: {
      itemId: input.itemId,
      status: { in: [...ITEM_BLOCKING_BOOKING_STATUSES] },
      startDate: { lte: now },
      endDate: { gt: now },
    },
    select: { id: true },
  })

  if (blockingBooking) {
    if (item.status !== "RENTED") {
      await prisma.item.update({
        where: { id: input.itemId },
        data: { status: "RENTED" },
      })
    }
    return
  }

  if (item.status === "RENTED") {
    await prisma.item.update({
      where: { id: input.itemId },
      data: { status: "AVAILABLE" },
    })
  }
}

const buildReturnNotification = (bookingId: string) => ({
  type: "BOOKING_RETURN_REQUESTED" as const,
  title: "Item return requested",
  body: "A borrower marked one of your items as returned. Review the booking and confirm receipt.",
  actionPath: `/account/transactions/${bookingId}`,
})

const buildBookingRequestNotification = (input: {
  bookingId: string
  itemName: string
  borrowerName: string
}) => ({
  type: "BOOKING_REQUESTED" as unknown as PrismaNotificationType,
  title: "New booking request",
  body: `${input.borrowerName} requested to book ${input.itemName}. Review the request before the rental starts.`,
  actionPath: `/account/transactions/${input.bookingId}`,
})

const createBookingRequestNotification = async (
  prisma: Pick<Context["prisma"], "$executeRaw" | "appNotification">,
  input: {
    recipientUserId: string
    actorUserId: string
    bookingId: string
    itemName: string
    borrowerName: string
  },
) => {
  const notification = buildBookingRequestNotification(input)

  try {
    await prisma.appNotification.create({
      data: {
        recipientUserId: input.recipientUserId,
        actorUserId: input.actorUserId,
        bookingId: input.bookingId,
        ...notification,
      },
    })
    return
  } catch (error) {
    console.warn("Prisma notification create failed; retrying booking notification via SQL", error)
  }

  try {
    await prisma.$executeRaw`
      INSERT INTO public."AppNotification" (
        "id",
        "recipientUserId",
        "actorUserId",
        "bookingId",
        "type",
        "title",
        "body",
        "actionPath"
      )
      VALUES (
        ${randomUUID()},
        ${input.recipientUserId},
        ${input.actorUserId},
        ${input.bookingId},
        ${notification.type}::"NotificationType",
        ${notification.title},
        ${notification.body},
        ${notification.actionPath}
      )
    `
  } catch (error) {
    console.error("Failed to create booking request notification", error)
  }
}

export const bookingRouter = router({
  list: protectedProcedure.input(listBookingsSchema).query(async ({ ctx, input }) => {
    const bookingPrisma = getBookingPrisma(ctx)
    const { role, status, itemId, startDateFrom, startDateTo, limit, cursor } = input
    const userId = ctx.user.id

    const roleWhere =
      role === "LENDER"
        ? { lenderId: userId }
        : role === "BORROWER"
          ? { borrowerId: userId }
          : { OR: [{ lenderId: userId }, { borrowerId: userId }] }

    const statusWhere = status ? { status } : {}
    const itemWhere = itemId ? { itemId } : {}
    const dateWhere =
      startDateFrom || startDateTo
        ? {
            startDate: {
              ...(startDateFrom ? { gte: startDateFrom } : {}),
              ...(startDateTo ? { lte: startDateTo } : {}),
            },
          }
        : {}
    const cursorWhere = cursor
      ? {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        }
      : {}

    const records = await bookingPrisma.booking.findMany({
      where: {
        AND: [roleWhere, statusWhere, itemWhere, dateWhere, cursorWhere],
      },
      include: bookingInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    })

    const hasMore = records.length > limit
    const bookings = hasMore ? records.slice(0, limit) : records
    const lastRecord = bookings.at(-1)
    const nextCursor =
      hasMore && lastRecord ? { id: lastRecord.id, createdAt: lastRecord.createdAt } : null

    return { bookings: (bookings as BookingRecord[]).map(mapBookingRecord), nextCursor }
  }),

  create: protectedProcedure.input(createBookingSchema).mutation(async ({ ctx, input }) => {
    const bookingPrisma = getBookingPrisma(ctx)

    await ctx.prisma.borrower.upsert({
      where: { userId: ctx.user.id },
      create: { userId: ctx.user.id, borrowStatus: "ACTIVE", borrowerRating: 0 },
      update: {},
    })

    const item = await ctx.prisma.item.findUnique({
      where: { id: input.itemId },
      select: {
        id: true,
        name: true,
        lenderId: true,
        rateOption: true,
        rentalFee: true,
        freeToBorrow: true,
        status: true,
      },
    })

    if (!item) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." })
    }

    if (item.lenderId === ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You cannot book your own item." })
    }

    if (item.status !== "AVAILABLE") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Item is not available for booking." })
    }

    await ensureBookingWindowMatchesAvailability(ctx.prisma, {
      itemId: input.itemId,
      startDate: input.startDate,
      endDate: input.endDate,
    })

    await ensureBookingWindowAvailable(bookingPrisma, {
      itemId: input.itemId,
      startDate: input.startDate,
      endDate: input.endDate,
    })

    const totalFee = calculateBookingTotal(item, input.startDate, input.endDate)
    const platformCommission = item.freeToBorrow ? 0 : calculatePlatformCommissionAmount(totalFee)
    const now = new Date()

    await ctx.prisma.lender.upsert({
      where: { userId: item.lenderId },
      create: { userId: item.lenderId, lenderRating: 0 },
      update: {},
    })

    const booking = await ctx.prisma.booking.create({
      data: {
        borrowerId: ctx.user.id,
        lenderId: item.lenderId,
        itemId: item.id,
        startDate: input.startDate,
        endDate: input.endDate,
        totalFee,
        platformCommission,
        paymentMethod: prismaPaymentMethodByInput[input.paymentMethod ?? DEFAULT_PAYMENT_METHOD],
        status: bookingStatusSchema.enum.PENDING,
        paymentStatus: item.freeToBorrow
          ? bookingPaymentStatusSchema.enum.NOT_REQUIRED
          : input.paymentMethod === "WALLET"
            ? bookingPaymentStatusSchema.enum.PAID
            : bookingPaymentStatusSchema.enum.PENDING,
        paymentProcessedAt: input.paymentMethod === "WALLET" ? now : null,
        cancellationReason: input.cancellationReason ?? null,
        updatedAt: now,
      },
      include: bookingInclude,
    })

    await syncBookingTransaction(
      ctx.prisma as unknown as TransactionStatusRunnerPrismaClient,
      booking,
      {
        userId: ctx.user.id,
        role: "borrower",
        remarks: "Booking created.",
      },
    )
    await ctx.prisma.item.update({
      where: { id: item.id },
      data: {
        bookingCount: {
          increment: 1,
        },
      },
    })

    await createBookingRequestNotification(ctx.prisma, {
      recipientUserId: item.lenderId,
      actorUserId: ctx.user.id,
      bookingId: booking.id,
      itemName: item.name,
      borrowerName: ctx.user.name || "A borrower",
    })

    return mapBookingRecord(booking as BookingRecord)
  }),

  byId: protectedProcedure.input(bookingIdSchema).query(async ({ ctx, input }) => {
    const bookingPrisma = getBookingPrisma(ctx)
    let booking = (await bookingPrisma.booking.findUnique({
      where: { id: input.id },
      include: bookingInclude,
    })) as BookingRecord | null

    // Fallback: Check if input.id is a transaction ID
    if (!booking) {
      const transaction = await ctx.prisma.rentalTransaction.findUnique({
        where: { id: input.id },
        select: { bookingId: true },
      })

      if (transaction?.bookingId) {
        booking = (await bookingPrisma.booking.findUnique({
          where: { id: transaction.bookingId },
          include: bookingInclude,
        })) as BookingRecord | null
      }
    }

    if (!booking) {
      return null
    }

    // --- PROACTIVE DATA REPAIR ---
    // If totalFee < refundAmount, the record is in a corrupted 'net' state.
    // We restore it to 'gross' (Net + Refund) to ensure correct UI and Payouts.
    if (booking.refundAmount > 0 && booking.totalFee < booking.refundAmount) {
      const correctGross = booking.totalFee + booking.refundAmount
      await bookingPrisma.booking.update({
        where: { id: booking.id },
        data: { totalFee: correctGross },
      })
      booking.totalFee = correctGross
    }

    const bookingProofFields = await getBookingProofFields(
      ctx.prisma,
      booking.id,
      booking as Partial<BookingProofFields>,
    )
    const bookingWithProof = { ...booking, ...bookingProofFields } as BookingRecord

    assertParticipantAccess(bookingWithProof, ctx.user.id)
    const transaction = await (
      ctx.prisma.rentalTransaction.findUnique as unknown as (
        args: Record<string, unknown>,
      ) => Promise<BookingDetailTransaction | null>
    )({
      where: { bookingId: input.id },
      select: {
        id: true,
        status: true,
        borrowerId: true,
        lenderId: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        statusLogs: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            oldStatus: true,
            newStatus: true,
            changedByRole: true,
            remarks: true,
            createdAt: true,
          },
        },
        disputes: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            raisedById: true,
            reason: true,
            description: true,
            status: true,
            createdAt: true,
            reviewedAt: true,
            finalDecision: true,
            finalDecisionNotes: true,
            finalDecisionAt: true,
            requiredActionCount: true,
            closedAt: true,
            rebuttalById: true,
            rebuttalText: true,
            rebuttalNotes: true,
            rebuttalSubmittedAt: true,
            rebuttalBy: {
              select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true,
              },
            },
            reviewedBy: {
              select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true,
              },
            },
          },
        },
        reviews: {
          orderBy: {
            createdAt: "desc",
          },
          select: transactionReviewSelect,
        },
      },
    })

    const latestDispute = transaction?.disputes[0] ?? null
    const hasActiveDispute =
      transaction?.disputes.some((dispute) => isActiveDisputeStatus(dispute.status)) ?? false
    const hasAnyDispute = (transaction?.disputes.length ?? 0) > 0
    const visibleLatestDispute =
      latestDispute &&
      (latestDispute.raisedById === ctx.user.id ||
        isCounterpartyVisibleDisputeStatus(latestDispute.status))
        ? latestDispute
        : null
    const isWithinDisputeWindow =
      booking.status === bookingStatusSchema.enum.COMPLETED &&
      isDateWithinWindow(booking.completedAt, DISPUTE_REPORT_WINDOW_DAYS)
    const canSubmitRebuttal = Boolean(
      visibleLatestDispute &&
      isRebuttalEnabledDisputeStatus(visibleLatestDispute.status) &&
      !visibleLatestDispute.finalDecisionAt &&
      !visibleLatestDispute.closedAt &&
      visibleLatestDispute.raisedById !== ctx.user.id &&
      !visibleLatestDispute.rebuttalSubmittedAt,
    )

    return {
      ...mapBookingRecord(bookingWithProof),
      transactionId: transaction?.id ?? null,
      transactionStartDate: transaction?.startDate ?? null,
      transactionEndDate: transaction?.endDate ?? null,
      timeline: buildBookingTimeline(bookingWithProof, transaction),
      canRaiseDispute:
        Boolean(transaction?.id && (transaction.borrowerId || transaction.lenderId)) &&
        isWithinDisputeWindow &&
        !hasAnyDispute,
      latestDispute: visibleLatestDispute
        ? {
            id: visibleLatestDispute.id,
            raisedById: visibleLatestDispute.raisedById,
            reason: visibleLatestDispute.reason,
            description: visibleLatestDispute.description,
            status: toUserFacingDisputeStatus(visibleLatestDispute.status),
            createdAt: visibleLatestDispute.createdAt,
            reviewedAt: visibleLatestDispute.reviewedAt,
            finalDecision: visibleLatestDispute.finalDecision,
            finalDecisionNotes: visibleLatestDispute.finalDecisionNotes,
            finalDecisionAt: visibleLatestDispute.finalDecisionAt,
            requiredActionCount: visibleLatestDispute.requiredActionCount,
            closedAt: visibleLatestDispute.closedAt,
            rebuttalById: visibleLatestDispute.rebuttalById,
            rebuttalText: visibleLatestDispute.rebuttalText,
            rebuttalNotes: visibleLatestDispute.rebuttalNotes,
            rebuttalSubmittedAt: visibleLatestDispute.rebuttalSubmittedAt,
            rebuttalBy: visibleLatestDispute.rebuttalBy
              ? {
                  id: visibleLatestDispute.rebuttalBy.id,
                  firstName: visibleLatestDispute.rebuttalBy.firstName,
                  middleName: visibleLatestDispute.rebuttalBy.middleName,
                  lastName: visibleLatestDispute.rebuttalBy.lastName,
                }
              : null,
            reviewedBy: visibleLatestDispute.reviewedBy
              ? {
                  id: visibleLatestDispute.reviewedBy.id,
                  firstName: visibleLatestDispute.reviewedBy.firstName,
                  middleName: visibleLatestDispute.reviewedBy.middleName,
                  lastName: visibleLatestDispute.reviewedBy.lastName,
                }
              : null,
            isActive: isActiveDisputeStatus(visibleLatestDispute.status),
            hasRebuttal: Boolean(
              visibleLatestDispute.rebuttalSubmittedAt && visibleLatestDispute.rebuttalText,
            ),
            canSubmitRebuttal,
          }
        : null,
      reviewState: buildTransactionReviewState({
        status: hasActiveDispute
          ? bookingStatusSchema.enum.IN_DISPUTE
          : (transaction?.status ?? booking.status),
        itemId: bookingWithProof.itemId,
        borrowerId: transaction?.borrowerId ?? bookingWithProof.borrowerId,
        lenderId: transaction?.lenderId ?? bookingWithProof.lenderId,
        currentUserId: ctx.user.id,
        existingReviewTypes: transaction?.reviews.map((review) => review.reviewType) ?? [],
      }),
      reviews: transaction?.reviews.map(mapTransactionReview) ?? [],
    }
  }),

  update: protectedProcedure.input(updateBookingSchema).mutation(async ({ ctx, input }) => {
    const bookingPrisma = getBookingPrisma(ctx)
    const existing = (await bookingPrisma.booking.findUnique({
      where: { id: input.id },
      select: bookingEditableSelect,
    })) as BookingEditableRecord | null

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." })
    }
    Object.assign(
      existing,
      await getBookingProofFields(ctx.prisma, existing.id, existing as Partial<BookingProofFields>),
    )

    assertParticipantAccess(existing, ctx.user.id)

    if (input.status === bookingStatusSchema.enum.CONFIRMED && existing.lenderId !== ctx.user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only the lender can accept this booking request.",
      })
    }

    if (input.status === bookingStatusSchema.enum.RETURNED) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Use the dedicated return action to mark this booking as returned.",
      })
    }

    if (input.status === bookingStatusSchema.enum.CANCELLED) {
      if (existing.status !== bookingStatusSchema.enum.PENDING) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending booking requests can be cancelled.",
        })
      }

      if (existing.borrowerId !== ctx.user.id && existing.lenderId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only booking participants can cancel this request.",
        })
      }
    }

    if (input.status === bookingStatusSchema.enum.COMPLETED) {
      if (existing.lenderId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the lender can complete this booking after the item is returned.",
        })
      }

      if (existing.status !== bookingStatusSchema.enum.RETURNED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only returned bookings can be completed.",
        })
      }

      if (!existing.returnedAt || existing.returnedAt < existing.startDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only bookings returned after the rental period starts can be completed.",
        })
      }
    }

    const startDate = input.startDate ?? existing.startDate
    const endDate = input.endDate ?? existing.endDate

    if (endDate <= startDate) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "endDate must be later than startDate.",
      })
    }

    if (input.startDate || input.endDate) {
      await ensureBookingWindowMatchesAvailability(ctx.prisma, {
        itemId: existing.itemId,
        startDate,
        endDate,
      })

      await ensureBookingWindowAvailable(bookingPrisma, {
        itemId: existing.itemId,
        startDate,
        endDate,
        excludeBookingId: existing.id,
        statuses: ITEM_BLOCKING_BOOKING_STATUSES,
      })
    }

    const shouldRecalculatePricing = Boolean(input.startDate || input.endDate)
    const totalFee = shouldRecalculatePricing
      ? calculateBookingTotal(existing.item, startDate, endDate)
      : existing.totalFee
    const platformCommission = existing.item.freeToBorrow
      ? 0
      : shouldRecalculatePricing
        ? calculatePlatformCommissionAmount(totalFee)
        : existing.platformCommission
    const timestamps = buildBookingTimestamps(existing, input.status, input.paymentStatus)

    const updatedBookingId = await ctx.prisma.$transaction(async (tx) => {
      const txBookingPrisma = getBookingPrisma({ prisma: tx as Context["prisma"] })
      const isConfirmingBooking =
        input.status === bookingStatusSchema.enum.CONFIRMED &&
        existing.status !== bookingStatusSchema.enum.CONFIRMED

      if (isConfirmingBooking) {
        await ensureBookingWindowAvailable(txBookingPrisma, {
          itemId: existing.itemId,
          startDate,
          endDate,
          excludeBookingId: existing.id,
          statuses: ITEM_BLOCKING_BOOKING_STATUSES,
        })
      }

      const updatedBooking = await txBookingPrisma.booking.update({
        where: { id: input.id },
        data: {
          ...(input.startDate ? { startDate } : {}),
          ...(input.endDate ? { endDate } : {}),
          ...(shouldRecalculatePricing ? { totalFee, platformCommission } : {}),
          ...(input.paymentMethod
            ? { paymentMethod: prismaPaymentMethodByInput[input.paymentMethod] }
            : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.paymentStatus ? { paymentStatus: input.paymentStatus } : {}),
          ...(input.cancellationReason !== undefined
            ? { cancellationReason: input.cancellationReason }
            : {}),
          ...Object.fromEntries(
            Object.entries(timestamps).filter(([, value]) => value !== undefined),
          ),
        },
        select: bookingTransactionSelect,
      })

      if (isConfirmingBooking) {
        // Increment bookingCount on the item
        await (tx as Context["prisma"]).item.update({
          where: { id: existing.itemId },
          data: { bookingCount: { increment: 1 } },
        })

        const overlappingPendingBookings = (await txBookingPrisma.booking.findMany({
          where: {
            itemId: existing.itemId,
            id: { not: existing.id },
            status: bookingStatusSchema.enum.PENDING,
            startDate: { lt: endDate },
            endDate: { gt: startDate },
          },
          select: overlappingPendingBookingSelect,
        })) as OverlappingPendingBookingRecord[]

        for (const overlappingBooking of overlappingPendingBookings) {
          if (
            !doBookingWindowsOverlap(
              { startDate, endDate },
              {
                startDate: overlappingBooking.startDate,
                endDate: overlappingBooking.endDate,
              },
            )
          ) {
            continue
          }

          const cancelledBooking = await txBookingPrisma.booking.update({
            where: { id: overlappingBooking.id },
            data: {
              status: bookingStatusSchema.enum.CANCELLED,
              cancellationReason:
                overlappingBooking.cancellationReason ?? OVERLAPPING_REQUEST_CANCELLATION_REASON,
              cancelledAt: overlappingBooking.cancelledAt ?? new Date(),
            },
            select: bookingTransactionSelect,
          })

          await syncBookingTransaction(
            tx as unknown as TransactionStatusRunnerPrismaClient,
            cancelledBooking,
            {
              userId: ctx.user.id,
              role: "lender",
              remarks: OVERLAPPING_REQUEST_CANCELLATION_REASON,
            },
          )

          if (
            overlappingBooking.paymentMethod === PrismaPaymentMethod.WALLET &&
            overlappingBooking.paymentStatus === bookingPaymentStatusSchema.enum.PAID &&
            overlappingBooking.totalFee > 0
          ) {
            const walletTx = asWalletPrisma(tx as Prisma.TransactionClient)
            const existingRefund = await walletTx.walletTransaction.findFirst({
              where: {
                userId: overlappingBooking.borrowerId,
                type: "REFUND",
                relatedEntityType: BOOKING_ENTITY_TYPE,
                relatedEntityId: overlappingBooking.id,
              },
            })

            if (!existingRefund) {
              await creditToWallet(
                overlappingBooking.borrowerId,
                overlappingBooking.totalFee,
                {
                  type: "REFUND",
                  relatedEntityType: BOOKING_ENTITY_TYPE,
                  relatedEntityId: overlappingBooking.id,
                  metadata: { bookingId: overlappingBooking.id, refundReason: "CANCELLATION" },
                },
                tx as Context["prisma"],
              )
              await (tx as Context["prisma"]).booking.update({
                where: { id: overlappingBooking.id },
                data: { paymentStatus: bookingPaymentStatusSchema.enum.REFUNDED },
              })
            }
          }
        }
      }

      await syncBookingTransaction(
        tx as unknown as TransactionStatusRunnerPrismaClient,
        updatedBooking,
        {
          userId: ctx.user.id,
          role: existing.lenderId === ctx.user.id ? "lender" : "borrower",
          remarks: `Booking status updated to ${updatedBooking.status}.`,
        },
      )
      const syncedTransaction = await (tx as Context["prisma"]).rentalTransaction.findUnique({
        where: { bookingId: updatedBooking.id },
        select: {
          id: true,
          status: true,
        },
      })

      if (syncedTransaction) {
        if (isConfirmingBooking && isChatAvailableForTransactionStatus(syncedTransaction.status)) {
          await (tx as Context["prisma"]).conversation.upsert({
            where: { transactionId: syncedTransaction.id },
            update: {},
            create: { transactionId: syncedTransaction.id },
          })
        }

        await processTransactionRewards(tx as Context["prisma"], syncedTransaction.id)
      }

      // Wallet Refund on cancellation of a paid PENDING booking
      if (
        updatedBooking.status === bookingStatusSchema.enum.CANCELLED &&
        existing.status !== bookingStatusSchema.enum.CANCELLED &&
        existing.paymentMethod === PrismaPaymentMethod.WALLET &&
        existing.paymentStatus === bookingPaymentStatusSchema.enum.PAID &&
        existing.totalFee > 0
      ) {
        const walletTx = asWalletPrisma(tx as Prisma.TransactionClient)
        const existingRefund = await walletTx.walletTransaction.findFirst({
          where: {
            userId: existing.borrowerId,
            type: "REFUND",
            relatedEntityType: BOOKING_ENTITY_TYPE,
            relatedEntityId: updatedBooking.id,
          },
        })

        if (!existingRefund) {
          await creditToWallet(
            existing.borrowerId,
            existing.totalFee,
            {
              type: "REFUND",
              relatedEntityType: BOOKING_ENTITY_TYPE,
              relatedEntityId: updatedBooking.id,
              metadata: { bookingId: updatedBooking.id, refundReason: "CANCELLATION" },
            },
            tx as Context["prisma"],
          )
          await (tx as Context["prisma"]).booking.update({
            where: { id: updatedBooking.id },
            data: { paymentStatus: bookingPaymentStatusSchema.enum.REFUNDED },
          })
        }
      }

      // Wallet Payout & Refund Logic on completion
      if (
        updatedBooking.status === bookingStatusSchema.enum.COMPLETED &&
        existing.status !== bookingStatusSchema.enum.COMPLETED &&
        existing.paymentMethod === PrismaPaymentMethod.WALLET
      ) {
        const originalTotalFee = updatedBooking.totalFee
        const commission = updatedBooking.platformCommission
        const refundAmount = updatedBooking.refundAmount ?? 0
        const lenderEarnings = originalTotalFee - commission - refundAmount
        const walletTx = asWalletPrisma(tx as Prisma.TransactionClient)
        const commissionRatePercent =
          originalTotalFee > 0 ? Number(((commission / originalTotalFee) * 100).toFixed(2)) : 0
        const commissionMetadata = {
          sourceTransactionId: syncedTransaction?.id ?? null,
          bookingId: updatedBooking.id,
          borrowerId: existing.borrowerId,
          lenderId: existing.lenderId,
          grossAmount: originalTotalFee,
          commissionRatePercent,
        }

        if (commission > 0) {
          const existingCommission = await findSystemCommissionTransaction(
            updatedBooking.id,
            undefined,
            tx as Prisma.TransactionClient,
          )

          if (!existingCommission) {
            await creditCommissionToSystemWallet(
              commission,
              {
                relatedEntityType: BOOKING_ENTITY_TYPE,
                relatedEntityId: updatedBooking.id,
                metadata: commissionMetadata,
              },
              tx as Context["prisma"],
            )
          }
        }

        if (lenderEarnings > 0) {
          await creditToWallet(
            existing.lenderId,
            lenderEarnings,
            {
              type: "EARNING",
              relatedEntityType: BOOKING_ENTITY_TYPE,
              relatedEntityId: updatedBooking.id,
              metadata: {
                sourceTransactionId: syncedTransaction?.id ?? null,
                bookingId: updatedBooking.id,
                grossAmount: originalTotalFee,
                commissionAmount: commission,
                refundAmount,
              },
            },
            tx as Context["prisma"],
          )
        }

        if (refundAmount > 0) {
          const existingRefund = await walletTx.walletTransaction.findFirst({
            where: {
              userId: existing.borrowerId,
              type: "REFUND",
              relatedEntityType: BOOKING_ENTITY_TYPE,
              relatedEntityId: updatedBooking.id,
            },
          })

          if (!existingRefund) {
            await creditToWallet(
              existing.borrowerId,
              refundAmount,
              {
                type: "REFUND",
                relatedEntityType: BOOKING_ENTITY_TYPE,
                relatedEntityId: updatedBooking.id,
                metadata: {
                  sourceTransactionId: syncedTransaction?.id ?? null,
                  bookingId: updatedBooking.id,
                  refundAmount,
                },
              },
              tx as Context["prisma"],
            )
          }
        }
      }

      await syncItemStatusFromBookings(tx as unknown as ItemStatusSyncPrismaClient, {
        itemId: updatedBooking.itemId,
      })

      return updatedBooking.id
    }, BOOKING_MUTATION_TRANSACTION_OPTIONS)

    const updatedBooking = (await bookingPrisma.booking.findUnique({
      where: { id: updatedBookingId },
      include: bookingInclude,
    })) as BookingRecord | null

    if (!updatedBooking) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Booking was updated but could not be reloaded.",
      })
    }

    return mapBookingRecord(updatedBooking)
  }),

  markHandoffProof: protectedProcedure
    .input(handoffProofBookingSchema)
    .mutation(async ({ ctx, input }) => {
      const bookingPrisma = getBookingPrisma(ctx)
      const existing = (await bookingPrisma.booking.findUnique({
        where: { id: input.id },
        select: bookingEditableSelect,
      })) as BookingEditableRecord | null

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." })
      }
      Object.assign(
        existing,
        await getBookingProofFields(
          ctx.prisma,
          existing.id,
          existing as Partial<BookingProofFields>,
        ),
      )

      if (existing.lenderId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the lender can upload handoff proof for this booking.",
        })
      }

      if (existing.status !== bookingStatusSchema.enum.CONFIRMED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only confirmed bookings can be marked as in use.",
        })
      }

      if (existing.lenderHandoffProofUploadedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Handoff proof has already been uploaded for this booking.",
        })
      }

      const updatedBookingId = await ctx.prisma.$transaction(async (tx) => {
        const txBookingPrisma = getBookingPrisma({ prisma: tx as Context["prisma"] })
        const latestBooking = (await txBookingPrisma.booking.findUnique({
          where: { id: input.id },
          select: bookingEditableSelect,
        })) as BookingEditableRecord | null

        if (!latestBooking) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." })
        }
        Object.assign(
          latestBooking,
          await getBookingProofFields(
            tx as Context["prisma"],
            latestBooking.id,
            latestBooking as Partial<BookingProofFields>,
          ),
        )

        if (latestBooking.lenderId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the lender can upload handoff proof for this booking.",
          })
        }

        if (latestBooking.status !== bookingStatusSchema.enum.CONFIRMED) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only confirmed bookings can be marked as in use.",
          })
        }

        if (latestBooking.lenderHandoffProofUploadedAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Handoff proof has already been uploaded for this booking.",
          })
        }

        await syncBookingTransaction(
          tx as unknown as TransactionStatusRunnerPrismaClient,
          latestBooking,
          {
            userId: ctx.user.id,
            role: "lender",
            remarks: "Booking transaction prepared before handoff proof.",
          },
        )

        const transaction = await (tx as Context["prisma"]).rentalTransaction.findUnique({
          where: { bookingId: latestBooking.id },
          select: { id: true, status: true },
        })

        if (!transaction) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Transaction could not be prepared for this booking.",
          })
        }

        await transitionTransactionToStatus(
          tx as unknown as TransactionStatusRunnerPrismaClient,
          transaction,
          PrismaTransactionStatus.ONGOING,
          {
            userId: ctx.user.id,
            role: "lender",
            remarks: "Lender uploaded proof that the item was handed over.",
          },
        )

        const proofUploadedAt = new Date()
        await updateHandoffProofFields(tx as Context["prisma"], {
          bookingId: input.id,
          proofImageUrl: input.proofImageUrl,
          uploadedAt: proofUploadedAt,
        })
        const updatedBooking = (await txBookingPrisma.booking.findUnique({
          where: { id: input.id },
          select: bookingTransactionSelect,
        })) as BookingTransactionRecord | null

        if (!updatedBooking) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." })
        }

        await syncItemStatusFromBookings(tx as unknown as ItemStatusSyncPrismaClient, {
          itemId: updatedBooking.itemId,
        })

        return updatedBooking.id
      }, BOOKING_MUTATION_TRANSACTION_OPTIONS)

      const updatedBooking = (await bookingPrisma.booking.findUnique({
        where: { id: updatedBookingId },
        include: bookingInclude,
      })) as BookingRecord | null

      if (!updatedBooking) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Booking handoff proof was saved but could not be reloaded.",
        })
      }

      return mapBookingRecord(updatedBooking)
    }),

  returnItem: protectedProcedure
    .input(returnProofBookingSchema)
    .mutation(async ({ ctx, input }) => {
      const bookingPrisma = getBookingPrisma(ctx)
      const existing = (await bookingPrisma.booking.findUnique({
        where: { id: input.id },
        select: bookingEditableSelect,
      })) as BookingEditableRecord | null

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." })
      }
      Object.assign(
        existing,
        await getBookingProofFields(
          ctx.prisma,
          existing.id,
          existing as Partial<BookingProofFields>,
        ),
      )

      if (existing.borrowerId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the borrower can initiate a return for this booking.",
        })
      }

      if (existing.status === bookingStatusSchema.enum.RETURNED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This booking has already been marked as returned.",
        })
      }

      if (existing.status !== bookingStatusSchema.enum.CONFIRMED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only active confirmed bookings can be marked as returned.",
        })
      }

      if (!existing.lenderHandoffProofUploadedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The item must be marked as in use before it can be returned.",
        })
      }

      if (new Date() < existing.startDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This booking cannot be returned before the rental period starts.",
        })
      }

      const updatedBookingId = await ctx.prisma.$transaction(async (tx) => {
        const txBookingPrisma = getBookingPrisma({ prisma: tx as Context["prisma"] })
        const now = new Date()
        const latestBooking = (await txBookingPrisma.booking.findUnique({
          where: { id: input.id },
          select: bookingEditableSelect,
        })) as BookingEditableRecord | null

        if (!latestBooking) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." })
        }
        Object.assign(
          latestBooking,
          await getBookingProofFields(
            tx as Context["prisma"],
            latestBooking.id,
            latestBooking as Partial<BookingProofFields>,
          ),
        )

        if (latestBooking.borrowerId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the borrower can initiate a return for this booking.",
          })
        }

        if (latestBooking.status === bookingStatusSchema.enum.RETURNED) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This booking has already been marked as returned.",
          })
        }

        if (latestBooking.status !== bookingStatusSchema.enum.CONFIRMED) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only active confirmed bookings can be marked as returned.",
          })
        }

        if (!latestBooking.lenderHandoffProofUploadedAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "The item must be marked as in use before it can be returned.",
          })
        }

        if (now < latestBooking.startDate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This booking cannot be returned before the rental period starts.",
          })
        }

        await ensureBookingWindowAvailable(txBookingPrisma, {
          itemId: latestBooking.itemId,
          startDate: latestBooking.startDate,
          endDate: latestBooking.endDate,
          excludeBookingId: latestBooking.id,
          statuses: RETURN_CONFLICT_BOOKING_STATUSES,
          errorMessage:
            "Return cannot be recorded because another overlapping booking exists for this item.",
        })

        const returnedBooking = await txBookingPrisma.booking.update({
          where: { id: input.id },
          data: {
            status: bookingStatusSchema.enum.RETURNED,
            returnStatus: ReturnStatus.RETURNED,
            actualReturnedAt: now,
            returnedAt: now,
          },
          select: bookingTransactionSelect,
        })
        await updateReturnProofFields(tx as Context["prisma"], {
          bookingId: input.id,
          proofImageUrl: input.proofImageUrl,
          uploadedAt: now,
        })

        await syncBookingTransaction(
          tx as unknown as TransactionStatusRunnerPrismaClient,
          returnedBooking,
          {
            userId: ctx.user.id,
            role: "borrower",
            remarks: "Borrower uploaded proof that the item was returned.",
          },
        )
        const syncedTransaction = await (tx as Context["prisma"]).rentalTransaction.findUnique({
          where: { bookingId: returnedBooking.id },
          select: { id: true },
        })
        if (syncedTransaction) {
          await processTransactionRewards(tx as Context["prisma"], syncedTransaction.id)
        }

        await syncItemStatusFromBookings(tx as unknown as ItemStatusSyncPrismaClient, {
          itemId: returnedBooking.itemId,
        })

        await (tx as Context["prisma"]).appNotification.create({
          data: {
            recipientUserId: latestBooking.lenderId,
            actorUserId: ctx.user.id,
            bookingId: latestBooking.id,
            ...buildReturnNotification(latestBooking.id),
          },
        })

        return returnedBooking.id
      }, BOOKING_MUTATION_TRANSACTION_OPTIONS)

      const updatedBooking = (await bookingPrisma.booking.findUnique({
        where: { id: updatedBookingId },
        include: bookingInclude,
      })) as BookingRecord | null

      if (!updatedBooking) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Booking was returned but could not be reloaded.",
        })
      }

      return mapBookingRecord(updatedBooking)
    }),

  earlyReturn: protectedProcedure
    .input(earlyReturnBookingSchema)
    .mutation(async ({ ctx, input }) => {
      const bookingPrisma = getBookingPrisma(ctx)
      const existing = (await bookingPrisma.booking.findUnique({
        where: { id: input.id },
        select: {
          ...bookingEditableSelect,
          returnStatus: true,
          refundStatus: true,
        },
      })) as
        | (BookingEditableRecord & { returnStatus: ReturnStatus; refundStatus: RefundStatus })
        | null

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." })
      }
      Object.assign(
        existing,
        await getBookingProofFields(
          ctx.prisma,
          existing.id,
          existing as Partial<BookingProofFields>,
        ),
      )

      if (existing.borrowerId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the borrower can initiate an early return.",
        })
      }

      if (existing.status !== bookingStatusSchema.enum.CONFIRMED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only active confirmed bookings can be returned early.",
        })
      }

      if (!existing.lenderHandoffProofUploadedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The item must be marked as in use before it can be returned.",
        })
      }

      if (
        existing.returnStatus === ReturnStatus.EARLY_RETURNED ||
        existing.returnStatus === ReturnStatus.RETURNED
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This booking has already been returned.",
        })
      }

      const now = new Date()
      if (now < existing.startDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This booking cannot be returned before the rental period starts.",
        })
      }

      if (now >= existing.endDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The scheduled booking end time has already passed. Please use standard return.",
        })
      }

      const refundCalc = calculateEarlyReturnRefund(existing as unknown as Booking, now)

      const updatedBookingId = await ctx.prisma.$transaction(async (tx) => {
        const txBookingPrisma = getBookingPrisma({ prisma: tx as Context["prisma"] })

        const updateData = {
          status: bookingStatusSchema.enum.RETURNED,
          returnStatus: ReturnStatus.EARLY_RETURNED,
          actualReturnedAt: now,
          returnedAt: now,
          refundStatus: refundCalc.eligible ? RefundStatus.PROCESSED : RefundStatus.NOT_ELIGIBLE,
          refundAmount: refundCalc.refundAmount,
          refundProcessedAt: refundCalc.eligible ? now : null,
          refundReason: RefundReason.EARLY_RETURN,
        }

        const updatedBooking = await txBookingPrisma.booking.update({
          where: { id: input.id },
          data: updateData,
          select: bookingTransactionSelect,
        })
        await updateReturnProofFields(tx as Context["prisma"], {
          bookingId: input.id,
          proofImageUrl: input.proofImageUrl,
          uploadedAt: now,
        })

        // Sync transaction status
        await syncBookingTransaction(
          tx as unknown as TransactionStatusRunnerPrismaClient,
          updatedBooking,
          {
            userId: ctx.user.id,
            role: "borrower",
            remarks: `Borrower uploaded proof for early return. Refund: ${refundCalc.refundAmount} ${refundCalc.currency}`,
          },
        )

        // Create refund payment record if eligible
        if (refundCalc.eligible && refundCalc.refundAmount > 0) {
          const rentalTx = await (tx as Context["prisma"]).rentalTransaction.findUnique({
            where: { bookingId: input.id },
            select: { id: true },
          })

          if (rentalTx) {
            await (tx as Context["prisma"]).transactionPayment.create({
              data: {
                transactionId: rentalTx.id,
                payerUserId: existing.lenderId, // Money comes back from lender/system
                payeeUserId: existing.borrowerId,
                amount: refundCalc.refundAmount,
                method: existing.paymentMethod === "WALLET" ? "WALLET" : "GCASH",
                status: "SUCCESS",
                processedAt: now,
                feeAmount: 0,
              },
            })

            // Wallet Credit for Early Return Refund
            if (existing.paymentMethod === PrismaPaymentMethod.WALLET) {
              await creditToWallet(
                existing.borrowerId,
                refundCalc.refundAmount,
                {
                  type: "REFUND",
                  relatedEntityType: "BOOKING",
                  relatedEntityId: updatedBooking.id,
                },
                tx as Context["prisma"],
              )
            }
          }
        }

        // Standard post-return syncs
        const syncedTransaction = await (tx as Context["prisma"]).rentalTransaction.findUnique({
          where: { bookingId: updatedBooking.id },
          select: { id: true },
        })
        if (syncedTransaction) {
          await processTransactionRewards(tx as Context["prisma"], syncedTransaction.id)
        }

        await syncItemStatusFromBookings(tx as unknown as ItemStatusSyncPrismaClient, {
          itemId: updatedBooking.itemId,
        })

        await (tx as Context["prisma"]).appNotification.create({
          data: {
            recipientUserId: existing.lenderId,
            actorUserId: ctx.user.id,
            bookingId: existing.id,
            ...buildReturnNotification(existing.id),
          },
        })

        return updatedBooking.id
      }, BOOKING_MUTATION_TRANSACTION_OPTIONS)

      const updatedBooking = (await bookingPrisma.booking.findUnique({
        where: { id: updatedBookingId },
        include: bookingInclude,
      })) as BookingRecord | null

      if (!updatedBooking) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Booking was updated but could not be reloaded.",
        })
      }

      return {
        message: refundCalc.eligible
          ? "Early return processed successfully"
          : "Early return processed successfully. No refund is applicable.",
        booking: mapBookingRecord(updatedBooking),
        refund: {
          eligible: refundCalc.eligible,
          refundAmount: refundCalc.refundAmount,
          penaltyAmount: refundCalc.penaltyAmount,
          currency: refundCalc.currency,
          reason: refundCalc.reason,
        },
      }
    }),

  earlyReturnPreview: protectedProcedure.input(bookingIdSchema).query(async ({ ctx, input }) => {
    const existing = await ctx.prisma.booking.findUnique({
      where: { id: input.id },
    })

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." })
    }

    if (existing.borrowerId !== ctx.user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only the borrower can preview an early return.",
      })
    }

    const now = new Date()
    const refundCalc = calculateEarlyReturnRefund(existing, now)

    return {
      refund: {
        eligible: refundCalc.eligible,
        totalPaidAmount: refundCalc.totalPaidAmount,
        nonRefundableFees: refundCalc.nonRefundableFees,
        refundableRentalAmount: refundCalc.refundableRentalAmount,
        usedDurationMs: refundCalc.usedDurationMs,
        unusedDurationMs: refundCalc.unusedDurationMs,
        totalDurationMs: refundCalc.totalDurationMs,
        usagePercentage: refundCalc.usagePercentage,
        unusedRentalValue: refundCalc.unusedRentalValue,
        penaltyAmount: refundCalc.penaltyAmount,
        refundAmount: refundCalc.refundAmount,
        currency: refundCalc.currency,
        reason: refundCalc.reason,
      },
      actualReturnTime: now,
    }
  }),

  delete: protectedProcedure.input(deleteBookingSchema).mutation(async ({ ctx, input }) => {
    const bookingPrisma = getBookingPrisma(ctx)
    const existing = (await bookingPrisma.booking.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        borrowerId: true,
        lenderId: true,
      },
    })) as Pick<BookingEditableRecord, "id" | "borrowerId" | "lenderId"> | null

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." })
    }

    assertParticipantAccess(existing, ctx.user.id)

    return ctx.prisma.$transaction(async (tx) => {
      const txBookingPrisma = getBookingPrisma({ prisma: tx as Context["prisma"] })
      const txBookingMutationPrisma = tx as unknown as BookingMutationPrismaClient
      const deletedBooking = await txBookingPrisma.booking.delete({
        where: { id: input.id },
        include: bookingInclude,
      })

      await txBookingMutationPrisma.rentalTransaction.deleteMany({
        where: { bookingId: input.id },
      })
      await syncItemStatusFromBookings(tx as unknown as ItemStatusSyncPrismaClient, {
        itemId: deletedBooking.itemId,
      })

      return mapBookingRecord(deletedBooking as BookingRecord)
    })
  }),
})
