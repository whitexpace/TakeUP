import { computed, ref, watch, type Ref } from "vue"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../server/trpc/routers"
import type { BookingStatus } from "#shared/schemas/booking"

type RouterOutputs = inferRouterOutputs<AppRouter>
export type BorrowerItemRequestSource = RouterOutputs["booking"]["list"]["bookings"][number]
type BookingListResponse = RouterOutputs["booking"]["list"]

export type BorrowerItemRequestStatus = "PENDING" | "APPROVED" | "REJECTED"

export type BorrowerItemRequest = BorrowerItemRequestSource & {
  requestStatus: BorrowerItemRequestStatus
  requestStatusLabel: "Pending" | "Approved" | "Rejected" | "Cancelled" | "Completed"
}

type UseBorrowerItemRequestsOptions = {
  enabled: Ref<boolean>
  statuses: Ref<BookingStatus[]>
  searchQuery: Ref<string>
}

type BorrowerRequestCacheEntry = {
  expiresAt: number
  requests: BorrowerItemRequest[]
}

type FetchRequestsOptions = {
  force?: boolean
}

const BORROWER_REQUEST_CACHE_TTL_MS = 5 * 60_000
const REQUEST_BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
  "RETURNED",
  "IN_DISPUTE",
] satisfies BookingStatus[]
const REQUEST_BOOKING_STATUS_SET = new Set<BookingStatus>(REQUEST_BOOKING_STATUSES)
const borrowerRequestCache = new Map<string, BorrowerRequestCacheEntry>()
const pendingBorrowerRequestFetches = new Map<string, Promise<BorrowerItemRequest[]>>()

const cloneBorrowerRequests = (requests: BorrowerItemRequest[]) => structuredClone(requests)

const getBorrowerRequestViewerKey = () => {
  if (import.meta.server) {
    return useRequestEvent()?.context.authUser?.id ?? "anonymous"
  }

  if (typeof useSupabaseUser === "function") {
    return useSupabaseUser().value?.id ?? "anonymous"
  }

  return "anonymous"
}

const buildBorrowerRequestCacheKey = (statuses: BookingStatus[]) =>
  `${getBorrowerRequestViewerKey()}:borrower-requests:${[...statuses].sort().join("|")}`

const getCachedBorrowerRequests = (cacheKey: string) => {
  const cachedEntry = borrowerRequestCache.get(cacheKey)
  if (!cachedEntry) return null

  if (cachedEntry.expiresAt <= Date.now()) {
    borrowerRequestCache.delete(cacheKey)
    return null
  }

  return cloneBorrowerRequests(cachedEntry.requests)
}

const setCachedBorrowerRequests = (cacheKey: string, requests: BorrowerItemRequest[]) => {
  borrowerRequestCache.set(cacheKey, {
    expiresAt: Date.now() + BORROWER_REQUEST_CACHE_TTL_MS,
    requests: cloneBorrowerRequests(requests),
  })
}

const requestStatusByBookingStatus: Partial<
  Record<BookingStatus, Pick<BorrowerItemRequest, "requestStatus" | "requestStatusLabel">>
> = {
  PENDING: { requestStatus: "PENDING", requestStatusLabel: "Pending" },
  CONFIRMED: { requestStatus: "APPROVED", requestStatusLabel: "Approved" },
  // When a borrower cancels their own booking request we surface it in the
  // borrower requests list. Historically this was shown with the label
  // "Rejected" (which is confusing). Change the label to "Cancelled" while
  // keeping the internal requestStatus value so existing consumers/styles
  // remain compatible.
  CANCELLED: { requestStatus: "REJECTED", requestStatusLabel: "Cancelled" },
  COMPLETED: { requestStatus: "APPROVED", requestStatusLabel: "Completed" },
  RETURNED: { requestStatus: "APPROVED", requestStatusLabel: "Approved" },
}

const formatUserName = (user: { firstName: string; middleName: string | null; lastName: string }) =>
  `${user.firstName} ${user.lastName[0]}.`

const toBorrowerItemRequest = (booking: BorrowerItemRequestSource): BorrowerItemRequest | null => {
  const requestStatus = requestStatusByBookingStatus[booking.status]
  if (!requestStatus) return null

  return {
    ...booking,
    ...requestStatus,
  }
}

const sortByCreatedAtDesc = (left: BorrowerItemRequest, right: BorrowerItemRequest) => {
  const leftTime = new Date(left.createdAt).getTime()
  const rightTime = new Date(right.createdAt).getTime()

  if (rightTime !== leftTime) return rightTime - leftTime
  return right.id.localeCompare(left.id)
}

export const useBorrowerItemRequests = ({
  enabled,
  statuses,
  searchQuery,
}: UseBorrowerItemRequestsOptions) => {
  const requests = ref<BorrowerItemRequest[]>([])
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
      REQUEST_BOOKING_STATUS_SET.has(status),
    )

    if (uniqueStatuses.length === 0) {
      requests.value = []
      return
    }

    const cacheKey = buildBorrowerRequestCacheKey(uniqueStatuses)

    if (!options.force) {
      const cachedRequests = getCachedBorrowerRequests(cacheKey)
      if (cachedRequests) {
        requests.value = cachedRequests
        return
      }

      const pendingRequest = pendingBorrowerRequestFetches.get(cacheKey)
      if (pendingRequest) {
        isLoading.value = true
        error.value = null

        try {
          const pendingRequests = await pendingRequest
          if (version === requestVersion.value) {
            requests.value = cloneBorrowerRequests(pendingRequests)
          }
        } catch {
          if (version === requestVersion.value) {
            error.value = "Unable to load item requests. Please try again."
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
              role: "BORROWER",
              status,
              limit: 100,
            },
          }),
        ),
      )
        .then((responses) =>
          responses
            .flatMap((response) => response.bookings)
            .map(toBorrowerItemRequest)
            .filter((request): request is BorrowerItemRequest => request !== null)
            .sort(sortByCreatedAtDesc),
        )
        .then((nextRequests) => {
          setCachedBorrowerRequests(cacheKey, nextRequests)
          return nextRequests
        })
        .finally(() => {
          if (pendingBorrowerRequestFetches.get(cacheKey) === request) {
            pendingBorrowerRequestFetches.delete(cacheKey)
          }
        })

      pendingBorrowerRequestFetches.set(cacheKey, request)
      const nextRequests = await request

      if (version !== requestVersion.value) return

      requests.value = cloneBorrowerRequests(nextRequests)
    } catch (err: unknown) {
      if (version !== requestVersion.value) return

      const statusCode = (err as { statusCode?: number })?.statusCode
      if (statusCode === 401) {
        await navigateTo("/")
        return
      }

      error.value = "Unable to load item requests. Please try again."
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
      const lenderName = formatUserName(request.lender.user).toLowerCase()
      const requestId = request.id.slice(0, 16).toLowerCase()

      return itemName.includes(q) || lenderName.includes(q) || requestId.includes(q)
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
