import { TransactionStatus as PrismaTransactionStatus } from "@prisma/client"
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
  updateBookingSchema,
} from "../../../shared/schemas/booking"

const bookingItemImageOrderBy = [{ sortOrder: "asc" }, { createdAt: "asc" }] as const

const bookingInclude = {
  item: {
    select: {
      id: true,
      name: true,
      lenderId: true,
      rateOption: true,
      rentalFee: true,
      freeToBorrow: true,
      status: true,
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
} as const

type BookingRecord = {
  id: string
  borrowerId: string
  lenderId: string
  itemId: string
  startDate: Date
  endDate: Date
  totalFee: number
  platformCommission: number
  paymentMethod: PaymentMethod
  status: keyof typeof bookingStatusSchema.enum
  paymentStatus: keyof typeof bookingPaymentStatusSchema.enum
  cancellationReason: string | null
  requestedAt: Date
  confirmedAt: Date | null
  cancelledAt: Date | null
  completedAt: Date | null
  disputeOpenedAt: Date | null
  paymentProcessedAt: Date | null
  createdAt: Date
  updatedAt: Date
  item: {
    id: string
    name: string
    lenderId: string
    rateOption: "PER_HOUR" | "PER_DAY"
    rentalFee: number
    freeToBorrow: boolean
    status: string
    images: Array<{
      path: string
      isPrimary: boolean
      sortOrder: number
    }>
  }
  borrower: {
    user: {
      username: string
      firstName: string
      middleName: string | null
      lastName: string
      email: string
    }
  }
  lender: {
    user: {
      username: string
      firstName: string
      middleName: string | null
      lastName: string
      email: string
    }
  }
}

type BookingListItem = Omit<BookingRecord, "item"> & {
  item: Omit<BookingRecord["item"], "images"> & {
    thumbnailImage: string | null
  }
}

type BookingEditableRecord = {
  id: string
  borrowerId: string
  lenderId: string
  itemId: string
  startDate: Date
  endDate: Date
  totalFee: number
  platformCommission: number
  paymentMethod: PaymentMethod
  status: keyof typeof bookingStatusSchema.enum
  paymentStatus: keyof typeof bookingPaymentStatusSchema.enum
  cancellationReason: string | null
  confirmedAt: Date | null
  cancelledAt: Date | null
  completedAt: Date | null
  disputeOpenedAt: Date | null
  paymentProcessedAt: Date | null
  item: {
    id: string
    lenderId: string
    rateOption: "PER_HOUR" | "PER_DAY"
    rentalFee: number
    freeToBorrow: boolean
    status: string
  }
}

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
    upsert(args: Record<string, unknown>): Promise<unknown>
    deleteMany(args: Record<string, unknown>): Promise<unknown>
  }
}

const getBookingPrisma = (ctx: Pick<Context, "prisma">) =>
  ctx.prisma as unknown as BookingPrismaClient

const getBookingThumbnailImage = (
  item: Pick<BookingRecord["item"], "images">,
) => item.images.find((image) => image.isPrimary)?.path ?? item.images[0]?.path ?? null

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

const BOOKING_ACTIVE_STATUSES = [
  bookingStatusSchema.enum.PENDING,
  bookingStatusSchema.enum.CONFIRMED,
  bookingStatusSchema.enum.IN_DISPUTE,
] as const

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

const mapBookingToTransactionStatus = (
  status: keyof typeof bookingStatusSchema.enum,
  paymentStatus: keyof typeof bookingPaymentStatusSchema.enum,
) => {
  if (paymentStatus === bookingPaymentStatusSchema.enum.FAILED) {
    return PrismaTransactionStatus.FAILED
  }

  if (paymentStatus === bookingPaymentStatusSchema.enum.REFUNDED) {
    return PrismaTransactionStatus.REFUNDED
  }

  switch (status) {
    case bookingStatusSchema.enum.CONFIRMED:
      return paymentStatus === bookingPaymentStatusSchema.enum.PAID
        ? PrismaTransactionStatus.PAID
        : PrismaTransactionStatus.CONFIRMED
    case bookingStatusSchema.enum.CANCELLED:
      return PrismaTransactionStatus.CANCELLED
    case bookingStatusSchema.enum.COMPLETED:
      return PrismaTransactionStatus.COMPLETED
    case bookingStatusSchema.enum.IN_DISPUTE:
      return PrismaTransactionStatus.IN_DISPUTE
    case bookingStatusSchema.enum.PENDING:
    default:
      return PrismaTransactionStatus.PENDING
  }
}

const buildBookingTimestamps = (
  existing: Pick<
    BookingEditableRecord,
    "confirmedAt" | "cancelledAt" | "completedAt" | "disputeOpenedAt" | "paymentProcessedAt" | "paymentStatus"
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
  },
) => {
  const overlappingBooking = await bookingPrisma.booking.findFirst({
    where: {
      itemId: input.itemId,
      ...(input.excludeBookingId ? { id: { not: input.excludeBookingId } } : {}),
      status: { in: [...BOOKING_ACTIVE_STATUSES] },
      startDate: { lt: input.endDate },
      endDate: { gt: input.startDate },
    },
    select: { id: true },
  })

  if (overlappingBooking) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The requested booking window overlaps an existing booking.",
    })
  }
}

const syncBookingTransaction = async (
  bookingPrisma: BookingMutationPrismaClient,
  booking: Pick<
    BookingListItem,
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
) => {
  const rentalFee = calculateRentalAmount(booking.totalFee, booking.platformCommission)
  const status = mapBookingToTransactionStatus(booking.status, booking.paymentStatus)

  await bookingPrisma.rentalTransaction.upsert({
    where: { bookingId: booking.id },
    create: {
      bookingId: booking.id,
      borrowerId: booking.borrowerId,
      lenderId: booking.lenderId,
      itemId: booking.itemId,
      startDate: booking.startDate,
      endDate: booking.endDate,
      rentalFee,
      platformFee: booking.platformCommission,
      status,
    },
    update: {
      borrowerId: booking.borrowerId,
      lenderId: booking.lenderId,
      itemId: booking.itemId,
      startDate: booking.startDate,
      endDate: booking.endDate,
      rentalFee,
      platformFee: booking.platformCommission,
      status,
    },
  })
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

    return { bookings: bookings.map(mapBookingRecord), nextCursor }
  }),

  create: protectedProcedure.input(createBookingSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.$transaction(async (tx) => {
      const bookingPrisma = getBookingPrisma({ prisma: tx as Context["prisma"] })

      await tx.borrower.upsert({
        where: { userId: ctx.user.id },
        create: { userId: ctx.user.id, borrowStatus: "ACTIVE", borrowerRating: 0 },
        update: {},
      })

      const item = await tx.item.findUnique({
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

      await ensureBookingWindowAvailable(bookingPrisma, {
        itemId: input.itemId,
        startDate: input.startDate,
        endDate: input.endDate,
      })

      const platformCommission = item.freeToBorrow ? 0 : input.platformCommission
      const totalFee = calculateBookingTotal(item, input.startDate, input.endDate, platformCommission)

      const booking = await tx.booking.create({
        data: {
          borrowerId: ctx.user.id,
          lenderId: item.lenderId,
          itemId: item.id,
          startDate: input.startDate,
          endDate: input.endDate,
          totalFee,
          platformCommission,
          paymentMethod: input.paymentMethod ?? DEFAULT_PAYMENT_METHOD,
          status: bookingStatusSchema.enum.PENDING,
          paymentStatus: item.freeToBorrow
            ? bookingPaymentStatusSchema.enum.NOT_REQUIRED
            : bookingPaymentStatusSchema.enum.PENDING,
          cancellationReason: input.cancellationReason ?? null,
        },
        include: bookingInclude,
      })

      await syncBookingTransaction(tx as unknown as BookingMutationPrismaClient, booking)
      await tx.item.update({
        where: { id: item.id },
        data: {
          bookingCount: {
            increment: 1,
          },
        },
      })

      return mapBookingRecord(booking)
    })
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
      select: {
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
      },
    })) as BookingEditableRecord | null

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." })
    }

    assertParticipantAccess(existing, ctx.user.id)

    const startDate = input.startDate ?? existing.startDate
    const endDate = input.endDate ?? existing.endDate

    if (endDate <= startDate) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "endDate must be later than startDate.",
      })
    }

    if (input.startDate || input.endDate) {
      await ensureBookingWindowAvailable(bookingPrisma, {
        itemId: existing.itemId,
        startDate,
        endDate,
        excludeBookingId: existing.id,
      })
    }

    const platformCommission = existing.item.freeToBorrow
      ? 0
      : (input.platformCommission ?? existing.platformCommission)
    const totalFee = calculateBookingTotal(existing.item, startDate, endDate, platformCommission)
    const timestamps = buildBookingTimestamps(existing, input.status, input.paymentStatus)

    return ctx.prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: input.id },
        data: {
          ...(input.startDate ? { startDate } : {}),
          ...(input.endDate ? { endDate } : {}),
          ...(input.startDate || input.endDate || input.platformCommission !== undefined
            ? { totalFee, platformCommission }
            : {}),
          ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.paymentStatus ? { paymentStatus: input.paymentStatus } : {}),
          ...(input.cancellationReason !== undefined
            ? { cancellationReason: input.cancellationReason }
            : {}),
          ...Object.fromEntries(
            Object.entries(timestamps).filter(([, value]) => value !== undefined),
          ),
        },
        include: bookingInclude,
      })

      await syncBookingTransaction(tx as unknown as BookingMutationPrismaClient, updatedBooking)

      return mapBookingRecord(updatedBooking)
    })
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
      const deletedBooking = await tx.booking.delete({
        where: { id: input.id },
        include: bookingInclude,
      })

      await tx.rentalTransaction.deleteMany({
        where: { bookingId: input.id },
      })

      return mapBookingRecord(deletedBooking)
    })
  }),
})
