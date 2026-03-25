import type {
  BookingPaymentStatus as PrismaBookingPaymentStatus,
  BookingStatus as PrismaBookingStatus,
} from "@prisma/client"
import {
  Prisma,
  PaymentMethod as PrismaPaymentMethod,
  TransactionStatus as PrismaTransactionStatus,
} from "@prisma/client"
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
  listBookingsSchema,
  type PaymentMethod,
  paymentMethodSchema,
  returnBookingSchema,
  updateBookingSchema,
} from "../../../shared/schemas/booking"

const bookingItemImageOrderBy: Prisma.ItemImageOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { createdAt: "asc" },
]

const bookingInclude = {
  item: {
    select: {
      id: true,
      name: true,
      description: true,
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
}>

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
} satisfies Prisma.BookingSelect

type BookingEditableRecord = Prisma.BookingGetPayload<{
  select: typeof bookingEditableSelect
}>

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
  confirmedAt: true,
  returnedAt: true,
  cancellationReason: true,
  cancelledAt: true,
} satisfies Prisma.BookingSelect

type BookingTransactionRecord = Prisma.BookingGetPayload<{
  select: typeof bookingTransactionSelect
}>

const overlappingPendingBookingSelect = {
  id: true,
  startDate: true,
  endDate: true,
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

const normalizeCalendarDate = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate())

const isDateWithinAvailabilityRange = (date: Date, range: AvailabilityRangeRecord) => {
  const normalizedDate = normalizeCalendarDate(date)
  const rangeStart = normalizeCalendarDate(range.startDate)
  const rangeEnd = normalizeCalendarDate(range.endDate)

  return (
    normalizedDate.getTime() >= rangeStart.getTime() &&
    normalizedDate.getTime() <= rangeEnd.getTime()
  )
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

  const hasAvailableRanges = availabilityRanges.some((range) => range.status === "AVAILABLE")

  const startBoundary = normalizeCalendarDate(input.startDate)
  const endBoundary = normalizeCalendarDate(input.endDate)

  for (
    const cursor = new Date(startBoundary);
    cursor.getTime() <= endBoundary.getTime();
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const hasAvailableWindow = availabilityRanges.some(
      (range) => range.status === "AVAILABLE" && isDateWithinAvailabilityRange(cursor, range),
    )

    const hasBlockedWindow = availabilityRanges.some(
      (range) => range.status !== "AVAILABLE" && isDateWithinAvailabilityRange(cursor, range),
    )

    if (hasBlockedWindow || (hasAvailableRanges && !hasAvailableWindow)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "The selected dates are not fully available for this listing.",
      })
    }
  }
}

const getBookingThumbnailImage = (item: Pick<BookingRecord["item"], "images">) =>
  item.images.find((image) => image.isPrimary)?.path ?? item.images[0]?.path ?? null

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
  platformCommission: number,
) => {
  if (item.freeToBorrow) {
    return 0
  }

  const diffMs = endDate.getTime() - startDate.getTime()
  const unitMs = item.rateOption === "PER_HOUR" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  const units = Math.max(1, Math.ceil(diffMs / unitMs))

  return units * item.rentalFee + platformCommission
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

const doBookingWindowsOverlap = (left: BookingTimeRange, right: BookingTimeRange) =>
  left.startDate < right.endDate && left.endDate > right.startDate

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

    return { bookings: bookings.map(mapBookingRecord), nextCursor }
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

    const platformCommission = item.freeToBorrow ? 0 : input.platformCommission
    const totalFee = calculateBookingTotal(item, input.startDate, input.endDate, platformCommission)
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
          : bookingPaymentStatusSchema.enum.PENDING,
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

    return mapBookingRecord(booking)
  }),

  byId: protectedProcedure.input(bookingIdSchema).query(async ({ ctx, input }) => {
    const bookingPrisma = getBookingPrisma(ctx)
    const booking = (await bookingPrisma.booking.findUnique({
      where: { id: input.id },
      include: bookingInclude,
    })) as BookingRecord | null

    if (!booking) {
      return null
    }

    assertParticipantAccess(booking, ctx.user.id)
    return mapBookingRecord(booking)
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

    const platformCommission = existing.item.freeToBorrow
      ? 0
      : (input.platformCommission ?? existing.platformCommission)
    const totalFee = calculateBookingTotal(existing.item, startDate, endDate, platformCommission)
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
          ...(input.startDate || input.endDate || input.platformCommission !== undefined
            ? { totalFee, platformCommission }
            : {}),
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

  returnItem: protectedProcedure.input(returnBookingSchema).mutation(async ({ ctx, input }) => {
    const bookingPrisma = getBookingPrisma(ctx)
    const existing = (await bookingPrisma.booking.findUnique({
      where: { id: input.id },
      select: bookingEditableSelect,
    })) as BookingEditableRecord | null

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." })
    }

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

    const updatedBookingId = await ctx.prisma.$transaction(async (tx) => {
      const txBookingPrisma = getBookingPrisma({ prisma: tx as Context["prisma"] })
      const latestBooking = (await txBookingPrisma.booking.findUnique({
        where: { id: input.id },
        select: bookingEditableSelect,
      })) as BookingEditableRecord | null

      if (!latestBooking) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." })
      }

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
          returnedAt: latestBooking.returnedAt ?? new Date(),
        },
        select: bookingTransactionSelect,
      })

      await syncBookingTransaction(
        tx as unknown as TransactionStatusRunnerPrismaClient,
        returnedBooking,
        {
          userId: ctx.user.id,
          role: "borrower",
          remarks: "Borrower initiated item return.",
        },
      )

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

      return mapBookingRecord(deletedBooking)
    })
  }),
})
