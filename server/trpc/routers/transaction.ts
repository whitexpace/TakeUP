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
      username: true,
      firstName: true,
      middleName: true,
      lastName: true,
    },
  },
  lender: {
    select: {
      username: true,
      firstName: true,
      middleName: true,
      lastName: true,
    },
  },
} satisfies Prisma.RentalTransactionInclude

const getTransactionTotalAmount = (transaction: {
  startDate: Date
  endDate: Date
  item: { freeToBorrow: boolean; rentalFee: number; rateOption: "PER_HOUR" | "PER_DAY" }
  totalAmount?: number
}) => {
  if (typeof transaction.totalAmount === "number") return transaction.totalAmount
  if (transaction.item.freeToBorrow) return 0

  const durationMs = Math.max(transaction.endDate.getTime() - transaction.startDate.getTime(), 0)
  const unitMs = transaction.item.rateOption === "PER_HOUR" ? 1000 * 60 * 60 : 1000 * 60 * 60 * 24
  const units = Math.max(Math.ceil(durationMs / unitMs), 1)

  return units * transaction.item.rentalFee
}

const getTransactionThumbnailImage = (item: {
  images?: Array<{ path: string; isPrimary?: boolean }>
}): string | null =>
  item.images?.find((image) => image.isPrimary)?.path ?? item.images?.[0]?.path ?? null

const mapTransactionRecord = <
  T extends { item: { images?: Array<{ path: string; isPrimary?: boolean }> } },
>(
  record: T & {
    startDate: Date
    endDate: Date
    item: T["item"] & {
      freeToBorrow: boolean
      rentalFee: number
      rateOption: "PER_HOUR" | "PER_DAY"
    }
    totalAmount?: number
  },
) => ({
  ...record,
  totalAmount: getTransactionTotalAmount(record),
  item: {
    ...record.item,
    thumbnailImage: getTransactionThumbnailImage(record.item),
  } as T["item"] & { thumbnailImage: string | null },
})

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

    const records = await ctx.prisma.rentalTransaction.findMany({
      where: baseWhere,
      include: transactionInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    })

    const hasMore = records.length > limit
    const pageRecords = hasMore ? records.slice(0, limit) : records
    const normalizedRecords = pageRecords
      .map(normalizeTransaction)
      .filter((record): record is NonNullable<typeof record> => record !== null)
    const lastRecord = pageRecords.at(-1)
    const nextCursor =
      hasMore && lastRecord ? { id: lastRecord.id, createdAt: lastRecord.createdAt } : null

    return {
      transactions: pageRecords.map(mapTransactionRecord),
      nextCursor,
    }
  }),
})
