import type { Prisma } from "@prisma/client"
import { router } from "../init"
import { protectedProcedure } from "../procedures"
import { listTransactionsSchema } from "../../../shared/schemas/transaction"

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
} as const

export const transactionRouter = router({
  list: protectedProcedure.input(listTransactionsSchema).query(async ({ ctx, input }) => {
    const { role, status, startDateFrom, startDateTo, limit, cursor } = input
    const userId = ctx.user.id

    const roleWhere: Prisma.TransactionWhereInput =
      role === "LENDER"
        ? { lenderId: userId }
        : role === "BORROWER"
          ? { borrowerId: userId }
          : { OR: [{ lenderId: userId }, { borrowerId: userId }] }

    const statusWhere: Prisma.TransactionWhereInput = status ? { status } : {}

    const dateWhere: Prisma.TransactionWhereInput =
      startDateFrom || startDateTo
        ? {
            startDate: {
              ...(startDateFrom ? { gte: startDateFrom } : {}),
              ...(startDateTo ? { lte: startDateTo } : {}),
            },
          }
        : {}

    const cursorWhere: Prisma.TransactionWhereInput = cursor
      ? {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        }
      : {}

    const baseWhere: Prisma.TransactionWhereInput = {
      AND: [roleWhere, statusWhere, dateWhere, cursorWhere],
    }

    const records = await ctx.prisma.transaction.findMany({
      where: baseWhere,
      include: transactionInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    })

    const hasMore = records.length > limit
    const pageRecords = hasMore ? records.slice(0, limit) : records
    const nextCursor =
      hasMore
        ? {
            id: pageRecords[pageRecords.length - 1].id,
            createdAt: pageRecords[pageRecords.length - 1].createdAt,
          }
        : null

    return { transactions: pageRecords, nextCursor }
  }),
})
