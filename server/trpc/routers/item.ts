import { TRPCError } from "@trpc/server"
import type { ItemCategory, ItemCondition, ItemStatus, Prisma } from "@prisma/client"
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
  KNOWN_SIDEBAR_DB_CATEGORIES,
  UI_OTHERS_SENTINEL,
} from "../../../shared/schemas/item"
import { getDefaultItemOrderBy } from "./item-sorting"

const SEARCH_SCAN_LIMIT = 2000
const SEARCH_COUNT_BATCH_SIZE = 250

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
} as const

type ItemWithTaxonomy = Prisma.ItemGetPayload<{
  include: typeof itemWithTaxonomy
}>

const itemSearchSelect = {
  id: true,
  createdAt: true,
  bookingCount: true,
  name: true,
  description: true,
  condition: true,
  status: true,
  rentalFee: true,
  freeToBorrow: true,
  lenderId: true,
  whatItemOffers: true,
  whatIsIncluded: true,
  knownIssues: true,
  usageLimitations: true,
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
} as const satisfies Prisma.ItemSelect

type SearchableItem = Prisma.ItemGetPayload<{
  select: typeof itemSearchSelect
}>

const normalizeSearchText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const tokenizeSearch = (value: string) => normalizeSearchText(value).split(/\s+/).filter(Boolean)

const getEditDistanceThreshold = (tokenLength: number) => {
  if (tokenLength <= 4) return 1
  if (tokenLength <= 8) return 2
  return 3
}

const levenshteinDistance = (source: string, target: string) => {
  if (source === target) return 0
  if (source.length === 0) return target.length
  if (target.length === 0) return source.length

  const sourceLength = source.length
  const targetLength = target.length
  const previousRow = Array.from({ length: targetLength + 1 }, (_, i) => i)
  const currentRow = new Array<number>(targetLength + 1).fill(0)

  for (let i = 1; i <= sourceLength; i++) {
    currentRow[0] = i
    for (let j = 1; j <= targetLength; j++) {
      const substitutionCost = source[i - 1] === target[j - 1] ? 0 : 1
      currentRow[j] = Math.min(
        currentRow[j - 1]! + 1,
        previousRow[j]! + 1,
        previousRow[j - 1]! + substitutionCost,
      )
    }

    for (let j = 0; j <= targetLength; j++) {
      previousRow[j] = currentRow[j]!
    }
  }

  return previousRow[targetLength]!
}

const buildSearchWords = (item: SearchableItem | ItemWithTaxonomy) => {
  const lenderUser = item.lender?.user
  const lenderName = [lenderUser?.firstName, lenderUser?.middleName, lenderUser?.lastName]
    .filter(Boolean)
    .join(" ")

  const rawSearchText = [
    item.name,
    item.description ?? "",
    item.condition,
    item.status,
    String(item.rentalFee),
    item.freeToBorrow ? "borrow free" : "rent paid",
    item.lenderId,
    lenderUser?.username ?? "",
    lenderUser?.email ?? "",
    lenderName,
    item.whatItemOffers ?? "",
    item.whatIsIncluded ?? "",
    item.knownIssues ?? "",
    item.usageLimitations ?? "",
    ...item.tags.map((entry) => entry.tag.name),
    ...item.categories.map((entry) => entry.category),
  ]
    .join(" ")
    .trim()

  const normalizedText = normalizeSearchText(rawSearchText)
  const words = normalizedText.split(/\s+/).filter(Boolean)

  return { normalizedText, words }
}

const scoreSearchMatch = (
  query: string,
  searchWords: ReturnType<typeof buildSearchWords>,
): number | null => {
  const queryTokens = tokenizeSearch(query)
  if (queryTokens.length === 0) return 0

  let totalScore = 0

  for (const token of queryTokens) {
    let tokenScore = 0

    for (const word of searchWords.words) {
      if (word === token) {
        tokenScore = Math.max(tokenScore, 6)
        continue
      }

      if (word.includes(token) || (token.length >= 4 && token.includes(word))) {
        tokenScore = Math.max(tokenScore, 4)
        continue
      }

      if (Math.abs(word.length - token.length) > 3) {
        continue
      }

      const distance = levenshteinDistance(word, token)
      const maxDistance = getEditDistanceThreshold(token.length)

      if (distance <= maxDistance) {
        if (distance === 1) {
          tokenScore = Math.max(tokenScore, 3)
        } else if (distance === 2) {
          tokenScore = Math.max(tokenScore, 2)
        } else {
          tokenScore = Math.max(tokenScore, 1)
        }
      }
    }

    if (tokenScore === 0) {
      return null
    }

    totalScore += tokenScore
  }

  if (searchWords.normalizedText.includes(normalizeSearchText(query))) {
    totalScore += 2
  }

  return totalScore
}

const filterAndRankSearchResults = <T extends SearchableItem | ItemWithTaxonomy>(
  items: T[],
  search: string,
  options: { sortByScore?: boolean } = {},
): T[] => {
  const ranked = items
    .map((item) => ({
      item,
      score: scoreSearchMatch(search, buildSearchWords(item)),
    }))
    .filter((entry): entry is { item: T; score: number } => entry.score !== null)

  if (options.sortByScore ?? true) {
    ranked.sort((a, b) => b.score - a.score)
  }

  return ranked.map((entry) => entry.item)
}

const mapItemTaxonomy = (item: ItemWithTaxonomy) => {
  const { availability, categories, tags, lender, ...rest } = item
  const lenderUser = lender.user
  const ownerName =
    lenderUser.username ||
    [lenderUser.firstName, lenderUser.middleName, lenderUser.lastName].filter(Boolean).join(" ") ||
    lenderUser.email ||
    item.lenderId

  return {
    ...rest,
    ownerName,
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
  // May contain real DB categories or the UI-only "OTHERS" sentinel
  categories?: Array<ItemCategory | typeof UI_OTHERS_SENTINEL>
  tags?: string[]
  conditions?: ItemCondition[]
  minPrice?: number
  maxPrice?: number
  freeToBorrow?: boolean
  availableFrom?: Date
  availableTo?: Date
  minRating?: number
}

const buildListWhere = (
  input?: ListWhereFilters,
  options: { includeSearch?: boolean } = {},
): Prisma.ItemWhereInput => {
  const search = input?.search?.trim()
  const status = input?.status
  const statuses = input?.statuses
  const rawCategories = input?.categories
  const tags = input?.tags
  const conditions = input?.conditions
  const minPrice = input?.minPrice
  const maxPrice = input?.maxPrice
  const freeToBorrow = input?.freeToBorrow
  const availableFrom = input?.availableFrom
  const availableTo = input?.availableTo
  const minRating = input?.minRating
  const includeSearch = options.includeSearch ?? true

  const statusFilter: Prisma.ItemWhereInput["status"] = status
    ? status
    : statuses?.length
      ? { in: statuses }
      : { not: "DELETED" }

  // Split out the OTHERS sentinel from real DB category values
  const wantsOthers = rawCategories?.includes(UI_OTHERS_SENTINEL) ?? false
  const realCategories = rawCategories?.filter((c): c is ItemCategory => c !== UI_OTHERS_SENTINEL)

  // Build category filter:
  //  • Only "Others" selected  → items where NONE of their categories is in the known sidebar list
  //  • Only known cats selected → items that have at least one of those categories
  //  • Both selected           → union of the two (match either condition)
  //  • Nothing selected        → no category filter
  let categoryFilter: Prisma.ItemWhereInput = {}
  if (rawCategories?.length) {
    const othersClause: Prisma.ItemWhereInput = {
      categories: { none: { category: { in: [...KNOWN_SIDEBAR_DB_CATEGORIES] } } },
    }
    const knownClause: Prisma.ItemWhereInput = realCategories?.length
      ? { categories: { some: { category: { in: realCategories } } } }
      : {}

    if (wantsOthers && realCategories?.length) {
      // Union: show items matching known cats OR items with no known-sidebar category
      categoryFilter = { OR: [knownClause, othersClause] }
    } else if (wantsOthers) {
      categoryFilter = othersClause
    } else if (realCategories?.length) {
      categoryFilter = knownClause
    }
  }

  return {
    status: statusFilter,
    ...categoryFilter,
    ...(search && includeSearch
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
    ...(conditions?.length ? { condition: { in: conditions } } : {}),
    ...(minPrice !== undefined || maxPrice !== undefined
      ? {
          freeToBorrow: false,
          rentalFee: {
            ...(minPrice !== undefined ? { gte: minPrice } : {}),
            ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
          },
        }
      : {}),
    ...(freeToBorrow !== undefined ? { freeToBorrow } : {}),
    ...(minRating !== undefined ? { rating: { gte: minRating } } : {}),
    ...(availableFrom || availableTo
      ? {
          availability: {
            some: {
              status: "AVAILABLE",
              ...(availableFrom ? { startDate: { lte: availableFrom } } : {}),
              ...(availableTo ? { endDate: { gte: availableTo } } : {}),
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
  list: publicProcedure.input(listItemsSchema).query(async ({ ctx, input }) => {
    const search = input?.search?.trim()

    const records = await ctx.prisma.item.findMany({
      take: search ? SEARCH_SCAN_LIMIT : 50,
      orderBy: getDefaultItemOrderBy(),
      include: itemWithTaxonomy,
      where: buildListWhere(input, { includeSearch: !search }),
    })

    const matchedItems = search ? filterAndRankSearchResults(records, search).slice(0, 50) : records
    return matchedItems.map(mapItemTaxonomy)
  }),

  paginatedList: publicProcedure.input(paginatedItemsSchema).query(async ({ ctx, input }) => {
    const search = input.search?.trim()
    const baseWhere = buildListWhere(input, { includeSearch: !search })
    const paginationWhere = input.cursor
      ? buildPaginationWhereFromCursor({
          bookingCount: input.cursor.bookingCount,
          createdAt: input.cursor.createdAt,
          id: input.cursor.id,
        })
      : null

    const records = await ctx.prisma.item.findMany({
      take: search ? SEARCH_SCAN_LIMIT : input.limit + 1,
      orderBy: getDefaultItemOrderBy(),
      include: itemWithTaxonomy,
      where: paginationWhere ? { AND: [baseWhere, paginationWhere] } : baseWhere,
    })

    const filteredRecords = search
      ? filterAndRankSearchResults(records, search, { sortByScore: false })
      : records
    const hasMore = filteredRecords.length > input.limit
    const pageRecords = hasMore ? filteredRecords.slice(0, input.limit) : filteredRecords
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

  countFiltered: publicProcedure.input(listItemsSchema).query(async ({ ctx, input }) => {
    const search = input?.search?.trim()

    if (!search) {
      const where = buildListWhere(input)
      const count = await ctx.prisma.item.count({ where })
      return { count }
    }

    const where = buildListWhere(input, { includeSearch: false })
    let totalCount = 0
    let cursor: { id: string; createdAt: Date; bookingCount: number } | null = null

    while (true) {
      const paginationWhere: Prisma.ItemWhereInput | null = cursor
        ? buildPaginationWhereFromCursor(cursor)
        : null
      const batch: SearchableItem[] = await ctx.prisma.item.findMany({
        take: SEARCH_COUNT_BATCH_SIZE,
        orderBy: getDefaultItemOrderBy(),
        select: itemSearchSelect,
        where: paginationWhere ? { AND: [where, paginationWhere] } : where,
      })

      if (batch.length === 0) {
        break
      }

      totalCount += filterAndRankSearchResults(batch, search, { sortByScore: false }).length

      const last: SearchableItem | undefined = batch.at(-1)
      if (!last || batch.length < SEARCH_COUNT_BATCH_SIZE) {
        break
      }

      cursor = {
        id: last.id,
        bookingCount: last.bookingCount,
        createdAt: last.createdAt,
      }
    }

    const count = totalCount
    return { count }
  }),

  filterMetadata: publicProcedure.query(async ({ ctx }) => {
    const baseWhere: Prisma.ItemWhereInput = { status: { not: "DELETED" } }

    const [categoryGroups, priceGroups, conditionGroups, freeToborrowCount, othersCount] =
      await Promise.all([
        // Count per category
        ctx.prisma.itemCategoryOnItem.groupBy({
          by: ["category"],
          where: { item: baseWhere },
          _count: { category: true },
        }),
        // Count per price bucket for paid items (raw)
        ctx.prisma.$queryRaw<Array<{ bucket: string; count: bigint }>>`
          SELECT
            CASE
              WHEN "rentalFee" < 100 THEN 'under100'
              WHEN "rentalFee" <= 500 THEN '100to500'
              ELSE 'over500'
            END AS bucket,
            COUNT(*) AS count
          FROM "Item"
          WHERE status != 'DELETED'
            AND "freeToBorrow" = false
          GROUP BY bucket
        `,
        // Count per condition
        ctx.prisma.item.groupBy({
          by: ["condition"],
          where: baseWhere,
          _count: { condition: true },
        }),
        // Count free-to-borrow
        ctx.prisma.item.count({ where: { ...baseWhere, freeToBorrow: true } }),
        // Count "Others": items where NO category belongs to the known sidebar list
        ctx.prisma.item.count({
          where: {
            ...baseWhere,
            categories: {
              none: { category: { in: [...KNOWN_SIDEBAR_DB_CATEGORIES] } },
            },
          },
        }),
      ])

    const categoryCountMap = Object.fromEntries(
      categoryGroups.map((g) => [g.category, g._count.category]),
    )

    const priceCountMap = Object.fromEntries(priceGroups.map((g) => [g.bucket, Number(g.count)]))

    const conditionCountMap = Object.fromEntries(
      conditionGroups.map((g) => [g.condition, g._count.condition]),
    )

    return {
      categories: { ...categoryCountMap, OTHERS: othersCount },
      prices: priceCountMap,
      conditions: conditionCountMap,
      freeToborrowCount,
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
