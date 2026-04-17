import { TRPCError } from "@trpc/server"
import {
  DisputeStatus as PrismaDisputeStatus,
  type ItemCategory,
  type ItemCondition,
  type ItemStatus,
  type Prisma,
  type TransactionStatus,
} from "@prisma/client"
import { router } from "../init"
import { protectedProcedure, publicProcedure } from "../procedures"
import {
  createItemSchema,
  deleteItemSchema,
  itemIdSchema,
  listItemsSchema,
  myListingsSchema,
  paginatedItemsSchema,
  itemStatusSchema,
  updateItemSchema,
  toggleLikeSchema,
  KNOWN_SIDEBAR_DB_CATEGORIES,
  UI_OTHERS_SENTINEL,
} from "../../../shared/schemas/item"
import { removeItemImagesFromStorage } from "../../utils/item-image-storage"

import { getDefaultItemOrderBy } from "./item-sorting"

const SEARCH_SCAN_LIMIT = 2000
const SEARCH_COUNT_BATCH_SIZE = 250
const itemImageOrderBy: Prisma.ItemImageOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { createdAt: "asc" },
]

const itemWithTaxonomy = {
  images: {
    select: {
      path: true,
      isPrimary: true,
      sortOrder: true,
    },
    orderBy: itemImageOrderBy,
  },
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
} satisfies Prisma.ItemInclude

const ACTIVE_TRANSACTION_DISPUTE_STATUSES = [
  PrismaDisputeStatus.OPEN,
  PrismaDisputeStatus.UNDER_REVIEW,
  PrismaDisputeStatus.APPEALED,
] as const

const TERMINAL_TRANSACTION_STATUSES = [
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
  "FAILED",
] as const satisfies ReadonlyArray<TransactionStatus>

const myListingsWithDisputes = {
  ...itemWithTaxonomy,
  transactions: {
    select: {
      disputes: {
        where: {
          status: {
            in: [...ACTIVE_TRANSACTION_DISPUTE_STATUSES],
          },
        },
        select: {
          id: true,
        },
      },
    },
  },
} satisfies Prisma.ItemInclude

type ItemWithTaxonomy = Prisma.ItemGetPayload<{
  include: typeof itemWithTaxonomy
}>

type MyListingFilterStatus = "ACTIVE" | "IN_USE" | "INACTIVE" | "DISPUTED"

type ItemWithListingDisputes = Prisma.ItemGetPayload<{
  include: typeof myListingsWithDisputes
}>

type ItemWithUserLike = ItemWithTaxonomy & {
  likes?: Array<{ id: string }>
}

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

const mapItemTaxonomy = (
  item: ItemWithUserLike & {
    images?: Array<{ path: string; isPrimary?: boolean; sortOrder?: number }>
    thumbnailImage?: string | null
    photos?: string[]
  },
) => {
  const { availability, categories, tags, lender, likes, images, ...rest } = item
  const lenderUser = lender.user
  const lenderFullName =
    [lenderUser.firstName, lenderUser.middleName, lenderUser.lastName].filter(Boolean).join(" ") ||
    null
  const lenderUsername = lenderUser.username || null
  const ownerName = lenderUsername || lenderFullName || lenderUser.email || item.lenderId
  const orderedPhotos =
    images?.map((entry) => entry.path) ??
    item.photos ??
    (item.thumbnailImage ? [item.thumbnailImage] : [])
  const thumbnailImage =
    images?.find((entry) => entry.isPrimary)?.path ??
    item.thumbnailImage ??
    orderedPhotos[0] ??
    null

  return {
    ...rest,
    ownerName,
    lenderUsername,
    lenderFullName,
    isLiked: Array.isArray(likes) ? likes.length > 0 : false,
    images:
      images?.map((entry, index) => ({
        path: entry.path,
        isPrimary: Boolean(entry.isPrimary),
        sortOrder: entry.sortOrder ?? index,
      })) ?? [],
    thumbnailImage,
    photos: orderedPhotos,
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

const itemHasActiveDispute = (item: Pick<ItemWithListingDisputes, "transactions">) =>
  item.transactions.some((transaction) => transaction.disputes.length > 0)

const getMyListingDisplayStatus = (
  item: Pick<ItemWithListingDisputes, "status" | "transactions">,
): MyListingFilterStatus => {
  if (itemHasActiveDispute(item)) {
    return "DISPUTED"
  }

  switch (item.status) {
    case itemStatusSchema.enum.AVAILABLE:
      return "ACTIVE"
    case itemStatusSchema.enum.RENTED:
      return "IN_USE"
    case itemStatusSchema.enum.DEACTIVATED:
      return "INACTIVE"
    default:
      return "INACTIVE"
  }
}

const mapMyListing = (item: ItemWithListingDisputes) => ({
  ...mapItemTaxonomy(item),
  hasActiveDispute: itemHasActiveDispute(item),
  displayStatus: getMyListingDisplayStatus(item),
})

const buildOrderedImagePaths = (thumbnailImage?: string | null, photos?: string[]) => {
  if (thumbnailImage === undefined && photos === undefined) {
    return undefined
  }

  const seenPaths = new Set<string>()
  return [...(photos ?? []), ...(thumbnailImage ? [thumbnailImage] : [])].filter((path) => {
    if (!path || seenPaths.has(path)) return false
    seenPaths.add(path)
    return true
  })
}

const buildCreateImageWrites = (
  thumbnailImage?: string | null,
  photos?: string[],
): Prisma.ItemImageCreateNestedManyWithoutItemInput | undefined => {
  const orderedPaths = buildOrderedImagePaths(thumbnailImage, photos)
  if (!orderedPaths || orderedPaths.length === 0) {
    return undefined
  }

  const primaryPath =
    thumbnailImage && orderedPaths.includes(thumbnailImage) ? thumbnailImage : orderedPaths[0]!

  return {
    create: orderedPaths.map((path, index) => ({
      path,
      sortOrder: index,
      isPrimary: path === primaryPath,
    })),
  }
}

const buildUpdateImageWrites = (
  thumbnailImage?: string | null,
  photos?: string[],
): Prisma.ItemImageUpdateManyWithoutItemNestedInput | undefined => {
  const orderedPaths = buildOrderedImagePaths(thumbnailImage, photos)
  if (!orderedPaths) {
    return undefined
  }

  if (orderedPaths.length === 0) {
    return { deleteMany: {} }
  }

  const primaryPath =
    thumbnailImage && orderedPaths.includes(thumbnailImage) ? thumbnailImage : orderedPaths[0]!

  return {
    deleteMany: {},
    create: orderedPaths.map((path, index) => ({
      path,
      sortOrder: index,
      isPrimary: path === primaryPath,
    })),
  }
}

type ListWhereFilters = {
  search?: string
  likedOnly?: boolean
  ownedOnly?: boolean
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
  options: { includeSearch?: boolean; userId?: string | null } = {},
): Prisma.ItemWhereInput => {
  const search = input?.search?.trim()
  const likedOnly = input?.likedOnly
  const ownedOnly = input?.ownedOnly
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
  const userId = options.userId ?? null

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
    ...(ownedOnly
      ? {}
      : {
          lender: {
            user: {
              status: "ACTIVE",
            },
          },
        }),
    ...(likedOnly
      ? userId
        ? {
            likes: {
              some: {
                userId,
              },
            },
          }
        : { id: "__liked_requires_user__" }
      : {}),
    ...(ownedOnly
      ? userId
        ? {
            lenderId: userId,
          }
        : { id: "__owned_requires_user__" }
      : {}),
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

const buildItemInclude = (userId: string | null) =>
  ({
    ...itemWithTaxonomy,
    likes: {
      where: { userId: userId ?? "__anonymous_user__" },
      select: { id: true },
    },
  }) satisfies Prisma.ItemInclude

const blockingBookingStatusFilter = ["CONFIRMED", "IN_DISPUTE"] as const

export const itemRouter = router({
  list: publicProcedure.input(listItemsSchema).query(async ({ ctx, input }) => {
    const search = input?.search?.trim()

    const records = await ctx.prisma.item.findMany({
      take: search ? SEARCH_SCAN_LIMIT : 50,
      orderBy: getDefaultItemOrderBy(),
      include: buildItemInclude(ctx.user?.id ?? null),
      where: buildListWhere(input, {
        includeSearch: !search,
        userId: ctx.user?.id ?? null,
      }),
    })

    const matchedItems = search ? filterAndRankSearchResults(records, search).slice(0, 50) : records
    return matchedItems.map(mapItemTaxonomy)
  }),

  paginatedList: publicProcedure.input(paginatedItemsSchema).query(async ({ ctx, input }) => {
    const search = input.search?.trim()
    const baseWhere = buildListWhere(input, {
      includeSearch: !search,
      userId: ctx.user?.id ?? null,
    })
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
      include: buildItemInclude(ctx.user?.id ?? null),
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
      const where = buildListWhere(input, { userId: ctx.user?.id ?? null })
      const count = await ctx.prisma.item.count({ where })
      return { count }
    }

    const where = buildListWhere(input, {
      includeSearch: false,
      userId: ctx.user?.id ?? null,
    })
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
    const baseWhere: Prisma.ItemWhereInput = {
      status: { not: "DELETED" },
      lender: { user: { status: "ACTIVE" } },
    }

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
              WHEN i."rentalFee" < 100 THEN 'under100'
              WHEN i."rentalFee" <= 500 THEN '100to500'
              ELSE 'over500'
            END AS bucket,
            COUNT(*) AS count
          FROM "Item" i
          INNER JOIN "User" u ON u."id" = i."lenderId"
          WHERE i."status" != 'DELETED'
            AND i."freeToBorrow" = false
            AND u."status" = 'ACTIVE'::"UserStatus"
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

  create: protectedProcedure.input(createItemSchema).mutation(async ({ ctx, input }) => {
    const existingUser = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: { id: true },
    })

    if (!existingUser) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Your account is missing from the database. Sign out and sign in again before publishing an item.",
      })
    }

    // Ensure Lender profile exists for this user
    await ctx.prisma.lender.upsert({
      where: { userId: ctx.user.id },
      create: { userId: ctx.user.id, lenderRating: 0 },
      update: {},
    })

    const imageWrites = buildCreateImageWrites(input.thumbnailImage, input.photos)

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
          isTrending: input.isTrending ?? false,
          viewCount: input.viewCount ?? 0,
          bookingCount: input.bookingCount ?? 0,
          likeCount: input.likeCount ?? 0,
          lenderId: ctx.user.id,
          ...(imageWrites ? { images: imageWrites } : {}),
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

  byId: publicProcedure.input(itemIdSchema).query(async ({ ctx, input }) => {
    const item = (await ctx.prisma.item.findFirst({
      where: {
        id: input.id,
        OR: [
          { lender: { user: { status: "ACTIVE" } } },
          ...(ctx.user ? [{ lenderId: ctx.user.id }] : []),
        ],
      },
      include: {
        ...buildItemInclude(ctx.user?.id ?? null),
        bookings: {
          where: {
            status: { in: [...blockingBookingStatusFilter] },
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    })) as
      | (ItemWithUserLike & {
          bookings: Array<{ id: string; startDate: Date; endDate: Date }>
        })
      | null

    if (!item) return null

    // Increment view count (fire-and-forget, don't block the response)
    ctx.prisma.item
      .update({ where: { id: item.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {})

    return {
      ...mapItemTaxonomy(item),
      bookingBlocks: item.bookings.map((booking) => ({
        id: booking.id,
        startDate: booking.startDate,
        endDate: booking.endDate,
        status: "RENTED" as const,
      })),
    }
  }),

  update: protectedProcedure.input(updateItemSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.item.findUnique({
      where: { id: input.id },
      select: {
        lenderId: true,
        images: {
          select: {
            path: true,
          },
        },
      },
    })

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." })
    }

    if (existing.lenderId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed to update this item." })
    }

    const { id, availability, categories, tags, thumbnailImage, photos, ...data } = input
    const imageWrites = buildUpdateImageWrites(thumbnailImage, photos)
    const nextImageUrls = new Set(buildOrderedImagePaths(thumbnailImage, photos) ?? [])
    const removedImageUrls = existing.images
      .map((image) => image.path)
      .filter((path) => !nextImageUrls.has(path))

    const updatedItem = await ctx.prisma.item
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
          ...(imageWrites ? { images: imageWrites } : {}),
        },
        include: itemWithTaxonomy,
      })
      .then(mapItemTaxonomy)

    void removeItemImagesFromStorage(removedImageUrls, {
      bucket: useRuntimeConfig(ctx.event).public.itemImageBucket,
      supabaseUrl: useRuntimeConfig(ctx.event).public.supabase.url,
      serviceRoleKey: useRuntimeConfig(ctx.event).supabaseServiceRoleKey,
    })

    return updatedItem
  }),

  delete: protectedProcedure.input(deleteItemSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.item.findUnique({
      where: { id: input.id },
      select: {
        lenderId: true,
        transactions: {
          where: {
            status: {
              notIn: [...TERMINAL_TRANSACTION_STATUSES],
            },
          },
          select: { id: true },
          take: 1,
        },
      },
    })

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." })
    }

    if (existing.lenderId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed to delete this item." })
    }

    if (existing.transactions.length > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "This item cannot be deleted because it has active or upcoming transactions. Deactivate the listing instead to preserve system records.",
      })
    }

    return ctx.prisma.item
      .update({
        where: { id: input.id },
        data: { status: itemStatusSchema.enum.DELETED },
        include: itemWithTaxonomy,
      })
      .then(mapItemTaxonomy)
  }),

  myListings: protectedProcedure.input(myListingsSchema).query(async ({ ctx, input }) => {
    const { search, statuses, categories, limit, cursor } = input
    const userId = ctx.user.id

    const activeDisputeWhere: Prisma.RentalTransactionWhereInput = {
      disputes: {
        some: {
          status: {
            in: [...ACTIVE_TRANSACTION_DISPUTE_STATUSES],
          },
        },
      },
    }

    const selectedStatuses = statuses ?? []
    const includeDisputed = selectedStatuses.includes("DISPUTED")
    const requestedBaseStatuses = selectedStatuses.filter(
      (status): status is Exclude<MyListingFilterStatus, "DISPUTED"> => status !== "DISPUTED",
    )

    const baseStatusClauses: Prisma.ItemWhereInput[] = requestedBaseStatuses.map((status) => {
      switch (status) {
        case "ACTIVE":
          return {
            status: itemStatusSchema.enum.AVAILABLE,
            NOT: { transactions: { some: activeDisputeWhere } },
          }
        case "IN_USE":
          return {
            status: itemStatusSchema.enum.RENTED,
            NOT: { transactions: { some: activeDisputeWhere } },
          }
        case "INACTIVE":
          return {
            status: itemStatusSchema.enum.DEACTIVATED,
            NOT: { transactions: { some: activeDisputeWhere } },
          }
      }
    })

    const baseWhere: Prisma.ItemWhereInput = {
      lenderId: userId,
      status: { not: itemStatusSchema.enum.DELETED },
      ...(categories?.length
        ? {
            categories: {
              some: {
                category: {
                  in: categories,
                },
              },
            },
          }
        : {}),
      ...(selectedStatuses.length
        ? {
            OR: [
              ...baseStatusClauses,
              ...(includeDisputed
                ? [
                    {
                      transactions: {
                        some: activeDisputeWhere,
                      },
                    } satisfies Prisma.ItemWhereInput,
                  ]
                : []),
            ],
          }
        : {}),
    }

    const cursorWhere: Prisma.ItemWhereInput = cursor
      ? {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        }
      : {}

    const records = await ctx.prisma.item.findMany({
      where: { AND: [baseWhere, cursorWhere] },
      include: myListingsWithDisputes,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: search ? SEARCH_SCAN_LIMIT : limit + 1,
    })

    const filteredRecords = search
      ? filterAndRankSearchResults(records, search, { sortByScore: false })
      : records
    const hasMore = filteredRecords.length > limit
    const pageRecords = hasMore ? filteredRecords.slice(0, limit) : filteredRecords
    const lastRecord = pageRecords.at(-1)

    return {
      items: pageRecords.map(mapMyListing),
      nextCursor:
        hasMore && lastRecord ? { id: lastRecord.id, createdAt: lastRecord.createdAt } : null,
    }
  }),

  toggleLike: protectedProcedure.input(toggleLikeSchema).mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id
    const { itemId } = input

    // Check if item exists
    const item = await ctx.prisma.item.findFirst({
      where: {
        id: itemId,
        lender: { user: { status: "ACTIVE" } },
      },
      select: { id: true },
    })

    if (!item) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." })
    }

    // Check if like already exists
    const existingLike = await ctx.prisma.like.findUnique({
      where: {
        userId_itemId: {
          userId,
          itemId,
        },
      },
    })

    if (existingLike) {
      await ctx.prisma.like.delete({
        where: { userId_itemId: { userId, itemId } },
      })
      await ctx.prisma.item.update({
        where: { id: itemId },
        data: { likeCount: { decrement: 1 } },
      })
    } else {
      await ctx.prisma.like.create({
        data: { userId, itemId },
      })
      await ctx.prisma.item.update({
        where: { id: itemId },
        data: { likeCount: { increment: 1 } },
      })
    }

    // Return the current like status
    const currentLike = await ctx.prisma.like.findUnique({
      where: {
        userId_itemId: {
          userId,
          itemId,
        },
      },
    })

    return {
      isLiked: !!currentLike,
      itemId,
    }
  }),
})
