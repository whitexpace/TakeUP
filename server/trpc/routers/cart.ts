import { TRPCError } from "@trpc/server"
import { Prisma } from "@prisma/client"
import type { Context } from "../context"
import { router } from "../init"
import { protectedProcedure } from "../procedures"
import { addToCartSchema, cartEntryIdSchema } from "#shared/schemas/cart"

const cartEntryInclude = {
  item: {
    select: {
      id: true,
      name: true,
      rentalFee: true,
      rateOption: true,
      freeToBorrow: true,
      lenderId: true,
      images: {
        select: {
          path: true,
          isPrimary: true,
          sortOrder: true,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
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
    lenderId: string
    images: Array<{ path: string; isPrimary: boolean; sortOrder: number }>
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
  lenderId: string
  lenderUsername: string | null
  lenderFirstName: string | null
  lenderMiddleName: string | null
  lenderLastName: string | null
  lenderEmail: string | null
}

const getOwnerName = (entry: CartEntryWithItem) => {
  const lenderUser = entry.item.lender.user
  return (
    lenderUser.username ||
    [lenderUser.firstName, lenderUser.middleName, lenderUser.lastName].filter(Boolean).join(" ") ||
    lenderUser.email ||
    entry.item.lenderId
  )
}

const mapCartEntry = (entry: CartEntryWithItem) => {
  const primaryImage =
    entry.item.images.find((image) => image.isPrimary)?.path ?? entry.item.images[0]?.path ?? ""

  return {
    id: entry.id,
    itemId: entry.itemId,
    name: entry.item.name,
    price: entry.item.rentalFee,
    priceUnit: entry.item.rateOption === "PER_HOUR" ? "hour" : "day",
    image: primaryImage,
    startAt: entry.startAt,
    endAt: entry.endAt,
    lenderId: entry.item.lenderId,
    lenderName: getOwnerName(entry),
    listingType: entry.item.freeToBorrow ? ("Borrow" as const) : ("Rent" as const),
    createdAt: entry.createdAt,
  }
}

const getOwnerNameFromRow = (row: CartEntryRow) =>
  row.lenderUsername ||
  [row.lenderFirstName, row.lenderMiddleName, row.lenderLastName].filter(Boolean).join(" ") ||
  row.lenderEmail ||
  row.lenderId

const mapCartRow = (row: CartEntryRow & { image?: string }) => ({
  id: row.id,
  itemId: row.itemId,
  name: row.itemName,
  price: Number(row.rentalFee),
  priceUnit: row.rateOption === "PER_HOUR" ? "hour" : "day",
  image: row.image || "",
  startAt: row.startAt,
  endAt: row.endAt,
  lenderId: row.lenderId,
  lenderName: getOwnerNameFromRow(row),
  listingType: row.freeToBorrow ? ("Borrow" as const) : ("Rent" as const),
  createdAt: row.createdAt,
})

const queryCartRows = async (prisma: Context["prisma"], clause: Prisma.Sql) => {
  const rows = await prisma.$queryRaw<CartEntryRow[]>(Prisma.sql`
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

  if (rows.length === 0) return []

  // Fetch images for these items
  const itemIds = Array.from(new Set(rows.map((r) => r.itemId)))
  const images = await prisma.$queryRaw<
    Array<{ itemId: string; path: string; isPrimary: boolean }>
  >(Prisma.sql`
    SELECT "itemId", "path", "isPrimary"
    FROM "ItemImage"
    WHERE "itemId" IN (${Prisma.join(itemIds)})
    ORDER BY "isPrimary" DESC, "sortOrder" ASC
  `)

  const imageMap = images.reduce(
    (acc, img) => {
      if (!acc[img.itemId]) acc[img.itemId] = img.path
      return acc
    },
    {} as Record<string, string>,
  )

  return rows.map((row) => ({
    ...row,
    image: imageMap[row.itemId],
  }))
}

const normalizeCalendarDate = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate())

const isDateWithinAvailabilityRange = (date: Date, range: { startDate: Date; endDate: Date }) => {
  const normalizedDate = normalizeCalendarDate(date)
  const rangeStart = normalizeCalendarDate(range.startDate)
  const rangeEnd = normalizeCalendarDate(range.endDate)

  return (
    normalizedDate.getTime() >= rangeStart.getTime() &&
    normalizedDate.getTime() <= rangeEnd.getTime()
  )
}

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

  // Check against defined availability ranges
  const availability = item.availability
  if (availability.length > 0) {
    const hasAvailableRanges = availability.some((range) => range.status === "AVAILABLE")

    const startBoundary = normalizeCalendarDate(input.startAt)
    const endBoundary = normalizeCalendarDate(input.endAt)

    for (
      const cursor = new Date(startBoundary);
      cursor.getTime() <= endBoundary.getTime();
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const hasAvailableWindow = availability.some(
        (range) => range.status === "AVAILABLE" && isDateWithinAvailabilityRange(cursor, range),
      )

      const hasBlockedWindow = availability.some(
        (range) => range.status !== "AVAILABLE" && isDateWithinAvailabilityRange(cursor, range),
      )

      if (hasBlockedWindow) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The selected dates overlap with a blocked or already rented period.",
        })
      }

      if (hasAvailableRanges && !hasAvailableWindow) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selected dates are outside the item's available time windows.",
        })
      }
    }
  }

  // Also check against existing bookings (CONFIRMED or IN_DISPUTE)
  const overlappingBooking = await ctx.prisma.booking.findFirst({
    where: {
      itemId: input.itemId,
      status: { in: ["CONFIRMED", "IN_DISPUTE"] },
      startDate: { lt: input.endAt },
      endDate: { gt: input.startAt },
    },
    select: { id: true },
  })

  if (overlappingBooking) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This item is already booked for the selected dates.",
    })
  }
}

export const cartRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await requireBorrowerAccount(ctx)

    // Try standard Prisma first
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entries = await (ctx.prisma as any).cartEntry.findMany({
        where: { borrowerId: ctx.user.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: cartEntryInclude,
      })

      return {
        items: entries.map(mapCartEntry),
      }
    } catch {
      // Fallback to raw query if delegate is missing from client
      const rows = await queryCartRows(
        ctx.prisma,
        Prisma.sql`WHERE c."borrowerId" = ${ctx.user.id} ORDER BY c."createdAt" DESC, c."id" DESC`,
      )

      return {
        items: rows.map(mapCartRow),
      }
    }
  }),

  add: protectedProcedure.input(addToCartSchema).mutation(async ({ ctx, input }) => {
    await requireBorrowerAccount(ctx)
    await assertCartEligibility(ctx, input)

    // Try standard Prisma first
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cartEntry = (ctx.prisma as any).cartEntry
      if (!cartEntry) throw new Error("cartEntry delegate missing")

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

      let entry: CartEntryWithItem

      try {
        entry = await cartEntry.create({
          data: {
            borrowerId: ctx.user.id,
            itemId: input.itemId,
            startAt: input.startAt,
            endAt: input.endAt,
          },
          include: cartEntryInclude,
        })
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This item with the selected dates is already in your bag.",
          })
        }

        throw error
      }

      return mapCartEntry(entry)
    } catch (error: unknown) {
      if (error instanceof TRPCError) throw error

      // Fallback to raw query if delegate is missing or failed
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
      ON CONFLICT ("borrowerId", "itemId", "startAt", "endAt") DO NOTHING
      RETURNING "id"
    `)

      const createdId = created[0]?.id

      if (!createdId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This item with the selected dates is already in your bag.",
        })
      }

      const [entry] = await queryCartRows(
        ctx.prisma,
        Prisma.sql`WHERE c."id" = ${createdId} LIMIT 1`,
      )

      if (!entry) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to load the created bag entry.",
        })
      }

      return mapCartRow(entry)
    }
  }),

  remove: protectedProcedure.input(cartEntryIdSchema).mutation(async ({ ctx, input }) => {
    await requireBorrowerAccount(ctx)

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cartEntry = (ctx.prisma as any).cartEntry
      if (!cartEntry) throw new Error("cartEntry delegate missing")

      const existing = await cartEntry.findUnique({
        where: { id: input.id },
        select: { borrowerId: true },
      })

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

      await cartEntry.delete({
        where: { id: input.id },
      })
    } catch {
      const existing = (
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

      await ctx.prisma.$executeRaw(Prisma.sql`
        DELETE FROM "CartEntry"
        WHERE "id" = ${input.id}
      `)
    }

    return { ok: true }
  }),
})
