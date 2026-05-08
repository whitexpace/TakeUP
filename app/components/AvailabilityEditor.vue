<script setup lang="ts">
import { ref, watch } from "vue"

const toYyyyMmDd = (date: Date | null): string => {
  if (!date) return ""
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

const fromYyyyMmDd = (str: string): Date | null => {
  if (!str) return null
  const [y, m, d] = str.split("-").map(Number)
  return new Date(y!, m! - 1, d!)
}

type AvailabilityRange = {
  startDate: Date | null
  endDate: Date | null
  noEndDate: boolean
  status: "AVAILABLE" | "RENTED"
}

const props = defineProps<{
  modelValue: AvailabilityRange[]
  errors?: string[]
}>()

const emit = defineEmits<{
  "update:modelValue": [value: AvailabilityRange[]]
}>()

const ranges = ref<AvailabilityRange[]>(
  props.modelValue.length > 0
    ? props.modelValue
    : [{ startDate: null, endDate: null, noEndDate: false, status: "AVAILABLE" }],
)

watch(
  () => props.modelValue,
  (val) => {
    if (JSON.stringify(val) !== JSON.stringify(ranges.value)) {
      ranges.value =
        val.length > 0
          ? val
          : [{ startDate: null, endDate: null, noEndDate: false, status: "AVAILABLE" }]
    }
  },
)

const updateRange = (index: number, field: keyof AvailabilityRange, value: unknown) => {
  const updated = ranges.value.map((r, i) => {
    if (i !== index) return r
    const next = { ...r, [field]: value }
    if (field === "noEndDate" && value === true) next.endDate = null
    return next
  })
  ranges.value = updated
  emit("update:modelValue", updated)
}

const addRange = () => {
  const updated = [
    ...ranges.value,
    { startDate: null, endDate: null, noEndDate: false, status: "AVAILABLE" as const },
  ]
  ranges.value = updated
  emit("update:modelValue", updated)
}

const removeRange = (index: number) => {
  if (ranges.value.length <= 1) return
  const updated = ranges.value.filter((_, i) => i !== index)
  ranges.value = updated
  emit("update:modelValue", updated)
}

const rangeError = (range: AvailabilityRange): string | null => {
  if (!range.startDate) return null
  if (!range.noEndDate && range.endDate && range.endDate <= range.startDate) {
    return "End date must be after start date."
  }
  return null
}
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="(range, index) in ranges"
      :key="index"
      class="bg-white rounded-[10px] border border-cinnamon-ice p-4 space-y-4"
    >
      <!-- Range header -->
      <div class="flex items-center justify-between">
        <span class="text-neutral-800/70 text-sm font-medium font-geist">
          Availability Period {{ ranges.length > 1 ? index + 1 : "" }}
        </span>
        <button
          v-if="ranges.length > 1"
          type="button"
          class="text-red-400 hover:text-red-600 text-sm transition-colors"
          @click="removeRange(index)"
        >
          Remove
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <!-- Available From -->
        <div class="space-y-1">
          <label class="block text-neutral-800 text-base font-medium font-geist">
            Available From <span class="text-red-500">*</span>
          </label>
          <CustomCalendar
            :model-value="toYyyyMmDd(range.startDate)"
            placeholder="Pick a date"
            @update:model-value="updateRange(index, 'startDate', fromYyyyMmDd($event))"
          />
        </div>

        <!-- Available Until -->
        <div class="space-y-1">
          <label class="block text-neutral-800 text-base font-medium font-geist"
            >Available Until</label
          >
          <div class="space-y-2">
            <CustomCalendar
              v-if="!range.noEndDate"
              :model-value="toYyyyMmDd(range.endDate)"
              placeholder="Pick a date"
              @update:model-value="updateRange(index, 'endDate', fromYyyyMmDd($event))"
            />
            <p
              v-else
              class="text-neutral-800/70 text-base font-geist py-2 px-3 bg-cream rounded-[10px]"
            >
              No end date
            </p>
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                :checked="range.noEndDate"
                class="w-4 h-4 accent-orange-500"
                @change="
                  updateRange(index, 'noEndDate', ($event.target as HTMLInputElement).checked)
                "
              />
              <span class="text-neutral-800/70 text-sm font-geist">No end date</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Range error -->
      <p v-if="rangeError(range)" class="text-red-500 text-sm font-geist">
        {{ rangeError(range) }}
      </p>
    </div>

    <!-- Add period button -->
    <button
      type="button"
      class="flex items-center gap-2 text-burning-orange text-sm font-medium font-geist hover:text-orange-600 transition-colors"
      @click="addRange"
    >
      <Icon name="ph:plus-light" class="text-lg leading-none" /> Add another availability period
    </button>

    <!-- Outer validation errors -->
    <p v-for="e in errors" :key="e" class="text-red-500 text-sm font-geist">{{ e }}</p>
  </div>
</template>
