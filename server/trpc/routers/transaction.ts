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
  borrower: {
    select: {
      user: {
        select: {
          username: true,
          firstName: true,
          middleName: true,
          lastName: true,
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
        },
      },
    },
  },
} satisfies Prisma.RentalTransactionInclude

const getTransactionThumbnailImage = (item: {
  images?: Array<{ path: string; isPrimary?: boolean }>
}): string | null =>
  item.images?.find((image) => image.isPrimary)?.path ?? item.images?.[0]?.path ?? null

const statusGroups: Record<UiTransactionStatus, PrismaTransactionStatus[]> = {
  PENDING: [PrismaTransactionStatus.PENDING],
  ACTIVE: [PrismaTransactionStatus.ACTIVE],
  COMPLETED: [PrismaTransactionStatus.COMPLETED],
  CANCELLED: [PrismaTransactionStatus.CANCELLED],
}

const toUiTransactionStatus = (status: PrismaTransactionStatus): UiTransactionStatus => {
  switch (status) {
    case PrismaTransactionStatus.PENDING:
      return "PENDING"
    case PrismaTransactionStatus.ACTIVE:
      return "ACTIVE"
    case PrismaTransactionStatus.COMPLETED:
      return "COMPLETED"
    case PrismaTransactionStatus.CANCELLED:
      return "CANCELLED"
    default:
      return "PENDING"
  }
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
  borrower: {
    user: {
      username: string
      firstName: string
      middleName: string | null
      lastName: string
    }
  } | null
  lender: {
    user: {
      username: string
      firstName: string
      middleName: string | null
      lastName: string
    }
  } | null
}

type TransactionListItem = {
  id: string
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
    !record.borrower ||
    !record.lender ||
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
    borrower: record.borrower,
    lender: record.lender,
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
    const lastRecord = pageRecords.at(-1)
    const nextCursor =
      hasMore && lastRecord ? { id: lastRecord.id, createdAt: lastRecord.createdAt } : null

    return {
      transactions: normalizedRecords,
      nextCursor,
    }
  }),
})
