<script setup lang="ts">
import type { inferRouterOutputs } from "@trpc/server"
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import { useBag } from "../../composables/use-bag"
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
const backNavigationPath = "/dashboard"
const backNavigationLabel = "Back to listings"

const {
  data,
  pending,
  error,
  refresh: refreshItem,
} = await useAsyncData(
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
  { watch: [itemId] },
)

if (error.value) {
  throw error.value
}

const item = computed(() => data.value)

const currentDate = new Date()
const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())

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
const bookingErrorMessage = ref("")
const bookingSuccessMessage = ref("")

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
const typeLabel = computed(() => (item.value?.freeToBorrow ? "Borrow" : "Rent"))
const isItemAvailableForBooking = computed(() => item.value?.status === "AVAILABLE")
const ownerName = computed(() => item.value?.ownerName ?? "TakeUP member")
const ownerInitials = computed(() => {
  const parts = ownerName.value.split(/\s+/).filter(Boolean)
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
})

const ratingLabel = computed(() => (item.value ? item.value.rating.toFixed(1) : "0.0"))
const bookingCountLabel = computed(() => `${item.value?.bookingCount ?? 0} booking(s)`)

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
  (item.value?.availability ?? []).map((slot) => ({
    id: slot.id,
    startDate: normalizeDate(new Date(slot.startDate)),
    endDate: normalizeDate(new Date(slot.endDate)),
    status: slot.status,
  })),
)

const isDateUnavailable = (date: Date | null) => {
  if (!date) return true

  const normalizedDate = normalizeDate(date)
  if (normalizedDate.getTime() < today.getTime()) return true

  if (!availabilityRanges.value.length) return false

  const hasAvailableWindow = availabilityRanges.value.some(
    (range) =>
      range.status === "AVAILABLE" &&
      normalizedDate.getTime() >= range.startDate.getTime() &&
      normalizedDate.getTime() <= range.endDate.getTime(),
  )

  const hasBlockedWindow = availabilityRanges.value.some(
    (range) =>
      range.status !== "AVAILABLE" &&
      normalizedDate.getTime() >= range.startDate.getTime() &&
      normalizedDate.getTime() <= range.endDate.getTime(),
  )

  if (hasBlockedWindow) return true
  return !hasAvailableWindow
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

const isTimeDisabled = (timeValue: string, isEnd: boolean) => {
  if (!isSameDay.value) return false
  if (!isEnd) return false

  return timeToMinutes(timeValue) <= timeToMinutes(startTime.value)
}

const selectStartTime = (timeValue: string) => {
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

  endTime.value = timeValue
  isEndTimeOpen.value = false
}

const toggleStartTime = () => {
  isStartTimeOpen.value = !isStartTimeOpen.value
  isEndTimeOpen.value = false
}

const toggleEndTime = () => {
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
    isItemAvailableForBooking.value &&
    hasBookingSelection.value &&
    selectedBookingWindow.value !== null &&
    !isSubmittingBooking.value,
)

const bookingFeedbackMessage = computed(() => {
  if (item.value && !isItemAvailableForBooking.value) {
    return `This item is currently marked as ${statusLabel.value.toLowerCase()} and cannot be booked.`
  }

  if (bookingErrorMessage.value) return bookingErrorMessage.value
  if (bookingSuccessMessage.value) return bookingSuccessMessage.value
  return "You won't be charged yet."
})

const bookingFeedbackClass = computed(() => {
  if (item.value && !isItemAvailableForBooking.value) {
    return "text-cinnabar-red"
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
  isSubmittingBooking.value ? "Requesting Booking..." : "Request Booking",
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

const isInBag = computed(() => {
  if (!item.value || !selectedBookingWindow.value) return false

  return hasItemWithWindow(
    item.value.id,
    selectedBookingWindow.value.startDate,
    selectedBookingWindow.value.endDate,
  )
})

const canAddToBag = computed(
  () =>
    isItemAvailableForBooking.value &&
    hasBookingSelection.value &&
    selectedBookingWindow.value !== null &&
    !isInBag.value,
)

const showBagFeedback = (message: string, tone: "success" | "error") => {
  bagFeedbackMessage.value = message
  bagFeedbackTone.value = tone

  window.setTimeout(() => {
    if (bagFeedbackMessage.value === message) {
      bagFeedbackMessage.value = ""
    }
  }, 2400)
}

const handleAddToBag = async () => {
  if (!item.value || !selectedBookingWindow.value || !canAddToBag.value || isAddingToBag.value) {
    return
  }

  try {
    isAddingToBag.value = true

    await addItemToBag({
      itemId: item.value.id,
      startAt: selectedBookingWindow.value.startDate,
      endAt: selectedBookingWindow.value.endDate,
    })

    showBagFeedback("Added to Bag.", "success")

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
  if (!import.meta.client) return

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

const toggleSaved = () => {
  isSaved.value = !isSaved.value
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
    !isItemAvailableForBooking.value ||
    !selectedBookingWindow.value ||
    isSubmittingBooking.value
  ) {
    return
  }

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
      },
    })

    bookingSuccessMessage.value = "Booking request sent to the lender."
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

    <main class="max-w-7xl mx-auto px-4 sm:px-6 py-6" @mouseleave="handleCalendarMouseLeave">
      <!-- Back Link -->
      <NuxtLink
        :to="backNavigationPath"
        class="flex items-center gap-2 text-noble-black/70 hover:text-burning-orange transition-colors mb-6 group"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="transition-transform group-hover:-translate-x-1"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
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

      <div v-else-if="item" class="pb-28 lg:pb-0">
        <!-- Title & Actions -->
        <div class="flex justify-between items-start mb-2">
          <div>
            <div class="mb-3 flex flex-wrap gap-2">
              <span
                v-for="category in formattedCategories"
                :key="category"
                class="rounded-full border border-cinnamon-ice bg-cream px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-burning-orange"
              >
                {{ category }}
              </span>
              <span
                v-if="item.isTrending"
                class="rounded-full bg-burning-orange px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white"
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="group-hover:stroke-[2] transition-all duration-300 ease-in-out"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
                <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
              </svg>
            </button>
            <button
              class="p-2 transition-all duration-300 ease-in-out group"
              :class="
                isSaved ? 'text-burning-orange' : 'text-noble-black/70 hover:text-noble-black'
              "
              title="Save"
              @click="toggleSaved"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="group-hover:stroke-[2] transition-all duration-300 ease-in-out"
                :class="{ 'fill-burning-orange/20': isSaved }"
              >
                <path
                  d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- Rating Row -->
        <div class="flex items-center gap-2 mb-8 text-sm">
          <div class="flex items-center gap-1 text-burning-orange">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon
                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
              />
            </svg>
            <span class="font-bold">{{ ratingLabel }}</span>
          </div>
          <span class="text-noble-black/60">({{ bookingCountLabel }})</span>
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
                <div
                  class="absolute top-4 left-4 px-4 py-1.5 min-w-[80px] h-[32px] rounded-full font-geist text-[15px] font-normal tracking-wide flex items-center justify-center shadow-sm bg-cinnamon-ice text-noble-black"
                >
                  {{ typeLabel }}
                </div>
                <button
                  v-if="imageGallery.length > 1"
                  class="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  @click="prevImage"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <button
                  v-if="imageGallery.length > 1"
                  class="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  @click="nextImage"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
                <div
                  class="absolute bottom-4 left-4 px-3 py-1.5 bg-white/80 backdrop-blur-sm text-noble-black text-[13px] font-medium rounded-full shadow-sm"
                >
                  {{ imageGallery.length ? currentImageIndex + 1 : 0 }} / {{ imageGallery.length }}
                </div>
                <button
                  class="absolute bottom-4 right-4 p-2 bg-white/80 backdrop-blur-sm text-noble-black rounded-full hover:bg-white transition-colors shadow-sm z-10"
                  @click="openLightbox"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M15 3h6v6" />
                    <path d="M9 21H3v-6" />
                    <path d="M21 3l-7 7" />
                    <path d="M3 21l7-7" />
                  </svg>
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
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="m15 18-6-6 6-6" />
                    </svg>
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
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
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
                    class="bg-cream border border-cinnamon-ice rounded-3xl p-6 shadow-sm overflow-hidden"
                    @mouseleave="handleCalendarMouseLeave"
                  >
                    <!-- Calendar Grid -->
                    <div class="flex items-center justify-between mb-6">
                      <h3 class="font-semibold text-noble-black">
                        {{ monthNames[viewMonth] }} {{ viewYear }}
                      </h3>
                      <div class="flex gap-2">
                        <button
                          class="p-1 hover:bg-white/20 rounded-full transition-colors text-noble-black/60"
                          @click="changeMonth(-1)"
                        >
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <path d="m15 18-6-6 6-6" />
                          </svg>
                        </button>
                        <button
                          class="p-1 hover:bg-white/20 rounded-full transition-colors text-noble-black/60"
                          @click="changeMonth(1)"
                        >
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <path d="m9 18 6-6-6-6" />
                          </svg>
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
                        class="w-full bg-cream border border-cinnamon-ice rounded-2xl px-4 py-3 text-sm font-medium text-noble-black flex items-center justify-between hover:border-burning-orange transition-colors"
                        @click="toggleStartTime"
                      >
                        {{ startTime
                        }}<svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          class="text-noble-black/30"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                      <div
                        v-if="isStartTimeOpen"
                        class="absolute z-50 mt-2 w-full bg-white border border-cinnamon-ice rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                      >
                        <div class="max-h-60 overflow-y-auto custom-time-scrollbar py-2">
                          <div
                            v-for="time in timeOptions"
                            :key="time"
                            class="px-4 py-2 text-sm text-noble-black hover:bg-cream hover:text-burning-orange cursor-pointer transition-colors"
                            :class="
                              startTime === time ? 'bg-cream text-burning-orange font-bold' : ''
                            "
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
                        class="w-full bg-cream border border-cinnamon-ice rounded-2xl px-4 py-3 text-sm font-medium text-noble-black flex items-center justify-between hover:border-burning-orange transition-colors"
                        @click="toggleEndTime"
                      >
                        {{ endTime
                        }}<svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          class="text-noble-black/30"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                      <div
                        v-if="isEndTimeOpen"
                        class="absolute z-50 mt-2 w-full bg-white border border-cinnamon-ice rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                      >
                        <div class="max-h-60 overflow-y-auto custom-time-scrollbar py-2">
                          <div
                            v-for="time in timeOptions"
                            :key="time"
                            class="px-4 py-2 text-sm text-noble-black hover:bg-cream hover:text-burning-orange cursor-pointer transition-colors"
                            :class="[
                              isTimeDisabled(time, true)
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
                  class="bg-cream border border-cinnamon-ice rounded-3xl p-6 shadow-sm flex flex-col h-full justify-between"
                >
                  <div>
                    <div class="flex items-baseline gap-1 mb-4">
                      <span class="text-3xl font-bold text-noble-black">{{ priceAmount }}</span
                      ><span class="text-sm text-noble-black/60 font-medium">{{
                        priceUnitLabel
                      }}</span>
                    </div>
                    <div class="grid grid-cols-2 mb-6 relative">
                      <div class="absolute left-1/2 top-1 bottom-1 w-px bg-cinnamon-ice/30" />
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
                      class="w-full py-3 text-white rounded-2xl font-bold text-base transition-all duration-300 ease-in-out active:scale-[0.98] shadow-md shadow-burning-orange/10 mb-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      :class="
                        isInBag
                          ? 'bg-noble-black hover:bg-noble-black/90'
                          : 'bg-burning-orange hover:bg-blue-estate'
                      "
                      :disabled="!canAddToBag"
                      @click="handleAddToBag"
                    >
                      <svg
                        v-if="isInBag"
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {{ isInBag ? "Added to Bag" : "Add to Bag" }}
                    </button>
                    <p
                      class="text-center text-[11px] font-normal"
                      :class="
                        bagFeedbackMessage
                          ? bagFeedbackTone === 'success'
                            ? 'text-blue-estate'
                            : 'text-cinnabar-red'
                          : 'text-noble-black/40'
                      "
                    >
                      {{ bagFeedbackMessage || "You won't be charged yet." }}
                    </p>
                    <button
                      class="w-full py-3 rounded-2xl border border-noble-black/10 bg-white text-noble-black font-bold text-base transition-all duration-300 ease-in-out active:scale-[0.98] hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mb-3"
                      :disabled="!canSubmitBooking"
                      @click="submitBookingRequest"
                    >
                      {{ requestBookingButtonLabel }}
                    </button>
                    <p class="text-center text-[11px] font-normal" :class="bookingFeedbackClass">
                      {{ bookingFeedbackMessage }}
                    </p>
                  </div>
                  <div>
                    <div class="h-px bg-cinnamon-ice/30 mb-4" />
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
                    <div class="h-px bg-cinnamon-ice/30 mb-4" />
                    <div class="flex justify-between items-center mb-4">
                      <span class="text-base font-semibold text-noble-black">Total</span
                      ><span class="text-lg font-bold text-noble-black">
                        {{ item.freeToBorrow ? "Free" : formatPesoAmount(totalPrice) }}
                      </span>
                    </div>
                    <div class="h-px bg-cinnamon-ice/30 mb-4" />
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
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg
                      ><span class="text-[11px] font-normal">Protected by TakeUP Guarantee</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 2b. Small Layout (sm to md): Stacked, Collapsible Calendar & Time -->
              <div class="hidden sm:block md:hidden space-y-6">
                <div class="bg-cream border border-cinnamon-ice rounded-3xl p-6 shadow-sm">
                  <button
                    class="w-full flex items-center justify-between group"
                    @click="isCalendarExpanded = !isCalendarExpanded"
                  >
                    <div class="flex flex-col items-start">
                      <h3 class="font-bold text-noble-black">Select Dates & Time</h3>
                      <p class="text-[11px] text-noble-black/60 font-medium">
                        {{
                          startDate
                            ? `${formatDate(startDate)} at ${startTime} — ${endDate ? formatDate(endDate) : "Select end date"} at ${endTime}`
                            : "When do you need this?"
                        }}
                      </p>
                    </div>
                    <div
                      class="w-10 h-10 rounded-full bg-white/50 border border-cinnamon-ice/30 flex items-center justify-center transition-all group-hover:bg-white group-hover:border-burning-orange/30"
                      :class="{
                        'rotate-180 bg-burning-orange/5 !border-burning-orange/20':
                          isCalendarExpanded,
                      }"
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="text-noble-black/40"
                        :class="{ '!text-burning-orange': isCalendarExpanded }"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
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
                      class="mt-8 pt-6 border-t border-cinnamon-ice/20 space-y-8"
                    >
                      <div>
                        <div class="flex items-center justify-between mb-6">
                          <h3 class="font-semibold text-noble-black">
                            {{ monthNames[viewMonth] }} {{ viewYear }}
                          </h3>
                          <div class="flex gap-2">
                            <button
                              class="p-1 hover:bg-white/20 rounded-full transition-colors text-noble-black/60"
                              @click="changeMonth(-1)"
                            >
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <path d="m15 18-6-6 6-6" />
                              </svg>
                            </button>
                            <button
                              class="p-1 hover:bg-white/20 rounded-full transition-colors text-noble-black/60"
                              @click="changeMonth(1)"
                            >
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <path d="m9 18 6-6-6-6" />
                              </svg>
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
                            class="w-full bg-cream border border-cinnamon-ice rounded-2xl px-4 py-3 text-sm font-medium text-noble-black flex items-center justify-between hover:border-burning-orange transition-colors"
                            @click="toggleStartTime"
                          >
                            {{ startTime
                            }}<svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.5"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              class="text-noble-black/30"
                            >
                              <path d="m6 9 6 6 6-6" />
                            </svg>
                          </button>
                          <div
                            v-if="isStartTimeOpen"
                            class="absolute z-50 mt-2 w-full bg-white border border-cinnamon-ice rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                          >
                            <div class="max-h-60 overflow-y-auto custom-time-scrollbar py-2">
                              <div
                                v-for="time in timeOptions"
                                :key="time"
                                class="px-4 py-2 text-sm text-noble-black hover:bg-cream hover:text-burning-orange cursor-pointer transition-colors"
                                :class="
                                  startTime === time ? 'bg-cream text-burning-orange font-bold' : ''
                                "
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
                            class="w-full bg-cream border border-cinnamon-ice rounded-2xl px-4 py-3 text-sm font-medium text-noble-black flex items-center justify-between hover:border-burning-orange transition-colors"
                            @click="toggleEndTime"
                          >
                            {{ endTime
                            }}<svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.5"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              class="text-noble-black/30"
                            >
                              <path d="m6 9 6 6 6-6" />
                            </svg>
                          </button>
                          <div
                            v-if="isEndTimeOpen"
                            class="absolute z-50 mt-2 w-full bg-white border border-cinnamon-ice rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                          >
                            <div class="max-h-60 overflow-y-auto custom-time-scrollbar py-2">
                              <div
                                v-for="time in timeOptions"
                                :key="time"
                                class="px-4 py-2 text-sm text-noble-black hover:bg-cream hover:text-burning-orange cursor-pointer transition-colors"
                                :class="
                                  endTime === time ? 'bg-cream text-burning-orange font-bold' : ''
                                "
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
                <div class="bg-cream border border-cinnamon-ice rounded-3xl p-6 shadow-sm">
                  <div class="flex items-baseline gap-1 mb-4">
                    <span class="text-3xl font-bold text-noble-black">{{ priceAmount }}</span
                    ><span class="text-sm text-noble-black/60 font-medium">{{
                      priceUnitLabel
                    }}</span>
                  </div>
                  <div class="grid grid-cols-2 mb-6 relative">
                    <div class="absolute left-1/2 top-1 bottom-1 w-px bg-cinnamon-ice/30" />
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
                    class="w-full py-2 text-white rounded-2xl font-medium text-base transition-all duration-300 ease-in-out active:scale-[0.98] shadow-md shadow-burning-orange/10 mb-2.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    :class="
                      isInBag
                        ? 'bg-noble-black hover:bg-noble-black/90'
                        : 'bg-burning-orange hover:bg-blue-estate'
                    "
                    :disabled="!canAddToBag"
                    @click="handleAddToBag"
                  >
                    <svg
                      v-if="isInBag"
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {{ isInBag ? "Added to Bag" : "Add to Bag" }}
                  </button>
                  <p
                    class="text-center text-[11px] mb-4 font-normal"
                    :class="
                      bagFeedbackMessage
                        ? bagFeedbackTone === 'success'
                          ? 'text-blue-estate'
                          : 'text-cinnabar-red'
                        : 'text-noble-black/40'
                    "
                  >
                    {{ bagFeedbackMessage || "You won't be charged yet." }}
                  </p>
                  <button
                    class="w-full py-2 rounded-2xl border border-noble-black/10 bg-white text-noble-black font-medium text-base transition-all duration-300 ease-in-out active:scale-[0.98] hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mb-2.5"
                    :disabled="!canSubmitBooking"
                    @click="submitBookingRequest"
                  >
                    {{ requestBookingButtonLabel }}
                  </button>
                  <p class="text-center text-[11px] mb-4 font-normal" :class="bookingFeedbackClass">
                    {{ bookingFeedbackMessage }}
                  </p>
                  <div class="h-px bg-cinnamon-ice/30 mb-4" />
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
                  <div class="h-px bg-cinnamon-ice/30 mb-4" />
                  <div class="flex justify-between items-center mb-4">
                    <span class="text-base font-semibold text-noble-black">Total</span
                    ><span class="text-lg font-bold text-noble-black">
                      {{ item.freeToBorrow ? "Free" : formatPesoAmount(totalPrice) }}
                    </span>
                  </div>
                  <div class="h-px bg-cinnamon-ice/30 mb-4" />
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
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg
                    ><span class="text-[11px] font-normal">Protected by TakeUP Guarantee</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Unified Metadata Container -->
            <div
              class="mb-10 rounded-2xl border-[0.5px] border-cinnamon-ice bg-white p-7 md:p-8 shadow-sm"
            >
              <!-- Top Metadata Row -->
              <div class="grid grid-cols-2 md:grid-cols-4 gap-y-8 md:gap-y-0 items-start">
                <!-- Status -->
                <div class="flex flex-col gap-3 pr-4 md:border-r-[0.5px] border-cinnamon-ice/60">
                  <span class="text-[11px] font-bold uppercase tracking-widest text-noble-black/50"
                    >Status</span
                  >
                  <div
                    class="flex w-fit items-center gap-2 rounded-full bg-burning-orange/10 px-3 py-1"
                  >
                    <div class="h-1.5 w-1.5 rounded-full bg-burning-orange" />
                    <span class="text-xs font-bold text-burning-orange">{{ statusLabel }}</span>
                  </div>
                </div>
                <!-- Condition -->
                <div
                  class="flex flex-col gap-3 px-0 md:px-6 md:border-r-[0.5px] border-cinnamon-ice/60"
                >
                  <span class="text-[11px] font-bold uppercase tracking-widest text-noble-black/50"
                    >Condition</span
                  >
                  <div class="flex w-fit items-center rounded-full bg-noble-black/5 px-3 py-1">
                    <span class="text-xs font-bold text-noble-black/70">{{
                      formattedCondition
                    }}</span>
                  </div>
                </div>
                <!-- Replacement Cost -->
                <div
                  class="flex flex-col gap-3 px-0 md:px-6 md:border-r-[0.5px] border-cinnamon-ice/60"
                >
                  <span class="text-[11px] font-bold uppercase tracking-widest text-noble-black/50"
                    >Replacement</span
                  >
                  <span class="text-base font-semibold text-noble-black">{{
                    replacementCostLabel
                  }}</span>
                </div>
                <!-- Tags -->
                <div class="flex flex-col gap-3 pl-0 md:pl-6">
                  <span class="text-[11px] font-bold uppercase tracking-widest text-noble-black/50"
                    >Tags</span
                  >
                  <div v-if="item.tags.length" class="flex flex-wrap gap-2">
                    <span
                      v-for="tag in item.tags"
                      :key="tag"
                      class="rounded-full border border-cinnamon-ice/60 bg-cinnamon-ice/10 px-2.5 py-0.5 text-[11px] font-medium text-noble-black/60 hover:border-burning-orange/40 hover:bg-burning-orange/5 transition-colors cursor-default"
                    >
                      #{{ tag }}
                    </span>
                  </div>
                  <span v-else class="text-sm italic text-noble-black/30">None listed</span>
                </div>
              </div>

              <!-- Horizontal Divider -->
              <div class="my-8 h-[0.5px] bg-cinnamon-ice/60" />

              <!-- Bottom Metadata Row -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-10">
                <!-- Known Issues -->
                <div class="flex flex-col gap-3">
                  <span class="text-[11px] font-bold uppercase tracking-widest text-noble-black/50"
                    >Known Issues</span
                  >
                  <div v-if="knownIssuesList.length" class="space-y-2">
                    <p
                      v-for="issue in knownIssuesList"
                      :key="issue"
                      class="text-sm leading-relaxed text-noble-black/80 flex items-start gap-2"
                    >
                      <span
                        class="text-burning-orange mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current"
                      />
                      {{ issue }}
                    </p>
                  </div>
                  <p v-else class="text-sm italic text-noble-black/40">No known issues listed</p>
                </div>
                <!-- Usage Limitations -->
                <div class="flex flex-col gap-3">
                  <span class="text-[11px] font-bold uppercase tracking-widest text-noble-black/50"
                    >Usage Limitations</span
                  >
                  <div v-if="usageLimitationsList.length" class="space-y-2">
                    <p
                      v-for="limitation in usageLimitationsList"
                      :key="limitation"
                      class="text-sm leading-relaxed text-noble-black/80 flex items-start gap-2"
                    >
                      <span
                        class="text-burning-orange mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current"
                      />
                      {{ limitation }}
                    </p>
                  </div>
                  <p v-else class="text-sm italic text-noble-black/40">
                    No usage limitations listed
                  </p>
                </div>
              </div>
            </div>

            <!-- Description Section -->
            <div class="border-b border-cinnamon-ice py-8">
              <h2 class="text-lg font-semibold mb-3">Description</h2>
              <p class="text-noble-black/80 text-sm leading-relaxed">{{ item.description }}</p>
            </div>
            <!-- Offers Section -->
            <div class="border-b border-cinnamon-ice py-8">
              <h2 class="text-lg font-semibold mb-3">What This Item Offers</h2>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div
                  v-for="(offer, idx) in offerHighlights"
                  :key="idx"
                  class="flex items-center gap-2.5 px-3 py-2 bg-cream rounded-xl border border-cinnamon-ice/20"
                >
                  <div class="text-burning-orange scale-90 shrink-0">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="M12 5v14" />
                    </svg>
                  </div>
                  <span class="text-sm text-noble-black/90">{{ offer }}</span>
                </div>
              </div>
            </div>
            <div v-if="includedItems.length" class="border-b border-cinnamon-ice py-8 mb-12">
              <h2 class="text-lg font-semibold mb-3">What's Included</h2>
              <ul class="space-y-2">
                <li
                  v-for="(included, idx) in includedItems"
                  :key="idx"
                  class="flex items-center gap-2.5"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="text-burning-orange"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <span class="text-noble-black/90 text-sm">{{ included }}</span>
                </li>
              </ul>
            </div>

            <!-- Seller Card -->
            <div
              class="bg-cream rounded-3xl p-5 border border-cinnamon-ice/30 flex items-center justify-between gap-4 mt-16 sm:p-6 sm:gap-6"
            >
              <div class="flex items-center gap-4 sm:gap-5">
                <div
                  class="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-cinnamon-ice flex items-center justify-center text-white text-lg sm:text-xl font-bold shrink-0"
                >
                  {{ ownerInitials || "TU" }}
                </div>
                <div class="flex flex-col">
                  <h3 class="text-base sm:text-lg font-semibold text-noble-black">
                    {{ ownerName }}
                  </h3>
                  <div class="flex items-center gap-1.5 text-sm">
                    <div class="flex items-center gap-1 text-burning-orange">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <polygon
                          points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                        />
                      </svg>
                      <span class="font-bold">{{ ratingLabel }}</span>
                    </div>
                    <span class="text-noble-black/60">({{ bookingCountLabel }})</span>
                  </div>
                  <p class="hidden sm:block text-xs text-noble-black/60 mt-1">
                    Item owner on TakeUP
                  </p>
                </div>
              </div>
              <button
                class="w-10 h-10 rounded-full bg-blue-estate flex items-center justify-center hover:opacity-90 transition-opacity shrink-0"
                title="Message owner"
              >
                <svg
                  class="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
                  />
                </svg>
              </button>
            </div>
          </div>

          <!-- Sidebar Layout (lg+) -->
          <div class="hidden lg:block space-y-6">
            <div
              class="bg-cream border border-cinnamon-ice rounded-3xl p-6 shadow-sm overflow-hidden"
              @mouseleave="handleCalendarMouseLeave"
            >
              <div class="flex items-center justify-between mb-6">
                <h3 class="font-semibold text-noble-black">
                  {{ monthNames[viewMonth] }} {{ viewYear }}
                </h3>
                <div class="flex gap-2">
                  <button
                    class="p-1 hover:bg-white/20 rounded-full transition-colors text-noble-black/60"
                    @click="changeMonth(-1)"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                  <button
                    class="p-1 hover:bg-white/20 rounded-full transition-colors text-noble-black/60"
                    @click="changeMonth(1)"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
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
                  class="w-full bg-cream border border-cinnamon-ice rounded-2xl px-4 py-3 text-sm font-medium text-noble-black flex items-center justify-between hover:border-burning-orange transition-colors"
                  @click="toggleStartTime"
                >
                  {{ startTime
                  }}<svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="text-noble-black/30"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <div
                  v-if="isStartTimeOpen"
                  class="absolute z-50 mt-2 w-full bg-white border border-cinnamon-ice rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  <div class="max-h-60 overflow-y-auto custom-time-scrollbar py-2">
                    <div
                      v-for="time in timeOptions"
                      :key="time"
                      class="px-4 py-2 text-sm text-noble-black hover:bg-cream hover:text-burning-orange cursor-pointer transition-colors"
                      :class="startTime === time ? 'bg-cream text-burning-orange font-bold' : ''"
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
                  class="w-full bg-cream border border-cinnamon-ice rounded-2xl px-4 py-3 text-sm font-medium text-noble-black flex items-center justify-between hover:border-burning-orange transition-colors"
                  @click="toggleEndTime"
                >
                  {{ endTime
                  }}<svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="text-noble-black/30"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <div
                  v-if="isEndTimeOpen"
                  class="absolute z-50 mt-2 w-full bg-white border border-cinnamon-ice rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  <div class="max-h-60 overflow-y-auto custom-time-scrollbar py-2">
                    <div
                      v-for="time in timeOptions"
                      :key="time"
                      class="px-4 py-2 text-sm text-noble-black hover:bg-cream hover:text-burning-orange cursor-pointer transition-colors"
                      :class="[
                        isTimeDisabled(time, true)
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
            <div class="bg-cream border border-cinnamon-ice rounded-3xl p-6 shadow-sm">
              <div class="flex items-baseline gap-1 mb-4">
                <span class="text-3xl font-bold text-noble-black">{{ priceAmount }}</span
                ><span class="text-sm text-noble-black/60 font-medium">{{ priceUnitLabel }}</span>
              </div>
              <div class="grid grid-cols-2 mb-6 relative">
                <div class="absolute left-1/2 top-1 bottom-1 w-px bg-cinnamon-ice/30" />
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
              <button
                class="w-full py-2 text-white rounded-2xl font-medium text-base transition-all duration-300 ease-in-out active:scale-[0.98] shadow-md shadow-burning-orange/10 mb-2.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                :class="
                  isInBag
                    ? 'bg-noble-black hover:bg-noble-black/90'
                    : 'bg-burning-orange hover:bg-blue-estate'
                "
                :disabled="!canAddToBag"
                @click="handleAddToBag"
              >
                <svg
                  v-if="isInBag"
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {{ isInBag ? "Added to Bag" : "Add to Bag" }}
              </button>
              <p
                class="text-center text-[11px] mb-4 font-normal"
                :class="
                  bagFeedbackMessage
                    ? bagFeedbackTone === 'success'
                      ? 'text-blue-estate'
                      : 'text-cinnabar-red'
                    : 'text-noble-black/40'
                "
              >
                {{ bagFeedbackMessage || "You won't be charged yet." }}
              </p>
              <button
                class="w-full py-2 rounded-2xl border border-noble-black/10 bg-white text-noble-black font-medium text-base transition-all duration-300 ease-in-out active:scale-[0.98] hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mb-2.5"
                :disabled="!canSubmitBooking"
                @click="submitBookingRequest"
              >
                {{ requestBookingButtonLabel }}
              </button>
              <p class="text-center text-[11px] mb-4 font-normal" :class="bookingFeedbackClass">
                {{ bookingFeedbackMessage }}
              </p>
              <div class="h-px bg-cinnamon-ice/30 mb-4" />
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
              <div class="h-px bg-cinnamon-ice/30 mb-4" />
              <div class="flex justify-between items-center mb-4">
                <span class="text-base font-semibold text-noble-black">Total</span
                ><span class="text-lg font-bold text-noble-black">
                  {{ item.freeToBorrow ? "Free" : formatPesoAmount(totalPrice) }}
                </span>
              </div>
              <div class="h-px bg-cinnamon-ice/30 mb-4" />
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
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg
                ><span class="text-[11px] font-normal">Protected by TakeUP Guarantee</span>
              </div>
            </div>
          </div>
        </div>

        <ReviewsSection :rating="item.rating" :reviews-count="item.bookingCount" />
      </div>

      <p v-else class="py-20 text-center text-sm text-noble-black/60">Item not found.</p>
    </main>

    <!-- Sticky Bottom Bar (Mobile < sm) -->
    <div
      v-if="item"
      class="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-cinnamon-ice p-4 px-6 z-[100] shadow-[0_-10px_30px_rgba(0,0,0,0.08)] pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
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
          :class="
            isInBag
              ? 'bg-noble-black'
              : isItemAvailableForBooking
                ? 'bg-burning-orange'
                : 'bg-noble-black/40'
          "
          :disabled="!isInBag && !isItemAvailableForBooking"
          @click="
            isInBag
              ? null
              : !isItemAvailableForBooking
                ? null
                : hasBookingSelection
                  ? handleAddToBag()
                  : openBookingModal()
          "
        >
          <svg
            v-if="isInBag"
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {{
            isInBag
              ? "Added to Bag"
              : !isItemAvailableForBooking
                ? "Unavailable"
                : hasBookingSelection
                  ? "Add to Bag"
                  : "Check Availability"
          }}
        </button>
      </div>
      <p
        class="mt-2 text-center text-[11px] font-normal"
        :class="
          bagFeedbackMessage
            ? bagFeedbackTone === 'success'
              ? 'text-blue-estate'
              : 'text-cinnabar-red'
            : 'text-noble-black/40'
        "
      >
        {{ bagFeedbackMessage || "You won't be charged yet." }}
      </p>
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
            class="sticky top-0 bg-white border-b border-cinnamon-ice p-4 flex items-center justify-between z-10"
          >
            <button class="p-2 -ml-2" @click="closeBookingModal">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
            <h2 class="font-bold text-noble-black text-base">Booking Details</h2>
            <div class="w-10" />
          </div>
          <div class="p-6 space-y-8 pb-32">
            <div class="bg-cream border border-cinnamon-ice rounded-3xl p-6">
              <h3 class="font-bold text-noble-black mb-6">Select Dates</h3>
              <div class="flex items-center justify-between mb-6">
                <h3 class="font-semibold text-noble-black">
                  {{ monthNames[viewMonth] }} {{ viewYear }}
                </h3>
                <div class="flex gap-2">
                  <button
                    class="p-1 hover:bg-white/20 rounded-full transition-colors text-noble-black/60"
                    @click="changeMonth(-1)"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                  <button
                    class="p-1 hover:bg-white/20 rounded-full transition-colors text-noble-black/60"
                    @click="changeMonth(1)"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
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
                  class="w-full bg-cream border border-cinnamon-ice rounded-2xl px-4 py-3 text-sm font-medium text-noble-black flex items-center justify-between hover:border-burning-orange transition-colors"
                  @click="toggleStartTime"
                >
                  {{ startTime
                  }}<svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="text-noble-black/30"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <div
                  v-if="isStartTimeOpen"
                  class="absolute z-50 mt-2 w-full bg-white border border-cinnamon-ice rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  <div class="max-h-60 overflow-y-auto custom-time-scrollbar py-2">
                    <div
                      v-for="time in timeOptions"
                      :key="time"
                      class="px-4 py-2 text-sm text-noble-black hover:bg-cream hover:text-burning-orange cursor-pointer transition-colors"
                      :class="startTime === time ? 'bg-cream text-burning-orange font-bold' : ''"
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
                  class="w-full bg-cream border border-cinnamon-ice rounded-2xl px-4 py-3 text-sm font-medium text-noble-black flex items-center justify-between hover:border-burning-orange transition-colors"
                  @click="toggleEndTime"
                >
                  {{ endTime
                  }}<svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="text-noble-black/30"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <div
                  v-if="isEndTimeOpen"
                  class="absolute z-50 mt-2 w-full bg-white border border-cinnamon-ice rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  <div class="max-h-60 overflow-y-auto custom-time-scrollbar py-2">
                    <div
                      v-for="time in timeOptions"
                      :key="time"
                      class="px-4 py-2 text-sm text-noble-black hover:bg-cream hover:text-burning-orange cursor-pointer transition-colors"
                      :class="[
                        isTimeDisabled(time, true)
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
            <div class="bg-cream border border-cinnamon-ice rounded-3xl p-6 shadow-sm">
              <div class="flex items-baseline gap-1 mb-4">
                <span class="text-3xl font-bold text-noble-black">{{ priceAmount }}</span
                ><span class="text-sm text-noble-black/60 font-medium">{{ priceUnitLabel }}</span>
              </div>
              <div class="grid grid-cols-2 mb-6 relative">
                <div class="absolute left-1/2 top-1 bottom-1 w-px bg-cinnamon-ice/30" />
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
              <div class="h-px bg-cinnamon-ice/30 mb-4" />
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
              <div class="h-px bg-cinnamon-ice/30 mb-4" />
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
            class="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-cinnamon-ice flex justify-center"
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
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <button
            v-if="imageGallery.length > 1"
            class="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-4 z-[2010]"
            @click="prevImage"
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            v-if="imageGallery.length > 1"
            class="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-4 z-[2010]"
            @click="nextImage"
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
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
