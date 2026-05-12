<script setup lang="ts">
import type { inferRouterOutputs } from "@trpc/server"
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import { useBag } from "../../composables/use-bag"
import { useLikes } from "../../composables/use-likes"
import { buildItemDetailPath, extractItemIdFromSlug } from "../../utils/item-detail-route"
import type { AppRouter } from "../../../server/trpc/routers"

definePageMeta({
  auth: false,
})

const route = useRoute()

type RouterOutputs = inferRouterOutputs<AppRouter>
type ItemDetail = RouterOutputs["item"]["byId"]

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const daysOfWeek = ["S", "M", "T", "W", "T", "F", "S"]

const slugParam = computed(() => {
  const slug = route.params.slug
  return Array.isArray(slug) ? (slug[0] ?? "") : (slug ?? "")
})

const itemId = computed(() => extractItemIdFromSlug(slugParam.value))
const fromPage = computed(() => {
  const from = route.query.from
  return typeof from === "string" ? from : null
})

const adminUserId = computed(() => {
  const id = route.query.adminUserId
  return typeof id === "string" ? id : null
})

const backNavigationPath = computed(() => {
  if (fromPage.value === "admin-user-listings" && adminUserId.value) {
    return {
      path: `/admin/users/${adminUserId.value}`,
      query: { tab: "listings" },
    }
  }

  if (fromPage.value === "likes") {
    return "/likes"
  }

  return "/dashboard"
})

const backNavigationLabel = computed(() => {
  if (fromPage.value === "admin-user-listings") {
    return "Back to admin user listings"
  }

  if (fromPage.value === "likes") {
    return "Back to liked items"
  }

  return "Back to listings"
})

const {
  data,
  pending,
  error,
  refresh: refreshItem,
} = useAsyncData(
  () => `item:${itemId.value ?? "missing"}`,
  async () => {
    if (!itemId.value) {
      throw createError({
        statusCode: 404,
        statusMessage: "Item not found",
      })
    }

    return await $fetch<ItemDetail>(`/api/items/${itemId.value}`)
  },
  {
    watch: [itemId],
    lazy: true,
    default: () => null,
  },
)

const item = computed(() => data.value)
const itemLoadErrorMessage = computed(
  () => error.value?.statusMessage ?? error.value?.message ?? "Unable to load item details.",
)

const currentDate = new Date()
const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
const currentTimeMinutes = currentDate.getHours() * 60 + currentDate.getMinutes()

const currentImageIndex = ref(0)
const scrollContainer = ref<HTMLElement | null>(null)
const isAtStart = ref(true)
const isAtEnd = ref(false)
const isLightboxOpen = ref(false)
const isMobileModalOpen = ref(false)
const isCalendarExpanded = ref(false)
const isSaved = ref(false)
const shareFeedback = ref("")
const isSubmittingBooking = ref(false)
const showPaymentModal = ref(false)
const bookingErrorMessage = ref("")
const bookingSuccessMessage = ref("")
const hasRequestedBooking = ref(false)

const viewMonth = ref(today.getMonth())
const viewYear = ref(today.getFullYear())
const startDate = ref<Date | null>(null)
const endDate = ref<Date | null>(null)
const hoverDate = ref<Date | null>(null)
const mouseIsDown = ref(false)
const isDragging = ref(false)
const tempDragStart = ref<Date | null>(null)

const startTime = ref("09:00 AM")
const endTime = ref("06:00 PM")
const isStartTimeOpen = ref(false)
const isEndTimeOpen = ref(false)

const normalizeDate = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate())

const timeOptions = (() => {
  const options: string[] = []

  for (let hour = 5; hour <= 23; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      if (hour === 23 && minute > 30) continue

      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
      const period = hour >= 12 ? "PM" : "AM"
      options.push(
        `${displayHour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")} ${period}`,
      )
    }
  }

  return options
})()

const formatPhpAmount = (value: number) =>
  new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(value)

const formatPesoAmount = (value: number) => `₱${formatPhpAmount(value)}`

const formatDate = (value: Date | null) => {
  if (!value) return ""

  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const humanizeEnum = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")

const splitDetailList = (value?: string | null) =>
  (value ?? "")
    .split(/\r?\n|•|·/)
    .map((entry) => entry.replace(/^[\s\-*•·]+/, "").trim())
    .filter(Boolean)

const imageGallery = computed(() => {
  if (!item.value) return []

  const imagesFromRelation = item.value.images.map((image) => image.path)
  const images = imagesFromRelation.length ? [...imagesFromRelation] : [...item.value.photos]
  if (item.value.thumbnailImage && !images.includes(item.value.thumbnailImage)) {
    images.unshift(item.value.thumbnailImage)
  }

  return images
})

const currentImage = computed(() => imageGallery.value[currentImageIndex.value] ?? null)

const updateScrollStatus = () => {
  if (!scrollContainer.value) return

  isAtStart.value = scrollContainer.value.scrollLeft <= 1
  isAtEnd.value =
    scrollContainer.value.scrollLeft + scrollContainer.value.clientWidth >=
    scrollContainer.value.scrollWidth - 1
}

const handleScroll = () => updateScrollStatus()

const scrollOnce = (direction: "left" | "right") => {
  if (!scrollContainer.value) return

  scrollContainer.value.scrollBy({
    left: direction === "left" ? -260 : 260,
    behavior: "smooth",
  })
}

const nextImage = () => {
  if (!imageGallery.value.length) return
  currentImageIndex.value = (currentImageIndex.value + 1) % imageGallery.value.length
}

const prevImage = () => {
  if (!imageGallery.value.length) return
  currentImageIndex.value =
    (currentImageIndex.value - 1 + imageGallery.value.length) % imageGallery.value.length
}

const maskStyle = computed(() => {
  if (isAtStart.value && isAtEnd.value) return {}
  if (isAtStart.value)
    return { maskImage: "linear-gradient(to right, black 84%, transparent 100%)" }
  if (isAtEnd.value) return { maskImage: "linear-gradient(to left, black 84%, transparent 100%)" }

  return {
    maskImage: "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
  }
})

watch(
  imageGallery,
  async (images) => {
    if (currentImageIndex.value >= images.length) {
      currentImageIndex.value = 0
    }

    await nextTick()
    updateScrollStatus()
  },
  { immediate: true },
)

watch(currentImageIndex, async () => {
  await nextTick()
  updateScrollStatus()
})

const priceAmount = computed(() => {
  if (!item.value) return ""
  if (item.value.freeToBorrow) return "Free"
  return formatPesoAmount(item.value.rentalFee)
})

const priceUnitLabel = computed(() => {
  if (!item.value) return ""
  if (item.value.freeToBorrow) return "to borrow"
  return `/ ${item.value.rateOption === "PER_HOUR" ? "hour" : "day"}`
})

const replacementCostLabel = computed(() => {
  if (!item.value?.replacementCost) return "Not specified"
  return formatPesoAmount(item.value.replacementCost)
})

const statusLabel = computed(() => (item.value ? humanizeEnum(item.value.status) : ""))
const formattedCondition = computed(() => (item.value ? humanizeEnum(item.value.condition) : ""))
const formattedCategories = computed(() => item.value?.categories.map(humanizeEnum) ?? [])
const isItemRented = computed(() => item.value?.status === "RENTED")
const isItemUnavailableForBooking = computed(() =>
  Boolean(item.value && (item.value.status === "DEACTIVATED" || item.value.status === "DELETED")),
)
const unavailableItemLabel = computed(() => {
  if (!item.value) return "Unavailable"
  if (item.value.status === "RENTED") {
    return item.value.freeToBorrow ? "Borrowed" : "Rented"
  }
  return "Unavailable"
})
const bookingAvailabilityTitle = computed(() =>
  isItemUnavailableForBooking.value ? "Currently unavailable" : "Select Dates & Time",
)
const bookingAvailabilityMessage = computed(() => {
  if (isItemRented.value) {
    return "Some dates are already reserved. Choose another available date and time."
  }

  if (isItemUnavailableForBooking.value) {
    return "This listing is not accepting bookings right now."
  }

  return "Choose your dates and time to request this item."
})
const isItemAvailableForBooking = computed(() =>
  Boolean(item.value && !isItemUnavailableForBooking.value),
)
const ownerName = computed(() => item.value?.ownerName ?? "TakeUP member")
const ownerInitials = computed(() => {
  const parts = ownerName.value.split(/\s+/).filter(Boolean)
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
})

const ratingLabel = computed(() => (item.value ? item.value.rating.toFixed(1) : "0.0"))
const lenderRatingLabel = computed(() => (item.value ? item.value.lenderRating.toFixed(1) : "0.0"))
const bookingCountLabel = computed(() => {
  const count = item.value?.bookingCount ?? 0
  return `${count.toLocaleString()} ${count === 1 ? "booking" : "bookings"}`
})

const offerHighlights = computed(() => {
  const explicitOffers = splitDetailList(item.value?.whatItemOffers)
  if (explicitOffers.length) return explicitOffers

  if (!item.value) return []

  return [
    item.value.freeToBorrow
      ? "Available to borrow for free"
      : `${priceAmount.value} ${priceUnitLabel.value}`,
    `${formattedCondition.value} condition`,
    `Status: ${statusLabel.value}`,
    ...formattedCategories.value.slice(0, 2),
  ].filter(Boolean)
})

const includedItems = computed(() => splitDetailList(item.value?.whatIsIncluded))
const knownIssuesList = computed(() => splitDetailList(item.value?.knownIssues))
const usageLimitationsList = computed(() => splitDetailList(item.value?.usageLimitations))

const availabilityRanges = computed(() =>
  [...(item.value?.availability ?? []), ...(item.value?.bookingBlocks ?? [])].map((slot) => ({
    id: slot.id,
    startDate: new Date(slot.startDate),
    endDate: new Date(slot.endDate),
    status: slot.status,
  })),
)

const MIN_BOOKABLE_MS = 30 * 60 * 1000

const isDateUnavailable = (date: Date | null) => {
  if (!date) return true
  if (isItemUnavailableForBooking.value) return true

  const normalizedDate = normalizeDate(date)
  if (normalizedDate.getTime() < today.getTime()) return true

  const ranges = availabilityRanges.value
  if (!ranges.length) return false

  const dayStart = normalizedDate.getTime()
  const dayEnd = dayStart + 24 * 60 * 60 * 1000

  const hasAvailableRanges = ranges.some((range) => range.status === "AVAILABLE")

  if (!hasAvailableRanges) return false

  const hasAvailableWindow = ranges.some(
    (range) =>
      range.status === "AVAILABLE" &&
      range.startDate.getTime() < dayEnd &&
      range.endDate.getTime() > dayStart,
  )

  if (!hasAvailableWindow) return true

  const rentedOnDay = ranges.filter(
    (range) =>
      range.status !== "AVAILABLE" &&
      range.startDate.getTime() < dayEnd &&
      range.endDate.getTime() > dayStart,
  )

  if (!rentedOnDay.length) return false

  const availableIntervals = ranges
    .filter(
      (range) =>
        range.status === "AVAILABLE" &&
        range.startDate.getTime() < dayEnd &&
        range.endDate.getTime() > dayStart,
    )
    .map((range) => ({
      start: Math.max(range.startDate.getTime(), dayStart),
      end: Math.min(range.endDate.getTime(), dayEnd),
    }))

  const bookedIntervals = rentedOnDay.map((range) => ({
    start: Math.max(range.startDate.getTime(), dayStart),
    end: Math.min(range.endDate.getTime(), dayEnd),
  }))

  let remaining = [...availableIntervals]
  for (const booked of bookedIntervals) {
    const newRemaining: Array<{ start: number; end: number }> = []
    for (const avail of remaining) {
      if (booked.end <= avail.start || booked.start >= avail.end) {
        newRemaining.push(avail)
      } else {
        if (booked.start > avail.start) newRemaining.push({ start: avail.start, end: booked.start })
        if (booked.end < avail.end) newRemaining.push({ start: booked.end, end: avail.end })
      }
    }
    remaining = newRemaining
  }

  const remainingMs = remaining.reduce((sum, interval) => sum + interval.end - interval.start, 0)
  return remainingMs < MIN_BOOKABLE_MS
}

const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate()
const getFirstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay()

const days = computed(() => {
  const numberOfDays = getDaysInMonth(viewMonth.value, viewYear.value)
  const firstDay = getFirstDayOfMonth(viewMonth.value, viewYear.value)
  const daysArray: Array<{
    day: number | null
    fullDate: Date | null
    isToday?: boolean
    isPast?: boolean
    isUnavailable?: boolean
  }> = []

  for (let index = 0; index < firstDay; index++) {
    daysArray.push({ day: null, fullDate: null })
  }

  for (let day = 1; day <= numberOfDays; day++) {
    const fullDate = new Date(viewYear.value, viewMonth.value, day)
    const normalizedDate = normalizeDate(fullDate)

    daysArray.push({
      day,
      fullDate,
      isToday: normalizedDate.getTime() === today.getTime(),
      isPast: normalizedDate.getTime() < today.getTime(),
      isUnavailable: isDateUnavailable(fullDate),
    })
  }

  return daysArray
})

const changeMonth = (delta: number) => {
  if (isItemUnavailableForBooking.value) return

  viewMonth.value += delta

  if (viewMonth.value > 11) {
    viewMonth.value = 0
    viewYear.value++
  } else if (viewMonth.value < 0) {
    viewMonth.value = 11
    viewYear.value--
  }
}

const isSelected = (date: Date | null) => {
  if (!date) return false

  return (
    (startDate.value && date.getTime() === startDate.value.getTime()) ||
    (endDate.value && date.getTime() === endDate.value.getTime())
  )
}

const isInRange = (date: Date | null) => {
  if (!date || !startDate.value) return false

  const target = date.getTime()
  const start = startDate.value.getTime()

  if (endDate.value) {
    const end = endDate.value.getTime()
    return target > Math.min(start, end) && target < Math.max(start, end)
  }

  if (hoverDate.value) {
    const hover = hoverDate.value.getTime()
    return target > Math.min(start, hover) && target < Math.max(start, hover)
  }

  return false
}

const rangeHasUnavailable = (start: Date, end: Date) => {
  const startBoundary = normalizeDate(new Date(Math.min(start.getTime(), end.getTime())))
  const endBoundary = normalizeDate(new Date(Math.max(start.getTime(), end.getTime())))

  for (
    const cursor = new Date(startBoundary);
    cursor.getTime() <= endBoundary.getTime();
    cursor.setDate(cursor.getDate() + 1)
  ) {
    if (isDateUnavailable(cursor)) {
      return true
    }
  }

  return false
}

const onDateClick = (date: Date | null, isUnavailable: boolean, isPast: boolean) => {
  if (!date || isUnavailable || isPast) return

  if (!startDate.value || (startDate.value && endDate.value)) {
    startDate.value = date
    endDate.value = null
    return
  }

  if (rangeHasUnavailable(startDate.value, date)) {
    startDate.value = date
    endDate.value = null
    return
  }

  if (date.getTime() === startDate.value.getTime()) {
    startDate.value = null
    return
  }

  if (date < startDate.value) {
    endDate.value = startDate.value
    startDate.value = date
    return
  }

  endDate.value = date
}

const onMouseDown = (date: Date | null, isUnavailable: boolean, isPast: boolean) => {
  if (!date || isUnavailable || isPast) return

  mouseIsDown.value = true
  tempDragStart.value = date
}

const onMouseEnter = (date: Date | null, isUnavailable: boolean, isPast: boolean) => {
  if (!date || isUnavailable || isPast) {
    hoverDate.value = null
    return
  }

  hoverDate.value = date

  if (mouseIsDown.value && tempDragStart.value) {
    if (rangeHasUnavailable(tempDragStart.value, date)) return

    isDragging.value = true

    if (date < tempDragStart.value) {
      startDate.value = date
      endDate.value = tempDragStart.value
      return
    }

    startDate.value = tempDragStart.value
    endDate.value = date
  }
}

const onMouseUp = (_date: Date | null, _isUnavailable: boolean, _isPast: boolean) => {
  mouseIsDown.value = false
  isDragging.value = false
  tempDragStart.value = null
}

const handleCalendarMouseLeave = () => {
  hoverDate.value = null
  mouseIsDown.value = false
  isDragging.value = false
}

const timeToMinutes = (timeValue: string) => {
  const [timePart, period] = timeValue.split(" ")
  if (!timePart) return 0

  const [hoursPart, minutesPart] = timePart.split(":").map(Number)
  let hours = hoursPart ?? 0
  const minutes = minutesPart ?? 0

  if (period === "PM" && hours !== 12) hours += 12
  if (period === "AM" && hours === 12) hours = 0

  return hours * 60 + minutes
}

const createDateTime = (date: Date, timeValue: string) => {
  const value = new Date(date)
  const minutesFromMidnight = timeToMinutes(timeValue)
  value.setHours(Math.floor(minutesFromMidnight / 60), minutesFromMidnight % 60, 0, 0)
  return value
}

const isSameDay = computed(() => {
  if (!startDate.value) return false
  if (!endDate.value) return true

  return startDate.value.getTime() === endDate.value.getTime()
})

const isStartDateToday = computed(() => {
  if (!startDate.value) return false
  return startDate.value.getTime() === today.getTime()
})

const isStartTimePast = (timeValue: string) => {
  if (!isStartDateToday.value) return false
  return timeToMinutes(timeValue) <= currentTimeMinutes
}

const isTimeOnDayBooked = (timeValue: string, date: Date | null) => {
  if (!date) return false
  const dayStart = normalizeDate(date).getTime()
  const dayEnd = dayStart + 24 * 60 * 60 * 1000
  const timeMs = dayStart + timeToMinutes(timeValue) * 60 * 1000

  return availabilityRanges.value.some(
    (range) =>
      range.status !== "AVAILABLE" &&
      range.startDate.getTime() < dayEnd &&
      range.endDate.getTime() > dayStart &&
      timeMs >= range.startDate.getTime() &&
      timeMs <= range.endDate.getTime(),
  )
}

const isTimeDisabled = (timeValue: string, isEnd: boolean) => {
  if (!isSameDay.value) return false
  if (!isEnd) return false

  return timeToMinutes(timeValue) <= timeToMinutes(startTime.value)
}

const selectStartTime = (timeValue: string) => {
  if (isStartTimePast(timeValue)) return
  if (isTimeOnDayBooked(timeValue, startDate.value)) return
  startTime.value = timeValue
  isStartTimeOpen.value = false

  if (isSameDay.value && timeToMinutes(timeValue) >= timeToMinutes(endTime.value)) {
    const nextValidTime = timeOptions.find(
      (option) => timeToMinutes(option) > timeToMinutes(timeValue),
    )
    endTime.value = nextValidTime ?? endTime.value
  }
}

const selectEndTime = (timeValue: string) => {
  if (isTimeDisabled(timeValue, true)) return
  if (isTimeOnDayBooked(timeValue, displayEndDate.value)) return

  endTime.value = timeValue
  isEndTimeOpen.value = false
}

const toggleStartTime = () => {
  if (isItemUnavailableForBooking.value) return

  isStartTimeOpen.value = !isStartTimeOpen.value
  isEndTimeOpen.value = false
}

const toggleEndTime = () => {
  if (isItemUnavailableForBooking.value) return

  isEndTimeOpen.value = !isEndTimeOpen.value
  isStartTimeOpen.value = false
}

const displayStartDate = computed(() => startDate.value)
const displayEndDate = computed(() => endDate.value || startDate.value)
const hasBookingSelection = computed(() => {
  if (!startDate.value) return false
  if (endDate.value) return true
  return timeToMinutes(startTime.value) !== timeToMinutes(endTime.value)
})

const selectedBookingWindow = computed(() => {
  if (!item.value || !startDate.value || !displayEndDate.value) return null

  const bookingStart = createDateTime(startDate.value, startTime.value)
  const bookingEnd = createDateTime(displayEndDate.value, endTime.value)

  if (bookingEnd <= bookingStart) {
    return null
  }

  return {
    startDate: bookingStart,
    endDate: bookingEnd,
  }
})

const canSubmitBooking = computed(
  () =>
    !isItemUnavailableForBooking.value &&
    hasBookingSelection.value &&
    selectedBookingWindow.value !== null &&
    !hasRequestedBooking.value &&
    !isSubmittingBooking.value,
)

const bookingFeedbackMessage = computed(() => {
  if (isItemUnavailableForBooking.value) {
    return bookingAvailabilityMessage.value
  }

  if (bookingErrorMessage.value) return bookingErrorMessage.value
  if (bookingSuccessMessage.value) return bookingSuccessMessage.value
  return "You won't be charged yet."
})

const bookingFeedbackClass = computed(() => {
  if (isItemUnavailableForBooking.value) {
    return "text-noble-black/60"
  }

  if (bookingErrorMessage.value) {
    return "text-cinnabar-red"
  }

  if (bookingSuccessMessage.value) {
    return "text-burning-orange"
  }

  return "text-noble-black/40"
})

const requestBookingButtonLabel = computed(() =>
  hasRequestedBooking.value
    ? "Booking Requested"
    : isSubmittingBooking.value
      ? "Requesting Booking..."
      : "Request Booking",
)

const totalUnits = computed(() => {
  if (!item.value || !startDate.value || !displayEndDate.value) return 1

  const bookingStart = createDateTime(startDate.value, startTime.value)
  const bookingEnd = createDateTime(displayEndDate.value, endTime.value)
  const diffHours = Math.max(
    0.5,
    (bookingEnd.getTime() - bookingStart.getTime()) / (1000 * 60 * 60),
  )

  if (item.value.rateOption === "PER_HOUR") {
    return Math.max(1, Math.ceil(diffHours))
  }

  return Math.max(1, Math.ceil(diffHours / 24))
})

const totalPrice = computed(() => {
  if (!item.value || item.value.freeToBorrow) return 0
  return totalUnits.value * item.value.rentalFee
})

const totalUnitsLabel = computed(() => {
  if (!item.value) return "units"
  return item.value.rateOption === "PER_HOUR" ? "hours" : "days"
})

const canonicalPath = computed(() => {
  if (!item.value) return null
  return buildItemDetailPath({ id: item.value.id, name: item.value.name })
})

watch(
  [slugParam, canonicalPath],
  ([slug, canonical]) => {
    if (canonical && `/items/${slug}` !== canonical) {
      void navigateTo({ path: canonical, query: route.query }, { replace: true })
    }
  },
  { immediate: true },
)

watch(itemId, () => {
  hasRequestedBooking.value = false
  bookingErrorMessage.value = ""
  bookingSuccessMessage.value = ""
})

const openLightbox = () => {
  if (!import.meta.client || !currentImage.value) return

  isLightboxOpen.value = true
  document.body.style.overflow = "hidden"
}

const closeLightbox = () => {
  if (!import.meta.client) return

  isLightboxOpen.value = false
  if (!isMobileModalOpen.value) {
    document.body.style.overflow = "auto"
  }
}

const { addToBag: addItemToBag, hasItemWithWindow } = useBag()

const bagFeedbackMessage = ref("")
const bagFeedbackTone = ref<"success" | "error">("success")
const isAddingToBag = ref(false)

const showBagFeedback = (message: string, tone: "success" | "error") => {
  bagFeedbackMessage.value = message
  bagFeedbackTone.value = tone

  setTimeout(() => {
    if (bagFeedbackMessage.value === message) {
      bagFeedbackMessage.value = ""
    }
  }, 2400)
}

const selectedBagWindow = computed(() => {
  if (!item.value || !startDate.value || !displayEndDate.value) {
    return null
  }

  return {
    itemId: item.value.id,
    startAt: createDateTime(startDate.value, startTime.value),
    endAt: createDateTime(displayEndDate.value, endTime.value),
  }
})

const isInBag = computed(() => {
  if (!selectedBagWindow.value) {
    return false
  }

  return hasItemWithWindow(
    selectedBagWindow.value.itemId,
    selectedBagWindow.value.startAt,
    selectedBagWindow.value.endAt,
  )
})

const canAddToBag = computed(
  () =>
    isItemAvailableForBooking.value &&
    hasBookingSelection.value &&
    selectedBookingWindow.value !== null &&
    !isInBag.value,
)

const addToBagButtonLabel = computed(() => {
  if (isItemUnavailableForBooking.value) {
    return `Currently ${unavailableItemLabel.value}`
  }

  return isInBag.value ? "Added to Bag" : "Add to Bag"
})

const mobileBookingButtonLabel = computed(() => {
  if (isInBag.value) return "Added to Bag"
  if (!isItemAvailableForBooking.value) return "Unavailable"

  return hasBookingSelection.value ? "Add to Bag" : "Check Availability"
})

const handleAddToBag = async () => {
  if (
    !selectedBagWindow.value ||
    !hasBookingSelection.value ||
    !canAddToBag.value ||
    isAddingToBag.value
  ) {
    return
  }

  try {
    isAddingToBag.value = true

    await addItemToBag({
      itemId: selectedBagWindow.value.itemId,
      startAt: selectedBagWindow.value.startAt,
      endAt: selectedBagWindow.value.endAt,
    })

    showBagFeedback("Added to your bag.", "success")

    if (isMobileModalOpen.value) {
      closeBookingModal()
    }
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number })?.statusCode
    const statusMessage =
      (error as { data?: { statusMessage?: string }; statusMessage?: string })?.data
        ?.statusMessage ?? (error as { statusMessage?: string })?.statusMessage

    if (statusCode === 401) {
      showBagFeedback("Sign in to add items to your bag.", "error")
      return
    }

    if (statusCode === 409) {
      showBagFeedback(
        statusMessage ?? "This item with the selected dates is already in your bag.",
        "error",
      )
      return
    }

    if (statusCode === 403 || statusCode === 400 || statusCode === 404) {
      showBagFeedback(statusMessage ?? "This item cannot be added to your bag.", "error")
      return
    }

    showBagFeedback("Unable to add this item to your bag right now.", "error")
  } finally {
    isAddingToBag.value = false
  }
}

const openBookingModal = () => {
  if (!import.meta.client || isItemUnavailableForBooking.value) return

  isMobileModalOpen.value = true
  document.body.style.overflow = "hidden"
}

const closeBookingModal = () => {
  if (!import.meta.client) return

  isMobileModalOpen.value = false
  if (!isLightboxOpen.value) {
    document.body.style.overflow = "auto"
  }
}

const { incrementLikes, decrementLikes } = useLikes()
const toggleSaved = () => {
  isSaved.value = !isSaved.value
  if (isSaved.value) {
    incrementLikes()
  } else {
    decrementLikes()
  }
}

const shareItem = async () => {
  if (!import.meta.client) return

  const shareUrl = window.location.href

  try {
    if (navigator.share) {
      await navigator.share({
        title: item.value?.name ?? "TakeUP item",
        url: shareUrl,
      })
      shareFeedback.value = "Shared"
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareUrl)
      shareFeedback.value = "Link copied"
    } else {
      shareFeedback.value = "Share unavailable"
    }
  } catch (caughtError) {
    if (caughtError instanceof DOMException && caughtError.name === "AbortError") return
    shareFeedback.value = "Share unavailable"
  }

  window.setTimeout(() => {
    shareFeedback.value = ""
  }, 1800)
}

const handlePaymentSuccess = async (_data: {
  transaction: { referenceCode: string; status: string }
}) => {
  showPaymentModal.value = false
  // After successful payment, we finalize the booking
  await performBookingCreation()
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

const submitBookingRequest = async () => {
  if (
    !item.value ||
    isItemUnavailableForBooking.value ||
    !selectedBookingWindow.value ||
    isSubmittingBooking.value
  )
    return

  // If item is not free, we show payment modal first
  if (!item.value.freeToBorrow) {
    showPaymentModal.value = true
    return
  }

  // If free, we just proceed with creation
  await performBookingCreation()
}

const performBookingCreation = async () => {
  if (!item.value || !selectedBookingWindow.value) return

  bookingErrorMessage.value = ""
  bookingSuccessMessage.value = ""
  isSubmittingBooking.value = true

  try {
    await $fetch("/api/bookings", {
      method: "POST",
      body: {
        itemId: item.value.id,
        startDate: selectedBookingWindow.value.startDate.toISOString(),
        endDate: selectedBookingWindow.value.endDate.toISOString(),
        paymentMethod: item.value.freeToBorrow ? "CASH" : "WALLET",
      },
    })

    bookingSuccessMessage.value = "Booking request sent to the lender."
    hasRequestedBooking.value = true
    startDate.value = null
    endDate.value = null
    closeBookingModal()
    await refreshItem().catch(() => undefined)
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number })?.statusCode
    if (statusCode === 401) {
      await navigateTo("/")
      return
    }

    bookingErrorMessage.value = resolveBookingErrorMessage(error)
  } finally {
    isSubmittingBooking.value = false
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === "ArrowRight") nextImage()
  if (event.key === "ArrowLeft") prevImage()

  if (event.key === "Escape") {
    if (isMobileModalOpen.value) closeBookingModal()
    if (isLightboxOpen.value) closeLightbox()
  }
}

onMounted(() => {
  updateScrollStatus()
  window.addEventListener("keydown", handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown)

  if (import.meta.client) {
    document.body.style.overflow = "auto"
  }
})
</script>

<template>
  <div class="min-h-screen bg-white font-geist">
    <Header />

    <main class="max-w-7xl mx-auto px-4 sm:px-6 py-6 pt-20" @mouseleave="handleCalendarMouseLeave">
      <!-- Back Link -->
      <NuxtLink
        :to="backNavigationPath"
        class="flex items-center gap-2 text-noble-black/70 hover:text-burning-orange transition-colors mb-6 group"
      >
        <Icon
          name="ph:caret-left"
          size="20"
          class="transition-transform group-hover:-translate-x-1"
        />
        <span class="font-normal">{{ backNavigationLabel }}</span>
      </NuxtLink>

      <div v-if="pending" class="space-y-8 pb-28 lg:pb-6">
        <div class="flex flex-col gap-4">
          <div class="h-10 w-3/5 animate-pulse rounded-2xl bg-cream"></div>
          <div class="h-5 w-48 animate-pulse rounded-2xl bg-cream"></div>
        </div>
        <div class="grid gap-12 lg:grid-cols-3">
          <div class="space-y-6 lg:col-span-2">
            <div class="aspect-video animate-pulse rounded-[28px] bg-cream"></div>
            <div class="h-28 animate-pulse rounded-[28px] bg-cream"></div>
            <div class="h-48 animate-pulse rounded-[28px] bg-cream"></div>
          </div>
          <div class="space-y-6">
            <div class="h-80 animate-pulse rounded-[28px] bg-cream"></div>
            <div class="h-72 animate-pulse rounded-[28px] bg-cream"></div>
          </div>
        </div>
      </div>

      <div
        v-else-if="error"
        class="rounded-[28px] border border-cinnamon-ice/15 bg-cream px-6 py-16 text-center"
      >
        <h2 class="text-2xl font-bold text-noble-black">Unable to load item</h2>
        <p class="mx-auto mt-3 max-w-md text-sm text-noble-black/60">
          {{ itemLoadErrorMessage }}
        </p>
        <button
          class="mt-6 rounded-xl bg-burning-orange px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-estate"
          @click="() => void refreshItem()"
        >
          Retry
        </button>
      </div>

      <div v-else-if="item" class="pb-28 lg:pb-0">
        <!-- Title & Actions -->
        <div class="flex justify-between items-start mb-2">
          <div>
            <div class="mb-3 flex flex-wrap gap-2">
              <span
                v-for="category in formattedCategories"
                :key="category"
                class="rounded-full border-[0.5px] border-cinnamon-ice/30 bg-noble-black/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-noble-black/70"
              >
                {{ category }}
              </span>
              <span
                v-if="item.isTrending"
                class="rounded-full bg-burning-orange px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white"
              >
                Trending
              </span>
            </div>
            <h1 class="text-3xl font-bold text-noble-black">{{ item.name }}</h1>
          </div>
          <div class="flex items-center gap-4">
            <button
              class="p-2 text-noble-black/70 hover:text-noble-black transition-all duration-300 ease-in-out group"
              title="Share"
              @click="shareItem"
            >
              <Icon
                name="ph:share-network"
                size="22"
                class="group-hover:stroke-[2] transition-all duration-300 ease-in-out"
              />
            </button>
            <button
              class="p-2 transition-all duration-300 ease-in-out group"
              :class="
                isSaved ? 'text-burning-orange' : 'text-noble-black/70 hover:text-noble-black'
              "
              title="Save"
              @click="toggleSaved"
            >
              <Icon
                name="ph:heart"
                size="22"
                class="group-hover:stroke-[2] transition-all duration-300 ease-in-out"
                :class="{ 'fill-burning-orange/20': isSaved }"
              />
            </button>
          </div>
        </div>

        <!-- Rating Row -->
        <div class="flex items-center gap-2 mb-8 text-sm">
          <div class="flex items-center gap-1 text-burning-orange">
            <Icon name="ph:star-fill" size="16" class="-translate-y-[0.5px]" />
            <span class="font-bold leading-none">{{ ratingLabel }}</span>
          </div>
          <span class="text-noble-black/60 leading-none">({{ bookingCountLabel }})</span>
        </div>

        <!-- Main Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div class="lg:col-span-2">
            <!-- 1. Image Section -->
            <div class="mb-10">
              <div class="relative aspect-video bg-cream rounded-2xl overflow-hidden group">
                <img
                  v-if="currentImage"
                  :src="currentImage"
                  :alt="item.name"
                  class="w-full h-full object-cover"
                />
                <div
                  v-else
                  class="flex h-full items-center justify-center bg-cream text-sm uppercase tracking-[0.3em] text-noble-black/35"
                >
                  No image available
                </div>
                <button
                  v-if="imageGallery.length > 1"
                  class="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/80 hover:bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  @click="prevImage"
                >
                  <Icon name="ph:caret-left" size="24" />
                </button>
                <button
                  v-if="imageGallery.length > 1"
                  class="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/80 hover:bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  @click="nextImage"
                >
                  <Icon name="ph:caret-right" size="24" />
                </button>
                <div
                  class="absolute bottom-4 left-4 px-3 py-1.5 bg-white/80 backdrop-blur-sm text-noble-black text-[13px] font-medium rounded-full shadow-sm"
                >
                  {{ imageGallery.length ? currentImageIndex + 1 : 0 }} / {{ imageGallery.length }}
                </div>
                <button
                  class="absolute bottom-4 right-4 w-9 h-9 flex items-center justify-center bg-white/80 backdrop-blur-sm text-noble-black rounded-full hover:bg-white transition-colors shadow-sm z-10"
                  @click="openLightbox"
                >
                  <Icon name="ph:arrows-out" size="18" />
                </button>
              </div>
              <div
                v-if="imageGallery.length > 1"
                class="relative mt-4 group/scroll overflow-hidden"
              >
                <div
                  v-if="!isAtStart"
                  class="absolute top-0 left-0 h-20 w-16 bg-gradient-to-r from-white via-white/80 to-transparent flex items-center justify-start pl-2 cursor-pointer z-10"
                  @click="scrollOnce('left')"
                >
                  <div class="text-noble-black/20 group-hover/scroll:text-noble-black/40">
                    <Icon name="ph:caret-left" size="20" />
                  </div>
                </div>
                <div
                  ref="scrollContainer"
                  class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide scroll-smooth px-4"
                  :style="maskStyle"
                  @scroll="handleScroll"
                >
                  <div
                    v-for="(img, idx) in imageGallery"
                    :key="idx"
                    class="w-20 h-20 rounded-xl overflow-hidden cursor-pointer border-2 transition-all duration-300 shrink-0 group/thumb"
                    :class="
                      currentImageIndex === idx
                        ? 'border-burning-orange opacity-100'
                        : 'border-transparent opacity-40 hover:opacity-100'
                    "
                    @click="currentImageIndex = idx"
                  >
                    <img
                      :src="img"
                      class="w-full h-full object-cover transition-all duration-300"
                      :class="
                        currentImageIndex === idx ? '' : 'blur-[1px] group-hover/thumb:blur-0'
                      "
                    />
                  </div>
                </div>
                <div
                  v-if="!isAtEnd"
                  class="absolute top-0 right-0 h-20 w-24 bg-gradient-to-l from-white via-white/80 to-transparent flex items-center justify-end pr-2 cursor-pointer z-10"
                  @click="scrollOnce('right')"
                >
                  <div class="text-noble-black/20 group-hover/scroll:text-noble-black/40">
                    <Icon name="ph:caret-right" size="20" />
                  </div>
                </div>
              </div>
            </div>

            <!-- 2. Responsive Booking (lg:hidden) -->
            <div class="lg:hidden mb-12">
              <!-- 2a. Hybrid Layout (md to lg): Two Columns, Expanded -->
              <div class="hidden md:grid grid-cols-2 gap-8">
                <div class="space-y-6">
                  <div
                    class="bg-cream border border-cinnamon-ice/15 rounded-3xl p-6 shadow-sm overflow-hidden"
                    @mouseleave="handleCalendarMouseLeave"
                  >
                    <div
                      v-if="isItemUnavailableForBooking"
                      class="mb-5 rounded-2xl border border-noble-black/10 bg-white px-4 py-3 text-sm text-noble-black/75"
                    >
                      <span class="font-semibold text-noble-black"
                        >{{ bookingAvailabilityTitle }}.</span
                      >
                      {{ bookingAvailabilityMessage }}
                    </div>
                    <!-- Calendar Grid -->
                    <div class="flex items-center justify-between mb-6">
                      <h3 class="font-semibold text-noble-black">
                        {{ monthNames[viewMonth] }} {{ viewYear }}
                      </h3>
                      <div class="flex gap-2">
                        <button
                          class="p-1 hover:bg-white/20 rounded-full transition-colors text-noble-black/60"
                          :disabled="isItemUnavailableForBooking"
                          @click="changeMonth(-1)"
                        >
                          <Icon name="ph:caret-left" size="20" />
                        </button>
                        <button
                          class="p-1 hover:bg-white/20 rounded-full transition-colors text-noble-black/60"
                          :disabled="isItemUnavailableForBooking"
                          @click="changeMonth(1)"
                        >
                          <Icon name="ph:caret-right" size="20" />
                        </button>
                      </div>
                    </div>
                    <div class="grid grid-cols-7 text-center mb-2">
                      <div
                        v-for="day in daysOfWeek"
                        :key="day"
                        class="text-[10px] uppercase tracking-wider text-noble-black/40 font-bold py-2"
                      >
                        {{ day }}
                      </div>
                    </div>
                    <div class="grid grid-cols-7 relative">
                      <div
                        v-for="(dayObj, idx) in days"
                        :key="idx"
                        class="relative flex items-center justify-center py-1"
                      >
                        <div
                          v-if="dayObj.fullDate && startDate && isInRange(dayObj.fullDate)"
                          class="absolute inset-y-1 inset-x-0 bg-burning-orange/10 z-0"
                        />
                        <div
                          v-if="
                            dayObj.fullDate &&
                            startDate &&
                            (endDate || hoverDate) &&
                            dayObj.fullDate.getTime() ===
                              Math.min(startDate.getTime(), (endDate || hoverDate)!.getTime())
                          "
                          class="absolute inset-y-1 right-0 left-1/2 bg-burning-orange/10 rounded-l-full z-0"
                        />
                        <div
                          v-if="
                            dayObj.fullDate &&
                            startDate &&
                            (endDate || hoverDate) &&
                            dayObj.fullDate.getTime() ===
                              Math.max(startDate.getTime(), (endDate || hoverDate)!.getTime())
                          "
                          class="absolute inset-y-1 left-0 right-1/2 bg-burning-orange/10 rounded-r-full z-0"
                        />
                        <button
                          v-if="dayObj.day"
                          class="relative w-9 h-9 flex items-center justify-center text-sm rounded-full transition-all duration-200 z-10 select-none"
                          :class="[
                            dayObj.isUnavailable || dayObj.isPast
                              ? 'text-noble-black/30 cursor-not-allowed'
                              : 'text-noble-black hover:bg-transparent hover:text-burning-orange cursor-pointer',
                            dayObj.isUnavailable ? 'line-through' : '',
                            isSelected(dayObj.fullDate) ||
                            (hoverDate &&
                              dayObj.fullDate?.getTime() === hoverDate.getTime() &&
                              startDate &&
                              !endDate)
                              ? '!bg-burning-orange !text-white !hover:bg-burning-orange shadow-md scale-110 font-bold'
                              : '',
                            dayObj.isToday && !isSelected(dayObj.fullDate)
                              ? 'text-burning-orange font-bold'
                              : '',
                          ]"
                          @mousedown="
                            onMouseDown(
                              dayObj.fullDate,
                              dayObj.isUnavailable ?? false,
                              dayObj.isPast ?? false,
                            )
                          "
                          @mouseup="
                            onMouseUp(
                              dayObj.fullDate,
                              dayObj.isUnavailable ?? false,
                              dayObj.isPast ?? false,
                            )
                          "
                          @mouseenter="
                            onMouseEnter(
                              dayObj.fullDate,
                              dayObj.isUnavailable ?? false,
                              dayObj.isPast ?? false,
                            )
                          "
                          @click="
                            onDateClick(
                              dayObj.fullDate,
                              dayObj.isUnavailable ?? false,
                              dayObj.isPast ?? false,
                            )
                          "
                        >
                          {{ dayObj.day }}
                        </button>
                      </div>
                    </div>
                  </div>
                  <!-- Time Selection -->
                  <div class="grid grid-cols-2 gap-4">
                    <div class="relative">
                      <span
                        class="text-[10px] uppercase font-bold text-noble-black/40 tracking-wider mb-1.5 block ml-1"
                        >Start Time</span
                      ><button
                        class="w-full bg-cream border border-cinnamon-ice/15 rounded-2xl px-4 py-3 text-sm font-medium text-noble-black flex items-center justify-between hover:border-burning-orange transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="isItemUnavailableForBooking"
                        @click="toggleStartTime"
                      >
                        {{ startTime
                        }}<Icon name="ph:caret-down" size="16" class="text-noble-black/30" />
                      </button>
                      <div
                        v-if="isStartTimeOpen"
                        class="absolute z-50 mt-2 w-full bg-white border border-cinnamon-ice/15 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                      >
                        <div class="max-h-60 overflow-y-auto custom-time-scrollbar py-2">
                          <div
                            v-for="time in timeOptions"
                            :key="time"
                            class="px-4 py-2 text-sm text-noble-black hover:bg-cream hover:text-burning-orange cursor-pointer transition-colors"
                            :class="[
                              isStartTimePast(time) || isTimeOnDayBooked(time, startDate)
                                ? 'opacity-30 cursor-not-allowed pointer-events-none'
                                : startTime === time
                                  ? 'bg-cream text-burning-orange font-bold'
                                  : '',
                            ]"
                            @click="selectStartTime(time)"
                          >
                            {{ time }}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="relative">
                      <span
                        class="text-[10px] uppercase font-bold text-noble-black/40 tracking-wider mb-1.5 block ml-1"
                        >End Time</span
                      ><button
                        class="w-full bg-cream border border-cinnamon-ice/15 rounded-2xl px-4 py-3 text-sm font-medium text-noble-black flex items-center justify-between hover:border-burning-orange transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="isItemUnavailableForBooking"
                        @click="toggleEndTime"
                      >
                        {{ endTime
                        }}<Icon name="ph:caret-down" size="16" class="text-noble-black/30" />
                      </button>
                      <div
                        v-if="isEndTimeOpen"
                        class="absolute z-50 mt-2 w-full bg-white border border-cinnamon-ice/15 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                      >
                        <div class="max-h-60 overflow-y-auto custom-time-scrollbar py-2">
                          <div
                            v-for="time in timeOptions"
                            :key="time"
                            class="px-4 py-2 text-sm text-noble-black hover:bg-cream hover:text-burning-orange cursor-pointer transition-colors"
                            :class="[
                              isTimeDisabled(time, true) || isTimeOnDayBooked(time, displayEndDate)
                                ? 'opacity-30 cursor-not-allowed pointer-events-none'
                                : endTime === time
                                  ? 'bg-cream text-burning-orange font-bold'
                                  : '',
                            ]"
                            @click="selectEndTime(time)"
                          >
                            {{ time }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  class="bg-cream border border-cinnamon-ice/15 rounded-3xl p-6 shadow-sm flex flex-col h-full justify-between"
                >
                  <div>
                    <div class="flex items-baseline gap-1 mb-4">
                      <span class="text-3xl font-bold text-noble-black">{{ priceAmount }}</span
                      ><span class="text-sm text-noble-black/60 font-medium">{{
                        priceUnitLabel
                      }}</span>
                    </div>
                    <div class="grid grid-cols-2 mb-6 relative">
                      <div class="absolute left-1/2 top-1 bottom-1 w-px bg-cinnamon-ice/15" />
                      <div class="flex flex-col gap-1 pr-4">
                        <span
                          class="text-[10px] uppercase font-bold text-noble-black/40 tracking-wider"
                          >Start</span
                        >
                        <div class="flex flex-col">
                          <span class="text-sm font-semibold text-noble-black">{{
                            formatDate(displayStartDate)
                          }}</span
                          ><span class="text-xs text-noble-black/60">{{ startTime }}</span>
                        </div>
                      </div>
                      <div class="flex flex-col gap-1 pl-4">
                        <span
                          class="text-[10px] uppercase font-bold text-noble-black/40 tracking-wider"
                          >End</span
                        >
                        <div class="flex flex-col">
                          <span class="text-sm font-semibold text-noble-black">{{
                            formatDate(displayEndDate)
                          }}</span
                          ><span class="text-xs text-noble-black/60">{{ endTime }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <button
                      class="w-full py-3 rounded-2xl bg-burning-orange text-white font-bold text-base transition-all duration-300 ease-in-out active:scale-[0.98] hover:brightness-110 shadow-md shadow-burning-orange/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mb-3"
                      :disabled="!canSubmitBooking"
                      @click="submitBookingRequest"
                    >
                      {{ requestBookingButtonLabel }}
                    </button>
                    <p
                      class="text-center text-[11px] font-normal mb-3"
                      :class="bookingFeedbackClass"
                    >
                      {{ bookingFeedbackMessage }}
                    </p>

                    <button
                      class="w-full py-3 rounded-2xl border border-burning-orange text-burning-orange font-bold text-base transition-all duration-300 ease-in-out active:scale-[0.98] hover:bg-burning-orange/5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-3"
                      :disabled="!canAddToBag"
                      @click="handleAddToBag"
                    >
                      <Icon v-if="isInBag" name="ph:check" size="18" class="stroke-[3]" />
                      {{ addToBagButtonLabel }}
                    </button>
                    <p
                      v-if="bagFeedbackMessage"
                      class="text-center text-[11px] font-normal"
                      :class="
                        bagFeedbackTone === 'success' ? 'text-blue-estate' : 'text-cinnabar-red'
                      "
                    >
                      {{ bagFeedbackMessage }}
                    </p>
                  </div>
                  <div>
                    <div class="h-px bg-cinnamon-ice/15 mb-4" />
                    <div class="space-y-3 mb-4">
                      <div class="flex justify-between items-center text-sm text-noble-black/70">
                        <span>
                          Rate ({{
                            item.freeToBorrow ? "Free" : formatPesoAmount(item.rentalFee)
                          }}
                          x {{ totalUnits }} {{ totalUnitsLabel }})
                        </span>
                        <span class="font-medium text-noble-black">
                          {{ item.freeToBorrow ? "Free" : formatPesoAmount(totalPrice) }}
                        </span>
                      </div>
                    </div>
                    <div class="h-px bg-cinnamon-ice/15 mb-4" />
                    <div class="flex justify-between items-center mb-4">
                      <span class="text-base font-semibold text-noble-black">Total</span
                      ><span class="text-lg font-bold text-noble-black">
                        {{ item.freeToBorrow ? "Free" : formatPesoAmount(totalPrice) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 2b. Small Layout (sm to md): Stacked, Collapsible Calendar & Time -->
              <div class="hidden sm:block md:hidden space-y-6">
                <div class="bg-cream border border-cinnamon-ice/15 rounded-3xl p-6 shadow-sm">
                  <button
                    class="w-full flex items-center justify-between group"
                    @click="isCalendarExpanded = !isCalendarExpanded"
                  >
                    <div class="flex flex-col items-start">
                      <h3 class="font-bold text-noble-black">
                        {{
                          isItemUnavailableForBooking
                            ? bookingAvailabilityTitle
                            : "Select Dates & Time"
                        }}
                      </h3>
                      <p class="text-[11px] text-noble-black/60 font-medium">
                        {{
                          isItemUnavailableForBooking
                            ? bookingAvailabilityMessage
                            : startDate
                              ? `${formatDate(startDate)} at ${startTime} — ${endDate ? formatDate(endDate) : "Select end date"} at ${endTime}`
                              : "When do you need this?"
                        }}
                      </p>
                    </div>
                    <div
                      class="w-10 h-10 rounded-full bg-white/50 border border-cinnamon-ice/15 flex items-center justify-center transition-all group-hover:bg-white group-hover:border-burning-orange/30"
                      :class="{
                        'rotate-180 bg-burning-orange/5 !border-burning-orange/20':
                          isCalendarExpanded,
                      }"
                    >
                      <Icon
                        name="ph:caret-down"
                        size="20"
                        class="text-noble-black/40 transition-transform duration-300"
                        :class="{ 'rotate-180 !text-burning-orange': isCalendarExpanded }"
                      />
                    </div>
                  </button>
                  <Transition
                    enter-active-class="transition-[max-height,opacity] duration-500 ease-in-out overflow-hidden"
                    enter-from-class="max-h-0 opacity-0"
                    enter-to-class="max-h-[1000px] opacity-100"
                    leave-active-class="transition-[max-height,opacity] duration-400 ease-in-out overflow-hidden"
                    leave-from-class="max-h-[1000px] opacity-100"
                    leave-to-class="max-h-0 opacity-0"
                  >
                    <div
                      v-if="isCalendarExpanded"
                      class="mt-8 pt-6 border-t border-cinnamon-ice/15 space-y-8"
                    >
                      <div
                        v-if="isItemUnavailableForBooking"
                        class="rounded-2xl border border-noble-black/10 bg-white px-4 py-3 text-sm text-noble-black/75"
                      >
                        <span class="font-semibold text-noble-black"
                          >{{ bookingAvailabilityTitle }}.</span
                        >
                        {{ bookingAvailabilityMessage }}
                      </div>
                      <div>
                        <div class="flex items-center justify-between mb-6">
                          <h3 class="font-semibold text-noble-black">
                            {{ monthNames[viewMonth] }} {{ viewYear }}
                          </h3>
                          <div class="flex gap-2">
                            <button
                              class="p-1 hover:bg-white/20 rounded-full transition-colors text-noble-black/60"
                              :disabled="isItemUnavailableForBooking"
                              @click="changeMonth(-1)"
                            >
                              <Icon name="ph:caret-left" size="20" />
                            </button>
                            <button
                              class="p-1 hover:bg-white/20 rounded-full transition-colors text-noble-black/60"
                              :disabled="isItemUnavailableForBooking"
                              @click="changeMonth(1)"
                            >
                              <Icon name="ph:caret-right" size="20" />
                            </button>
                          </div>
                        </div>
                        <div class="grid grid-cols-7 text-center mb-2">
                          <div
                            v-for="day in daysOfWeek"
                            :key="day"
                            class="text-[10px] uppercase tracking-wider text-noble-black/40 font-bold py-2"
                          >
                            {{ day }}
                          </div>
                        </div>
                        <div class="grid grid-cols-7 relative">
                          <div
                            v-for="(dayObj, idx) in days"
                            :key="idx"
                            class="relative flex items-center justify-center py-1"
                          >
                            <div
                              v-if="dayObj.fullDate && startDate && isInRange(dayObj.fullDate)"
                              class="absolute inset-y-1 inset-x-0 bg-burning-orange/10 z-0"
                            />
                            <div
                              v-if="
                                dayObj.fullDate &&
                                startDate &&
                                (endDate || hoverDate) &&
                                dayObj.fullDate.getTime() ===
                                  Math.min(startDate.getTime(), (endDate || hoverDate)!.getTime())
                              "
                              class="absolute inset-y-1 right-0 left-1/2 bg-burning-orange/10 rounded-l-full z-0"
                            />
                            <div
                              v-if="
                                dayObj.fullDate &&
                                startDate &&
                                (endDate || hoverDate) &&
                                dayObj.fullDate.getTime() ===
                                  Math.max(startDate.getTime(), (endDate || hoverDate)!.getTime())
                              "
                              class="absolute inset-y-1 left-0 right-1/2 bg-burning-orange/10 rounded-r-full z-0"
                            />
                            <button
                              v-if="dayObj.day"
                              class="relative w-9 h-9 flex items-center justify-center text-sm rounded-full transition-all duration-200 z-10 select-none"
                              :class="[
                                dayObj.isUnavailable || dayObj.isPast
                                  ? 'text-noble-black/30 cursor-not-allowed'
                                  : 'text-noble-black hover:bg-transparent hover:text-burning-orange cursor-pointer',
                                dayObj.isUnavailable ? 'line-through' : '',
                                isSelected(dayObj.fullDate) ||
                                (hoverDate &&
                                  dayObj.fullDate?.getTime() === hoverDate.getTime() &&
                                  startDate &&
                                  !endDate)
                                  ? '!bg-burning-orange !text-white !hover:bg-burning-orange shadow-md scale-110 font-bold'
                                  : '',
                                dayObj.isToday && !isSelected(dayObj.fullDate)
                                  ? 'text-burning-orange font-bold'
                                  : '',
                              ]"
                              @mousedown="
                                onMouseDown(
                                  dayObj.fullDate,
                                  dayObj.isUnavailable ?? false,
                                  dayObj.isPast ?? false,
                                )
                              "
                              @mouseup="
                                onMouseUp(
                                  dayObj.fullDate,
                                  dayObj.isUnavailable ?? false,
                                  dayObj.isPast ?? false,
                                )
                              "
                              @mouseenter="
                                onMouseEnter(
                                  dayObj.fullDate,
                                  dayObj.isUnavailable ?? false,
                                  dayObj.isPast ?? false,
                                )
                              "
                              @click="
                                onDateClick(
                                  dayObj.fullDate,
                                  dayObj.isUnavailable ?? false,
                                  dayObj.isPast ?? false,
                                )
                              "
                            >
                              {{ dayObj.day }}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div class="grid grid-cols-2 gap-4">
                        <div class="relative">
                          <span
                            class="text-[10px] uppercase font-bold text-noble-black/40 tracking-wider mb-1.5 block ml-1"
                            >Start Time</span
                          ><button
                            class="w-full bg-cream border border-cinnamon-ice/15 rounded-2xl px-4 py-3 text-sm font-medium text-noble-black flex items-center justify-between hover:border-burning-orange transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                            :disabled="isItemUnavailableForBooking"
                            @click="toggleStartTime"
                          >
                            {{ startTime
                            }}<Icon name="ph:caret-down" size="16" class="text-noble-black/30" />
                          </button>
                          <div
                            v-if="isStartTimeOpen"
                            class="absolute z-50 mt-2 w-full bg-white border border-cinnamon-ice/15 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                          >
                            <div class="max-h-60 overflow-y-auto custom-time-scrollbar py-2">
                              <div
                                v-for="time in timeOptions"
                                :key="time"
                                class="px-4 py-2 text-sm text-noble-black hover:bg-cream hover:text-burning-orange cursor-pointer transition-colors"
                                :class="[
                                  isStartTimePast(time) || isTimeOnDayBooked(time, startDate)
                                    ? 'opacity-30 cursor-not-allowed pointer-events-none'
                                    : startTime === time
                                      ? 'bg-cream text-burning-orange font-bold'
                                      : '',
                                ]"
                                @click="selectStartTime(time)"
                              >
                                {{ time }}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div class="relative">
                          <span
                            class="text-[10px] uppercase font-bold text-noble-black/40 tracking-wider mb-1.5 block ml-1"
                            >End Time</span
                          ><button
                            class="w-full bg-cream border border-cinnamon-ice/15 rounded-2xl px-4 py-3 text-sm font-medium text-noble-black flex items-center justify-between hover:border-burning-orange transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                            :disabled="isItemUnavailableForBooking"
                            @click="toggleEndTime"
                          >
                            {{ endTime
                            }}<Icon name="ph:caret-down" size="16" class="text-noble-black/30" />
                          </button>
                          <div
                            v-if="isEndTimeOpen"
                            class="absolute z-50 mt-2 w-full bg-white border border-cinnamon-ice/15 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                          >
                            <div class="max-h-60 overflow-y-auto custom-time-scrollbar py-2">
                              <div
                                v-for="time in timeOptions"
                                :key="time"
                                class="px-4 py-2 text-sm text-noble-black hover:bg-cream hover:text-burning-orange cursor-pointer transition-colors"
                                :class="[
                                  isTimeDisabled(time, true) ||
                                  isTimeOnDayBooked(time, displayEndDate)
                                    ? 'opacity-30 cursor-not-allowed pointer-events-none'
                                    : endTime === time
                                      ? 'bg-cream text-burning-orange font-bold'
                                      : '',
                                ]"
                                @click="selectEndTime(time)"
                              >
                                {{ time }}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Transition>
                </div>
                <div class="bg-cream border border-cinnamon-ice/15 rounded-3xl p-6 shadow-sm">
                  <div class="flex items-baseline gap-1 mb-4">
                    <span class="text-3xl font-bold text-noble-black">{{ priceAmount }}</span
                    ><span class="text-sm text-noble-black/60 font-medium">{{
                      priceUnitLabel
                    }}</span>
                  </div>
                  <div class="grid grid-cols-2 mb-6 relative">
                    <div class="absolute left-1/2 top-1 bottom-1 w-px bg-cinnamon-ice/15" />
                    <div class="flex flex-col gap-1 pr-4">
                      <span
                        class="text-[10px] uppercase font-bold text-noble-black/40 tracking-wider"
                        >Start</span
                      >
                      <div class="flex flex-col">
                        <span class="text-sm font-semibold text-noble-black">{{
                          formatDate(displayStartDate)
                        }}</span
                        ><span class="text-xs text-noble-black/60">{{ startTime }}</span>
                      </div>
                    </div>
                    <div class="flex flex-col gap-1 pl-4">
                      <span
                        class="text-[10px] uppercase font-bold text-noble-black/40 tracking-wider"
                        >End</span
                      >
                      <div class="flex flex-col">
                        <span class="text-sm font-semibold text-noble-black">{{
                          formatDate(displayEndDate)
                        }}</span
                        ><span class="text-xs text-noble-black/60">{{ endTime }}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    class="w-full py-2 rounded-2xl bg-burning-orange text-white font-medium text-base transition-all duration-300 ease-in-out active:scale-[0.98] hover:brightness-110 shadow-md shadow-burning-orange/10 mb-2.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    :disabled="!canSubmitBooking"
                    @click="submitBookingRequest"
                  >
                    {{ requestBookingButtonLabel }}
                  </button>
                  <p class="text-center text-[11px] mb-4 font-normal" :class="bookingFeedbackClass">
                    {{ bookingFeedbackMessage }}
                  </p>

                  <button
                    class="w-full py-2 rounded-2xl border border-burning-orange text-burning-orange font-medium text-base transition-all duration-300 ease-in-out active:scale-[0.98] hover:bg-burning-orange/5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-2.5"
                    :disabled="!canAddToBag"
                    @click="handleAddToBag"
                  >
                    <Icon v-if="isInBag" name="ph:check" size="16" class="stroke-[3]" />
                    {{ addToBagButtonLabel }}
                  </button>
                  <p
                    v-if="bagFeedbackMessage"
                    class="text-center text-[11px] mb-4 font-normal"
                    :class="
                      bagFeedbackTone === 'success' ? 'text-blue-estate' : 'text-cinnabar-red'
                    "
                  >
                    {{ bagFeedbackMessage }}
                  </p>

                  <div class="h-px bg-cinnamon-ice/15 mb-4" />
                  <div class="space-y-2 mb-4">
                    <div class="flex justify-between items-center text-sm text-noble-black/70">
                      <span>
                        Rate ({{ item.freeToBorrow ? "Free" : formatPesoAmount(item.rentalFee) }} x
                        {{ totalUnits }} {{ totalUnitsLabel }})
                      </span>
                      <span class="font-medium text-noble-black">
                        {{ item.freeToBorrow ? "Free" : formatPesoAmount(totalPrice) }}
                      </span>
                    </div>
                  </div>
                  <div class="h-px bg-cinnamon-ice/15 mb-4" />
                  <div class="flex justify-between items-center mb-4">
                    <span class="text-base font-semibold text-noble-black">Total</span
                    ><span class="text-lg font-bold text-noble-black">
                      {{ item.freeToBorrow ? "Free" : formatPesoAmount(totalPrice) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Redesigned Metadata Container -->
            <div class="mb-10 rounded-[14px] border border-cinnamon-ice/30 bg-white p-5 shadow-sm">
              <div class="grid grid-cols-2 md:grid-cols-4 gap-y-8 md:gap-y-0 items-start">
                <!-- Status -->
                <div class="flex flex-col gap-1 pr-4 md:border-r-[0.5px] border-cinnamon-ice/20">
                  <span class="text-[10px] font-bold uppercase tracking-[1.5px] text-noble-black/40"
                    >Status</span
                  >
                  <div class="flex items-center gap-2">
                    <div
                      class="h-1.5 w-1.5 rounded-full"
                      :class="
                        isItemUnavailableForBooking ? 'bg-noble-black/30' : 'bg-success-green'
                      "
                    />
                    <span class="text-[14px] font-semibold text-noble-black">{{
                      statusLabel
                    }}</span>
                  </div>
                </div>
                <!-- Condition -->
                <div
                  class="flex flex-col gap-1 px-0 md:px-6 md:border-r-[0.5px] border-cinnamon-ice/20"
                >
                  <span class="text-[10px] font-bold uppercase tracking-[1.5px] text-noble-black/40"
                    >Condition</span
                  >
                  <span
                    class="text-[14px] font-semibold"
                    :class="item.condition === 'POOR' ? 'text-burning-orange' : 'text-noble-black'"
                    >{{ formattedCondition }}</span
                  >
                </div>
                <!-- Replacement Cost -->
                <div
                  class="flex flex-col gap-1 px-0 md:px-6 md:border-r-[0.5px] border-cinnamon-ice/20"
                >
                  <span class="text-[10px] font-bold uppercase tracking-[1.5px] text-noble-black/40"
                    >Replacement</span
                  >
                  <span class="text-[14px] font-semibold text-noble-black">{{
                    replacementCostLabel
                  }}</span>
                </div>
                <!-- Tags -->
                <div class="flex flex-col gap-1 pl-0 md:pl-6">
                  <span class="text-[10px] font-bold uppercase tracking-[1.5px] text-noble-black/40"
                    >Tags</span
                  >
                  <div v-if="item.tags.length" class="flex flex-wrap gap-2">
                    <span
                      v-for="tag in item.tags"
                      :key="tag"
                      class="rounded-[12px] rounded-tl-[999px] rounded-br-[999px] bg-noble-black/5 px-2.5 py-1 text-[11px] font-medium text-noble-black/60 hover:bg-noble-black/10 transition-colors cursor-default"
                    >
                      {{ tag }}
                    </span>
                  </div>
                  <span v-else class="text-[14px] font-semibold text-noble-black/30">None</span>
                </div>
              </div>

              <!-- Horizontal Divider -->
              <div class="my-8 h-[0.5px] bg-cinnamon-ice/15" />

              <div class="grid grid-cols-1 md:grid-cols-2 gap-10">
                <!-- Known Issues -->
                <div class="flex flex-col gap-3">
                  <span class="text-[10px] font-bold uppercase tracking-[1.5px] text-noble-black/40"
                    >Known Issues</span
                  >
                  <div v-if="knownIssuesList.length" class="space-y-1">
                    <p
                      v-for="issue in knownIssuesList"
                      :key="issue"
                      class="text-[13px] text-noble-black/70 flex items-start gap-2"
                    >
                      <span class="flex items-center justify-center h-6 shrink-0"
                        ><span class="w-1 h-1 rounded-full bg-burning-orange"
                      /></span>
                      <span class="leading-6">{{ issue }}</span>
                    </p>
                  </div>
                  <p
                    v-else
                    class="text-[13px] font-medium text-success-green flex items-center gap-1.5"
                  >
                    No known issues reported
                    <Icon name="ph:check-circle-fill" size="14" class="shrink-0" />
                  </p>
                </div>
                <!-- Usage Limitations -->
                <div class="flex flex-col gap-3">
                  <span class="text-[10px] font-bold uppercase tracking-[1.5px] text-noble-black/40"
                    >Usage Limitations</span
                  >
                  <div v-if="usageLimitationsList.length" class="space-y-1">
                    <p
                      v-for="limitation in usageLimitationsList"
                      :key="limitation"
                      class="text-[13px] text-noble-black/70 flex items-start gap-2"
                    >
                      <span class="flex items-center justify-center h-6 shrink-0"
                        ><span class="w-1 h-1 rounded-full bg-burning-orange"
                      /></span>
                      <span class="leading-6">{{ limitation }}</span>
                    </p>
                  </div>
                  <p v-else class="text-[13px] italic text-noble-black/40">
                    No usage limitations listed
                  </p>
                </div>
              </div>
            </div>

            <!-- Description Section -->
            <div class="border-b border-cinnamon-ice/15 py-8">
              <div class="border-l-[3px] border-burning-orange pl-4 mb-4">
                <h2 class="text-lg font-semibold">Description</h2>
              </div>
              <p class="text-noble-black/80 text-sm leading-relaxed whitespace-pre-wrap">
                {{ item.description }}
              </p>
            </div>
            <!-- Offers Section -->
            <div class="border-b border-cinnamon-ice/15 py-8">
              <div class="border-l-[3px] border-burning-orange pl-4 mb-4">
                <h2 class="text-lg font-semibold">What This Item Offers</h2>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-y-2 sm:gap-x-10">
                <div
                  v-for="(offer, idx) in offerHighlights"
                  :key="idx"
                  class="flex items-start gap-3"
                >
                  <div class="flex items-center justify-center h-6 shrink-0">
                    <Icon name="ph:plus-bold" size="15" class="text-burning-orange" />
                  </div>
                  <span class="text-sm text-noble-black/90 leading-6">{{ offer }}</span>
                </div>
              </div>
            </div>
            <div v-if="includedItems.length" class="border-b border-cinnamon-ice/15 py-8 mb-12">
              <div class="border-l-[3px] border-burning-orange pl-4 mb-4">
                <h2 class="text-lg font-semibold">What's Included</h2>
              </div>
              <ul class="space-y-2">
                <li
                  v-for="(included, idx) in includedItems"
                  :key="idx"
                  class="flex items-start gap-3"
                >
                  <div class="flex items-center justify-center h-6 shrink-0">
                    <Icon name="ph:check-circle-fill" size="17" class="text-burning-orange" />
                  </div>
                  <span class="text-noble-black/90 text-sm leading-6">{{ included }}</span>
                </li>
              </ul>
            </div>

            <!-- Redesigned Lender Card -->
            <NuxtLink
              v-if="item.lenderUsername"
              :to="`/profile/${item.lenderUsername}`"
              class="bg-white rounded-[16px] p-5 border border-cinnamon-ice/30 flex items-center justify-between mt-16 group/seller shadow-sm hover:shadow-md transition-all duration-300"
            >
              <div class="flex items-center gap-4">
                <div
                  class="w-[52px] h-[52px] rounded-full border border-cinnamon-ice/40 bg-cinnamon-ice/10 flex items-center justify-center text-noble-black/70 text-lg font-bold shrink-0 overflow-hidden"
                >
                  <img
                    v-if="item.lenderAvatarUrl"
                    :src="item.lenderAvatarUrl"
                    class="w-full h-full object-cover"
                  />
                  <span v-else>{{ ownerInitials || "TU" }}</span>
                </div>

                <div class="flex flex-col">
                  <h3 class="text-[16px] font-semibold text-noble-black leading-tight">
                    {{ ownerName }}
                  </h3>
                  <div class="flex items-center gap-1.5 text-[13px] text-noble-black/60 mt-1">
                    <div class="flex items-center gap-1 text-burning-orange">
                      <Icon name="ph:star-fill" size="14" class="fill-current" />
                      <span class="font-bold">{{ lenderRatingLabel }}</span>
                    </div>
                    <span class="text-noble-black/30">·</span>
                    <span>{{ bookingCountLabel }}</span>
                  </div>
                  <p class="text-[12px] text-noble-black/40 mt-0.5">Item owner on TakeUP</p>
                </div>
              </div>

              <div class="text-[14px] font-semibold text-burning-orange hover:underline">
                View Profile →
              </div>
            </NuxtLink>

            <!-- Non-linked version -->
            <div
              v-else
              class="bg-white rounded-[16px] p-5 border border-cinnamon-ice/30 flex items-center gap-4 mt-16 shadow-sm"
            >
              <div
                class="w-[52px] h-[52px] rounded-full border border-cinnamon-ice/40 bg-cinnamon-ice/10 flex items-center justify-center text-noble-black/70 text-lg font-bold shrink-0 overflow-hidden"
              >
                <img
                  v-if="item.lenderAvatarUrl"
                  :src="item.lenderAvatarUrl"
                  class="w-full h-full object-cover"
                />
                <span v-else>{{ ownerInitials || "TU" }}</span>
              </div>
              <div class="flex flex-col">
                <h3 class="text-[16px] font-semibold text-noble-black leading-tight">
                  {{ ownerName }}
                </h3>
                <div class="flex items-center gap-1.5 text-[13px] text-noble-black/60 mt-1">
                  <div class="flex items-center gap-1 text-burning-orange">
                    <Icon name="ph:star-fill" size="14" class="fill-current" />
                    <span class="font-bold">{{ lenderRatingLabel }}</span>
                  </div>
                  <span class="text-noble-black/30">·</span>
                  <span>{{ bookingCountLabel }}</span>
                </div>
                <p class="text-[12px] text-noble-black/40 mt-0.5">Item owner on TakeUP</p>
              </div>
            </div>
          </div>

          <!-- Sidebar Layout (lg+) -->
          <div class="hidden lg:block space-y-6">
            <div
              class="bg-cream border border-cinnamon-ice/15 rounded-3xl p-6 shadow-sm overflow-hidden"
              @mouseleave="handleCalendarMouseLeave"
            >
              <div
                v-if="isItemUnavailableForBooking"
                class="mb-5 rounded-2xl border border-noble-black/10 bg-white px-4 py-3 text-sm text-noble-black/75"
              >
                <span class="font-semibold text-noble-black">{{ bookingAvailabilityTitle }}.</span>
                {{ bookingAvailabilityMessage }}
              </div>
              <div class="flex items-center justify-between mb-6">
                <h3 class="font-semibold text-noble-black">
                  {{ monthNames[viewMonth] }} {{ viewYear }}
                </h3>
                <div class="flex gap-2">
                  <button
                    class="p-1 hover:bg-white/20 rounded-full transition-colors text-noble-black/60"
                    :disabled="isItemUnavailableForBooking"
                    @click="changeMonth(-1)"
                  >
                    <Icon name="ph:caret-left" size="20" />
                  </button>
                  <button
                    class="p-1 hover:bg-white/20 rounded-full transition-colors text-noble-black/60"
                    :disabled="isItemUnavailableForBooking"
                    @click="changeMonth(1)"
                  >
                    <Icon name="ph:caret-right" size="20" />
                  </button>
                </div>
              </div>
              <div class="grid grid-cols-7 text-center mb-2">
                <div
                  v-for="day in daysOfWeek"
                  :key="day"
                  class="text-[10px] uppercase tracking-wider text-noble-black/40 font-bold py-2"
                >
                  {{ day }}
                </div>
              </div>
              <div class="grid grid-cols-7 relative">
                <div
                  v-for="(dayObj, idx) in days"
                  :key="idx"
                  class="relative flex items-center justify-center py-1"
                >
                  <div
                    v-if="dayObj.fullDate && startDate && isInRange(dayObj.fullDate)"
                    class="absolute inset-y-1 inset-x-0 bg-burning-orange/10 z-0"
                  />
                  <div
                    v-if="
                      dayObj.fullDate &&
                      startDate &&
                      (endDate || hoverDate) &&
                      dayObj.fullDate.getTime() ===
                        Math.min(startDate.getTime(), (endDate || hoverDate)!.getTime())
                    "
                    class="absolute inset-y-1 right-0 left-1/2 bg-burning-orange/10 rounded-l-full z-0"
                  />
                  <div
                    v-if="
                      dayObj.fullDate &&
                      startDate &&
                      (endDate || hoverDate) &&
                      dayObj.fullDate.getTime() ===
                        Math.max(startDate.getTime(), (endDate || hoverDate)!.getTime())
                    "
                    class="absolute inset-y-1 left-0 right-1/2 bg-burning-orange/10 rounded-r-full z-0"
                  />
                  <button
                    v-if="dayObj.day"
                    class="relative w-9 h-9 flex items-center justify-center text-sm rounded-full transition-all duration-200 z-10 select-none"
                    :class="[
                      dayObj.isUnavailable || dayObj.isPast
                        ? 'text-noble-black/30 cursor-not-allowed'
                        : 'text-noble-black hover:bg-transparent hover:text-burning-orange cursor-pointer',
                      dayObj.isUnavailable ? 'line-through' : '',
                      isSelected(dayObj.fullDate) ||
                      (hoverDate &&
                        dayObj.fullDate?.getTime() === hoverDate.getTime() &&
                        startDate &&
                        !endDate)
                        ? '!bg-burning-orange !text-white !hover:bg-burning-orange shadow-md scale-110 font-bold'
                        : '',
                      dayObj.isToday && !isSelected(dayObj.fullDate)
                        ? 'text-burning-orange font-bold'
                        : '',
                    ]"
                    @mousedown="
                      onMouseDown(
                        dayObj.fullDate,
                        dayObj.isUnavailable ?? false,
                        dayObj.isPast ?? false,
                      )
                    "
                    @mouseup="
                      onMouseUp(
                        dayObj.fullDate,
                        dayObj.isUnavailable ?? false,
                        dayObj.isPast ?? false,
                      )
                    "
                    @mouseenter="
                      onMouseEnter(
                        dayObj.fullDate,
                        dayObj.isUnavailable ?? false,
                        dayObj.isPast ?? false,
                      )
                    "
                    @click="
                      onDateClick(
                        dayObj.fullDate,
                        dayObj.isUnavailable ?? false,
                        dayObj.isPast ?? false,
                      )
                    "
                  >
                    {{ dayObj.day }}
                  </button>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="relative">
                <span
                  class="text-[10px] uppercase font-bold text-noble-black/40 tracking-wider mb-1.5 block ml-1"
                  >Start Time</span
                ><button
                  class="w-full bg-cream border border-cinnamon-ice/15 rounded-2xl px-4 py-3 text-sm font-medium text-noble-black flex items-center justify-between hover:border-burning-orange transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="isItemUnavailableForBooking"
                  @click="toggleStartTime"
                >
                  {{ startTime }}<Icon name="ph:caret-down" size="16" class="text-noble-black/30" />
                </button>
                <div
                  v-if="isStartTimeOpen"
                  class="absolute z-50 mt-2 w-full bg-white border border-cinnamon-ice/15 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  <div class="max-h-60 overflow-y-auto custom-time-scrollbar py-2">
                    <div
                      v-for="time in timeOptions"
                      :key="time"
                      class="px-4 py-2 text-sm text-noble-black hover:bg-cream hover:text-burning-orange cursor-pointer transition-colors"
                      :class="[
                        isStartTimePast(time) || isTimeOnDayBooked(time, startDate)
                          ? 'opacity-30 cursor-not-allowed pointer-events-none'
                          : startTime === time
                            ? 'bg-cream text-burning-orange font-bold'
                            : '',
                      ]"
                      @click="selectStartTime(time)"
                    >
                      {{ time }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="relative">
                <span
                  class="text-[10px] uppercase font-bold text-noble-black/40 tracking-wider mb-1.5 block ml-1"
                  >End Time</span
                ><button
                  class="w-full bg-cream border border-cinnamon-ice/15 rounded-2xl px-4 py-3 text-sm font-medium text-noble-black flex items-center justify-between hover:border-burning-orange transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="isItemUnavailableForBooking"
                  @click="toggleEndTime"
                >
                  {{ endTime }}<Icon name="ph:caret-down" size="16" class="text-noble-black/30" />
                </button>
                <div
                  v-if="isEndTimeOpen"
                  class="absolute z-50 mt-2 w-full bg-white border border-cinnamon-ice/15 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  <div class="max-h-60 overflow-y-auto custom-time-scrollbar py-2">
                    <div
                      v-for="time in timeOptions"
                      :key="time"
                      class="px-4 py-2 text-sm text-noble-black hover:bg-cream hover:text-burning-orange cursor-pointer transition-colors"
                      :class="[
                        isTimeDisabled(time, true) || isTimeOnDayBooked(time, displayEndDate)
                          ? 'opacity-30 cursor-not-allowed pointer-events-none'
                          : endTime === time
                            ? 'bg-cream text-burning-orange font-bold'
                            : '',
                      ]"
                      @click="selectEndTime(time)"
                    >
                      {{ time }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              class="bg-white border border-cinnamon-ice/30 rounded-[20px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.08)]"
            >
              <div class="flex items-baseline gap-1 mb-6">
                <span class="text-[32px] font-bold text-noble-black">{{ priceAmount }}</span>
                <span class="text-[16px] text-noble-black/40 font-medium">{{
                  priceUnitLabel
                }}</span>
              </div>

              <div class="grid grid-cols-2 mb-6 relative">
                <div class="absolute left-1/2 top-1 bottom-1 w-px bg-cinnamon-ice/15" />
                <div class="flex flex-col gap-1 pr-4">
                  <span class="text-[10px] uppercase font-bold text-noble-black/40 tracking-[1.5px]"
                    >Start</span
                  >
                  <div class="flex flex-col">
                    <span class="text-[14px] font-semibold text-noble-black">{{
                      formatDate(displayStartDate)
                    }}</span>
                    <span class="text-xs text-noble-black/50">{{ startTime }}</span>
                  </div>
                </div>
                <div class="flex flex-col gap-1 pl-4">
                  <span class="text-[10px] uppercase font-bold text-noble-black/40 tracking-[1.5px]"
                    >End</span
                  >
                  <div class="flex flex-col">
                    <span class="text-[14px] font-semibold text-noble-black">{{
                      formatDate(displayEndDate)
                    }}</span>
                    <span class="text-xs text-noble-black/50">{{ endTime }}</span>
                  </div>
                </div>
              </div>

              <div class="space-y-2 mb-4">
                <div class="flex justify-between items-center text-[13px] text-noble-black/60">
                  <span
                    >Rate ({{ item.freeToBorrow ? "Free" : formatPesoAmount(item.rentalFee) }} x
                    {{ totalUnits }} {{ totalUnitsLabel }})</span
                  >
                  <span class="font-medium">{{
                    item.freeToBorrow ? "Free" : formatPesoAmount(totalPrice)
                  }}</span>
                </div>
              </div>

              <div class="border-t border-dashed border-cinnamon-ice/30 my-4" />

              <div class="flex justify-between items-center mb-6">
                <span class="text-[16px] font-bold text-noble-black">Total</span>
                <span class="text-[16px] font-bold text-noble-black">{{
                  item.freeToBorrow ? "Free" : formatPesoAmount(totalPrice)
                }}</span>
              </div>

              <button
                class="w-full py-3 rounded-2xl bg-burning-orange text-white font-bold text-base transition-all duration-300 ease-in-out active:scale-[0.98] hover:brightness-110 shadow-md shadow-burning-orange/10 mb-2.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                :disabled="!canSubmitBooking"
                @click="submitBookingRequest"
              >
                {{ requestBookingButtonLabel }}
              </button>

              <button
                class="w-full py-3 rounded-2xl border border-burning-orange text-burning-orange font-bold text-base transition-all duration-300 ease-in-out active:scale-[0.98] hover:bg-burning-orange/5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                :disabled="!canAddToBag"
                @click="handleAddToBag"
              >
                <Icon v-if="isInBag" name="ph:check" size="16" class="stroke-[3]" />
                {{ addToBagButtonLabel }}
              </button>
            </div>
          </div>
        </div>

        <ReviewsSection
          :rating="item.rating"
          :reviews-count="item.reviewsCount"
          :reviews="item.reviews"
        />
      </div>

      <p v-else class="py-20 text-center text-sm text-noble-black/60">Item not found.</p>
    </main>

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
          v-if="showPaymentModal"
          class="fixed inset-0 z-[3000] flex items-center justify-center p-4"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            @click="showPaymentModal = false"
          ></div>

          <!-- Modal Content -->
          <div
            class="relative bg-white rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300"
          >
            <!-- Header -->
            <div class="px-8 pt-8 pb-4 flex items-center justify-between">
              <div>
                <h3 class="text-2xl font-bold text-neutral-800 font-geist">
                  Complete Booking Request
                </h3>
                <p class="text-sm text-neutral-500 mt-1">
                  Funds will be held securely until the rental is complete.
                </p>
              </div>
              <button
                class="p-2 text-neutral-400 hover:text-neutral-600 transition-colors"
                @click="showPaymentModal = false"
              >
                <Icon name="ph:x" size="24" />
              </button>
            </div>

            <!-- Booking Summary Snippet -->
            <div class="px-8 pb-6">
              <div class="bg-neutral-50 rounded-2xl p-4 flex gap-4 border border-neutral-100">
                <img
                  v-if="item?.thumbnailImage"
                  :src="item.thumbnailImage"
                  class="w-16 h-16 rounded-xl object-cover"
                />
                <div class="flex flex-col justify-center">
                  <p class="font-bold text-neutral-800 leading-tight">{{ item?.name }}</p>
                  <p class="text-xs text-neutral-500 mt-1">
                    {{ formatDate(startDate) }} - {{ formatDate(endDate || startDate) }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Payment Component -->
            <div class="px-8 pb-8">
              <WalletPayment
                :amount="totalPrice"
                related-entity-type="BOOKING_PENDING"
                :related-entity-id="item?.id || 'pending'"
                @success="handlePaymentSuccess"
                @cancel="showPaymentModal = false"
              />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Sticky Bottom Bar (Mobile < sm) -->
    <div
      v-if="item"
      class="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-cinnamon-ice/15 p-4 px-6 z-[100] shadow-[0_-10px_30px_rgba(0,0,0,0.08)] pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
    >
      <div class="flex items-center justify-between gap-4">
        <div class="flex flex-col">
          <div class="flex items-baseline gap-1">
            <span class="text-xl font-bold text-noble-black">{{ priceAmount }}</span>
            <span class="text-xs text-noble-black/60 font-medium">{{ priceUnitLabel }}</span>
          </div>
          <button class="text-[11px] font-bold text-burning-orange" @click="openBookingModal">
            {{
              startDate && displayEndDate
                ? `${formatDate(startDate)} — ${formatDate(displayEndDate)}`
                : "Select dates"
            }}
          </button>
        </div>
        <button
          class="px-6 py-2.5 text-white rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all flex items-center gap-2"
          :class="isInBag ? 'bg-noble-black' : 'bg-burning-orange'"
          @click="isInBag ? null : hasBookingSelection ? handleAddToBag() : openBookingModal()"
        >
          <Icon v-if="isInBag" name="ph:check" size="14" class="stroke-[3]" />
          {{
            isItemUnavailableForBooking
              ? `Currently ${unavailableItemLabel}`
              : startDate && displayEndDate
                ? `${formatDate(startDate)} — ${formatDate(displayEndDate)}`
                : "Select dates"
          }}
        </button>
      </div>
      <button
        class="px-6 py-2.5 text-white rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all flex items-center gap-2"
        :class="
          isItemUnavailableForBooking
            ? 'bg-noble-black/60'
            : isInBag
              ? 'bg-noble-black'
              : 'bg-burning-orange'
        "
        :disabled="isItemUnavailableForBooking"
        @click="isInBag ? null : hasBookingSelection ? handleAddToBag() : openBookingModal()"
      >
        <Icon v-if="isInBag" name="ph:check" size="14" class="stroke-[3]" />
        {{ mobileBookingButtonLabel }}
      </button>
    </div>

    <!-- Mobile Full-Screen Booking Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="translate-y-full"
        enter-to-class="translate-y-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="translate-y-0"
        leave-to-class="translate-y-full"
      >
        <div
          v-if="item && isMobileModalOpen"
          class="fixed inset-0 z-[200] bg-white overflow-y-auto flex flex-col"
        >
          <div
            class="sticky top-0 bg-white border-b border-cinnamon-ice/15 p-4 flex items-center justify-between z-10"
          >
            <button class="p-2 -ml-2" @click="closeBookingModal">
              <Icon name="ph:x" size="24" />
            </button>
            <h2 class="font-bold text-noble-black text-base">Booking Details</h2>
            <div class="w-10" />
          </div>
          <div class="p-6 space-y-8 pb-32">
            <div class="bg-cream border border-cinnamon-ice/15 rounded-3xl p-6">
              <h3 class="font-bold text-noble-black mb-3">
                {{ isItemUnavailableForBooking ? bookingAvailabilityTitle : "Select Dates" }}
              </h3>
              <p
                v-if="isItemUnavailableForBooking"
                class="mb-5 rounded-2xl border border-noble-black/10 bg-white px-4 py-3 text-sm text-noble-black/75"
              >
                {{ bookingAvailabilityMessage }}
              </p>
              <div class="flex items-center justify-between mb-6">
                <h3 class="font-semibold text-noble-black">
                  {{ monthNames[viewMonth] }} {{ viewYear }}
                </h3>
                <div class="flex gap-2">
                  <button
                    class="p-1 hover:bg-white/20 rounded-full transition-colors text-noble-black/60"
                    :disabled="isItemUnavailableForBooking"
                    @click="changeMonth(-1)"
                  >
                    <Icon name="ph:caret-left" size="20" />
                  </button>
                  <button
                    class="p-1 hover:bg-white/20 rounded-full transition-colors text-noble-black/60"
                    :disabled="isItemUnavailableForBooking"
                    @click="changeMonth(1)"
                  >
                    <Icon name="ph:caret-right" size="20" />
                  </button>
                </div>
              </div>
              <div class="grid grid-cols-7 text-center mb-2">
                <div
                  v-for="day in daysOfWeek"
                  :key="day"
                  class="text-[10px] uppercase tracking-wider text-noble-black/40 font-bold py-2"
                >
                  {{ day }}
                </div>
              </div>
              <div class="grid grid-cols-7 relative">
                <div
                  v-for="(dayObj, idx) in days"
                  :key="idx"
                  class="relative flex items-center justify-center py-1"
                >
                  <div
                    v-if="dayObj.fullDate && startDate && isInRange(dayObj.fullDate)"
                    class="absolute inset-y-1 inset-x-0 bg-burning-orange/10 z-0"
                  />
                  <div
                    v-if="
                      dayObj.fullDate &&
                      startDate &&
                      (endDate || hoverDate) &&
                      dayObj.fullDate.getTime() ===
                        Math.min(startDate.getTime(), (endDate || hoverDate)!.getTime())
                    "
                    class="absolute inset-y-1 right-0 left-1/2 bg-burning-orange/10 rounded-l-full z-0"
                  />
                  <div
                    v-if="
                      dayObj.fullDate &&
                      startDate &&
                      (endDate || hoverDate) &&
                      dayObj.fullDate.getTime() ===
                        Math.max(startDate.getTime(), (endDate || hoverDate)!.getTime())
                    "
                    class="absolute inset-y-1 left-0 right-1/2 bg-burning-orange/10 rounded-r-full z-0"
                  />
                  <button
                    v-if="dayObj.day"
                    class="relative w-9 h-9 flex items-center justify-center text-sm rounded-full transition-all duration-200 z-10 select-none"
                    :class="[
                      dayObj.isUnavailable || dayObj.isPast
                        ? 'text-noble-black/30 cursor-not-allowed'
                        : 'text-noble-black hover:bg-transparent hover:text-burning-orange cursor-pointer',
                      dayObj.isUnavailable ? 'line-through' : '',
                      isSelected(dayObj.fullDate) ||
                      (hoverDate &&
                        dayObj.fullDate?.getTime() === hoverDate.getTime() &&
                        startDate &&
                        !endDate)
                        ? '!bg-burning-orange !text-white !hover:bg-burning-orange shadow-md scale-110 font-bold'
                        : '',
                      dayObj.isToday && !isSelected(dayObj.fullDate)
                        ? 'text-burning-orange font-bold'
                        : '',
                    ]"
                    @mousedown="
                      onMouseDown(
                        dayObj.fullDate,
                        dayObj.isUnavailable ?? false,
                        dayObj.isPast ?? false,
                      )
                    "
                    @mouseup="
                      onMouseUp(
                        dayObj.fullDate,
                        dayObj.isUnavailable ?? false,
                        dayObj.isPast ?? false,
                      )
                    "
                    @mouseenter="
                      onMouseEnter(
                        dayObj.fullDate,
                        dayObj.isUnavailable ?? false,
                        dayObj.isPast ?? false,
                      )
                    "
                    @click="
                      onDateClick(
                        dayObj.fullDate,
                        dayObj.isUnavailable ?? false,
                        dayObj.isPast ?? false,
                      )
                    "
                  >
                    {{ dayObj.day }}
                  </button>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="relative">
                <span
                  class="text-[10px] uppercase font-bold text-noble-black/40 tracking-wider mb-1.5 block ml-1"
                  >Start Time</span
                ><button
                  class="w-full bg-cream border border-cinnamon-ice/15 rounded-2xl px-4 py-3 text-sm font-medium text-noble-black flex items-center justify-between hover:border-burning-orange transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="isItemUnavailableForBooking"
                  @click="toggleStartTime"
                >
                  {{ startTime }}<Icon name="ph:caret-down" size="16" class="text-noble-black/30" />
                </button>
                <div
                  v-if="isStartTimeOpen"
                  class="absolute z-50 mt-2 w-full bg-white border border-cinnamon-ice/15 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  <div class="max-h-60 overflow-y-auto custom-time-scrollbar py-2">
                    <div
                      v-for="time in timeOptions"
                      :key="time"
                      class="px-4 py-2 text-sm text-noble-black hover:bg-cream hover:text-burning-orange cursor-pointer transition-colors"
                      :class="[
                        isStartTimePast(time) || isTimeOnDayBooked(time, startDate)
                          ? 'opacity-30 cursor-not-allowed pointer-events-none'
                          : startTime === time
                            ? 'bg-cream text-burning-orange font-bold'
                            : '',
                      ]"
                      @click="selectStartTime(time)"
                    >
                      {{ time }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="relative">
                <span
                  class="text-[10px] uppercase font-bold text-noble-black/40 tracking-wider mb-1.5 block ml-1"
                  >End Time</span
                ><button
                  class="w-full bg-cream border border-cinnamon-ice/15 rounded-2xl px-4 py-3 text-sm font-medium text-noble-black flex items-center justify-between hover:border-burning-orange transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="isItemUnavailableForBooking"
                  @click="toggleEndTime"
                >
                  {{ endTime }}<Icon name="ph:caret-down" size="16" class="text-noble-black/30" />
                </button>
                <div
                  v-if="isEndTimeOpen"
                  class="absolute z-50 mt-2 w-full bg-white border border-cinnamon-ice/15 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  <div class="max-h-60 overflow-y-auto custom-time-scrollbar py-2">
                    <div
                      v-for="time in timeOptions"
                      :key="time"
                      class="px-4 py-2 text-sm text-noble-black hover:bg-cream hover:text-burning-orange cursor-pointer transition-colors"
                      :class="[
                        isTimeDisabled(time, true) || isTimeOnDayBooked(time, displayEndDate)
                          ? 'opacity-30 cursor-not-allowed pointer-events-none'
                          : endTime === time
                            ? 'bg-cream text-burning-orange font-bold'
                            : '',
                      ]"
                      @click="selectEndTime(time)"
                    >
                      {{ time }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="bg-cream border border-cinnamon-ice/15 rounded-3xl p-6 shadow-sm">
              <div class="flex items-baseline gap-1 mb-4">
                <span class="text-3xl font-bold text-noble-black">{{ priceAmount }}</span
                ><span class="text-sm text-noble-black/60 font-medium">{{ priceUnitLabel }}</span>
              </div>
              <div class="grid grid-cols-2 mb-6 relative">
                <div class="absolute left-1/2 top-1 bottom-1 w-px bg-cinnamon-ice/15" />
                <div class="flex flex-col gap-1 pr-4">
                  <span class="text-[10px] uppercase font-bold text-noble-black/40 tracking-wider"
                    >Start</span
                  >
                  <div class="flex flex-col">
                    <span class="text-sm font-semibold text-noble-black">{{
                      formatDate(displayStartDate)
                    }}</span
                    ><span class="text-xs text-noble-black/60">{{ startTime }}</span>
                  </div>
                </div>
                <div class="flex flex-col gap-1 pl-4">
                  <span class="text-[10px] uppercase font-bold text-noble-black/40 tracking-wider"
                    >End</span
                  >
                  <div class="flex flex-col">
                    <span class="text-sm font-semibold text-noble-black">{{
                      formatDate(displayEndDate)
                    }}</span
                    ><span class="text-xs text-noble-black/60">{{ endTime }}</span>
                  </div>
                </div>
              </div>
              <div class="h-px bg-cinnamon-ice/15 mb-4" />
              <div class="space-y-2 mb-4">
                <div class="flex justify-between items-center text-sm text-noble-black/70">
                  <span>
                    Rate ({{ item.freeToBorrow ? "Free" : formatPesoAmount(item.rentalFee) }} x
                    {{ totalUnits }} {{ totalUnitsLabel }})
                  </span>
                  <span class="font-medium text-noble-black">
                    {{ item.freeToBorrow ? "Free" : formatPesoAmount(totalPrice) }}
                  </span>
                </div>
              </div>
              <div class="h-px bg-cinnamon-ice/15 mb-4" />
              <div class="flex justify-between items-center mb-4">
                <span class="text-base font-semibold text-noble-black">Total</span
                ><span class="text-lg font-bold text-noble-black">
                  {{ item.freeToBorrow ? "Free" : formatPesoAmount(totalPrice) }}
                </span>
              </div>
            </div>
          </div>
          <!-- Modal Footer (Confirm) -->
          <div
            v-if="hasBookingSelection"
            class="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-cinnamon-ice/15 flex justify-center"
          >
            <button
              class="w-full py-4 bg-burning-orange text-white rounded-2xl font-bold text-lg"
              @click="closeBookingModal"
            >
              Confirm Selection
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Image Lightbox -->
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
          v-if="isLightboxOpen && item"
          class="fixed inset-0 z-[2000] bg-noble-black flex items-center justify-center p-4 md:p-12"
        >
          <button
            class="absolute top-6 right-6 text-white/70 hover:text-white transition-colors p-2 z-[2010]"
            @click="closeLightbox"
          >
            <Icon name="ph:x" size="32" />
          </button>
          <button
            v-if="imageGallery.length > 1"
            class="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-4 z-[2010]"
            @click="prevImage"
          >
            <Icon name="ph:caret-left" size="48" />
          </button>
          <button
            v-if="imageGallery.length > 1"
            class="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-4 z-[2010]"
            @click="nextImage"
          >
            <Icon name="ph:caret-right" size="48" />
          </button>
          <div class="relative w-full h-full flex items-center justify-center">
            <img
              v-if="currentImage"
              :src="currentImage"
              :alt="item.name"
              class="max-w-full max-h-full object-contain select-none shadow-2xl"
              @click.stop
            />
            <div
              class="absolute bottom-0 left-1/2 -translate-x-1/2 text-white/60 text-sm font-medium pb-4"
            >
              {{ imageGallery.length ? currentImageIndex + 1 : 0 }} / {{ imageGallery.length }}
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <div
      v-if="shareFeedback"
      class="fixed right-4 top-20 z-[2100] rounded-full bg-noble-black px-4 py-2 text-sm text-white shadow-lg"
    >
      {{ shareFeedback }}
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.custom-time-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: theme("colors.cinnamon-ice") transparent;
}
.custom-time-scrollbar::-webkit-scrollbar {
  width: 3px !important;
}
.custom-time-scrollbar::-webkit-scrollbar-track {
  background: transparent !important;
}
.custom-time-scrollbar::-webkit-scrollbar-thumb {
  background-color: theme("colors.cinnamon-ice") !important;
  border-radius: 20px !important;
}
.pb-safe-area-inset-bottom {
  padding-bottom: env(safe-area-inset-bottom, 16px);
}
</style>
