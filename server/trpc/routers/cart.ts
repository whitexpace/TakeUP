import { TRPCError } from "@trpc/server"
import { Prisma } from "@prisma/client"
import type { Context } from "../context"
import { router } from "../init"
import { protectedProcedure } from "../procedures"
import { addToCartSchema, cartEntryIdSchema } from "../../../shared/schemas/cart"

const cartEntryInclude = {
  item: {
    select: {
      id: true,
      name: true,
      rentalFee: true,
      rateOption: true,
      freeToBorrow: true,
      thumbnailImage: true,
      photos: true,
      lenderId: true,
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
    },
  },
} as const

type CartEntryWithItem = {
  id: string
  itemId: string
  startAt: Date
  endAt: Date
  createdAt: Date
  item: {
    id: string
    name: string
    rentalFee: number
    rateOption: "PER_HOUR" | "PER_DAY"
    freeToBorrow: boolean
    thumbnailImage: string | null
    photos: string[]
    lenderId: string
    lender: {
      user: {
        username: string | null
        firstName: string | null
        middleName: string | null
        lastName: string | null
        email: string | null
      }
    }
  }
}

type CartEntryRow = {
  id: string
  itemId: string
  startAt: Date
  endAt: Date
  createdAt: Date
  itemName: string
  rentalFee: number
  rateOption: "PER_HOUR" | "PER_DAY"
  freeToBorrow: boolean
  thumbnailImage: string | null
  photos: string[] | null
  lenderId: string
  lenderUsername: string | null
  lenderFirstName: string | null
  lenderMiddleName: string | null
  lenderLastName: string | null
  lenderEmail: string | null
}

type CartEntryDelegate = {
  findMany(args: Record<string, unknown>): Promise<CartEntryWithItem[]>
  findUnique(
    args: Record<string, unknown>,
  ): Promise<CartEntryWithItem | { borrowerId: string } | null>
  create(args: Record<string, unknown>): Promise<CartEntryWithItem>
  delete(args: Record<string, unknown>): Promise<unknown>
}

const getCartDelegate = (prisma: Context["prisma"]) =>
  (prisma as Context["prisma"] & { cartEntry?: CartEntryDelegate }).cartEntry

const getOwnerName = (entry: CartEntryWithItem) => {
  const lenderUser = entry.item.lender.user
  return (
    lenderUser.username ||
    [lenderUser.firstName, lenderUser.middleName, lenderUser.lastName].filter(Boolean).join(" ") ||
    lenderUser.email ||
    entry.item.lenderId
  )
}

const getOwnerNameFromRow = (row: CartEntryRow) =>
  row.lenderUsername ||
  [row.lenderFirstName, row.lenderMiddleName, row.lenderLastName].filter(Boolean).join(" ") ||
  row.lenderEmail ||
  row.lenderId

const mapCartEntry = (entry: CartEntryWithItem) => ({
  id: entry.id,
  itemId: entry.itemId,
  name: entry.item.name,
  price: entry.item.rentalFee,
  priceUnit: entry.item.rateOption === "PER_HOUR" ? "hour" : "day",
  image: entry.item.thumbnailImage || entry.item.photos[0] || "",
  startAt: entry.startAt,
  endAt: entry.endAt,
  lenderId: entry.item.lenderId,
  lenderName: getOwnerName(entry),
  listingType: entry.item.freeToBorrow ? ("Borrow" as const) : ("Rent" as const),
  createdAt: entry.createdAt,
})

const mapCartRow = (row: CartEntryRow) => ({
  id: row.id,
  itemId: row.itemId,
  name: row.itemName,
  price: Number(row.rentalFee),
  priceUnit: row.rateOption === "PER_HOUR" ? "hour" : "day",
  image: row.thumbnailImage || row.photos?.[0] || "",
  startAt: row.startAt,
  endAt: row.endAt,
  lenderId: row.lenderId,
  lenderName: getOwnerNameFromRow(row),
  listingType: row.freeToBorrow ? ("Borrow" as const) : ("Rent" as const),
  createdAt: row.createdAt,
})

const queryCartRows = async (prisma: Context["prisma"], clause: Prisma.Sql) =>
  prisma.$queryRaw<CartEntryRow[]>(Prisma.sql`
    SELECT
      c."id",
      c."itemId",
      c."startAt",
      c."endAt",
      c."createdAt",
      i."name" AS "itemName",
      i."rentalFee",
      i."rateOption",
      i."freeToBorrow",
      i."thumbnailImage",
      i."photos",
      i."lenderId",
      u."username" AS "lenderUsername",
      u."firstName" AS "lenderFirstName",
      u."middleName" AS "lenderMiddleName",
      u."lastName" AS "lenderLastName",
      u."email" AS "lenderEmail"
    FROM "CartEntry" c
    INNER JOIN "Item" i ON i."id" = c."itemId"
    LEFT JOIN "User" u ON u."id" = i."lenderId"
    ${clause}
  `)

const requireBorrowerAccount = async (
  ctx: Pick<Context, "prisma" | "user"> & { user: { id: string } },
) => {
  const userRecord = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.id },
    select: { accountType: true },
  })

  if (!userRecord || userRecord.accountType !== "BORROWER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only borrower accounts can add items to the bag.",
    })
  }
}

const assertCartEligibility = async (
  ctx: Pick<Context, "prisma" | "user"> & { user: { id: string } },
  input: { itemId: string; startAt: Date; endAt: Date },
) => {
  const item = await ctx.prisma.item.findUnique({
    where: { id: input.itemId },
    select: {
      id: true,
      status: true,
      lenderId: true,
      availability: {
        select: {
          startDate: true,
          endDate: true,
          status: true,
        },
      },
    },
  })

  if (!item) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Item not found.",
    })
  }

  if (item.lenderId === ctx.user.id) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You cannot add your own listing to the bag.",
    })
  }

  if (item.status !== "AVAILABLE") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This item is not available for bagging.",
    })
  }

  const isWithinAvailability = item.availability.some(
    (window) =>
      window.status === "AVAILABLE" &&
      input.startAt >= window.startDate &&
      input.endAt <= window.endDate,
  )

  if (!isWithinAvailability) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Selected dates are outside the item's available time windows.",
    })
  }
}

export const cartRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await requireBorrowerAccount(ctx)

    const cartEntry = getCartDelegate(ctx.prisma)

    if (cartEntry) {
      const entries = await cartEntry.findMany({
        where: { borrowerId: ctx.user.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: cartEntryInclude,
      })

      return {
        items: entries.map(mapCartEntry),
      }
    }

    const rows = await queryCartRows(
      ctx.prisma,
      Prisma.sql`WHERE c."borrowerId" = ${ctx.user.id} ORDER BY c."createdAt" DESC, c."id" DESC`,
    )

    return {
      items: rows.map(mapCartRow),
    }
  }),

  add: protectedProcedure.input(addToCartSchema).mutation(async ({ ctx, input }) => {
    await requireBorrowerAccount(ctx)
    await assertCartEligibility(ctx, input)

    const cartEntry = getCartDelegate(ctx.prisma)

    if (cartEntry) {
      const existing = await cartEntry.findUnique({
        where: {
          borrowerId_itemId_startAt_endAt: {
            borrowerId: ctx.user.id,
            itemId: input.itemId,
            startAt: input.startAt,
            endAt: input.endAt,
          },
        },
        include: cartEntryInclude,
      })

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This item with the selected dates is already in your bag.",
        })
      }

      const entry = await cartEntry.create({
        data: {
          borrowerId: ctx.user.id,
          itemId: input.itemId,
          startAt: input.startAt,
          endAt: input.endAt,
        },
        include: cartEntryInclude,
      })

      return mapCartEntry(entry)
    }

    const existing = await ctx.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "CartEntry"
      WHERE "borrowerId" = ${ctx.user.id}
        AND "itemId" = ${input.itemId}
        AND "startAt" = ${input.startAt}
        AND "endAt" = ${input.endAt}
      LIMIT 1
    `)

    if (existing.length > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This item with the selected dates is already in your bag.",
      })
    }

    const created = await ctx.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO "CartEntry" ("borrowerId", "itemId", "startAt", "endAt")
      VALUES (${ctx.user.id}, ${input.itemId}, ${input.startAt}, ${input.endAt})
      RETURNING "id"
    `)

    const createdId = created[0]?.id

    if (!createdId) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to create bag entry.",
      })
    }

    const [entry] = await queryCartRows(ctx.prisma, Prisma.sql`WHERE c."id" = ${createdId} LIMIT 1`)

    if (!entry) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to load the created bag entry.",
      })
    }

    return mapCartRow(entry)
  }),

  remove: protectedProcedure.input(cartEntryIdSchema).mutation(async ({ ctx, input }) => {
    await requireBorrowerAccount(ctx)

    const cartEntry = getCartDelegate(ctx.prisma)
    const existing = cartEntry
      ? ((await cartEntry.findUnique({
          where: { id: input.id },
          select: { borrowerId: true },
        })) as { borrowerId: string } | null)
      : (
          await ctx.prisma.$queryRaw<Array<{ borrowerId: string }>>(Prisma.sql`
            SELECT "borrowerId"
            FROM "CartEntry"
            WHERE "id" = ${input.id}
            LIMIT 1
          `)
        )[0]

    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Bag item not found.",
      })
    }

    if (existing.borrowerId !== ctx.user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only remove items from your own bag.",
      })
    }

    if (cartEntry) {
      await cartEntry.delete({
        where: { id: input.id },
      })
    } else {
      await ctx.prisma.$executeRaw(Prisma.sql`
        DELETE FROM "CartEntry"
        WHERE "id" = ${input.id}
      `)
    }

    return { ok: true }
  }),
})
