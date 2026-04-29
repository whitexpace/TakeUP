import { computed, ref, watch, type Ref } from "vue"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../server/trpc/routers"
import type { BookingRole, BookingStatus } from "#shared/schemas/booking"

type RouterOutputs = inferRouterOutputs<AppRouter>
export type BookingListItem = RouterOutputs["booking"]["list"]["bookings"][number]

type BookingListResponse = RouterOutputs["booking"]["list"]

type PaginationCursor = { id: string; createdAt: Date } | null

type UseBookingsOptions = {
  role: Ref<BookingRole>
  status: Ref<BookingStatus | null>
  searchQuery: Ref<string>
}

const formatUserName = (user: { firstName: string; middleName: string | null; lastName: string }) =>
  `${user.firstName} ${user.lastName[0]}.`

export const useBookings = ({ role, status, searchQuery }: UseBookingsOptions) => {
  const bookings = ref<BookingListItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const nextCursor = ref<PaginationCursor>(null)
  const hasMore = computed(() => nextCursor.value !== null)

  const reset = () => {
    bookings.value = []
    nextCursor.value = null
    error.value = null
    isLoading.value = false
  }

  const fetchPage = async (cursor: PaginationCursor = null) => {
    if (isLoading.value) return
    isLoading.value = true
    error.value = null

    try {
      const query: Record<string, string | number> = {
        role: role.value,
        limit: 20,
      }

      if (status.value) {
        query.status = status.value
      }

      if (cursor) {
        query.cursor = JSON.stringify(cursor)
      }

      const result = await $fetch<BookingListResponse>("/api/bookings", { query })

      if (cursor) {
        bookings.value = [...bookings.value, ...result.bookings]
      } else {
        bookings.value = result.bookings
      }

      nextCursor.value = result.nextCursor as PaginationCursor
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode
      if (statusCode === 401) {
        await navigateTo("/")
        return
      }

      error.value = "Unable to load booking requests. Please try again."
    } finally {
      isLoading.value = false
    }
  }

  const loadMore = () => {
    if (!hasMore.value || isLoading.value) return
    fetchPage(nextCursor.value)
  }

  const refresh = async () => {
    reset()
    await fetchPage()
  }

  watch([role, status], () => {
    reset()
    void fetchPage()
  })

  const filteredBookings = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return bookings.value

    return bookings.value.filter((booking) => {
      const itemName = booking.item.name.toLowerCase()
      const counterpart =
        role.value === "LENDER"
          ? formatUserName(booking.borrower.user).toLowerCase()
          : formatUserName(booking.lender.user).toLowerCase()

      return (
        itemName.includes(q) ||
        counterpart.includes(q) ||
        booking.id.slice(0, 16).toLowerCase().includes(q)
      )
    })
  })

  return {
    bookings,
    filteredBookings,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    fetchPage,
  }
}
