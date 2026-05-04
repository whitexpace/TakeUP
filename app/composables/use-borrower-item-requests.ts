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
  requestStatusLabel: "Pending" | "Approved" | "Rejected" | "Cancelled"
}

type UseBorrowerItemRequestsOptions = {
  enabled: Ref<boolean>
  statuses: Ref<BookingStatus[]>
  searchQuery: Ref<string>
}

const REQUEST_BOOKING_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED"] satisfies BookingStatus[]
const REQUEST_BOOKING_STATUS_SET = new Set<BookingStatus>(REQUEST_BOOKING_STATUSES)

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

  const fetchRequests = async () => {
    requestVersion.value += 1
    const version = requestVersion.value

    if (!enabled.value || statuses.value.length === 0) {
      reset()
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const uniqueStatuses = [...new Set(statuses.value)].filter((status) =>
        REQUEST_BOOKING_STATUS_SET.has(status),
      )

      if (uniqueStatuses.length === 0) {
        requests.value = []
        return
      }

      const responses = await Promise.all(
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

      if (version !== requestVersion.value) return

      requests.value = responses
        .flatMap((response) => response.bookings)
        .map(toBorrowerItemRequest)
        .filter((request): request is BorrowerItemRequest => request !== null)
        .sort(sortByCreatedAtDesc)
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
