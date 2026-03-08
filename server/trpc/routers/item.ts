import { TRPCError } from "@trpc/server"
import type { ItemCategory, ItemStatus, Prisma } from "@prisma/client"
import { router } from "../init"
import { protectedProcedure, publicProcedure } from "../procedures"
import {
  createItemSchema,
  deleteItemSchema,
  itemIdSchema,
  listItemsSchema,
  paginatedItemsSchema,
  itemStatusSchema,
  updateItemSchema,
} from "../../../shared/schemas/item"
import { getDefaultItemOrderBy } from "./item-sorting"

const itemWithTaxonomy = {
  availability: {
    select: {
      id: true,
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
} as const

type ItemWithTaxonomy = Prisma.ItemGetPayload<{
  include: typeof itemWithTaxonomy
}>

const mapItemTaxonomy = (item: ItemWithTaxonomy) => {
  const { availability, categories, tags, ...rest } = item
  return {
    ...rest,
    availability: availability.map((entry) => ({
      id: entry.id,
      startDate: entry.startDate,
      endDate: entry.endDate,
      status: entry.status,
    })),
    categories: categories.map((entry) => entry.category),
    tags: tags.map((entry) => entry.tag.name),
  }
}

type ListWhereFilters = {
  search?: string
  status?: ItemStatus
  statuses?: ItemStatus[]
  categories?: ItemCategory[]
  tags?: string[]
}

const buildListWhere = (input?: ListWhereFilters): Prisma.ItemWhereInput => {
  const search = input?.search?.trim()
  const status = input?.status
  const statuses = input?.statuses
  const categories = input?.categories
  const tags = input?.tags

  const statusFilter: Prisma.ItemWhereInput["status"] = status
    ? status
    : statuses?.length
      ? { in: statuses }
      : { not: "DELETED" }

  return {
    status: statusFilter,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
            {
              tags: {
                some: {
                  tag: {
                    name: { contains: search, mode: "insensitive" as const },
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
  }
}

const buildPaginationWhereFromCursor = (cursor: {
  bookingCount: number
  createdAt: Date
  id: string
}): Prisma.ItemWhereInput => ({
  OR: [
    { bookingCount: { lt: cursor.bookingCount } },
    {
      bookingCount: cursor.bookingCount,
      createdAt: { lt: cursor.createdAt },
    },
    {
      bookingCount: cursor.bookingCount,
      createdAt: cursor.createdAt,
      id: { lt: cursor.id },
    },
  ],
})

export const itemRouter = router({
  list: publicProcedure.input(listItemsSchema).query(({ ctx, input }) => {
    return ctx.prisma.item
      .findMany({
        take: 50,
        orderBy: getDefaultItemOrderBy(),
        include: itemWithTaxonomy,
        where: buildListWhere(input),
      })
      .then((items) => items.map(mapItemTaxonomy))
  }),

  paginatedList: publicProcedure.input(paginatedItemsSchema).query(async ({ ctx, input }) => {
    const baseWhere = buildListWhere(input)
    const paginationWhere = input.cursor
      ? buildPaginationWhereFromCursor({
          bookingCount: input.cursor.bookingCount,
          createdAt: input.cursor.createdAt,
          id: input.cursor.id,
        })
      : null

    const records = await ctx.prisma.item.findMany({
      take: input.limit + 1,
      orderBy: getDefaultItemOrderBy(),
      include: itemWithTaxonomy,
      where: paginationWhere ? { AND: [baseWhere, paginationWhere] } : baseWhere,
    })

    const hasMore = records.length > input.limit
    const pageRecords = hasMore ? records.slice(0, input.limit) : records
    const lastRecord = pageRecords.at(-1)

    return {
      items: pageRecords.map(mapItemTaxonomy),
      nextCursor:
        hasMore && lastRecord
          ? {
              id: lastRecord.id,
              bookingCount: lastRecord.bookingCount,
              createdAt: lastRecord.createdAt,
            }
          : null,
    }
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
