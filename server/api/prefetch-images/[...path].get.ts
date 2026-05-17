import { createError, getRouterParam } from "h3"
import { itemIdSchema } from "#shared/schemas/item"
import { prisma } from "../../utils/prisma"
import {
  ITEM_VISIBILITY_BLOCKING_BOOKING_STATUSES,
  buildPublicVisibleItemWhere,
  isPublicVisibleItem,
} from "../../utils/item-visibility"
import { setPublicSWRApiHeaders } from "../../utils/request-security"

const ITEM_ID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_PREFETCH_IMAGES = 1
const DETAIL_IMAGE_SIZES = "(min-width: 1024px) 896px, 100vw"
const PRIVATE_ROUTE_PREFIXES = [
  "/account",
  "/admin",
  "/api",
  "/auth",
  "/bag",
  "/chat",
  "/dashboard",
  "/likes",
  "/profile",
]

const isExternalUrlLike = (value: string) => /^([a-z][a-z\d+.-]*:)?\/\//i.test(value)

const getDestinationPath = (rawPath: string) => {
  let decodedPath: string

  try {
    decodedPath = decodeURIComponent(rawPath.trim())
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid prefetch path.",
    })
  }

  if (!decodedPath || decodedPath.includes("\\") || isExternalUrlLike(decodedPath)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Only same-origin relative paths can be prefetched.",
    })
  }

  const destinationPath = `/${decodedPath.replace(/^\/+/, "")}`

  if (destinationPath.includes("?") || destinationPath.includes("#")) {
    throw createError({
      statusCode: 400,
      statusMessage: "Prefetch paths must not include search params or hashes.",
    })
  }

  if (PRIVATE_ROUTE_PREFIXES.some((prefix) => destinationPath.startsWith(prefix))) {
    throw createError({
      statusCode: 403,
      statusMessage: "This route cannot be image-prefetched.",
    })
  }

  const segments = destinationPath.split("/").filter(Boolean)
  if (segments.length !== 2 || segments[0] !== "items") {
    throw createError({
      statusCode: 403,
      statusMessage: "Only public item pages can be image-prefetched.",
    })
  }

  return destinationPath
}

const extractItemIdFromPath = (path: string) => {
  const slug = path.split("/").filter(Boolean)[1] ?? ""
  const match = slug.match(ITEM_ID_PATTERN)
  return match ? match[0] : null
}

const handler = defineCachedEventHandler(
  async (event) => {
    setPublicSWRApiHeaders(event, 30, 120)

    const rawPath = getRouterParam(event, "path") ?? ""
    const destinationPath = getDestinationPath(rawPath)
    const parsed = itemIdSchema.safeParse({ id: extractItemIdFromPath(destinationPath) })

    if (!parsed.success) {
      return {
        images: [],
      }
    }

    const now = new Date()
    const item = await prisma.item.findFirst({
      where: {
        AND: [
          { id: parsed.data.id },
          buildPublicVisibleItemWhere(now),
          { adminModerationState: null },
        ],
      },
      select: {
        id: true,
        name: true,
        status: true,
        images: {
          select: {
            path: true,
            isPrimary: true,
            sortOrder: true,
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
        availability: {
          select: {
            startDate: true,
            endDate: true,
            status: true,
          },
        },
        bookings: {
          where: {
            status: { in: [...ITEM_VISIBILITY_BLOCKING_BOOKING_STATUSES] },
          },
          select: {
            startDate: true,
            endDate: true,
            status: true,
          },
        },
        lender: {
          select: {
            user: {
              select: {
                status: true,
              },
            },
          },
        },
      },
    })

    if (!item || !isPublicVisibleItem(item, now)) {
      return {
        images: [],
      }
    }

    const primaryImage = item.images.find((image) => image.isPrimary) ?? item.images[0] ?? null
    const images = primaryImage
      ? [
          {
            src: primaryImage.path,
            sizes: DETAIL_IMAGE_SIZES,
            alt: item.name,
            loading: "eager" as const,
          },
        ].slice(0, MAX_PREFETCH_IMAGES)
      : []

    return {
      images,
    }
  },
  {
    maxAge: 30,
    swr: true,
  },
)

export default handler
