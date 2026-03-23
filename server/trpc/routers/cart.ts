import { TRPCError } from "@trpc/server"
import type { Prisma } from "@prisma/client"
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
} as const satisfies Prisma.CartEntryInclude

type CartEntryWithItem = Prisma.CartEntryGetPayload<{
  include: typeof cartEntryInclude
}>

const getOwnerName = (entry: CartEntryWithItem) => {
  const lenderUser = entry.item.lender.user
  return (
    lenderUser.username ||
    [lenderUser.firstName, lenderUser.middleName, lenderUser.lastName].filter(Boolean).join(" ") ||
    lenderUser.email ||
    entry.item.lenderId
  )
}

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

    const entries = await ctx.prisma.cartEntry.findMany({
      where: { borrowerId: ctx.user.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: cartEntryInclude,
    })

    return {
      items: entries.map(mapCartEntry),
    }
  }),

  add: protectedProcedure.input(addToCartSchema).mutation(async ({ ctx, input }) => {
    await requireBorrowerAccount(ctx)
    await assertCartEligibility(ctx, input)

    const existing = await ctx.prisma.cartEntry.findUnique({
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

    const entry = await ctx.prisma.cartEntry.create({
      data: {
        borrowerId: ctx.user.id,
        itemId: input.itemId,
        startAt: input.startAt,
        endAt: input.endAt,
      },
      include: cartEntryInclude,
    })

    return mapCartEntry(entry)
  }),

  remove: protectedProcedure.input(cartEntryIdSchema).mutation(async ({ ctx, input }) => {
    await requireBorrowerAccount(ctx)

    const existing = await ctx.prisma.cartEntry.findUnique({
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

    await ctx.prisma.cartEntry.delete({
      where: { id: input.id },
    })

    return { ok: true }
  }),
})
