<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue"

const item = {
  id: 1,
  name: "Sony A7 IV - Digital Camera",
  type: "Rent",
  category: "Cameras",
  rating: 4.9,
  reviewsCount: 35,
  price: 500,
  description:
    "The Sony A7 IV is the ultimate hybrid camera, perfect for both professional photography and videography. Featuring a 33MP full-frame sensor, advanced real-time eye autofocus, and 4K 60p video recording. This kit includes the body, two extra batteries, a 128GB high-speed SD card, and a carrying bag.",
  offers: [
    { icon: "camera", text: "33MP Full-Frame Sensor" },
    { icon: "video", text: "4K 60p 10-bit Video" },
    { icon: "package", text: "Complete Accessories Kit" },
    { icon: "clock", text: "Flexible Pickup Times" },
    { icon: "shield", text: "Damage Protection" },
    { icon: "truck", text: "Free Delivery in Campus" },
  ],
  included: [
    "Sony A7 IV Camera Body",
    "FE 28-70mm f/3.5-5.6 OSS Lens",
    "2x Rechargeable Batteries (NP-FZ100)",
    "Battery Charger",
    "128GB V60 SDXC Memory Card",
    "Professional Carrying Bag",
  ],
  seller: {
    name: "Issa S.",
    rating: 5.0,
    reviews: 21,
    joined: "Feb 2024",
    replyTime: "Replies within an hour",
  },
}

const images = [
  "/images/popular/camera.jpg",
  "/images/popular/macbook.jpg",
  "/images/popular/scical.jpg",
  "/images/popular/dress.jpg",
]

const currentImageIndex = ref(0)
const scrollContainer = ref<HTMLElement | null>(null)
const isAtStart = ref(true)
const isAtEnd = ref(false)

const nextImage = () => {
  currentImageIndex.value = (currentImageIndex.value + 1) % images.length
}

const prevImage = () => {
  currentImageIndex.value = (currentImageIndex.value - 1 + images.length) % images.length
}

const updateScrollStatus = () => {
  if (!scrollContainer.value) return
  isAtStart.value = scrollContainer.value.scrollLeft <= 0
  isAtEnd.value =
    scrollContainer.value.scrollLeft + scrollContainer.value.clientWidth >=
    scrollContainer.value.scrollWidth - 1
}

const handleScroll = () => updateScrollStatus()

const scrollOnce = (direction: "left" | "right") => {
  if (!scrollContainer.value) return
  const scrollAmount = 300
  scrollContainer.value.scrollBy({
    left: direction === "left" ? -scrollAmount : scrollAmount,
    behavior: "smooth",
  })
}

const maskStyle = computed(() => {
  if (isAtStart.value && isAtEnd.value) return {}
  if (isAtStart.value)
    return { maskImage: "linear-gradient(to right, black 80%, transparent 100%)" }
  if (isAtEnd.value) return { maskImage: "linear-gradient(to left, black 80%, transparent 100%)" }
  return {
    maskImage: "linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)",
  }
})

// Calendar Logic
const daysOfWeek = ["S", "M", "T", "W", "T", "F", "S"]
const months = [
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

const currentDate = new Date()
const viewMonth = ref(currentDate.getMonth())
const viewYear = ref(currentDate.getFullYear())

const startDate = ref<Date | null>(null)
const endDate = ref<Date | null>(null)
const hoverDate = ref<Date | null>(null)
const mouseIsDown = ref(false)
const isDragging = ref(false)
const tempDragStart = ref<Date | null>(null)
const isCalendarExpanded = ref(false)
const isMobileModalOpen = ref(false)

// Mock unavailable dates
const unavailableDates = [5, 6, 15, 16, 22, 23]

const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate()
const getFirstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay()

const days = computed(() => {
  const numDays = getDaysInMonth(viewMonth.value, viewYear.value)
  const firstDay = getFirstDayOfMonth(viewMonth.value, viewYear.value)
  const daysArray = []
  const todayMidnight = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
  ).getTime()

  for (let i = 0; i < firstDay; i++) {
    daysArray.push({ day: null, fullDate: null })
  }

  for (let i = 1; i <= numDays; i++) {
    const fullDate = new Date(viewYear.value, viewMonth.value, i)
    const time = fullDate.getTime()
    daysArray.push({
      day: i,
      fullDate,
      isToday: time === todayMidnight,
      isPast: time < todayMidnight,
      isUnavailable:
        unavailableDates.includes(i) &&
        viewMonth.value === currentDate.getMonth() &&
        viewYear.value === currentDate.getFullYear(),
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
  const s = startDate.value.getTime()

  if (endDate.value) {
    const e = endDate.value.getTime()
    return target > Math.min(s, e) && target < Math.max(s, e)
  }

  if (hoverDate.value) {
    const h = hoverDate.value.getTime()
    return target > Math.min(s, h) && target < Math.max(s, h)
  }

  return false
}

// Function to check if a range includes any unavailable or past dates
const rangeHasUnavailable = (start: Date, end: Date) => {
  const s = new Date(Math.min(start.getTime(), end.getTime()))
  const e = new Date(Math.max(start.getTime(), end.getTime()))
  const todayMidnight = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
  ).getTime()

  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const day = d.getDate()
    const month = d.getMonth()
    const year = d.getFullYear()
    const time = d.getTime()

    // Block past dates
    if (time < todayMidnight) return true

    // Check against mock unavailable dates
    if (
      unavailableDates.includes(day) &&
      month === currentDate.getMonth() &&
      year === currentDate.getFullYear()
    ) {
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
  } else {
    if (rangeHasUnavailable(startDate.value, date)) {
      startDate.value = date
      endDate.value = null
      return
    }

    if (date.getTime() === startDate.value.getTime()) {
      startDate.value = null
    } else {
      if (date < startDate.value) {
        endDate.value = startDate.value
        startDate.value = date
      } else {
        endDate.value = date
      }
    }
  }
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
    if (!rangeHasUnavailable(tempDragStart.value, date)) {
      isDragging.value = true
      if (date < tempDragStart.value) {
        startDate.value = date
        endDate.value = tempDragStart.value
      } else {
        startDate.value = tempDragStart.value
        endDate.value = date
      }
    }
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

// Time Selection Logic: 5:00 AM to 11:30 PM
const startTime = ref("09:00 AM")
const endTime = ref("06:00 PM")
const isStartTimeOpen = ref(false)
const isEndTimeOpen = ref(false)

const generateTimeOptions = () => {
  const options = []
  for (let hour = 5; hour <= 23; hour++) {
    for (let min = 0; min < 60; min += 30) {
      if (hour === 23 && min > 30) continue
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
      const ampm = hour >= 12 ? "PM" : "AM"
      const time = `${displayHour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")} ${ampm}`
      options.push(time)
    }
  }
  return options
}

const timeOptions = generateTimeOptions()

const toggleStartTime = () => (isStartTimeOpen.value = !isStartTimeOpen.value)
const toggleEndTime = () => (isEndTimeOpen.value = !isEndTimeOpen.value)

// Helper to convert "HH:mm AM/PM" to total minutes from midnight for comparison
const timeToMinutes = (timeStr: string) => {
  const [time, period] = timeStr.split(" ")
  if (!time) return 0
  const [hoursStr, minutesStr] = time.split(":").map(Number)
  let hours = hoursStr ?? 0
  const minutes = minutesStr ?? 0
  if (period === "PM" && hours !== 12) hours += 12
  if (period === "AM" && hours === 12) hours = 0
  return hours * 60 + minutes
}

const isSameDay = computed(() => {
  if (!startDate.value) return false
  if (!endDate.value) return true // Default to same day if only one date is picked
  return startDate.value.getTime() === endDate.value.getTime()
})

const isTimeDisabled = (time: string, isEnd: boolean) => {
  if (!isSameDay.value) return false
  const startMins = timeToMinutes(startTime.value)
  const currentMins = timeToMinutes(time)

  if (isEnd) {
    return currentMins <= startMins
  }
  return false
}

const selectStartTime = (time: string) => {
  startTime.value = time
  isStartTimeOpen.value = false

  // If new start time is after or equal to current end time on same day, reset end time
  if (isSameDay.value && timeToMinutes(time) >= timeToMinutes(endTime.value)) {
    // Find first available valid end time (30 mins after start)
    const startMins = timeToMinutes(time)
    const nextValid = timeOptions.find((t) => timeToMinutes(t) > startMins)
    endTime.value = nextValid || timeOptions[timeOptions.length - 1] || ""
  }
}

const selectEndTime = (time: string) => {
  if (isTimeDisabled(time, true)) return
  endTime.value = time
  isEndTimeOpen.value = false
}

// Lightbox
const isLightboxOpen = ref(false)
const openLightbox = () => {
  isLightboxOpen.value = true
  document.body.style.overflow = "hidden"
}
const closeLightbox = () => {
  isLightboxOpen.value = false
  document.body.style.overflow = "auto"
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "ArrowRight") nextImage()
  if (e.key === "ArrowLeft") prevImage()

  if (isMobileModalOpen.value && e.key === "Escape") {
    closeBookingModal()
    return
  }
  if (!isLightboxOpen.value) return
  if (e.key === "Escape") closeLightbox()
}

const formatDate = (date: Date | null) => {
  if (!date) return ""
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const displayStartDate = computed(() => startDate.value)
const displayEndDate = computed(() => endDate.value || startDate.value)

const totalDays = computed(() => {
  if (!startDate.value || !endDate.value) return 0
  const s = startDate.value.getTime()
  const e = endDate.value.getTime()
  const diffTime = Math.abs(e - s)
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

const totalPrice = computed(() => {
  const days = totalDays.value || 1
  return days * item.price
})

onMounted(() => {
  updateScrollStatus()
  window.addEventListener("keydown", handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown)
})

const openBookingModal = () => {
  isMobileModalOpen.value = true
  document.body.style.overflow = "hidden"
}

const closeBookingModal = () => {
  isMobileModalOpen.value = false
  document.body.style.overflow = "auto"
}
</script>

<template>
  <div class="min-h-screen bg-white font-geist">
    <header
      class="h-16 w-full bg-white border-b border-cinnamon-ice flex items-center px-8 sticky top-0 z-50"
    />

    <main class="max-w-7xl mx-auto px-4 sm:px-6 py-6" @mouseleave="handleCalendarMouseLeave">
      <!-- Back Link -->
      <NuxtLink
        to="/dashboard"
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
        <span class="font-normal">Back to listings</span>
      </NuxtLink>

      <!-- Title & Actions -->
      <div class="flex justify-between items-start mb-2">
        <h1 class="text-3xl font-bold text-noble-black">{{ item.name }}</h1>
        <div class="flex items-center gap-4">
          <button
            class="p-2 text-noble-black/70 hover:text-noble-black transition-all duration-300 ease-in-out group"
            title="Share"
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
            class="p-2 text-noble-black/70 hover:text-noble-black transition-all duration-300 ease-in-out group"
            title="Save"
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
          <span class="font-bold">{{ item.rating }}</span>
        </div>
        <span class="text-noble-black/60">({{ item.reviewsCount }} reviews)</span>
      </div>

      <!-- Main Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div class="lg:col-span-2">
          <!-- 1. Image Section -->
          <div class="mb-10">
            <div class="relative aspect-video bg-cream rounded-2xl overflow-hidden group">
              <img
                :src="images[currentImageIndex]"
                :alt="item.name"
                class="w-full h-full object-cover"
              />
              <div
                class="absolute top-4 left-4 px-4 py-1.5 min-w-[80px] h-[32px] rounded-full font-geist text-[15px] font-normal tracking-wide flex items-center justify-center shadow-sm bg-cinnamon-ice text-noble-black"
              >
                {{ item.type }}
              </div>
              <button
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
                {{ currentImageIndex + 1 }} / {{ images.length }}
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
            <div class="relative mt-4 group/scroll overflow-hidden">
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
                  v-for="(img, idx) in [...images, ...images]"
                  :key="idx"
                  class="w-20 h-20 rounded-xl overflow-hidden cursor-pointer border-2 transition-all duration-300 shrink-0 group/thumb"
                  :class="
                    currentImageIndex === idx % images.length
                      ? 'border-burning-orange opacity-100'
                      : 'border-transparent opacity-40 hover:opacity-100'
                  "
                  @click="currentImageIndex = idx % images.length"
                >
                  <img
                    :src="img"
                    class="w-full h-full object-cover transition-all duration-300"
                    :class="
                      currentImageIndex === idx % images.length
                        ? ''
                        : 'blur-[1px] group-hover/thumb:blur-0'
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
                      {{ months[viewMonth] }} {{ viewYear }}
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
                          onMouseDown(dayObj.fullDate, dayObj.isUnavailable, dayObj.isPast)
                        "
                        @mouseup="onMouseUp(dayObj.fullDate, dayObj.isUnavailable, dayObj.isPast)"
                        @mouseenter="
                          onMouseEnter(dayObj.fullDate, dayObj.isUnavailable, dayObj.isPast)
                        "
                        @click="onDateClick(dayObj.fullDate, dayObj.isUnavailable, dayObj.isPast)"
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
                    <span class="text-3xl font-bold text-noble-black">₱{{ item.price }}</span
                    ><span class="text-sm text-noble-black/60 font-medium">/ day</span>
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
                    class="w-full py-3 bg-burning-orange text-white rounded-2xl font-bold text-base hover:bg-blue-estate transition-all duration-300 ease-in-out active:scale-[0.98] shadow-md shadow-burning-orange/10 mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    :disabled="!startDate || !endDate"
                  >
                    Add to Bag
                  </button>
                  <p class="text-center text-[11px] text-noble-black/40 font-normal">
                    You won't be charged yet.
                  </p>
                </div>
                <div>
                  <div class="h-px bg-cinnamon-ice/30 mb-4" />
                  <div class="space-y-3 mb-4">
                    <div class="flex justify-between items-center text-sm text-noble-black/70">
                      <span>Rate (₱{{ item.price }} x {{ totalDays || 1 }} days)</span
                      ><span class="font-medium text-noble-black"
                        >₱{{ totalPrice.toLocaleString() }}</span
                      >
                    </div>
                  </div>
                  <div class="h-px bg-cinnamon-ice/30 mb-4" />
                  <div class="flex justify-between items-center mb-4">
                    <span class="text-base font-semibold text-noble-black">Total</span
                    ><span class="text-lg font-bold text-noble-black"
                      >₱{{ totalPrice.toLocaleString() }}</span
                    >
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
                          {{ months[viewMonth] }} {{ viewYear }}
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
                              onMouseDown(dayObj.fullDate, dayObj.isUnavailable, dayObj.isPast)
                            "
                            @mouseup="
                              onMouseUp(dayObj.fullDate, dayObj.isUnavailable, dayObj.isPast)
                            "
                            @mouseenter="
                              onMouseEnter(dayObj.fullDate, dayObj.isUnavailable, dayObj.isPast)
                            "
                            @click="
                              onDateClick(dayObj.fullDate, dayObj.isUnavailable, dayObj.isPast)
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
                  <span class="text-3xl font-bold text-noble-black">₱{{ item.price }}</span
                  ><span class="text-sm text-noble-black/60 font-medium">/ day</span>
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
                  class="w-full py-2 bg-burning-orange text-white rounded-2xl font-medium text-base hover:bg-blue-estate transition-all duration-300 ease-in-out active:scale-[0.98] shadow-md shadow-burning-orange/10 mb-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="!startDate || !endDate"
                >
                  Add to Bag
                </button>
                <p class="text-center text-[11px] text-noble-black/40 mb-4 font-normal">
                  You won't be charged yet.
                </p>
                <div class="h-px bg-cinnamon-ice/30 mb-4" />
                <div class="space-y-2 mb-4">
                  <div class="flex justify-between items-center text-sm text-noble-black/70">
                    <span>Rate (₱{{ item.price }} x {{ totalDays || 1 }} days)</span
                    ><span class="font-medium text-noble-black"
                      >₱{{ totalPrice.toLocaleString() }}</span
                    >
                  </div>
                </div>
                <div class="h-px bg-cinnamon-ice/30 mb-4" />
                <div class="flex justify-between items-center mb-4">
                  <span class="text-base font-semibold text-noble-black">Total</span
                  ><span class="text-lg font-bold text-noble-black"
                    >₱{{ totalPrice.toLocaleString() }}</span
                  >
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

          <!-- Description Section -->
          <div class="border-b border-cinnamon-ice py-8">
            <h2 class="text-lg font-semibold mb-3">Description</h2>
            <p class="text-noble-black/80 text-sm leading-relaxed">{{ item.description }}</p>
          </div>
          <!-- Offers Section -->
          <div class="border-b border-cinnamon-ice py-8">
            <h2 class="text-lg font-semibold mb-3">What This Item Offers</h2>
            <div class="grid grid-cols-2 gap-3 sm:gap-4">
              <div
                v-for="(offer, idx) in item.offers"
                :key="idx"
                class="flex items-center gap-2.5 px-3 py-2 bg-cream rounded-xl border border-cinnamon-ice/20"
              >
                <div class="text-burning-orange scale-90 shrink-0">
                  <svg
                    v-if="offer.icon === 'camera'"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path
                      d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"
                    />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                  <svg
                    v-else-if="offer.icon === 'video'"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="m22 8-6 4 6 4V8Z" />
                    <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
                  </svg>
                  <svg
                    v-else-if="offer.icon === 'package'"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M16.5 9.4 7.5 4.21" />
                    <path
                      d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
                    />
                    <polyline points="3.29 7 12 12 20.71 7" />
                    <line x1="12" x2="12" y1="22" y2="12" />
                  </svg>
                  <svg
                    v-else-if="offer.icon === 'clock'"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <svg
                    v-else-if="offer.icon === 'shield'"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <svg
                    v-else-if="offer.icon === 'truck'"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect width="16" height="13" x="2" y="4" rx="2" />
                    <path d="M16 9h4l3 3v6h-2" />
                    <circle cx="7" cy="18" r="2" />
                    <circle cx="17" cy="18" r="2" />
                  </svg>
                </div>
                <span class="text-noble-black/90 text-sm">{{ offer.text }}</span>
              </div>
            </div>
          </div>
          <div class="border-b border-cinnamon-ice py-8 mb-12">
            <h2 class="text-lg font-semibold mb-3">What's Included</h2>
            <ul class="space-y-2">
              <li
                v-for="(included, idx) in item.included"
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
                IS
              </div>
              <div class="flex flex-col">
                <h3 class="text-base sm:text-lg font-semibold text-noble-black">
                  {{ item.seller.name }}
                </h3>
                <div class="flex items-center gap-1.5 text-sm">
                  <div class="flex items-center gap-1 text-burning-orange">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <polygon
                        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                      />
                    </svg>
                    <span class="font-bold">{{ item.seller.rating }}</span>
                  </div>
                  <span class="text-noble-black/60">({{ item.seller.reviews }})</span>
                </div>
                <p class="hidden sm:block text-xs text-noble-black/60 mt-1">
                  Member since {{ item.seller.joined }} <span class="mx-1">|</span>
                  {{ item.seller.replyTime }}
                </p>
              </div>
            </div>
            <button
              class="w-10 h-10 rounded-full bg-blue-estate flex items-center justify-center hover:opacity-90 transition-opacity shrink-0"
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
              <h3 class="font-semibold text-noble-black">{{ months[viewMonth] }} {{ viewYear }}</h3>
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
                  @mousedown="onMouseDown(dayObj.fullDate, dayObj.isUnavailable, dayObj.isPast)"
                  @mouseup="onMouseUp(dayObj.fullDate, dayObj.isUnavailable, dayObj.isPast)"
                  @mouseenter="onMouseEnter(dayObj.fullDate, dayObj.isUnavailable, dayObj.isPast)"
                  @click="onDateClick(dayObj.fullDate, dayObj.isUnavailable, dayObj.isPast)"
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
              <span class="text-3xl font-bold text-noble-black">₱{{ item.price }}</span
              ><span class="text-sm text-noble-black/60 font-medium">/ day</span>
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
              class="w-full py-2 bg-burning-orange text-white rounded-2xl font-medium text-base hover:bg-blue-estate transition-all duration-300 ease-in-out active:scale-[0.98] shadow-md shadow-burning-orange/10 mb-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!startDate || !endDate"
            >
              Add to Bag
            </button>
            <p class="text-center text-[11px] text-noble-black/40 mb-4 font-normal">
              You won't be charged yet.
            </p>
            <div class="h-px bg-cinnamon-ice/30 mb-4" />
            <div class="space-y-2 mb-4">
              <div class="flex justify-between items-center text-sm text-noble-black/70">
                <span>Rate (₱{{ item.price }} x {{ totalDays || 1 }} days)</span
                ><span class="font-medium text-noble-black"
                  >₱{{ totalPrice.toLocaleString() }}</span
                >
              </div>
            </div>
            <div class="h-px bg-cinnamon-ice/30 mb-4" />
            <div class="flex justify-between items-center mb-4">
              <span class="text-base font-semibold text-noble-black">Total</span
              ><span class="text-lg font-bold text-noble-black"
                >₱{{ totalPrice.toLocaleString() }}</span
              >
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

      <ReviewsSection :rating="item.rating" :reviews-count="item.reviewsCount" />
    </main>

    <!-- Sticky Bottom Bar (Mobile < sm) -->
    <div
      class="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-cinnamon-ice p-4 px-6 flex items-center justify-between z-[100] shadow-[0_-10px_30px_rgba(0,0,0,0.08)] pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
    >
      <div class="flex flex-col">
        <div class="flex items-baseline gap-1">
          <span class="text-xl font-bold text-noble-black">₱{{ item.price }}</span
          ><span class="text-xs text-noble-black/60 font-medium">/ day</span>
        </div>
        <button class="text-[11px] font-bold text-burning-orange" @click="openBookingModal">
          {{
            startDate && endDate
              ? `${formatDate(startDate)} — ${formatDate(endDate)}`
              : "Select dates"
          }}
        </button>
      </div>
      <button
        class="px-6 py-2.5 bg-burning-orange text-white rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all"
        @click="openBookingModal"
      >
        {{ startDate && endDate ? "Add to Bag" : "Check Availability" }}
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
          v-if="isMobileModalOpen"
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
                  {{ months[viewMonth] }} {{ viewYear }}
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
                    @mousedown="onMouseDown(dayObj.fullDate, dayObj.isUnavailable, dayObj.isPast)"
                    @mouseup="onMouseUp(dayObj.fullDate, dayObj.isUnavailable, dayObj.isPast)"
                    @mouseenter="onMouseEnter(dayObj.fullDate, dayObj.isUnavailable, dayObj.isPast)"
                    @click="onDateClick(dayObj.fullDate, dayObj.isUnavailable, dayObj.isPast)"
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
                <span class="text-3xl font-bold text-noble-black">₱{{ item.price }}</span
                ><span class="text-sm text-noble-black/60 font-medium">/ day</span>
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
                  <span>Rate (₱{{ item.price }} x {{ totalDays || 1 }} days)</span
                  ><span class="font-medium text-noble-black"
                    >₱{{ totalPrice.toLocaleString() }}</span
                  >
                </div>
              </div>
              <div class="h-px bg-cinnamon-ice/30 mb-4" />
              <div class="flex justify-between items-center mb-4">
                <span class="text-base font-semibold text-noble-black">Total</span
                ><span class="text-lg font-bold text-noble-black"
                  >₱{{ totalPrice.toLocaleString() }}</span
                >
              </div>
            </div>
          </div>
          <!-- Modal Footer (Confirm) -->
          <div
            v-if="startDate && endDate"
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
          v-if="isLightboxOpen"
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
              :src="images[currentImageIndex]"
              class="max-w-full max-h-full object-contain select-none shadow-2xl"
              @click.stop
            />
            <div
              class="absolute bottom-0 left-1/2 -translate-x-1/2 text-white/60 text-sm font-medium pb-4"
            >
              {{ currentImageIndex + 1 }} / {{ images.length }}
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
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
