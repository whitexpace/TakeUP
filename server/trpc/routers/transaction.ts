import type { Prisma } from "@prisma/client"
import { router } from "../init"
import { protectedProcedure } from "../procedures"
import { listTransactionsSchema } from "../../../shared/schemas/transaction"

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
          createdAt: true,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
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
} as const

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

    const statusWhere: Prisma.RentalTransactionWhereInput = status ? { status } : {}

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
    const lastRecord = pageRecords.at(-1)
    const nextCursor =
      hasMore && lastRecord ? { id: lastRecord.id, createdAt: lastRecord.createdAt } : null

    const transactions = pageRecords.map((record) => {
      const legacyThumbnail =
        (record.item as { thumbnailImage?: string | null }).thumbnailImage ?? null
      const itemImages = Array.isArray((record.item as { images?: unknown[] }).images)
        ? (record.item.images as Array<{
            path: string
            isPrimary: boolean
            sortOrder: number
            createdAt: Date
          }>)
        : []

      const orderedImages = itemImages.slice().sort((a, b) => {
        if (a.sortOrder === b.sortOrder) {
          return a.createdAt.getTime() - b.createdAt.getTime()
        }
        return a.sortOrder - b.sortOrder
      })
      const thumbnailImage =
        orderedImages.find((entry) => entry.isPrimary)?.path ??
        orderedImages[0]?.path ??
        legacyThumbnail
      const { images, ...item } = record.item

      return {
        ...record,
        item: {
          ...item,
          thumbnailImage,
        },
      }
    })

    return { transactions, nextCursor }
  }),
})
