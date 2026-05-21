<template>
  <div ref="container" class="relative">
    <!-- Input Trigger -->
    <div
      class="flex items-center w-full h-[42px] bg-white border border-cinnamon-ice/40 rounded-[10px] px-2.5 cursor-pointer group hover:border-burning-orange/40 transition-all duration-300"
      :class="{ 'border-burning-orange ring-1 ring-burning-orange/20': isOpen }"
      @click="toggleCalendar"
    >
      <Icon
        name="ph:calendar-blank"
        class="w-4 h-4 text-noble-black/30 group-hover:text-noble-black/50 transition-colors"
      />
      <span
        class="ml-1.5 font-geist text-[13px] transition-colors"
        :class="modelValue ? 'text-noble-black' : 'text-noble-black/40'"
      >
        {{ formattedDate || placeholder }}
      </span>
    </div>

    <!-- Calendar Dropdown -->
    <transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform -translate-y-2 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform -translate-y-2 opacity-0"
    >
      <div
        v-if="isOpen"
        class="absolute z-[100] mt-2 w-[252px] left-0 bg-white border border-cinnamon-ice/30 rounded-2xl shadow-[0_12px_40px_-10px_rgba(0,0,0,0.12)] p-3.5 font-geist"
      >
        <!-- Calendar Header -->
        <div class="flex items-center justify-between mb-4 px-1">
          <h4 class="font-semibold text-[14px] text-noble-black tracking-tight">
            {{ monthNames[currentMonth] }} {{ currentYear }}
          </h4>

          <div class="flex gap-1">
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded-full text-noble-black/40 hover:text-burning-orange transition-all duration-300"
              @click.stop="prevMonth"
            >
              <Icon name="ph:caret-left" class="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded-full text-noble-black/40 hover:text-burning-orange transition-all duration-300"
              @click.stop="nextMonth"
            >
              <Icon name="ph:caret-right" class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Days Header -->
        <div class="grid grid-cols-7 mb-2">
          <div
            v-for="day in ['S', 'M', 'T', 'W', 'T', 'F', 'S']"
            :key="day"
            class="text-center text-[10px] font-bold text-gray-400 uppercase tracking-[1px]"
          >
            {{ day }}
          </div>
        </div>

        <!-- Days Grid -->
        <div class="grid grid-cols-7 gap-0.5">
          <div
            v-for="(day, index) in calendarDays"
            :key="index"
            class="flex items-center justify-center h-8"
          >
            <button
              v-if="day"
              type="button"
              class="w-8 h-8 shrink-0 aspect-square flex items-center justify-center rounded-full text-[13px] transition-all duration-300 relative group font-semibold"
              :class="[
                isDateDisabled(day)
                  ? 'text-gray-300 cursor-not-allowed'
                  : isSelected(day)
                    ? 'bg-burning-orange text-white font-bold shadow-lg shadow-burning-orange/25'
                    : 'text-noble-black hover:bg-burning-orange hover:text-white',
              ]"
              :disabled="isDateDisabled(day)"
              @click.stop="selectDate(day)"
            >
              <span class="relative z-10" :class="{ 'opacity-50': isDateDisabled(day) }">{{
                day
              }}</span>
              <!-- Today Indicator -->
              <div
                v-if="isToday(day) && !isSelected(day)"
                class="absolute inset-0 border-[1.5px] border-burning-orange rounded-full z-0"
              />
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue"

const props = defineProps<{
  modelValue: string
  placeholder?: string
  disablePast?: boolean
  minDate?: string // YYYY-MM-DD
}>()

const emit = defineEmits(["update:modelValue"])

const isOpen = ref(false)
const container = ref<HTMLElement | null>(null)

// Date logic
const today = new Date()
const currentMonth = ref(today.getMonth())
const currentYear = ref(today.getFullYear())

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

const parseYyyyMmDd = (value: string) => {
  const [yearPart = "", monthPart = "", dayPart = ""] = value.split("-")
  const year = Number(yearPart)
  const month = Number(monthPart)
  const day = Number(dayPart)

  if ([year, month, day].some((part) => Number.isNaN(part))) {
    return null
  }

  return { year, month, day }
}

const formattedDate = computed(() => {
  if (!props.modelValue) return ""
  // Split by '-' to avoid timezone shifts when parsing YYYY-MM-DD
  const parsedDate = parseYyyyMmDd(props.modelValue)
  if (!parsedDate) return ""

  const { year, month, day } = parsedDate
  return `${month.toString().padStart(2, "0")}/${day.toString().padStart(2, "0")}/${year}`
})

const calendarDays = computed(() => {
  const firstDay = new Date(currentYear.value, currentMonth.value, 1).getDay()
  const daysInMonth = new Date(currentYear.value, currentMonth.value + 1, 0).getDate()

  const days = []
  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }
  return days
})

const toggleCalendar = () => {
  isOpen.value = !isOpen.value
}

const prevMonth = () => {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

const nextMonth = () => {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

const isDateDisabled = (day: number) => {
  const date = new Date(currentYear.value, currentMonth.value, day)

  if (props.disablePast) {
    const todayAtZero = new Date()
    todayAtZero.setHours(0, 0, 0, 0)
    if (date < todayAtZero) return true
  }

  if (props.minDate) {
    const parsedMinDate = parseYyyyMmDd(props.minDate)
    if (parsedMinDate) {
      const minDateObj = new Date(parsedMinDate.year, parsedMinDate.month - 1, parsedMinDate.day)
      minDateObj.setHours(0, 0, 0, 0)
      if (date < minDateObj) return true
    }
  }

  return false
}

const selectDate = (day: number) => {
  if (isDateDisabled(day)) return

  const date = new Date(currentYear.value, currentMonth.value, day)
  // Format as YYYY-MM-DD for consistency
  const formatted = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`
  emit("update:modelValue", formatted)
  isOpen.value = false
}

const isSelected = (day: number) => {
  if (!props.modelValue) return false
  const parsedDate = parseYyyyMmDd(props.modelValue)
  if (!parsedDate) return false

  const { year, month, day: date } = parsedDate
  return date === day && month === currentMonth.value + 1 && year === currentYear.value
}

const isToday = (day: number) => {
  return (
    today.getDate() === day &&
    today.getMonth() === currentMonth.value &&
    today.getFullYear() === currentYear.value
  )
}

// Click outside logic
const handleClickOutside = (event: MouseEvent) => {
  if (container.value && !container.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside)
})
</script>
