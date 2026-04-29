import { createContext } from "../../trpc/context"
import {
  buildPublicVisibleItemWhere,
  isPublicVisibleItem,
  ITEM_VISIBILITY_BLOCKING_BOOKING_STATUSES,
} from "../../utils/item-visibility"

export default defineEventHandler(async (event) => {
  const ctx = await createContext(event)

  if (!ctx.user) {
    return []
  }

  const now = new Date()
  const items = await ctx.prisma.item.findMany({
    where: {
      AND: [
        buildPublicVisibleItemWhere(now),
        {
          likes: {
            some: {
              userId: ctx.user.id,
            },
          },
        },
      ],
    },
    select: {
      status: true,
      categories: {
        select: {
          category: true,
        },
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
    },
  })

  const categories = new Set<string>()
  for (const item of items) {
    if (!isPublicVisibleItem(item, now)) continue

    for (const entry of item.categories) {
      categories.add(entry.category)
    }
  }

  return [...categories].sort()
})
