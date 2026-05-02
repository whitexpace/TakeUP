import { TRPCError } from "@trpc/server"
import type {
  ItemCategory,
  ItemCondition,
  ItemStatus,
  Prisma,
  TransactionStatus,
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
import {
  ITEM_VISIBILITY_BLOCKING_BOOKING_STATUSES,
  buildPublicVisibleItemWhere,
  isPublicVisibleItem,
} from "../../utils/item-visibility"
import {
  buildViewerInterestProfile,
  compareFeedItemsByRelevance,
  sortFeedItemsByRelevance,
  type ViewerInterestProfile,
} from "../../utils/item-feed-ranking"
import { expireActiveBoosts } from "../../utils/rewards"

import { getDefaultItemOrderBy } from "./item-sorting"
import { mapTransactionReview, transactionReviewSelect } from "../review-helpers"
import { ACTIVE_DISPUTE_STATUSES } from "../../utils/dispute-status"

const SEARCH_SCAN_LIMIT = 2000
const FEED_RANKING_SCAN_LIMIT = 2000
const SEARCH_COUNT_BATCH_SIZE = 250
const VISIBILITY_SCAN_BATCH_SIZE = 100
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
          status: true,
        },
      },
    },
  },
} satisfies Prisma.ItemInclude

const itemVisibilityBookings = {
  where: {
    status: { in: [...ITEM_VISIBILITY_BLOCKING_BOOKING_STATUSES] },
  },
  select: {
    id: true,
    startDate: true,
    endDate: true,
    status: true,
  },
} satisfies Prisma.BookingFindManyArgs

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
            in: [...ACTIVE_DISPUTE_STATUSES],
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
  boostScore: true,
  boostExpiresAt: true,
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
          status: true,
        },
      },
    },
  },
} as const satisfies Prisma.ItemSelect

type SearchableItem = Prisma.ItemGetPayload<{
  select: typeof itemSearchSelect
}>

const itemSearchWithVisibilitySelect = {
  ...itemSearchSelect,
  availability: itemWithTaxonomy.availability,
  bookings: itemVisibilityBookings,
} as const satisfies Prisma.ItemSelect

type SearchableItemWithVisibility = Prisma.ItemGetPayload<{
  select: typeof itemSearchWithVisibilitySelect
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

const buildSearchWords = (
  item: SearchableItem | SearchableItemWithVisibility | ItemWithTaxonomy,
) => {
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

const filterAndRankSearchResults = <
  T extends SearchableItem | SearchableItemWithVisibility | ItemWithTaxonomy,
>(
  items: T[],
  search: string,
  options: {
    sortByScore?: boolean
    compareItems?: (left: T, right: T) => number
  } = {},
): T[] => {
  const ranked = items
    .map((item) => ({
      item,
      score: scoreSearchMatch(search, buildSearchWords(item)),
    }))
    .filter((entry): entry is { item: T; score: number } => entry.score !== null)

  if (options.sortByScore ?? true) {
    ranked.sort((a, b) => {
      const scoreDiff = b.score - a.score
      if (scoreDiff !== 0) return scoreDiff

      return options.compareItems ? options.compareItems(a.item, b.item) : 0
    })
  }

  return ranked.map((entry) => entry.item)
}

const mapItemTaxonomy = (
  item: ItemWithUserLike & {
    images?: Array<{ path: string; isPrimary?: boolean; sortOrder?: number }>
    thumbnailImage?: string | null
    photos?: string[]
    bookings?: Array<{ id: string; startDate: Date; endDate: Date; status?: string }>
    transactionReviews?: Array<unknown>
  },
) => {
  const {
    availability,
    categories,
    tags,
    lender,
    likes,
    images,
    bookings: _bookings,
    transactionReviews: _transactionReviews,
    ...rest
  } = item
  const lenderUser = lender?.user
  const lenderFullName = lenderUser
    ? [lenderUser.firstName, lenderUser.middleName, lenderUser.lastName].filter(Boolean).join(" ")
    : null
  const lenderUsername = lenderUser?.username || null
  const ownerName = lenderUsername || lenderFullName || lenderUser?.email || item.lenderId
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
    hasActiveBoost:
      item.boostExpiresAt instanceof Date ? item.boostExpiresAt.getTime() > Date.now() : false,
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
  options: { includeSearch?: boolean; userId?: string | null; now?: Date } = {},
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
  const now = options.now ?? new Date()
  const shouldApplyPublicVisibility = !ownedOnly

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

  const where: Prisma.ItemWhereInput = {
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

  return shouldApplyPublicVisibility ? { AND: [where, buildPublicVisibleItemWhere(now)] } : where
}

const buildPaginationWhereFromCursor = (cursor: {
  boostScore: number
  bookingCount: number
  createdAt: Date
  id: string
}): Prisma.ItemWhereInput => ({
  OR: [
    { boostScore: { lt: cursor.boostScore } },
    {
      boostScore: cursor.boostScore,
      bookingCount: { lt: cursor.bookingCount },
    },
    {
      boostScore: cursor.boostScore,
      bookingCount: cursor.bookingCount,
      createdAt: { lt: cursor.createdAt },
    },
    {
      boostScore: cursor.boostScore,
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

const buildPublicItemInclude = (userId: string | null) =>
  ({
    ...buildItemInclude(userId),
    bookings: itemVisibilityBookings,
  }) satisfies Prisma.ItemInclude

type PublicVisibleItemRecord = ItemWithUserLike & {
  bookings: Array<{ id: string; startDate: Date; endDate: Date; status: string }>
}

const getRequiredAvailabilityWindow = (
  input?: Pick<ListWhereFilters, "availableFrom" | "availableTo">,
) => {
  if (!input?.availableFrom || !input.availableTo) return null

  return {
    startDate: input.availableFrom,
    endDate: input.availableTo,
  }
}

const filterPublicVisibleItems = <T extends PublicVisibleItemRecord>(
  items: T[],
  now: Date,
  requiredWindow: { startDate: Date; endDate: Date } | null = null,
): T[] => items.filter((item) => isPublicVisibleItem(item, now, { requiredWindow }))

const buildPaginatedWhere = (
  where: Prisma.ItemWhereInput,
  cursor: { boostScore: number; bookingCount: number; createdAt: Date; id: string } | null,
) => {
  if (!cursor) return where
  return {
    AND: [where, buildPaginationWhereFromCursor(cursor)],
  } satisfies Prisma.ItemWhereInput
}

type FeedScanCursor = {
  id: string
  boostScore: number
  bookingCount: number
  createdAt: Date
}

type FeedPaginationState = {
  scanCursor: FeedScanCursor | null
  scanExhausted: boolean
  pendingIds: string[]
}

const getFeedScanCursor = (
  item: Pick<PublicVisibleItemRecord, "id" | "boostScore" | "bookingCount" | "createdAt">,
): FeedScanCursor => ({
  id: item.id,
  boostScore: item.boostScore,
  bookingCount: item.bookingCount,
  createdAt: item.createdAt,
})

const dedupeItemsById = <T extends { id: string }>(items: T[]) => {
  const unique = new Map<string, T>()

  for (const item of items) {
    if (!unique.has(item.id)) {
      unique.set(item.id, item)
    }
  }

  return [...unique.values()]
}

const orderItemsByIds = <T extends { id: string }>(items: T[], orderedIds: string[]) => {
  const itemsById = new Map(items.map((item) => [item.id, item]))
  return orderedIds.map((id) => itemsById.get(id)).filter((item): item is T => Boolean(item))
}

const getViewerInterestProfileForFeed = async (prisma: PrismaClientLike, userId: string | null) => {
  if (!userId) {
    return buildViewerInterestProfile([])
  }

  const likedItems = await prisma.like.findMany({
    where: { userId },
    select: {
      item: {
        select: {
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
        },
      },
    },
  })

  return buildViewerInterestProfile(likedItems)
}

type PrismaClientLike = {
  like: {
    findMany: (...args: unknown[]) => Promise<
      Array<{
        item: {
          categories: Array<{ category: ItemCategory }>
          tags: Array<{ tag: { name: string } }>
        } | null
      }>
    >
  }
  item: {
    findMany: (...args: unknown[]) => Promise<PublicVisibleItemRecord[]>
  }
}

const rankFeedRecords = (
  items: PublicVisibleItemRecord[],
  profile: ViewerInterestProfile,
  now: Date,
  search?: string,
) => {
  if (search) {
    return filterAndRankSearchResults(items, search, {
      compareItems: (left, right) => compareFeedItemsByRelevance(left, right, profile, now),
    })
  }

  return sortFeedItemsByRelevance(items, profile, now)
}

const loadPendingFeedRecords = async (
  prisma: PrismaClientLike["item"],
  userId: string | null,
  where: Prisma.ItemWhereInput,
  pendingIds: string[],
  now: Date,
  requiredWindow: { startDate: Date; endDate: Date } | null,
  search?: string,
) => {
  if (pendingIds.length === 0) {
    return []
  }

  const pendingRecords = await prisma.findMany({
    include: buildPublicItemInclude(userId),
    where: {
      AND: [where, { id: { in: pendingIds } }],
    },
  })

  const filteredPendingRecords = filterPublicVisibleItems(
    search
      ? filterAndRankSearchResults(pendingRecords, search, { sortByScore: false })
      : pendingRecords,
    now,
    requiredWindow,
  )

  return orderItemsByIds(filteredPendingRecords, pendingIds)
}

const collectRankedFeedRecords = async ({
  prisma,
  userId,
  where,
  search,
  limit,
  pagination,
  now,
  requiredWindow,
  viewerProfile,
}: {
  prisma: PrismaClientLike
  userId: string | null
  where: Prisma.ItemWhereInput
  search?: string
  limit: number
  pagination: FeedPaginationState
  now: Date
  requiredWindow: { startDate: Date; endDate: Date } | null
  viewerProfile: ViewerInterestProfile
}) => {
  const collectedRecords = await loadPendingFeedRecords(
    prisma.item,
    userId,
    where,
    pagination.pendingIds,
    now,
    requiredWindow,
    search,
  )

  let scanCursor = pagination.scanCursor
  let scanExhausted = pagination.scanExhausted
  let scannedCount = 0

  while (!scanExhausted && scannedCount < FEED_RANKING_SCAN_LIMIT) {
    const take = Math.min(VISIBILITY_SCAN_BATCH_SIZE, FEED_RANKING_SCAN_LIMIT - scannedCount)
    const records = await prisma.item.findMany({
      take,
      orderBy: getDefaultItemOrderBy(),
      include: buildPublicItemInclude(userId),
      where: buildPaginatedWhere(where, scanCursor),
    })

    if (records.length === 0) {
      scanExhausted = true
      break
    }

    scannedCount += records.length

    const filteredRecords = filterPublicVisibleItems(
      search ? filterAndRankSearchResults(records, search, { sortByScore: false }) : records,
      now,
      requiredWindow,
    )
    collectedRecords.push(...filteredRecords)

    const lastScannedRecord = records.at(-1)
    scanCursor = lastScannedRecord ? getFeedScanCursor(lastScannedRecord) : scanCursor

    if (records.length < take) {
      scanExhausted = true
      break
    }
  }

  const rankedRecords = rankFeedRecords(
    dedupeItemsById(collectedRecords),
    viewerProfile,
    now,
    search,
  )
  const pageRecords = rankedRecords.slice(0, limit)
  const pendingIds = rankedRecords.slice(limit).map((item) => item.id)

  return {
    pageRecords,
    nextCursor:
      pendingIds.length > 0 || !scanExhausted
        ? {
            version: 1 as const,
            scanExhausted,
            scanCursor: scanExhausted ? null : scanCursor,
            pendingIds,
          }
        : null,
  }
}

export const itemRouter = router({
  list: publicProcedure.input(listItemsSchema).query(async ({ ctx, input }) => {
    await expireActiveBoosts(ctx.prisma)
    const search = input?.search?.trim()
    const now = new Date()
    const requiredWindow = getRequiredAvailabilityWindow(input)
    const userId = ctx.user?.id ?? null
    const feedPrisma = ctx.prisma as unknown as PrismaClientLike
    const baseWhere = buildListWhere(input, {
      includeSearch: !search,
      userId,
      now,
    })
    const viewerProfile = await getViewerInterestProfileForFeed(feedPrisma, userId)
    const { pageRecords } = await collectRankedFeedRecords({
      prisma: feedPrisma,
      userId,
      where: baseWhere,
      search,
      limit: 50,
      pagination: {
        scanCursor: null,
        scanExhausted: false,
        pendingIds: [],
      },
      now,
      requiredWindow,
      viewerProfile,
    })

    return pageRecords.map(mapItemTaxonomy)
  }),

  paginatedList: publicProcedure.input(paginatedItemsSchema).query(async ({ ctx, input }) => {
    await expireActiveBoosts(ctx.prisma)
    const search = input.search?.trim()
    const now = new Date()
    const requiredWindow = getRequiredAvailabilityWindow(input)
    const userId = ctx.user?.id ?? null
    const feedPrisma = ctx.prisma as unknown as PrismaClientLike
    const baseWhere = buildListWhere(input, {
      includeSearch: !search,
      userId,
      now,
    })
    const viewerProfile = await getViewerInterestProfileForFeed(feedPrisma, userId)
    const pagination: FeedPaginationState = input.cursor
      ? {
          scanCursor: input.cursor.scanCursor
            ? {
                id: input.cursor.scanCursor.id,
                boostScore: input.cursor.scanCursor.boostScore,
                bookingCount: input.cursor.scanCursor.bookingCount,
                createdAt: input.cursor.scanCursor.createdAt,
              }
            : null,
          scanExhausted: input.cursor.scanExhausted,
          pendingIds: input.cursor.pendingIds,
        }
      : {
          scanCursor: null,
          scanExhausted: false,
          pendingIds: [],
        }
    const { pageRecords, nextCursor } = await collectRankedFeedRecords({
      prisma: feedPrisma,
      userId,
      where: baseWhere,
      search,
      limit: input.limit,
      pagination,
      now,
      requiredWindow,
      viewerProfile,
    })

    return {
      items: pageRecords.map(mapItemTaxonomy),
      nextCursor,
    }
  }),

  countFiltered: publicProcedure.input(listItemsSchema).query(async ({ ctx, input }) => {
    await expireActiveBoosts(ctx.prisma)
    const search = input?.search?.trim()
    const now = new Date()
    const requiredWindow = getRequiredAvailabilityWindow(input)

    const where = buildListWhere(input, {
      includeSearch: false,
      userId: ctx.user?.id ?? null,
      now,
    })
    let totalCount = 0
    let cursor: { id: string; createdAt: Date; bookingCount: number; boostScore: number } | null =
      null

    while (true) {
      const paginationWhere: Prisma.ItemWhereInput | null = cursor
        ? buildPaginationWhereFromCursor(cursor)
        : null
      const batch: SearchableItemWithVisibility[] = await ctx.prisma.item.findMany({
        take: SEARCH_COUNT_BATCH_SIZE,
        orderBy: getDefaultItemOrderBy(),
        select: itemSearchWithVisibilitySelect,
        where: paginationWhere ? { AND: [where, paginationWhere] } : where,
      })

      if (batch.length === 0) {
        break
      }

      const visibleBatch = batch.filter((item) =>
        isPublicVisibleItem(item, now, { requiredWindow }),
      )
      totalCount += search
        ? filterAndRankSearchResults(visibleBatch, search, { sortByScore: false }).length
        : visibleBatch.length

      const last: SearchableItemWithVisibility | undefined = batch.at(-1)
      if (!last || batch.length < SEARCH_COUNT_BATCH_SIZE) {
        break
      }

      cursor = {
        id: last.id,
        boostScore: last.boostScore,
        bookingCount: last.bookingCount,
        createdAt: last.createdAt,
      }
    }

    const count = totalCount
    return { count }
  }),

  filterMetadata: publicProcedure.query(async ({ ctx }) => {
    const now = new Date()
    const records = await ctx.prisma.item.findMany({
      where: buildPublicVisibleItemWhere(now),
      select: {
        condition: true,
        freeToBorrow: true,
        rentalFee: true,
        status: true,
        categories: {
          select: { category: true },
        },
        availability: itemWithTaxonomy.availability,
        bookings: itemVisibilityBookings,
      },
    })

    const visibleRecords = records.filter((item) => isPublicVisibleItem(item, now))
    const categoryCountMap: Record<string, number> = {}
    const priceCountMap: Record<string, number> = {}
    const conditionCountMap: Record<string, number> = {}
    let freeToborrowCount = 0
    let othersCount = 0

    for (const item of visibleRecords) {
      conditionCountMap[item.condition] = (conditionCountMap[item.condition] ?? 0) + 1

      if (item.freeToBorrow) {
        freeToborrowCount++
      } else {
        const bucket =
          item.rentalFee < 100 ? "under100" : item.rentalFee <= 500 ? "100to500" : "over500"
        priceCountMap[bucket] = (priceCountMap[bucket] ?? 0) + 1
      }

      const categories = item.categories.map((entry) => entry.category)
      if (
        !categories.some((category) =>
          (KNOWN_SIDEBAR_DB_CATEGORIES as readonly string[]).includes(category),
        )
      ) {
        othersCount++
      }

      for (const category of categories) {
        categoryCountMap[category] = (categoryCountMap[category] ?? 0) + 1
      }
    }

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
    await expireActiveBoosts(ctx.prisma)
    const now = new Date()
    const viewer = ctx.user
      ? await ctx.prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: { accountType: true },
        })
      : null
    const isAdmin = viewer?.accountType === "ADMIN"
    const itemInclude = {
      ...buildPublicItemInclude(ctx.user?.id ?? null),
      transactionReviews: {
        where: {
          reviewType: "ITEM_REVIEW",
        },
        orderBy: {
          createdAt: "desc",
        },
        select: transactionReviewSelect,
      },
    } satisfies Prisma.ItemInclude

    const item = await ctx.prisma.item.findFirst({
      where: isAdmin
        ? { id: input.id }
        : {
            id: input.id,
            OR: [
              { lender: { user: { status: "ACTIVE" } } },
              ...(ctx.user ? [{ lenderId: ctx.user.id }] : []),
            ],
          },
      include: itemInclude,
    })

    if (!item) return null

    const isOwner = ctx.user?.id === item.lenderId
    if (!isOwner && !isAdmin && !isPublicVisibleItem(item, now)) return null

    // Increment view count without delaying the item detail response.
    const updateItem = (
      ctx.prisma.item as unknown as Partial<{
        update(args: {
          where: { id: string }
          data: { viewCount: { increment: number } }
        }): Promise<unknown>
      }>
    ).update

    updateItem?.({ where: { id: item.id }, data: { viewCount: { increment: 1 } } }).catch(() => {})

    const reviews = item.transactionReviews.map(mapTransactionReview)
    const averageRating =
      reviews.length > 0
        ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
        : 0

    return {
      ...mapItemTaxonomy(item),
      rating: averageRating,
      reviews,
      reviewsCount: reviews.length,
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
    await expireActiveBoosts(ctx.prisma)
    const { search, statuses, categories, limit, cursor } = input
    const userId = ctx.user.id

    const activeDisputeWhere: Prisma.RentalTransactionWhereInput = {
      disputes: {
        some: {
          status: {
            in: [...ACTIVE_DISPUTE_STATUSES],
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
    const now = new Date()

    // Check if item exists
    const item = await ctx.prisma.item.findFirst({
      where: { AND: [{ id: itemId }, buildPublicVisibleItemWhere(now)] },
      select: {
        id: true,
        status: true,
        lender: {
          select: {
            user: {
              select: {
                status: true,
              },
            },
          },
        },
        availability: itemWithTaxonomy.availability,
        bookings: itemVisibilityBookings,
      },
    })

    if (!item || !isPublicVisibleItem(item, now)) {
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
