<template>
  <div ref="container" class="relative">
    <!-- Input Trigger -->
    <div
      class="flex items-center w-full h-[42px] bg-white border border-cinnamon-ice/40 rounded-[10px] px-3 cursor-pointer group hover:border-burning-orange/40 transition-all duration-300"
      :class="{ 'border-burning-orange ring-1 ring-burning-orange/20': isOpen }"
      @click="toggleDropdown"
    >
      <div class="flex items-center flex-1">
        <svg
          class="w-4 h-4 text-noble-black/30 group-hover:text-noble-black/50 transition-colors shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span
          class="ml-2 font-geist text-[13px] transition-colors truncate"
          :class="modelValue ? 'text-noble-black' : 'text-noble-black/40'"
        >
          {{ selectedLabel || placeholder }}
        </span>
      </div>
      <svg
        class="w-4 h-4 text-noble-black/30 group-hover:text-noble-black/50 transition-colors ml-1"
        :class="{ 'rotate-180': isOpen }"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </div>

    <!-- Time Dropdown -->
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
        class="absolute z-[100] mt-2 w-full min-w-[120px] bg-white border border-cinnamon-ice/30 rounded-[15px] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] py-2 font-geist"
      >
        <div class="max-h-[200px] overflow-y-auto custom-scrollbar">
          <button
            v-for="option in timeOptions"
            :key="option.value"
            class="w-full text-left px-4 py-2 text-[13px] transition-all duration-200"
            :class="[
              modelValue === option.value
                ? 'bg-burning-orange text-white font-bold'
                : 'text-noble-black/80 hover:bg-cream hover:text-burning-orange',
            ]"
            @click.stop="selectTime(option)"
          >
            {{ option.label }}
          </button>
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
}>()

const emit = defineEmits(["update:modelValue"])

const isOpen = ref(false)
const container = ref<HTMLElement | null>(null)

// Generate options from 5:00 AM to 11:30 PM
const timeOptions = (() => {
  const options = []
  // Start at 5 (5 AM) and end at 23.5 (11:30 PM)
  for (let hour = 5; hour < 24; hour++) {
    for (let min = 0; min < 60; min += 30) {
      // 11:30 PM is 23:30, so we stop after that
      if (hour === 23 && min > 30) break

      const h = hour.toString().padStart(2, "0")
      const m = min.toString().padStart(2, "0")
      const value = `${h}:${m}`

      const period = hour >= 12 ? "PM" : "AM"
      const displayHour = hour % 12 === 0 ? 12 : hour % 12
      const label = `${displayHour}:${m} ${period}`

      options.push({ value, label })
    }
  }
  return options
})()

const selectedLabel = computed(() => {
  const option = timeOptions.find((o) => o.value === props.modelValue)
  return option ? option.label : ""
})

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const selectTime = (option: { value: string; label: string }) => {
  emit("update:modelValue", option.value)
  isOpen.value = false
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

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 3px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: theme("colors.cinnamon-ice / 50%");
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: theme("colors.burning-orange");
}

/* For browsers that support scrollbar-color (Firefox) */
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: theme("colors.cinnamon-ice / 50%") transparent;
}
</style>
