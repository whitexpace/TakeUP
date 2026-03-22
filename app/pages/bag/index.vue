<script setup lang="ts">
import { computed, ref } from "vue"
import { useBag, type BagItem } from "../../composables/use-bag"
import UserAvatar from "../../components/UserAvatar.vue"
import Header from "../../components/Header.vue"

definePageMeta({
  auth: true,
})

const { bagItems, removeFromBag } = useBag()

const selectedItemIds = ref<Set<string>>(new Set())

const groupedItems = computed(() => {
  const groups: Record<
    string,
    { lenderName: string; lenderAvatarUrl?: string | null; items: BagItem[] }
  > = {}
  bagItems.value.forEach((item) => {
    if (!groups[item.lenderId]) {
      groups[item.lenderId] = {
        lenderName: item.lenderName,
        lenderAvatarUrl: item.lenderAvatarUrl,
        items: [],
      }
    }
    groups[item.lenderId]!.items.push(item)
  })
  return groups
})

const allItemIds = computed(() => bagItems.value.map((item) => item.id))

const isAllSelected = computed(() => {
  if (allItemIds.value.length === 0) return false
  return allItemIds.value.every((id) => selectedItemIds.value.has(id))
})

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedItemIds.value.clear()
  } else {
    allItemIds.value.forEach((id) => selectedItemIds.value.add(id))
  }
}

const isLenderSelected = (lenderId: string) => {
  const items = groupedItems.value[lenderId]?.items || []
  if (items.length === 0) return false
  return items.every((item) => selectedItemIds.value.has(item.id))
}

const toggleLenderSelect = (lenderId: string) => {
  const items = groupedItems.value[lenderId]?.items || []
  if (isLenderSelected(lenderId)) {
    items.forEach((item) => selectedItemIds.value.delete(item.id))
  } else {
    items.forEach((item) => selectedItemIds.value.add(item.id))
  }
}

const toggleItemSelect = (itemId: string) => {
  if (selectedItemIds.value.has(itemId)) {
    selectedItemIds.value.delete(itemId)
  } else {
    selectedItemIds.value.add(itemId)
  }
}

const handleDeleteItem = (itemId: string) => {
  removeFromBag(itemId)
  selectedItemIds.value.delete(itemId)
}

// Duration and Price calculation utilities
const createDateTime = (date: Date, timeValue: string) => {
  const value = new Date(date)
  const [timePart, period] = timeValue.split(" ")
  if (!timePart) return value

  const [hoursPart, minutesPart] = timePart.split(":").map(Number)
  let hours = hoursPart ?? 0
  const minutes = minutesPart ?? 0

  if (period === "PM" && hours !== 12) hours += 12
  if (period === "AM" && hours === 12) hours = 0

  value.setHours(hours, minutes, 0, 0)
  return value
}

const getBookingRange = (item: BagItem) => {
  if (!item.startDate) return null

  return {
    startDate: new Date(item.startDate),
    endDate: new Date(item.endDate ?? item.startDate),
  }
}

const calculateDuration = (item: BagItem) => {
  const bookingRange = getBookingRange(item)
  if (!bookingRange) return "1 day"

  const start = createDateTime(bookingRange.startDate, item.startTime)
  const end = createDateTime(bookingRange.endDate, item.endTime)

  const diffHours = Math.max(0.5, (end.getTime() - start.getTime()) / (1000 * 60 * 60))

  if (item.priceUnit === "hour") {
    const hours = Math.max(1, Math.ceil(diffHours))
    return `${hours} hour${hours > 1 ? "s" : ""}`
  } else {
    const days = Math.max(1, Math.ceil(diffHours / 24))
    return `${days} day${days > 1 ? "s" : ""}`
  }
}

const calculateUnits = (item: BagItem) => {
  const bookingRange = getBookingRange(item)
  if (!bookingRange) return 1

  const start = createDateTime(bookingRange.startDate, item.startTime)
  const end = createDateTime(bookingRange.endDate, item.endTime)

  const diffHours = Math.max(0.5, (end.getTime() - start.getTime()) / (1000 * 60 * 60))

  if (item.priceUnit === "hour") {
    return Math.max(1, Math.ceil(diffHours))
  } else {
    return Math.max(1, Math.ceil(diffHours / 24))
  }
}

const calculateItemTotal = (item: BagItem) => {
  if (item.listingType === "Borrow") return 0
  return calculateUnits(item) * item.price
}

const formatPesoAmount = (value: number) =>
  `₱${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(value)}`

const selectedItems = computed(() =>
  bagItems.value.filter((item) => selectedItemIds.value.has(item.id)),
)

const totalAmount = computed(() => {
  return selectedItems.value.reduce((sum, item) => sum + calculateItemTotal(item), 0)
})

const isSubmitting = ref(false)
const bookingStatusMessage = ref("")
const failedBookingDetails = ref<Array<{ name: string; reason: string }>>([])

// Confirmation Modal State
const isConfirmationModalOpen = ref(false)
const confirmationData = ref<{
  items: Array<{ name: string; dates: string; price: number }>
  lenders: string
  total: number
}>({
  items: [],
  lenders: "",
  total: 0,
})

const formatDateRange = (item: BagItem) => {
  const bookingRange = getBookingRange(item)
  if (!bookingRange) return ""

  const start = bookingRange.startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
  const end = bookingRange.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  return `${start} - ${end}`
}

const resolveBookingErrorMessage = (error: unknown) => {
  const fetchError = error as {
    data?: {
      statusMessage?: string
      error?: { message?: string }
      data?: { error?: { message?: string } }
    }
    statusCode?: number
    statusMessage?: string
    message?: string
  }

  return (
    fetchError.data?.statusMessage ??
    fetchError.data?.error?.message ??
    fetchError.data?.data?.error?.message ??
    fetchError.statusMessage ??
    (fetchError.statusCode === 500
      ? "Booking failed on the server. Check that the booking and transaction schema is applied to this database."
      : undefined) ??
    fetchError.message ??
    "Unable to submit your booking request."
  )
}

const handleRequestBooking = async () => {
  if (selectedItems.value.length === 0 || isSubmitting.value) return

  isSubmitting.value = true
  bookingStatusMessage.value = "Requesting bookings..."
  failedBookingDetails.value = []

  const itemsToBook = [...selectedItems.value]
  const successfulBookings: Array<{ name: string; dates: string; price: number }> = []
  const successfulLenders = new Set<string>()
  let totalBookedAmount = 0

  for (const item of itemsToBook) {
    const bookingRange = getBookingRange(item)
    if (!bookingRange) {
      failedBookingDetails.value.push({
        name: item.name,
        reason: "This item is missing a valid date and time range.",
      })
      continue
    }

    const start = createDateTime(bookingRange.startDate, item.startTime)
    const end = createDateTime(bookingRange.endDate, item.endTime)

    if (end <= start) {
      failedBookingDetails.value.push({
        name: item.name,
        reason: "End time must be later than the start time.",
      })
      continue
    }

    try {
      await $fetch("/api/bookings", {
        method: "POST",
        body: {
          itemId: item.id,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
      })
      const itemTotal = calculateItemTotal(item)
      successfulBookings.push({
        name: item.name,
        dates: formatDateRange(item),
        price: itemTotal,
      })
      successfulLenders.add(item.lenderName)
      totalBookedAmount += itemTotal
      removeFromBag(item.id)
      selectedItemIds.value.delete(item.id)
    } catch (err) {
      console.error(`Failed to book item ${item.id}`, err)
      failedBookingDetails.value.push({
        name: item.name,
        reason: resolveBookingErrorMessage(err),
      })
    }
  }

  if (successfulBookings.length > 0) {
    confirmationData.value = {
      items: successfulBookings,
      lenders: Array.from(successfulLenders).join(", "),
      total: totalBookedAmount,
    }
    isConfirmationModalOpen.value = true
    bookingStatusMessage.value =
      failedBookingDetails.value.length > 0
        ? `${failedBookingDetails.value.length} booking request(s) could not be submitted.`
        : ""
  } else {
    bookingStatusMessage.value =
      failedBookingDetails.value.length > 0
        ? `Failed to send ${failedBookingDetails.value.length} booking request(s).`
        : "No booking requests were sent."
  }

  isSubmitting.value = false
}
</script>

<template>
  <div class="min-h-screen bg-white font-geist">
    <Header />

    <main class="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      <div class="mb-10">
        <div
          class="text-noble-black mb-1"
          style="font-size: 30px; font-weight: 800; line-height: 1.2; letter-spacing: -0.02em"
        >
          My Bag
        </div>
        <p class="text-base text-noble-black/40 font-medium tracking-tight">
          Review and manage items you want to book
        </p>
      </div>

      <div v-if="bagItems.length === 0" class="py-20 text-center">
        <div class="mb-6 flex justify-center text-noble-black/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </div>
        <h2 class="text-xl font-bold text-noble-black mb-2">Your bag is empty</h2>
        <p class="text-noble-black/60 mb-8">Items you add to your bag will appear here.</p>
        <NuxtLink
          to="/dashboard"
          class="inline-flex items-center justify-center px-8 py-3 bg-burning-orange text-white rounded-2xl font-bold hover:bg-blue-estate transition-colors"
        >
          Continue Browsing
        </NuxtLink>
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <!-- Left Side: Items -->
        <div
          class="lg:col-span-2 bg-cream rounded-[32px] border border-cinnamon-ice h-fit py-8 overflow-hidden"
        >
          <div class="flex flex-col">
            <!-- Select All Bar -->
            <div class="flex items-center gap-4 pb-6 px-8 border-b border-cinnamon-ice/60">
              <button
                class="w-5 h-5 rounded border flex items-center justify-center transition-colors"
                :class="
                  isAllSelected
                    ? 'bg-burning-orange border-burning-orange'
                    : 'border-cinnamon-ice bg-white'
                "
                @click="toggleSelectAll"
              >
                <svg
                  v-if="isAllSelected"
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
              <span class="text-sm font-bold text-noble-black">Item</span>
            </div>

            <!-- Groups by Lender -->
            <div class="px-8">
              <div
                v-for="(group, lenderId, index) in groupedItems"
                :key="lenderId"
                class="flex flex-col"
              >
                <!-- Divider between lenders -->
                <div v-if="index > 0" class="h-px bg-cinnamon-ice/60 -mx-8 my-4"></div>
                <!-- Lender Header -->
                <div class="flex items-center gap-4 py-4">
                  <button
                    class="w-5 h-5 rounded border flex items-center justify-center transition-colors"
                    :class="
                      isLenderSelected(lenderId)
                        ? 'bg-burning-orange border-burning-orange'
                        : 'border-cinnamon-ice bg-white'
                    "
                    @click="toggleLenderSelect(lenderId)"
                  >
                    <svg
                      v-if="isLenderSelected(lenderId)"
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      stroke-width="3"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                  <UserAvatar
                    :avatar-url="group.lenderAvatarUrl"
                    :user-name="group.lenderName"
                    size="sm"
                  />
                  <span class="text-sm font-bold text-noble-black">{{ group.lenderName }}</span>
                </div>

                <!-- Items -->
                <div class="divide-y divide-cinnamon-ice/40">
                  <div
                    v-for="item in group.items"
                    :key="item.id"
                    class="flex items-center gap-4 py-6 px-4 rounded-3xl border border-transparent hover:bg-white/40 transition-all group"
                  >
                    <button
                      class="w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0"
                      :class="
                        selectedItemIds.has(item.id)
                          ? 'bg-burning-orange border-burning-orange'
                          : 'border-cinnamon-ice bg-white'
                      "
                      @click="toggleItemSelect(item.id)"
                    >
                      <svg
                        v-if="selectedItemIds.has(item.id)"
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        stroke-width="3"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>

                    <div class="w-20 h-20 rounded-xl overflow-hidden bg-cream shrink-0">
                      <img :src="item.image" :alt="item.name" class="w-full h-full object-cover" />
                    </div>

                    <div class="flex-1 min-w-0">
                      <div class="flex flex-col gap-1 mb-1">
                        <span
                          class="w-fit text-[10px] uppercase font-bold tracking-wider px-3 py-0.5 rounded-full"
                          :class="
                            item.listingType === 'Rent'
                              ? 'bg-cinnamon-ice text-noble-black'
                              : 'bg-blue-estate text-white'
                          "
                        >
                          {{ item.listingType }}
                        </span>
                        <h3 class="text-base font-bold text-noble-black truncate">
                          {{ item.name }}
                        </h3>
                      </div>
                      <p class="text-sm text-noble-black/60">{{ calculateDuration(item) }}</p>
                    </div>

                    <div class="flex flex-col items-end gap-2 shrink-0">
                      <button
                        class="p-2 text-blue-estate hover:opacity-80 transition-all"
                        title="Remove from bag"
                        @click="handleDeleteItem(item.id)"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          stroke="none"
                        >
                          <path
                            d="M19 6h-3.5l-1-1h-5l-1 1H5v2h14V6zM6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V8H6v11z"
                          />
                        </svg>
                      </button>
                      <div class="flex flex-col items-end">
                        <span class="text-base font-bold text-noble-black leading-none">{{
                          formatPesoAmount(calculateItemTotal(item))
                        }}</span>
                        <span
                          v-if="item.listingType === 'Rent'"
                          class="text-[11px] text-noble-black/40 mt-1"
                        >
                          ({{ formatPesoAmount(item.price) }} / {{ item.priceUnit }})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Side: Order Summary -->
        <div class="space-y-6">
          <div class="bg-cream border border-cinnamon-ice rounded-3xl p-8 shadow-sm">
            <h2 class="text-xl font-bold text-noble-black mb-6">Order Summary</h2>

            <div class="space-y-4 mb-8">
              <div class="flex justify-between items-center text-sm">
                <span class="text-noble-black/60">{{ selectedItemIds.size }} items selected</span>
                <span class="font-bold text-noble-black">{{ formatPesoAmount(totalAmount) }}</span>
              </div>
            </div>

            <div class="space-y-3">
              <button
                class="w-full py-3 bg-burning-orange text-white rounded-2xl font-bold text-base transition-all hover:bg-blue-estate disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-burning-orange/10"
                :disabled="selectedItemIds.size === 0 || isSubmitting"
                @click="handleRequestBooking"
              >
                <span
                  v-if="isSubmitting"
                  class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
                ></span>
                {{ isSubmitting ? "Requesting..." : "Request Booking" }}
              </button>

              <NuxtLink
                to="/dashboard"
                class="w-full py-3 bg-white border border-noble-black/10 text-noble-black rounded-2xl font-bold text-base transition-all hover:bg-cream flex items-center justify-center"
              >
                Continue Browsing
              </NuxtLink>
            </div>

            <p
              v-if="bookingStatusMessage"
              class="mt-4 text-center text-xs font-bold"
              :class="
                bookingStatusMessage.includes('failed')
                  ? 'text-cinnabar-red'
                  : 'text-burning-orange'
              "
            >
              {{ bookingStatusMessage }}
            </p>

            <div
              v-if="failedBookingDetails.length > 0"
              class="mt-4 rounded-2xl border border-cinnabar-red/20 bg-cinnabar-red/5 p-4"
            >
              <div class="mb-3 text-xs font-bold uppercase tracking-wide text-cinnabar-red">
                Booking Issues
              </div>
              <div class="space-y-3">
                <div
                  v-for="failedItem in failedBookingDetails"
                  :key="`${failedItem.name}-${failedItem.reason}`"
                  class="text-left"
                >
                  <div class="text-sm font-bold text-noble-black">{{ failedItem.name }}</div>
                  <div class="text-xs leading-relaxed text-noble-black/60">
                    {{ failedItem.reason }}
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-8 pt-6 border-t border-cinnamon-ice/30">
              <div class="flex items-center gap-2 text-noble-black/40 justify-center">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span class="text-[11px] font-medium">Protected by TakeUP Guarantee</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Booking Confirmation Modal -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isConfirmationModalOpen"
        class="fixed inset-0 z-[2000] flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-noble-black/40 backdrop-blur-sm"
          @click="isConfirmationModalOpen = false"
        ></div>

        <div
          class="relative w-full max-w-lg bg-white rounded-[40px] p-10 shadow-2xl border border-cinnamon-ice/30"
        >
          <div class="text-center mb-10">
            <div class="mb-6 flex justify-center">
              <div
                class="w-20 h-20 bg-burning-orange/10 rounded-full flex items-center justify-center text-burning-orange"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
            </div>
            <h2 class="text-4xl font-extrabold text-noble-black mb-3 tracking-tight">
              Booking Request Sent!
            </h2>
            <p class="text-lg text-noble-black/60 leading-relaxed">
              Waiting for
              <span class="text-noble-black font-bold">{{ confirmationData.lenders }}</span> to
              confirm your request.
            </p>
          </div>

          <div
            class="bg-cream rounded-3xl p-6 mb-8 max-h-60 overflow-y-auto border border-cinnamon-ice/20"
          >
            <div class="space-y-4">
              <div
                v-for="(item, idx) in confirmationData.items"
                :key="idx"
                class="flex justify-between items-start border-b border-cinnamon-ice/20 pb-4 last:border-0 last:pb-0"
              >
                <div class="flex flex-col gap-1 pr-4">
                  <span class="font-bold text-noble-black leading-tight">{{ item.name }}</span>
                  <span class="text-xs text-noble-black/50 font-medium">{{ item.dates }}</span>
                </div>
                <span class="font-bold text-noble-black text-sm shrink-0">{{
                  formatPesoAmount(item.price)
                }}</span>
              </div>
            </div>
          </div>

          <div class="flex justify-between items-center mb-10 px-2">
            <span class="text-lg font-bold text-noble-black/60">Total</span>
            <span class="text-2xl font-black text-noble-black">{{
              formatPesoAmount(confirmationData.total)
            }}</span>
          </div>

          <button
            class="w-full py-4 bg-burning-orange text-white rounded-2xl font-bold text-lg hover:bg-blue-estate transition-all duration-300 shadow-xl shadow-burning-orange/20 active:scale-95"
            @click="isConfirmationModalOpen = false"
          >
            Got It
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped></style>
