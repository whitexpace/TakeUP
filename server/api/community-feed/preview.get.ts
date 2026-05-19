import { createError, getQuery } from "h3"
import { z } from "zod"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"
import { handleItemRequestApiError } from "../item-requests/handle-item-request-api-error"
import {
  hasViewerCredentials,
  setPrivateNoStoreApiHeaders,
  setPublicSWRApiHeaders,
} from "../../utils/request-security"

type RequestForSummary = {
  id: number
  itemNeeded: string
  offersCount: number
  createdAt: Date | string | null
  borrower: { userId: string }
  offers: Array<{ lender: { userId: string } }>
}

const previewQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(8).default(5),
})

const getCreatedAtMs = (value: Date | string | null | undefined) => {
  if (!value) return 0
  return value instanceof Date ? value.getTime() : new Date(value).getTime()
}

const buildUserActivity = (requests: RequestForSummary[], viewerUserId: string) => {
  if (!viewerUserId) {
    return { postsMade: 0, offersSent: 0, offersReceived: 0 }
  }

  const myRequests = requests.filter((request) => request.borrower.userId === viewerUserId)
  const offersSent = requests.reduce((count, request) => {
    return count + request.offers.filter((offer) => offer.lender.userId === viewerUserId).length
  }, 0)
  const offersReceived = myRequests.reduce(
    (count, request) => count + Number(request.offersCount ?? 0),
    0,
  )

  return {
    postsMade: myRequests.length,
    offersSent,
    offersReceived,
  }
}

const buildTrendingItems = (requests: RequestForSummary[]) =>
  [...requests]
    .sort((left, right) => {
      if (right.offersCount !== left.offersCount) return right.offersCount - left.offersCount
      return getCreatedAtMs(right.createdAt) - getCreatedAtMs(left.createdAt)
    })
    .slice(0, 5)
    .map((request) => ({
      id: request.id,
      title: request.itemNeeded,
      offersCount: Number(request.offersCount ?? 0),
    }))

export default defineEventHandler(async (event) => {
  if (hasViewerCredentials(event)) {
    setPrivateNoStoreApiHeaders(event)
  } else {
    setPublicSWRApiHeaders(event, 30, 120)
  }

  try {
    const parsedQuery = previewQuerySchema.safeParse(getQuery(event))
    if (!parsedQuery.success) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid community feed preview query.",
      })
    }

    const ctx = await createContext(event)
    const caller = appRouter.createCaller(ctx)
    const viewerUserId = ctx.user?.id ?? ""

    const requests = await caller.community.listRequests({
      includeCancelledOffers: true,
    })
    const notifications = ctx.user ? await caller.community.notifications().catch(() => []) : []
    const offerableItems = ctx.user ? await caller.community.offerableItems().catch(() => []) : []

    return {
      requests: requests.slice(0, parsedQuery.data.limit),
      notifications,
      offerableItems,
      userActivity: buildUserActivity(requests, viewerUserId),
      trendingItems: buildTrendingItems(requests),
      currentDbUserId: viewerUserId,
      viewerKey: viewerUserId || "anonymous",
    }
  } catch (error) {
    handleItemRequestApiError(error, "prefetch community feed")
  }
})
