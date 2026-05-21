<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue"
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
    {
      lenderName: string
      lenderUsername: string
      lenderAvatarUrl?: string | null
      items: BagItem[]
    }
  > = {}
  bagItems.value.forEach((item) => {
    if (!groups[item.lenderId]) {
      groups[item.lenderId] = {
        lenderName: item.lenderName,
        lenderUsername: item.lenderUsername,
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
const failedBookingDetails = ref<Array<{ name: string; reason: string }>>([])

// Booking Queue State
const lenderQueue = ref<Array<{ lenderId: string; lenderName: string; items: BagItem[] }>>([])
const currentLenderIndex = ref(-1)
const showPaymentModal = ref(false)

const currentLender = computed(() => {
  if (currentLenderIndex.value === -1) return null
  return lenderQueue.value[currentLenderIndex.value] || null
})

const currentLenderTotal = computed(() => {
  if (!currentLender.value) return 0
  return currentLender.value.items.reduce((sum, item) => sum + calculateItemTotal(item), 0)
})

// Confirmation Modal State (Final Success)
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

// Scroll to hide logic for bottom checkout bar
const isBottomBarVisible = ref(true)
const lastScrollY = ref(0)
const scrollThreshold = 10

const handleScroll = () => {
  const currentScrollY = window.scrollY

  // Always show at the very top
  if (currentScrollY < 50) {
    isBottomBarVisible.value = true
    lastScrollY.value = currentScrollY
    return
  }

  if (Math.abs(currentScrollY - lastScrollY.value) < scrollThreshold) return

  if (currentScrollY > lastScrollY.value) {
    isBottomBarVisible.value = false // Scrolling down
  } else {
    isBottomBarVisible.value = true // Scrolling up
  }

  lastScrollY.value = currentScrollY
}

onMounted(() => {
  window.addEventListener("scroll", handleScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll)
})

const formatDate = (value: Date | null | string) => {
  if (!value) return ""
  const d = typeof value === "string" ? new Date(value) : value
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const formatDateRange = (item: BagItem) => {
  const bookingRange = getBookingRange(item)
  if (!bookingRange) return ""

  const start = formatDate(bookingRange.startDate)
  const end = formatDate(bookingRange.endDate)
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

  // Group selected items by lender
  const groups: Record<string, { lenderId: string; lenderName: string; items: BagItem[] }> = {}
  selectedItems.value.forEach((item) => {
    if (!groups[item.lenderId]) {
      groups[item.lenderId] = {
        lenderId: item.lenderId,
        lenderName: item.lenderName,
        items: [],
      }
    }
    groups[item.lenderId]!.items.push(item)
  })

  lenderQueue.value = Object.values(groups)
  currentLenderIndex.value = 0
  failedBookingDetails.value = []

  // Clear any final confirmation data from previous runs
  confirmationData.value = {
    items: [],
    lenders: "",
    total: 0,
  }

  startLenderProcess()
}

const startLenderProcess = () => {
  if (!currentLender.value) {
    // End of queue
    if (confirmationData.value.items.length > 0) {
      isConfirmationModalOpen.value = true
    }

    isSubmitting.value = false
    lenderQueue.value = []
    currentLenderIndex.value = -1
    return
  }

  // Check if any item in this group is not free
  const hasPaidItems = currentLender.value.items.some(
    (item) => item.listingType === "Rent" && item.price > 0,
  )

  if (hasPaidItems) {
    showPaymentModal.value = true
  } else {
    performLenderBookings()
  }
}

const handlePaymentSuccess = async () => {
  showPaymentModal.value = false
  await performLenderBookings()
}

const performLenderBookings = async () => {
  if (!currentLender.value) return

  isSubmitting.value = true
  const itemsToBook = [...currentLender.value.items]
  const successfulLenders = new Set<string>(
    confirmationData.value.lenders ? confirmationData.value.lenders.split(", ") : [],
  )

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
      const isFree = item.listingType === "Borrow" || item.price === 0
      await $fetch("/api/bookings", {
        method: "POST",
        body: {
          itemId: item.itemId,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          paymentMethod: isFree ? "CASH" : "WALLET",
        },
      })

      const itemTotal = calculateItemTotal(item)
      confirmationData.value.items.push({
        name: item.name,
        dates: formatDateRange(item),
        price: itemTotal,
      })
      successfulLenders.add(item.lenderName)
      confirmationData.value.total += itemTotal

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

  confirmationData.value.lenders = Array.from(successfulLenders).join(", ")

  // Move to next lender
  currentLenderIndex.value++
  startLenderProcess()
}
</script>

<template>
  <div class="min-h-screen bg-white font-geist">
    <Header />

    <main class="max-w-7xl mx-auto px-4 sm:px-6 py-12 pt-24 pb-32 lg:pb-12">
      <div class="mb-8 md:mb-10">
        <div class="space-y-2">
          <h1
            class="font-geist text-[28px] sm:text-[36px] font-medium text-noble-black leading-tight tracking-tight"
          >
            My Bag
          </h1>
          <div class="h-[2px] w-10 bg-burning-orange rounded-full"></div>
        </div>
        <p class="mt-2 font-geist text-[14px] sm:text-[16px] font-light text-noble-black/50">
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
              class="flex items-center justify-between py-4 px-4 sm:px-8 border-b border-gray-100 bg-white"
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

            <!-- Groups by Lender (Scrollable Container) -->
            <div class="flex flex-col max-h-[580px] overflow-y-auto">
              <div v-for="(group, lenderId) in groupedItems" :key="lenderId" class="flex flex-col">
                <!-- Lender Header -->
                <div
                  class="flex items-center gap-4 py-3 px-4 sm:px-8 border-b border-gray-100 bg-gray-50/50"
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
                  <NuxtLink
                    :to="`/profile/${group.lenderUsername}`"
                    class="flex items-center gap-3 transition-opacity hover:opacity-80"
                  >
                    <UserAvatar
                      :avatar-url="group.lenderAvatarUrl"
                      :user-name="group.lenderName"
                      size="sm"
                      class="!w-[28px] !h-[28px] border border-gray-100"
                    />
                    <div class="flex items-baseline gap-1.5 min-w-0">
                      <span class="text-[13px] font-bold text-noble-black leading-tight truncate">
                        {{ group.lenderName }}
                      </span>
                      <span class="text-[12px] text-gray-400">@{{ group.lenderUsername }}</span>
                    </div>
                  </NuxtLink>
                </div>

                <!-- Items -->
                <div class="flex flex-col">
                  <div
                    v-for="item in group.items"
                    :key="item.id"
                    class="flex items-start sm:items-center gap-3 xs:gap-4 sm:gap-6 py-4 xs:py-6 px-4 sm:px-8 border-b border-gray-50 last:border-0 hover:bg-gray-50/30 transition-all group"
                  >
                    <!-- Checkbox -->
                    <button
                      class="w-5 h-5 rounded-[6px] border flex items-center justify-center transition-all shrink-0 mt-2 sm:mt-0"
                      :class="
                        selectedItemIds.has(item.id)
                          ? 'bg-burning-orange border-burning-orange shadow-sm'
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

                    <!-- Image -->
                    <NuxtLink
                      :to="`/items/${item.itemId}`"
                      class="w-16 h-16 xs:w-[72px] xs:h-[72px] rounded-[10px] xs:rounded-[12px] overflow-hidden bg-gray-50 shrink-0 border border-gray-100 transition-opacity hover:opacity-80"
                    >
                      <img :src="item.image" :alt="item.name" class="w-full h-full object-cover" />
                    </NuxtLink>

                    <!-- Content -->
                    <div class="flex-1 min-w-0">
                      <div class="flex flex-col gap-1 xs:gap-1.5">
                        <NuxtLink :to="`/items/${item.itemId}`" class="group/name">
                          <h3
                            class="text-[14px] xs:text-[15px] font-semibold text-noble-black truncate transition-colors group-hover/name:text-burning-orange"
                          >
                            {{ item.name }}
                          </h3>
                        </NuxtLink>
                        <div class="flex flex-col xs:flex-row xs:items-center gap-1 xs:gap-2">
                          <span
                            class="w-fit text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-[5px] uppercase"
                            :class="
                              item.listingType === 'Rent'
                                ? 'bg-cinnamon-ice text-black'
                                : 'bg-blue-estate text-white'
                            "
                          >
                            {{ item.listingType }}
                          </span>
                          <span
                            class="text-[11px] xs:text-[12px] sm:text-[13px] text-gray-400 font-medium truncate"
                          >
                            {{ calculateDuration(item) }} · {{ formatDateRange(item) }}
                          </span>
                        </div>

                        <!-- Price (Mobile only) -->
                        <div class="flex items-center justify-between mt-1 sm:hidden">
                          <div class="flex items-baseline gap-1">
                            <span class="text-[15px] font-bold text-burning-orange">{{
                              formatPesoAmount(calculateItemTotal(item))
                            }}</span>
                            <span
                              v-if="item.listingType === 'Rent'"
                              class="text-[10px] text-gray-400"
                            >
                              ({{ formatPesoAmount(item.price) }}/{{ item.priceUnit }})
                            </span>
                          </div>
                          <button
                            class="p-1 text-gray-300 hover:text-cinnabar-red transition-all"
                            title="Remove from bag"
                            @click="handleDeleteItem(item.id)"
                          >
                            <Icon name="ph:trash" class="w-[18px] h-[18px]" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <!-- Price & Actions (Desktop only) -->
                    <div class="hidden sm:flex items-center gap-6 shrink-0">
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

        <!-- Right Side: Order Summary (Hidden on mobile) -->
        <div class="hidden lg:block space-y-6">
          <div class="bg-white border border-gray-100 rounded-[16px] p-6 shadow-sm sticky top-24">
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
                {{ isSubmitting ? "Requesting..." : "Checkout" }}
              </button>

              <NuxtLink
                to="/dashboard"
                class="w-full py-3.5 bg-white border-[1.5px] border-burning-orange text-burning-orange rounded-[10px] font-bold text-[15px] transition-all hover:bg-burning-orange/5 flex items-center justify-center"
              >
                Continue Browsing
              </NuxtLink>
            </div>

            <div
              v-if="failedBookingDetails.length > 0"
              class="mt-6 rounded-[12px] border border-cinnabar-red/10 bg-cinnabar-red/5 p-4"
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
          </div>
        </div>
      </div>
    </main>

    <!-- Mobile Bottom Checkout Bar (Fixed) -->
    <div
      v-if="bagItems.length > 0"
      class="lg:hidden fixed bottom-16 left-0 w-full bg-white border-t border-gray-100 z-[1000] px-4 py-3 flex items-center justify-between shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-safe transition-transform duration-300 ease-in-out"
      :class="!isBottomBarVisible ? 'translate-y-full' : 'translate-y-0'"
    >
      <div class="flex items-center gap-3">
        <button
          class="w-5 h-5 rounded-[6px] border flex items-center justify-center transition-all shrink-0"
          :class="
            isAllSelected
              ? 'bg-burning-orange border-burning-orange shadow-sm'
              : 'border-gray-300 bg-white'
          "
          @click="toggleSelectAll"
        >
          <Icon v-if="isAllSelected" name="ph:check" class="w-3 h-3 text-white" />
        </button>
        <span class="text-[12px] font-bold text-noble-black uppercase tracking-wider">All</span>
      </div>

      <div class="flex items-center gap-4">
        <div class="flex flex-col items-end">
          <div class="flex items-baseline gap-1">
            <span class="text-[12px] text-gray-400 font-medium">Total:</span>
            <span class="text-[17px] font-black text-burning-orange">{{
              formatPesoAmount(totalAmount)
            }}</span>
          </div>
          <span class="text-[10px] text-gray-400 leading-none"
            >{{ selectedItemIds.size }} items selected</span
          >
        </div>
        <button
          class="h-11 px-8 bg-burning-orange text-white rounded-full font-bold text-[14px] shadow-lg shadow-burning-orange/20 active:scale-95 transition-all disabled:opacity-50"
          :disabled="selectedItemIds.size === 0 || isSubmitting"
          @click="handleRequestBooking"
        >
          {{ isSubmitting ? "..." : "Checkout" }}
        </button>
      </div>
    </div>

    <!-- Payment Modal (Wallet) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showPaymentModal && currentLender"
          class="fixed inset-0 z-[3000] flex items-center justify-center p-4 font-geist"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm"
            @click="showPaymentModal = false"
          ></div>

          <!-- Modal Content -->
          <div
            class="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-[20px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.15)] overflow-hidden animate-in zoom-in-95 duration-300"
          >
            <!-- Header -->
            <div class="px-6 pt-8 pb-4 flex items-start justify-between gap-4 shrink-0">
              <div>
                <h2 class="text-[24px] font-semibold text-noble-black">Complete Booking Request</h2>
                <p class="mt-1 text-[13px] font-light text-noble-black/50">
                  Requesting from
                  <span class="font-bold text-noble-black">{{ currentLender.lenderName }}</span
                  >. Funds will be held securely until the rental is complete.
                </p>
              </div>
              <button
                type="button"
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-noble-black transition hover:bg-gray-100"
                @click="showPaymentModal = false"
              >
                <Icon name="ph:x" class="w-[18px] h-[18px]" />
              </button>
            </div>

            <!-- Scrollable Content -->
            <div class="flex-1 overflow-y-auto custom-modal-scrollbar px-6">
              <div class="py-6 space-y-8">
                <!-- Multiple Items Summary -->
                <div class="space-y-4">
                  <div
                    v-for="item in currentLender.items"
                    :key="item.id"
                    class="flex items-center gap-4"
                  >
                    <img
                      v-if="item.image"
                      :src="item.image"
                      class="w-16 h-16 rounded-xl object-cover border border-cinnamon-ice/10 shadow-sm"
                    />
                    <div
                      v-else
                      class="w-16 h-16 rounded-xl bg-noble-black/5 flex items-center justify-center text-noble-black/20"
                    >
                      <Icon name="ph:package" size="24" />
                    </div>
                    <div class="flex flex-col">
                      <p class="font-bold text-noble-black text-[15px] leading-tight">
                        {{ item.name }}
                      </p>
                      <div class="flex items-center gap-2 mt-1.5 text-[12px] text-noble-black/40">
                        <Icon name="ph:calendar-blank" size="14" />
                        <span>
                          {{ formatDateRange(item) }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Payment Component -->
                <WalletPayment
                  variant="minimal"
                  :amount="currentLenderTotal"
                  related-entity-type="BOOKING_PENDING"
                  :related-entity-id="currentLender.items[0]?.itemId || 'pending'"
                  @success="handlePaymentSuccess"
                  @cancel="showPaymentModal = false"
                />
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Final Booking Confirmation Modal -->
    <Teleport to="body">
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
          class="fixed inset-0 z-[4000] flex items-center justify-center p-4 font-geist"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm"
            @click="isConfirmationModalOpen = false"
          ></div>

          <!-- Modal Content -->
          <div
            class="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-[20px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.15)] overflow-hidden animate-in zoom-in-95 duration-300"
          >
            <!-- Header -->
            <div class="px-6 pt-8 pb-4 flex items-start justify-between gap-4 shrink-0">
              <div>
                <h2 class="text-[24px] font-semibold text-noble-black">Booking Request Sent!</h2>
                <p class="mt-1 text-[13px] font-light text-noble-black/50">
                  Waiting for
                  <span class="font-bold text-noble-black">{{ confirmationData.lenders }}</span> to
                  confirm.
                </p>
              </div>
              <button
                type="button"
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-noble-black transition hover:bg-gray-100"
                @click="isConfirmationModalOpen = false"
              >
                <Icon name="ph:x" class="w-[18px] h-[18px]" />
              </button>
            </div>

            <!-- Scrollable Content -->
            <div class="flex-1 overflow-y-auto custom-modal-scrollbar px-6">
              <div class="py-6 space-y-6">
                <!-- Items Summary -->
                <div
                  class="bg-noble-black/[0.02] border border-cinnamon-ice/10 rounded-2xl overflow-hidden"
                >
                  <div class="divide-y divide-cinnamon-ice/10">
                    <div
                      v-for="(item, idx) in confirmationData.items"
                      :key="idx"
                      class="flex justify-between items-center p-4"
                    >
                      <div class="flex flex-col gap-0.5">
                        <span class="text-[14px] font-bold text-noble-black">{{ item.name }}</span>
                        <span class="text-[12px] text-noble-black/40 font-medium">{{
                          item.dates
                        }}</span>
                      </div>
                      <span class="text-[14px] font-bold text-noble-black">{{
                        formatPesoAmount(item.price)
                      }}</span>
                    </div>
                  </div>
                </div>

                <!-- Total Summary -->
                <div class="flex justify-between items-center px-1">
                  <span class="text-[15px] font-bold text-noble-black/50">Total Amount</span>
                  <div class="flex flex-col items-end">
                    <span class="text-[24px] font-black text-noble-black leading-none">{{
                      formatPesoAmount(confirmationData.total)
                    }}</span>
                    <span class="mt-1 text-[11px] font-medium text-noble-black/30"
                      >Payment held securely</span
                    >
                  </div>
                </div>

                <!-- Action Button -->
                <div class="pt-4 pb-2">
                  <button
                    class="w-full py-4 bg-gradient-to-br from-burning-orange to-orange-500 text-white rounded-[16px] font-bold text-[16px] transition-all duration-300 shadow-lg shadow-burning-orange/25 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 active:scale-[0.98]"
                    @click="isConfirmationModalOpen = false"
                  >
                    Got It
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped></style>
