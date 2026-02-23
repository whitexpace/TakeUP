import { router } from "../init"
import { protectedProcedure, publicProcedure } from "../procedures"
import { createItemSchema, itemIdSchema } from "../../../shared/schemas/item"

export const itemRouter = router({
  list: publicProcedure.query(({ ctx }) => {
    return ctx.prisma.item.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
    })
  }),

  create: protectedProcedure.input(createItemSchema).mutation(({ ctx, input }) => {
    return ctx.prisma.item.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        ownerId: ctx.user.id,
      },
    })
  }),

  byId: publicProcedure.input(itemIdSchema).query(({ ctx, input }) => {
    return ctx.prisma.item.findUnique({ where: { id: input.id } })
  }),
})
