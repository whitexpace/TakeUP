import { TRPCError } from "@trpc/server"
import { router } from "../init"
import { protectedProcedure, publicProcedure } from "../procedures"
import {
  createItemSchema,
  deleteItemSchema,
  itemIdSchema,
  listItemsSchema,
  updateItemSchema,
} from "../../../shared/schemas/item"

export const itemRouter = router({
  list: publicProcedure.input(listItemsSchema).query(({ ctx, input }) => {
    const search = input?.search?.trim()

    return ctx.prisma.item.findMany({
      take: 50,
      orderBy: { id: "desc" },
      where: search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
    })
  }),

  create: protectedProcedure.input(createItemSchema).mutation(({ ctx, input }) => {
    return ctx.prisma.item.create({
      data: {
        title: input.name,
        description: input.description ?? null,
        ownerId: ctx.user.id,
      },
    })
  }),

  byId: publicProcedure.input(itemIdSchema).query(({ ctx, input }) => {
    return ctx.prisma.item.findUnique({
      where: { id: input.id },
    })
  }),

  update: protectedProcedure.input(updateItemSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.item.findUnique({
      where: { id: input.id },
      select: { ownerId: true },
    })

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." })
    }

    if (existing.ownerId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed to update this item." })
    }

    const data = {
      ...(input.name !== undefined ? { title: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    }

    if (Object.keys(data).length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No mutable Item fields were provided for this model version.",
      })
    }

    return ctx.prisma.item.update({
      where: { id: input.id },
      data,
    })
  }),

  delete: protectedProcedure.input(deleteItemSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.item.findUnique({
      where: { id: input.id },
      select: { ownerId: true },
    })

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." })
    }

    if (existing.ownerId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed to delete this item." })
    }

    return ctx.prisma.item.delete({
      where: { id: input.id },
    })
  }),
})
