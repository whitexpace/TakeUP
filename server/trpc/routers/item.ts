import { TRPCError } from "@trpc/server"
import { router } from "../init"
import { protectedProcedure, publicProcedure } from "../procedures"
import {
  createItemSchema,
  deleteItemSchema,
  itemIdSchema,
  updateItemSchema,
} from "../../../shared/schemas/item"

export const itemRouter = router({
  list: publicProcedure.query(({ ctx }) => {
    return ctx.prisma.item.findMany({
      take: 50,
      orderBy: { id: "desc" },
    })
  }),

  create: protectedProcedure.input(createItemSchema).mutation(({ ctx, input }) => {
    return ctx.prisma.item.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        condition: input.condition,
        category: input.category,
        rentalFee: input.rentalFee,
        availabilityDates: input.availabilityDates,
        freeToBorrow: input.freeToBorrow,
        photos: input.photos,
        lenderId: ctx.user.id,
      },
    })
  }),

  byId: publicProcedure.input(itemIdSchema).query(({ ctx, input }) => {
    return ctx.prisma.item.findUnique({ where: { id: input.id } })
  }),

  update: protectedProcedure.input(updateItemSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.item.findUnique({
      where: { id: input.id },
      select: { lenderId: true },
    })

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." })
    }

    if (existing.lenderId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed to update this item." })
    }

    const { id, ...data } = input

    return ctx.prisma.item.update({
      where: { id },
      data,
    })
  }),

  delete: protectedProcedure.input(deleteItemSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.item.findUnique({
      where: { id: input.id },
      select: { lenderId: true },
    })

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." })
    }

    if (existing.lenderId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed to delete this item." })
    }

    return ctx.prisma.item.delete({ where: { id: input.id } })
  }),
})
