<template>
  <div ref="container" class="relative">
    <!-- Input Trigger -->
    <div
      class="flex items-center w-full h-[42px] bg-white border border-cinnamon-ice/40 rounded-[10px] px-3 cursor-pointer group hover:border-burning-orange/40 transition-all duration-300"
      :class="{ 'border-burning-orange ring-1 ring-burning-orange/20': isOpen }"
      @click="toggleCalendar"
    >
      <svg
        class="w-4 h-4 text-noble-black/30 group-hover:text-noble-black/50 transition-colors"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <span
        class="ml-2 font-geist text-[13px] transition-colors"
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
        class="absolute z-[100] mt-2 w-[290px] bg-white border border-cinnamon-ice/30 rounded-[20px] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] p-5 font-geist"
      >
        <!-- Calendar Header -->
        <div class="flex items-center justify-between mb-5 px-1">
          <button
            class="p-2 hover:bg-cream rounded-xl text-noble-black/40 hover:text-burning-orange transition-all duration-300"
            @click.stop="prevMonth"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <h4 class="font-bold text-[15px] text-noble-black tracking-tight">
            {{ monthNames[currentMonth] }} {{ currentYear }}
          </h4>

          <button
            class="p-2 hover:bg-cream rounded-xl text-noble-black/40 hover:text-burning-orange transition-all duration-300"
            @click.stop="nextMonth"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        <!-- Days Header -->
        <div class="grid grid-cols-7 mb-3">
          <div
            v-for="day in ['S', 'M', 'T', 'W', 'T', 'F', 'S']"
            :key="day"
            class="text-center text-[10px] font-bold text-noble-black/30 uppercase tracking-[0.1em]"
          >
            {{ day }}
          </div>
        </div>

        <!-- Days Grid -->
        <div class="grid grid-cols-7 gap-1">
          <div
            v-for="(day, index) in calendarDays"
            :key="index"
            class="flex items-center justify-center h-9"
          >
            <button
              v-if="day"
              class="w-9 h-9 flex items-center justify-center rounded-xl text-[13px] transition-all duration-300 relative group"
              :class="[
                isDateDisabled(day)
                  ? 'text-noble-black/20 cursor-not-allowed'
                  : isSelected(day)
                    ? 'bg-burning-orange text-white font-bold shadow-lg shadow-burning-orange/25'
                    : 'text-noble-black/80 hover:bg-cream hover:text-burning-orange',
              ]"
              :disabled="isDateDisabled(day)"
              @click.stop="selectDate(day)"
            >
              <span :class="{ 'opacity-50': isDateDisabled(day) }">{{ day }}</span>
              <!-- Today Indicator Dot -->
              <div
                v-if="isToday(day)"
                class="absolute bottom-1.5 w-1 h-1 rounded-full"
                :class="isSelected(day) ? 'bg-white/60' : 'bg-burning-orange/40'"
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

const formattedDate = computed(() => {
  if (!props.modelValue) return ""
  // Split by '-' to avoid timezone shifts when parsing YYYY-MM-DD
  const [year, month, day] = props.modelValue.split("-").map(Number)
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
    const [minYear, minMonth, minDay] = props.minDate.split("-").map(Number)
    const minDateObj = new Date(minYear, minMonth - 1, minDay)
    minDateObj.setHours(0, 0, 0, 0)
    if (date < minDateObj) return true
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
  const [year, month, date] = props.modelValue.split("-").map(Number)
  return (
    date === day && month === currentMonth.value + 1 && year === currentYear.value
  )
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
