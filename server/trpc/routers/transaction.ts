import { TransactionStatus as PrismaTransactionStatus, type Prisma } from "@prisma/client"
import { router } from "../init"
import { protectedProcedure } from "../procedures"
import {
  listTransactionsSchema,
  type TransactionStatus as UiTransactionStatus,
} from "../../../shared/schemas/transaction"

const transactionInclude = {
  item: {
    select: {
      id: true,
      name: true,
      thumbnailImage: true,
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
} as const

const statusGroups: Record<UiTransactionStatus, PrismaTransactionStatus[]> = {
  PENDING: [PrismaTransactionStatus.PENDING, PrismaTransactionStatus.AWAITING_LENDER_APPROVAL],
  ACTIVE: [
    PrismaTransactionStatus.CONFIRMED,
    PrismaTransactionStatus.PAID,
    PrismaTransactionStatus.ONGOING,
    PrismaTransactionStatus.RETURNED,
    PrismaTransactionStatus.IN_DISPUTE,
    PrismaTransactionStatus.APPEALED,
  ],
  COMPLETED: [PrismaTransactionStatus.COMPLETED],
  CANCELLED: [
    PrismaTransactionStatus.CANCELLED,
    PrismaTransactionStatus.REFUNDED,
    PrismaTransactionStatus.FAILED,
  ],
}

const toUiTransactionStatus = (status: PrismaTransactionStatus): UiTransactionStatus => {
  switch (status) {
    case PrismaTransactionStatus.PENDING:
    case PrismaTransactionStatus.AWAITING_LENDER_APPROVAL:
      return "PENDING"
    case PrismaTransactionStatus.CONFIRMED:
    case PrismaTransactionStatus.PAID:
    case PrismaTransactionStatus.ONGOING:
    case PrismaTransactionStatus.RETURNED:
    case PrismaTransactionStatus.IN_DISPUTE:
    case PrismaTransactionStatus.APPEALED:
      return "ACTIVE"
    case PrismaTransactionStatus.COMPLETED:
      return "COMPLETED"
    case PrismaTransactionStatus.CANCELLED:
    case PrismaTransactionStatus.REFUNDED:
    case PrismaTransactionStatus.FAILED:
      return "CANCELLED"
  }
}

type TransactionRecord = Prisma.RentalTransactionGetPayload<{
  include: typeof transactionInclude
}>

const normalizeTransaction = (record: TransactionRecord) => {
  if (
    !record.item ||
    !record.borrower ||
    !record.lender ||
    !record.itemId ||
    !record.borrowerId ||
    !record.lenderId ||
    !record.startDate ||
    !record.endDate ||
    record.totalAmount === null
  ) {
    return null
  }

  return {
    id: record.id,
    itemId: record.itemId,
    borrowerId: record.borrowerId,
    lenderId: record.lenderId,
    startDate: record.startDate,
    endDate: record.endDate,
    totalAmount: Number(record.totalAmount),
    status: toUiTransactionStatus(record.status),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    item: record.item,
    borrower: { user: record.borrower },
    lender: { user: record.lender },
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

    return { transactions: normalizedRecords, nextCursor }
  }),
})
