import { TRPCError } from "@trpc/server"
import type { Prisma } from "@prisma/client"
import { router } from "../init"
import { protectedProcedure, publicProcedure } from "../procedures"
import {
  createItemSchema,
  deleteItemSchema,
  itemIdSchema,
  listItemsSchema,
  updateItemSchema,
} from "../../../shared/schemas/item"

const itemWithTaxonomy = {
  categories: {
    select: { category: true },
  },
  tags: {
    select: {
      tag: {
        select: { name: true },
      },
    },
  },
} satisfies Prisma.ItemInclude

const mapItemTaxonomy = <
  T extends {
    categories: Array<{ category: string }>
    tags: Array<{ tag: { name: string } }>
  },
>(
  item: T,
) => {
  const { categories, tags, ...rest } = item
  return {
    ...rest,
    categories: categories.map((entry) => entry.category),
    tags: tags.map((entry) => entry.tag.name),
  }
}

export const itemRouter = router({
  list: publicProcedure.input(listItemsSchema).query(({ ctx, input }) => {
    const search = input?.search?.trim()
    const categories = input?.categories
    const tags = input?.tags

    return ctx.prisma.item
      .findMany({
        take: 50,
        orderBy: { id: "desc" },
        include: itemWithTaxonomy,
        where: {
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { description: { contains: search, mode: "insensitive" } },
                  {
                    tags: {
                      some: {
                        tag: {
                          name: { contains: search, mode: "insensitive" },
                        },
                      },
                    },
                  },
                ],
              }
            : {}),
          ...(categories?.length
            ? {
                categories: {
                  some: {
                    category: { in: categories },
                  },
                },
              }
            : {}),
          ...(tags?.length
            ? {
                tags: {
                  some: {
                    tag: {
                      name: { in: tags },
                    },
                  },
                },
              }
            : {}),
        },
      })
      .then((items) => items.map(mapItemTaxonomy))
  }),

  create: protectedProcedure.input(createItemSchema).mutation(({ ctx, input }) => {
    return ctx.prisma.item
      .create({
        data: {
          name: input.name,
          description: input.description ?? null,
          condition: input.condition,
          rentalFee: input.rentalFee,
          availabilityDates: input.availabilityDates,
          freeToBorrow: input.freeToBorrow,
          photos: input.photos,
          lenderId: ctx.user.id,
          categories: {
            create: input.categories.map((category) => ({ category })),
          },
          tags: {
            create: input.tags.map((name) => ({
              tag: {
                connectOrCreate: {
                  where: { name },
                  create: { name },
                },
              },
            })),
          },
        },
        include: itemWithTaxonomy,
      })
      .then(mapItemTaxonomy)
  }),

  byId: publicProcedure.input(itemIdSchema).query(({ ctx, input }) => {
    return ctx.prisma.item
      .findUnique({
        where: { id: input.id },
        include: itemWithTaxonomy,
      })
      .then((item) => (item ? mapItemTaxonomy(item) : null))
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

    const { id, categories, tags, ...data } = input

    return ctx.prisma.item
      .update({
        where: { id },
        data: {
          ...data,
          ...(categories
            ? {
                categories: {
                  deleteMany: {},
                  create: categories.map((category) => ({ category })),
                },
              }
            : {}),
          ...(tags
            ? {
                tags: {
                  deleteMany: {},
                  create: tags.map((name) => ({
                    tag: {
                      connectOrCreate: {
                        where: { name },
                        create: { name },
                      },
                    },
                  })),
                },
              }
            : {}),
        },
        include: itemWithTaxonomy,
      })
      .then(mapItemTaxonomy)
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
