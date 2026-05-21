import { computed, ref, watch, type Ref } from "vue"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../server/trpc/routers"
import type { BookingStatus } from "#shared/schemas/booking"
import { pruneExpiredEntries, setBoundedMapEntry } from "../utils/bounded-cache"

type RouterOutputs = inferRouterOutputs<AppRouter>
export type LenderItemRequestSource = RouterOutputs["booking"]["list"]["bookings"][number]
type BookingListResponse = RouterOutputs["booking"]["list"]

export type LenderItemRequestStatus = "PENDING" | "APPROVED" | "REJECTED"

export type LenderItemRequest = LenderItemRequestSource & {
  requestStatus: LenderItemRequestStatus
  requestStatusLabel: "Pending" | "Approved" | "Cancelled" | "Completed"
}

type UseLenderItemRequestsOptions = {
  enabled: Ref<boolean>
  statuses: Ref<BookingStatus[]>
  searchQuery: Ref<string>
}

type LenderRequestCacheEntry = {
  expiresAt: number
  requests: LenderItemRequest[]
}

type FetchRequestsOptions = {
  force?: boolean
}

const LENDER_REQUEST_CACHE_TTL_MS = 5 * 60_000
const MAX_LENDER_REQUEST_CACHE_ENTRIES = 32
const LENDER_BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
  "RETURNED",
  "IN_DISPUTE",
] satisfies BookingStatus[]
const LENDER_BOOKING_STATUS_SET = new Set<BookingStatus>(LENDER_BOOKING_STATUSES)
const lenderRequestCache = new Map<string, LenderRequestCacheEntry>()
const pendingLenderRequestFetches = new Map<string, Promise<LenderItemRequest[]>>()

const cloneLenderRequests = (requests: LenderItemRequest[]) => structuredClone(requests)

const getLenderRequestViewerKey = () => {
  if (import.meta.server) {
    return useRequestEvent()?.context.authUser?.id ?? "anonymous"
  }

  if (typeof useSupabaseUser === "function") {
    return useSupabaseUser().value?.id ?? "anonymous"
  }

  return "anonymous"
}

const buildLenderRequestCacheKey = (statuses: BookingStatus[]) =>
  `${getLenderRequestViewerKey()}:lender-requests:${[...statuses].sort().join("|")}`

const getCachedLenderRequests = (cacheKey: string) => {
  pruneExpiredEntries(lenderRequestCache)
  const cachedEntry = lenderRequestCache.get(cacheKey)
  if (!cachedEntry) return null

  if (cachedEntry.expiresAt <= Date.now()) {
    lenderRequestCache.delete(cacheKey)
    return null
  }

  return cloneLenderRequests(cachedEntry.requests)
}

const setCachedLenderRequests = (cacheKey: string, requests: LenderItemRequest[]) => {
  pruneExpiredEntries(lenderRequestCache)
  setBoundedMapEntry(
    lenderRequestCache,
    cacheKey,
    {
      expiresAt: Date.now() + LENDER_REQUEST_CACHE_TTL_MS,
      requests: cloneLenderRequests(requests),
    },
    MAX_LENDER_REQUEST_CACHE_ENTRIES,
  )
}

const requestStatusByBookingStatus: Partial<
  Record<BookingStatus, Pick<LenderItemRequest, "requestStatus" | "requestStatusLabel">>
> = {
  PENDING: { requestStatus: "PENDING", requestStatusLabel: "Pending" },
  CONFIRMED: { requestStatus: "APPROVED", requestStatusLabel: "Approved" },
  CANCELLED: { requestStatus: "REJECTED", requestStatusLabel: "Cancelled" },
  COMPLETED: { requestStatus: "APPROVED", requestStatusLabel: "Completed" },
  RETURNED: { requestStatus: "APPROVED", requestStatusLabel: "Approved" },
}

const formatUserName = (user: { firstName: string; middleName: string | null; lastName: string }) =>
  `${user.firstName} ${user.lastName[0]}.`

const toLenderItemRequest = (booking: LenderItemRequestSource): LenderItemRequest | null => {
  const requestStatus = requestStatusByBookingStatus[booking.status]
  if (!requestStatus) return null

  return {
    ...booking,
    ...requestStatus,
  }
}

const sortByCreatedAtDesc = (left: LenderItemRequest, right: LenderItemRequest) => {
  const leftTime = new Date(left.createdAt).getTime()
  const rightTime = new Date(right.createdAt).getTime()

  if (rightTime !== leftTime) return rightTime - leftTime
  return right.id.localeCompare(left.id)
}

export const useLenderItemRequests = ({
  enabled,
  statuses,
  searchQuery,
}: UseLenderItemRequestsOptions) => {
  const requests = ref<LenderItemRequest[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const requestVersion = ref(0)

  const reset = () => {
    requests.value = []
    error.value = null
    isLoading.value = false
  }

  const fetchRequests = async (options: FetchRequestsOptions = {}) => {
    requestVersion.value += 1
    const version = requestVersion.value

    if (!enabled.value || statuses.value.length === 0) {
      reset()
      return
    }

    const uniqueStatuses = [...new Set(statuses.value)].filter((status) =>
      LENDER_BOOKING_STATUS_SET.has(status),
    )

    if (uniqueStatuses.length === 0) {
      requests.value = []
      return
    }

    const cacheKey = buildLenderRequestCacheKey(uniqueStatuses)

    if (!options.force) {
      const cachedRequests = getCachedLenderRequests(cacheKey)
      if (cachedRequests) {
        requests.value = cachedRequests
        return
      }

      const pendingRequest = pendingLenderRequestFetches.get(cacheKey)
      if (pendingRequest) {
        isLoading.value = true
        error.value = null

        try {
          const pendingRequests = await pendingRequest
          if (version === requestVersion.value) {
            requests.value = cloneLenderRequests(pendingRequests)
          }
        } catch {
          if (version === requestVersion.value) {
            error.value = "Unable to load booking requests. Please try again."
          }
        } finally {
          if (version === requestVersion.value) {
            isLoading.value = false
          }
        }
        return
      }
    }

    try {
      isLoading.value = true
      error.value = null

      const request = Promise.all(
        uniqueStatuses.map((status) =>
          $fetch<BookingListResponse>("/api/bookings", {
            query: {
              role: "LENDER",
              status,
              limit: 100,
            },
          }),
        ),
      )
        .then((responses) =>
          responses
            .flatMap((response) => response.bookings)
            .map(toLenderItemRequest)
            .filter((request): request is LenderItemRequest => request !== null)
            .sort(sortByCreatedAtDesc),
        )
        .then((nextRequests) => {
          setCachedLenderRequests(cacheKey, nextRequests)
          return nextRequests
        })
        .finally(() => {
          if (pendingLenderRequestFetches.get(cacheKey) === request) {
            pendingLenderRequestFetches.delete(cacheKey)
          }
        })

      pendingLenderRequestFetches.set(cacheKey, request)
      const nextRequests = await request

      if (version !== requestVersion.value) return

      requests.value = cloneLenderRequests(nextRequests)
    } catch (err: unknown) {
      if (version !== requestVersion.value) return

      const statusCode = (err as { statusCode?: number })?.statusCode
      if (statusCode === 401) {
        await navigateTo("/")
        return
      }

      error.value = "Unable to load booking requests. Please try again."
    } finally {
      if (version === requestVersion.value) {
        isLoading.value = false
      }
    }
  }

  watch([enabled, () => statuses.value.join("|")], () => {
    void fetchRequests()
  })

  const filteredRequests = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return requests.value

    return requests.value.filter((request) => {
      const itemName = request.item.name.toLowerCase()
      const borrowerName = formatUserName(request.borrower.user).toLowerCase()
      const requestId = request.id.slice(0, 16).toLowerCase()

      return itemName.includes(q) || borrowerName.includes(q) || requestId.includes(q)
    })
  })

  return {
    requests,
    filteredRequests,
    isLoading,
    error,
    fetchRequests,
  }
}
