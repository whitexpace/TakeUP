<script setup lang="ts">
import { computed, ref } from "vue"
import { useBag, type BagItem } from "../../composables/use-bag"
import UserAvatar from "../../components/UserAvatar.vue"
import Header from "../../components/Header.vue"

definePageMeta({
  auth: true,
})

const { bagItems, isLoading, removeFromBag } = useBag()

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

const handleRemoveSelected = () => {
  selectedItemIds.value.forEach((id) => {
    removeFromBag(id)
  })
  selectedItemIds.value.clear()
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
          itemId: item.itemId,
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

    <main class="max-w-7xl mx-auto px-4 sm:px-6 py-12 pt-24">
      <div class="mb-10">
        <div class="space-y-2">
          <h1 class="font-montravia text-[36px] font-medium text-noble-black leading-tight">
            My Bag
          </h1>
          <div class="h-[2px] w-10 bg-burning-orange rounded-full"></div>
        </div>
        <p class="mt-2 font-geist text-[16px] font-light text-noble-black/50">
          Review and manage items you want to book
        </p>
      </div>

      <div
        v-if="isLoading && bagItems.length === 0"
        class="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-pulse"
      >
        <div class="lg:col-span-2 space-y-6">
          <div class="h-14 w-full bg-noble-black/5 rounded-[16px]"></div>
          <div
            v-for="i in 2"
            :key="i"
            class="bg-white rounded-[16px] border border-gray-100 overflow-hidden"
          >
            <div
              class="h-12 w-full bg-gray-50/50 border-b border-gray-100 p-8 flex items-center gap-4"
            >
              <div class="h-4 w-4 bg-noble-black/10 rounded"></div>
              <div class="h-7 w-7 rounded-full bg-noble-black/10"></div>
              <div class="h-4 w-32 bg-noble-black/20 rounded"></div>
            </div>
            <div
              v-for="j in 2"
              :key="j"
              class="p-8 flex items-center gap-6 border-b border-gray-50 last:border-0"
            >
              <div class="h-5 w-5 bg-noble-black/10 rounded"></div>
              <div class="h-[72px] w-[72px] bg-noble-black/10 rounded-[12px]"></div>
              <div class="flex-1 space-y-2">
                <div class="h-4 w-1/2 bg-noble-black/20 rounded"></div>
                <div class="h-3 w-1/3 bg-noble-black/10 rounded"></div>
              </div>
              <div class="h-6 w-20 bg-noble-black/20 rounded"></div>
            </div>
          </div>
        </div>
        <div class="h-80 w-full bg-noble-black/5 rounded-[16px]"></div>
      </div>

      <div v-else-if="bagItems.length === 0" class="py-20 text-center">
        <div class="mb-6 flex justify-center text-noble-black/10">
          <Icon name="ph:shopping-bag" class="w-20 h-20" />
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

      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Left Side: Items -->
        <div
          class="lg:col-span-2 bg-white rounded-[16px] border border-gray-100 h-fit shadow-sm overflow-hidden"
        >
          <div class="flex flex-col">
            <!-- Select All Bar -->
            <div
              class="flex items-center justify-between py-4 px-8 border-b border-gray-100 bg-white"
            >
              <div class="flex items-center gap-3">
                <button
                  class="w-5 h-5 rounded-[6px] border flex items-center justify-center transition-all"
                  :class="
                    isAllSelected
                      ? 'bg-burning-orange border-burning-orange shadow-sm'
                      : 'border-gray-300 bg-white hover:border-burning-orange'
                  "
                  @click="toggleSelectAll"
                >
                  <Icon v-if="isAllSelected" name="ph:check" class="w-3 h-3 text-white" />
                </button>
                <span class="text-[13px] font-medium text-gray-500 tracking-tight">Select All</span>
              </div>
              <button
                v-if="selectedItemIds.size > 0"
                class="text-[12px] font-semibold text-cinnabar-red hover:underline"
                @click="handleRemoveSelected"
              >
                Remove Selected
              </button>
            </div>

            <!-- Groups by Lender -->
            <div class="flex flex-col">
              <div v-for="(group, lenderId) in groupedItems" :key="lenderId" class="flex flex-col">
                <!-- Lender Header -->
                <div
                  class="flex items-center gap-4 py-3 px-8 border-b border-gray-100 bg-gray-50/50"
                >
                  <button
                    class="w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all"
                    :class="
                      isLenderSelected(lenderId)
                        ? 'bg-burning-orange border-burning-orange'
                        : 'border-gray-300 bg-white hover:border-burning-orange'
                    "
                    @click="toggleLenderSelect(lenderId)"
                  >
                    <Icon
                      v-if="isLenderSelected(lenderId)"
                      name="ph:check"
                      class="w-2.5 h-2.5 text-white"
                    />
                  </button>
                  <div class="flex items-center gap-3">
                    <UserAvatar
                      :avatar-url="group.lenderAvatarUrl"
                      :user-name="group.lenderName"
                      size="sm"
                      class="!w-[28px] !h-[28px] border border-gray-100"
                    />
                    <div class="flex items-baseline gap-2">
                      <span class="text-[13px] font-semibold text-noble-black leading-tight">{{
                        group.lenderName
                      }}</span>
                      <span class="text-[12px] text-gray-400"
                        >@{{ group.lenderName.toLowerCase().replace(/\s+/g, "") }}</span
                      >
                    </div>
                  </div>
                </div>

                <!-- Items -->
                <div class="flex flex-col">
                  <div
                    v-for="item in group.items"
                    :key="item.id"
                    class="flex items-center gap-6 py-6 px-8 border-b border-gray-50 last:border-b-0 hover:bg-gray-50/30 transition-all group"
                  >
                    <button
                      class="w-5 h-5 rounded-[6px] border flex items-center justify-center transition-all shrink-0"
                      :class="
                        selectedItemIds.has(item.id)
                          ? 'bg-burning-orange border-burning-orange'
                          : 'border-gray-300 bg-white hover:border-burning-orange'
                      "
                      @click="toggleItemSelect(item.id)"
                    >
                      <Icon
                        v-if="selectedItemIds.has(item.id)"
                        name="ph:check"
                        class="w-3 h-3 text-white"
                      />
                    </button>

                    <div
                      class="w-[72px] h-[72px] rounded-[12px] overflow-hidden bg-gray-50 shrink-0 border border-gray-100"
                    >
                      <img :src="item.image" :alt="item.name" class="w-full h-full object-cover" />
                    </div>

                    <div class="flex-1 min-w-0">
                      <div class="flex flex-col gap-1.5">
                        <h3 class="text-[15px] font-semibold text-noble-black truncate">
                          {{ item.name }}
                        </h3>
                        <div class="flex items-center gap-2">
                          <span
                            class="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-[6px] uppercase"
                            :class="
                              item.listingType === 'Rent'
                                ? 'bg-blue-estate text-white'
                                : 'bg-gray-100 text-gray-600'
                            "
                          >
                            {{ item.listingType }}
                          </span>
                          <span class="text-[13px] text-gray-400 font-medium">
                            {{ calculateDuration(item) }} · {{ formatDateRange(item) }}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center gap-6 shrink-0">
                      <div class="flex flex-col items-end">
                        <span class="text-[16px] font-bold text-burning-orange leading-none">{{
                          formatPesoAmount(calculateItemTotal(item))
                        }}</span>
                        <span
                          v-if="item.listingType === 'Rent'"
                          class="text-[12px] text-gray-400 mt-1"
                        >
                          {{ formatPesoAmount(item.price) }}/{{ item.priceUnit }}
                        </span>
                      </div>
                      <button
                        class="p-2 text-gray-300 hover:text-cinnabar-red transition-all"
                        title="Remove from bag"
                        @click="handleDeleteItem(item.id)"
                      >
                        <Icon name="ph:trash" class="w-[18px] h-[18px]" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Side: Order Summary -->
        <div class="space-y-6">
          <div class="bg-white border border-gray-100 rounded-[16px] p-6 shadow-sm">
            <h2 class="text-[17px] font-semibold text-noble-black mb-6">Order Summary</h2>

            <div class="space-y-4 mb-6">
              <div class="flex justify-between items-center">
                <span class="text-[13px] text-gray-500"
                  >{{ selectedItemIds.size }} items selected</span
                >
                <span class="text-[14px] font-semibold text-noble-black">{{
                  formatPesoAmount(totalAmount)
                }}</span>
              </div>
            </div>

            <div class="border-t border-dashed border-gray-200 pt-5 mb-6">
              <div class="flex justify-between items-center">
                <span class="text-[15px] font-bold text-noble-black">Total</span>
                <span class="text-[18px] font-bold text-burning-orange">{{
                  formatPesoAmount(totalAmount)
                }}</span>
              </div>
            </div>

            <div class="space-y-3">
              <button
                class="w-full py-3.5 bg-burning-orange text-white rounded-[10px] font-bold text-[15px] transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(255,113,36,0.3)]"
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
                class="w-full py-3.5 bg-white border-[1.5px] border-burning-orange text-burning-orange rounded-[10px] font-bold text-[15px] transition-all hover:bg-burning-orange/5 flex items-center justify-center"
              >
                Continue Browsing
              </NuxtLink>
            </div>

            <p
              v-if="bookingStatusMessage"
              class="mt-4 text-center text-[12px] font-semibold"
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
              class="mt-4 rounded-[12px] border border-cinnabar-red/10 bg-cinnabar-red/5 p-4"
            >
              <div class="mb-2 text-[11px] font-bold uppercase tracking-wider text-cinnabar-red">
                Booking Issues
              </div>
              <div class="space-y-2">
                <div
                  v-for="failedItem in failedBookingDetails"
                  :key="`${failedItem.name}-${failedItem.reason}`"
                  class="text-left"
                >
                  <div class="text-[13px] font-semibold text-noble-black">
                    {{ failedItem.name }}
                  </div>
                  <div class="text-[12px] leading-tight text-gray-500">
                    {{ failedItem.reason }}
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-8">
              <div
                class="flex items-center gap-2 px-4 py-2 bg-blue-estate/5 border border-blue-estate/10 rounded-full justify-center"
              >
                <Icon name="ph:shield" class="w-3.5 h-3.5 text-blue-estate" />
                <span class="text-[12px] font-semibold text-blue-estate"
                  >Protected by TakeUP Secure</span
                >
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
                <Icon name="ph:check-circle" class="w-10 h-10" />
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
