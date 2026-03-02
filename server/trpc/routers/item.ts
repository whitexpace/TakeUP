import { TRPCError } from "@trpc/server"
import { router } from "../init"
import { protectedProcedure, publicProcedure } from "../procedures"
import {
  createItemSchema,
  deleteItemSchema,
  itemIdSchema,
  listItemsSchema,
  itemStatusSchema,
  updateItemSchema,
} from "../../../shared/schemas/item"

const itemWithTaxonomy = {
  availability: {
    select: {
      startDate: true,
      endDate: true,
      status: true,
    },
    orderBy: { startDate: "asc" },
  },
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
}

const mapItemTaxonomy = <
  T extends {
    availability: Array<{ startDate: Date; endDate: Date; status: string }>
    categories: Array<{ category: string }>
    tags: Array<{ tag: { name: string } }>
  },
>(
  item: T,
) => {
  const { availability, categories, tags, ...rest } = item
  return {
    ...rest,
    availability: availability.map((entry) => ({
      startDate: entry.startDate,
      endDate: entry.endDate,
      status: entry.status,
    })),
    categories: categories.map((entry) => entry.category),
    tags: tags.map((entry) => entry.tag.name),
  }
}

type ItemWithTaxonomy = {
  availability: Array<{ startDate: Date; endDate: Date; status: string }>
  categories: Array<{ category: string }>
  tags: Array<{ tag: { name: string } }>
} & Record<string, unknown>

export const itemRouter = router({
  list: publicProcedure.input(listItemsSchema).query(({ ctx, input }) => {
    const search = input?.search?.trim()
    const status = input?.status
    const statuses = input?.statuses
    const categories = input?.categories
    const tags = input?.tags

    return ctx.prisma.item
      .findMany({
        take: 50,
        orderBy: { id: "desc" },
        include: itemWithTaxonomy,
        where: {
          ...(status || statuses?.length
            ? {
                status: status ?? { in: statuses },
              }
            : {
                status: { not: "DELETED" },
              }),
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
      .then((items: ItemWithTaxonomy[]) => items.map(mapItemTaxonomy))
  }),

  create: protectedProcedure.input(createItemSchema).mutation(({ ctx, input }) => {
    return ctx.prisma.item
      .create({
        data: {
          name: input.name,
          description: input.description ?? null,
          condition: input.condition,
          status: input.status,
          rateOption: input.rateOption,
          rentalFee: input.rentalFee,
          replacementCost: input.replacementCost ?? null,
          availability: {
            create: input.availability.map((range) => ({
              startDate: range.startDate,
              endDate: range.endDate,
              status: range.status,
            })),
          },
          freeToBorrow: input.freeToBorrow,
          whatItemOffers: input.whatItemOffers ?? null,
          whatIsIncluded: input.whatIsIncluded ?? null,
          knownIssues: input.knownIssues ?? null,
          usageLimitations: input.usageLimitations ?? null,
          thumbnailImage: input.thumbnailImage ?? null,
          isTrending: input.isTrending ?? false,
          viewCount: input.viewCount ?? 0,
          bookingCount: input.bookingCount ?? 0,
          likeCount: input.likeCount ?? 0,
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
      .then((item: ItemWithTaxonomy | null) => (item ? mapItemTaxonomy(item) : null))
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

    const { id, availability, categories, tags, ...data } = input

    return ctx.prisma.item
      .update({
        where: { id },
        data: {
          ...data,
          ...(availability
            ? {
                availability: {
                  deleteMany: {},
                  create: availability.map((range) => ({
                    startDate: range.startDate,
                    endDate: range.endDate,
                    status: range.status,
                  })),
                },
              }
            : {}),
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

    return ctx.prisma.item
      .update({
        where: { id: input.id },
        data: { status: itemStatusSchema.enum.DELETED },
        include: itemWithTaxonomy,
      })
      .then(mapItemTaxonomy)
  }),
})
