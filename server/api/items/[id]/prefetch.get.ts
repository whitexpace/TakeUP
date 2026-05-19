import { createError, getRouterParam } from "h3"
import type { Prisma } from "@prisma/client"
import { itemIdSchema } from "#shared/schemas/item"
import { prisma } from "../../../utils/prisma"
import {
  ITEM_VISIBILITY_BLOCKING_BOOKING_STATUSES,
  isPublicVisibleItem,
} from "../../../utils/item-visibility"
import { setPublicSWRApiHeaders } from "../../../utils/request-security"
const isPrismaPoolTimeout = (error: unknown) =>
  (error as { code?: string } | null)?.code === "P2024"

const itemImageOrderBy: Prisma.ItemImageOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { createdAt: "asc" },
]

const prefetchItemSelect = {
  id: true,
  numericId: true,
  name: true,
  description: true,
  condition: true,
  status: true,
  rateOption: true,
  createdAt: true,
  rentalFee: true,
  replacementCost: true,
  freeToBorrow: true,
  whatItemOffers: true,
  whatIsIncluded: true,
  knownIssues: true,
  usageLimitations: true,
  isTrending: true,
  viewCount: true,
  bookingCount: true,
  likeCount: true,
  rating: true,
  boostScore: true,
  boostExpiresAt: true,
  lenderId: true,
  adminModerationState: true,
  adminModeratedById: true,
  adminModeratedAt: true,
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
  bookings: {
    where: {
      status: { in: [...ITEM_VISIBILITY_BLOCKING_BOOKING_STATUSES] },
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      status: true,
    },
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
      lenderRating: true,
      _count: {
        select: { bookings: true },
      },
      user: {
        select: {
          username: true,
          firstName: true,
          middleName: true,
          lastName: true,
          email: true,
          status: true,
          avatarUrl: true,
        },
      },
    },
  },
} satisfies Prisma.ItemSelect

type PrefetchItemRecord = Prisma.ItemGetPayload<{
  select: typeof prefetchItemSelect
}>

const mapHumanName = (user: {
  firstName?: string | null
  middleName?: string | null
  lastName?: string | null
}) => [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ")

const handler = defineCachedEventHandler(
  async (event) => {
    setPublicSWRApiHeaders(event, 30, 120)

    const rawId = getRouterParam(event, "id")
    const parsed = itemIdSchema.safeParse({ id: rawId })

    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid item id.",
      })
    }

    const now = new Date()
    let item: PrefetchItemRecord | null = null

    try {
      item = (await prisma.item.findUnique({
        where: { id: parsed.data.id },
        select: prefetchItemSelect,
      })) as PrefetchItemRecord | null
    } catch (error) {
      if (isPrismaPoolTimeout(error)) {
        return null
      }

      throw error
    }

    if (!item || item.adminModerationState !== null || !isPublicVisibleItem(item, now)) {
      return null
    }

    const lenderUser = item.lender.user
    const lenderFullName = lenderUser ? mapHumanName(lenderUser) : null
    const lenderUsername = lenderUser?.username || null
    const ownerName = lenderUsername || lenderFullName || lenderUser?.email || item.lenderId
    const orderedPhotos = item.images.map((image) => image.path)
    const thumbnailImage =
      item.images.find((image) => image.isPrimary)?.path ?? orderedPhotos[0] ?? null

    return {
      ...item,
      ownerName,
      lenderUsername,
      lenderFullName,
      lenderRating: item.lender.lenderRating,
      lenderBookingCount: item.lender._count.bookings,
      lenderAvatarUrl: lenderUser?.avatarUrl || null,
      isLiked: false,
      images: item.images,
      thumbnailImage,
      photos: orderedPhotos,
      hasActiveBoost:
        item.boostExpiresAt instanceof Date ? item.boostExpiresAt.getTime() > Date.now() : false,
      bookingBlocks: item.bookings.map((booking) => ({
        id: booking.id,
        startDate: booking.startDate,
        endDate: booking.endDate,
        status: "RENTED" as const,
      })),
      categories: item.categories.map((entry) => entry.category),
      tags: item.tags.map((entry) => entry.tag.name),
      reviews: [],
      reviewsCount: 0,
    }
  },
  {
    maxAge: 30,
    swr: true,
  },
)

export default handler
