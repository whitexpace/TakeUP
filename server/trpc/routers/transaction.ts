import { TransactionStatus as PrismaTransactionStatus, type Prisma } from "@prisma/client"
import { router } from "../init"
import { protectedProcedure } from "../procedures"
import {
  listTransactionsSchema,
  type TransactionStatus as UiTransactionStatus,
} from "../../../shared/schemas/transaction"

const itemImageOrderBy: Prisma.ItemImageOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { createdAt: "asc" },
]

const transactionInclude = {
  item: {
    select: {
      id: true,
      name: true,
      images: {
        select: {
          path: true,
          isPrimary: true,
          sortOrder: true,
        },
        orderBy: itemImageOrderBy,
      },
      rateOption: true,
      rentalFee: true,
      freeToBorrow: true,
    },
  },
} satisfies Prisma.RentalTransactionInclude

const getTransactionThumbnailImage = (item: {
  images?: Array<{ path: string; isPrimary?: boolean }>
}): string | null =>
  item.images?.find((image) => image.isPrimary)?.path ?? item.images?.[0]?.path ?? null

const prismaTransactionStatuses = PrismaTransactionStatus as Record<string, PrismaTransactionStatus>
const getOptionalTransactionStatus = (name: string) => prismaTransactionStatuses[name]
const getTransactionStatusGroup = (
  names: string[],
  fallback: PrismaTransactionStatus[],
): PrismaTransactionStatus[] => {
  const resolved = names
    .map((name) => getOptionalTransactionStatus(name))
    .filter((status): status is PrismaTransactionStatus => Boolean(status))

  return resolved.length > 0 ? resolved : fallback
}

const statusGroups: Record<UiTransactionStatus, PrismaTransactionStatus[]> = {
  PENDING: getTransactionStatusGroup(
    ["PENDING", "AWAITING_LENDER_APPROVAL"],
    [PrismaTransactionStatus.PENDING],
  ),
  ACTIVE: getTransactionStatusGroup(
    ["ACTIVE", "CONFIRMED", "PAID", "ONGOING", "RETURNED", "IN_DISPUTE", "APPEALED"],
    [PrismaTransactionStatus.PENDING],
  ),
  COMPLETED: [PrismaTransactionStatus.COMPLETED],
  CANCELLED: getTransactionStatusGroup(
    ["CANCELLED", "REFUNDED", "FAILED"],
    [PrismaTransactionStatus.CANCELLED],
  ),
}

const toUiTransactionStatus = (status: PrismaTransactionStatus): UiTransactionStatus => {
  if (statusGroups.PENDING.includes(status)) return "PENDING"
  if (statusGroups.ACTIVE.includes(status)) return "ACTIVE"
  if (statusGroups.COMPLETED.includes(status)) return "COMPLETED"
  if (statusGroups.CANCELLED.includes(status)) return "CANCELLED"
  return "PENDING"
}

type TransactionRecord = {
  id: string
  itemId: string | null
  borrowerId: string | null
  lenderId: string | null
  startDate: Date | null
  endDate: Date | null
  totalAmount?: number | Prisma.Decimal | null
  status: PrismaTransactionStatus
  createdAt: Date
  updatedAt: Date
  item: {
    id: string
    name: string
    rateOption: "PER_HOUR" | "PER_DAY"
    rentalFee: number
    freeToBorrow: boolean
    images: Array<{
      path: string
      isPrimary: boolean
      sortOrder: number
    }>
  } | null
}

type TransactionListItem = {
  id: string
  bookingId: string | null
  itemId: string
  borrowerId: string
  lenderId: string
  startDate: Date
  endDate: Date
  totalAmount: number
  status: UiTransactionStatus
  createdAt: Date
  updatedAt: Date
  item: {
    id: string
    name: string
    rateOption: "PER_HOUR" | "PER_DAY"
    rentalFee: number
    freeToBorrow: boolean
    images: Array<{
      path: string
      isPrimary: boolean
      sortOrder: number
    }>
    thumbnailImage: string | null
  }
  borrower: {
    user: {
      username: string
      firstName: string
      middleName: string | null
      lastName: string
    }
  }
  lender: {
    user: {
      username: string
      firstName: string
      middleName: string | null
      lastName: string
    }
  }
}

const normalizeTransaction = (record: TransactionRecord): TransactionListItem | null => {
  if (
    !record.item ||
    !record.itemId ||
    !record.borrowerId ||
    !record.lenderId ||
    !record.startDate ||
    !record.endDate
  ) {
    return null
  }

  const totalAmountValue =
    record.totalAmount ??
    Math.max(
      0,
      record.item.rentalFee *
        Math.ceil((record.endDate.getTime() - record.startDate.getTime()) / (24 * 60 * 60 * 1000)),
    )

  return {
    id: record.id,
    bookingId: record.bookingId,
    itemId: record.itemId,
    borrowerId: record.borrowerId,
    lenderId: record.lenderId,
    startDate: record.startDate,
    endDate: record.endDate,
    totalAmount: Number(totalAmountValue),
    status: toUiTransactionStatus(record.status),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    item: {
      ...record.item,
      thumbnailImage: getTransactionThumbnailImage(record.item),
    },
    borrower: {
      user: {
        username: "",
        firstName: "",
        middleName: null,
        lastName: "",
      },
    },
    lender: {
      user: {
        username: "",
        firstName: "",
        middleName: null,
        lastName: "",
      },
    },
  }
}

export const transactionRouter = router({
  list: protectedProcedure.input(listTransactionsSchema).query(async ({ ctx, input }) => {
    const { role, status, startDateFrom, startDateTo, limit, cursor } = input
    const userId = ctx.user.id

    const roleWhere: Prisma.RentalTransactionWhereInput =
      role === "LENDER"
        ? { lenderId: userId }
        : role === "BORROWER"
          ? { borrowerId: userId }
          : { OR: [{ lenderId: userId }, { borrowerId: userId }] }

    const statusWhere: Prisma.RentalTransactionWhereInput = status
      ? { status: { in: statusGroups[status] } }
      : {}

    const dateWhere: Prisma.RentalTransactionWhereInput =
      startDateFrom || startDateTo
        ? {
            startDate: {
              ...(startDateFrom ? { gte: startDateFrom } : {}),
              ...(startDateTo ? { lte: startDateTo } : {}),
            },
          }
        : {}

    const cursorWhere: Prisma.RentalTransactionWhereInput = cursor
      ? {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        }
      : {}

    const baseWhere: Prisma.RentalTransactionWhereInput = {
      AND: [roleWhere, statusWhere, dateWhere, cursorWhere],
    }

    const records = (await ctx.prisma.rentalTransaction.findMany({
      where: baseWhere,
      include: transactionInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    })) as unknown as TransactionRecord[]

    const hasMore = records.length > limit
    const pageRecords = hasMore ? records.slice(0, limit) : records
    const normalizedRecords = pageRecords
      .filter(Boolean)
      .map(normalizeTransaction)
      .filter((record): record is TransactionListItem => record !== null)

    const participantIds = [
      ...new Set(
        normalizedRecords.flatMap((record) => [record.borrowerId, record.lenderId]).filter(Boolean),
      ),
    ]

    const users = participantIds.length
      ? await ctx.prisma.user.findMany({
          where: { id: { in: participantIds } },
          select: {
            id: true,
            username: true,
            firstName: true,
            middleName: true,
            lastName: true,
          },
        })
      : []

    const userMap = new Map(users.map((user) => [user.id, user]))
    const transactions = normalizedRecords.map((record) => ({
      ...record,
      borrower: { user: userMap.get(record.borrowerId) ?? record.borrower.user },
      lender: { user: userMap.get(record.lenderId) ?? record.lender.user },
    }))
    const lastRecord = pageRecords.at(-1)
    const nextCursor =
      hasMore && lastRecord ? { id: lastRecord.id, createdAt: lastRecord.createdAt } : null

    return {
      transactions,
      nextCursor,
    }
  }),
})
