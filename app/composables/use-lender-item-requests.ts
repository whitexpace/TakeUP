import { computed, ref, watch, type Ref } from "vue"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../server/trpc/routers"

type RouterOutputs = inferRouterOutputs<AppRouter>
export type LenderItemRequestSource = RouterOutputs["booking"]["list"]["bookings"][number]
type BookingListResponse = RouterOutputs["booking"]["list"]

export type LenderItemRequest = LenderItemRequestSource & {
  requestStatus: "PENDING"
  requestStatusLabel: "Pending"
}

type UseLenderItemRequestsOptions = {
  enabled: Ref<boolean>
  searchQuery: Ref<string>
}

const formatUserName = (user: { firstName: string; middleName: string | null; lastName: string }) =>
  `${user.firstName} ${user.lastName[0]}.`

const toLenderItemRequest = (booking: LenderItemRequestSource): LenderItemRequest => ({
  ...booking,
  requestStatus: "PENDING" as const,
  requestStatusLabel: "Pending" as const,
})

const sortByCreatedAtDesc = (left: LenderItemRequest, right: LenderItemRequest) => {
  const leftTime = new Date(left.createdAt).getTime()
  const rightTime = new Date(right.createdAt).getTime()

  if (rightTime !== leftTime) return rightTime - leftTime
  return right.id.localeCompare(left.id)
}

export const useLenderItemRequests = ({
  enabled,
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

  const fetchRequests = async () => {
    requestVersion.value += 1
    const version = requestVersion.value

    if (!enabled.value) {
      reset()
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<BookingListResponse>("/api/bookings", {
        query: {
          role: "LENDER",
          status: "PENDING",
          limit: 100,
        },
      })

      if (version !== requestVersion.value) return

      requests.value = response.bookings.map(toLenderItemRequest).sort(sortByCreatedAtDesc)
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

  watch([enabled], () => {
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
