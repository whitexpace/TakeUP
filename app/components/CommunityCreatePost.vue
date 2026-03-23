<template>
  <form
    ref="containerRef"
    class="bg-cream rounded-[24px] border border-cinnamon-ice/30 p-6 flex flex-col gap-4 transition-all duration-500"
    :class="{
      'ring-4 ring-burning-orange/10 border-burning-orange/40 scale-[1.01] shadow-lg':
        isHighlighted,
    }"
    @submit.prevent="handlePost"
  >
    <div class="flex gap-4">
      <UserAvatar :avatar-url="props.userAvatar" :user-name="props.userName" size="lg" />

      <div class="flex-1 flex flex-col gap-3">
        <input
          ref="itemNeededInputRef"
          v-model="itemNeeded"
          type="text"
          placeholder="What are you looking for?"
          class="w-full rounded-[14px] bg-white/50 px-4 py-3 text-[18px] font-semibold text-noble-black placeholder:text-noble-black/30 outline-none transition-all duration-300"
          :class="
            showItemNeededError
              ? 'border border-burning-orange/50 bg-white ring-4 ring-burning-orange/10'
              : 'border border-transparent focus:border-cinnamon-ice focus:bg-white focus:ring-4 focus:ring-cinnamon-ice/5'
          "
          @blur="markTouched('itemNeeded')"
        />
        <p v-if="showItemNeededError" class="text-[12px] font-medium text-burning-orange">
          {{ itemNeededError }}
        </p>

        <textarea
          v-model="description"
          placeholder="Describe the item, how you plan to use it, and any important requirements."
          class="min-h-[110px] w-full resize-none rounded-[14px] bg-white/50 px-4 py-3 text-[15px] text-noble-black placeholder:text-noble-black/30 outline-none transition-all duration-300"
          :class="
            showDescriptionError
              ? 'border border-burning-orange/50 bg-white ring-4 ring-burning-orange/10'
              : 'border border-transparent focus:border-cinnamon-ice focus:bg-white focus:ring-4 focus:ring-cinnamon-ice/5'
          "
          @blur="markTouched('description')"
        ></textarea>
        <p v-if="showDescriptionError" class="text-[12px] font-medium text-burning-orange">
          {{ descriptionError }}
        </p>

        <div class="grid gap-3 md:grid-cols-2">
          <label class="flex flex-col gap-2">
            <span class="text-[12px] font-bold uppercase tracking-[0.12em] text-noble-black/45">
              Start date
            </span>
            <input
              v-model="startDate"
              type="date"
              class="w-full rounded-[14px] bg-white px-4 py-3 text-[14px] text-noble-black outline-none transition-all duration-300"
              :class="
                showStartDateError || showDateRangeError
                  ? 'border border-burning-orange/50 ring-4 ring-burning-orange/10'
                  : 'border border-cinnamon-ice/30 focus:border-blue-estate/30 focus:ring-4 focus:ring-blue-estate/5'
              "
              @blur="markTouched('startDate')"
            />
            <p v-if="showStartDateError" class="text-[12px] font-medium text-burning-orange">
              {{ startDateError }}
            </p>
          </label>

          <label class="flex flex-col gap-2">
            <span class="text-[12px] font-bold uppercase tracking-[0.12em] text-noble-black/45">
              End date
            </span>
            <input
              v-model="endDate"
              type="date"
              class="w-full rounded-[14px] bg-white px-4 py-3 text-[14px] text-noble-black outline-none transition-all duration-300"
              :class="
                showEndDateError || showDateRangeError
                  ? 'border border-burning-orange/50 ring-4 ring-burning-orange/10'
                  : 'border border-cinnamon-ice/30 focus:border-blue-estate/30 focus:ring-4 focus:ring-blue-estate/5'
              "
              @blur="markTouched('endDate')"
            />
            <p
              v-if="showEndDateError || showDateRangeError"
              class="text-[12px] font-medium text-burning-orange"
            >
              {{ endDateError || dateRangeError }}
            </p>
          </label>

          <label class="flex flex-col gap-2">
            <span class="text-[12px] font-bold uppercase tracking-[0.12em] text-noble-black/45">
              Min budget
            </span>
            <div
              class="flex items-center rounded-[14px] bg-white px-4"
              :class="
                showMinimumPriceError || showPriceRangeError
                  ? 'border border-burning-orange/50 ring-4 ring-burning-orange/10'
                  : 'border border-cinnamon-ice/30 focus-within:border-blue-estate/30 focus-within:ring-4 focus-within:ring-blue-estate/5'
              "
            >
              <span class="text-[14px] font-semibold text-noble-black/45">PHP</span>
              <input
                v-model="minimumPrice"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                class="w-full border-none bg-transparent px-3 py-3 text-[14px] text-noble-black outline-none"
                @blur="markTouched('minimumPrice')"
              />
            </div>
            <p v-if="showMinimumPriceError" class="text-[12px] font-medium text-burning-orange">
              {{ minimumPriceError }}
            </p>
          </label>

          <label class="flex flex-col gap-2">
            <span class="text-[12px] font-bold uppercase tracking-[0.12em] text-noble-black/45">
              Max budget
            </span>
            <div
              class="flex items-center rounded-[14px] bg-white px-4"
              :class="
                showMaximumPriceError || showPriceRangeError
                  ? 'border border-burning-orange/50 ring-4 ring-burning-orange/10'
                  : 'border border-cinnamon-ice/30 focus-within:border-blue-estate/30 focus-within:ring-4 focus-within:ring-blue-estate/5'
              "
            >
              <span class="text-[14px] font-semibold text-noble-black/45">PHP</span>
              <input
                v-model="maximumPrice"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                class="w-full border-none bg-transparent px-3 py-3 text-[14px] text-noble-black outline-none"
                @blur="markTouched('maximumPrice')"
              />
            </div>
            <p
              v-if="showMaximumPriceError || showPriceRangeError"
              class="text-[12px] font-medium text-burning-orange"
            >
              {{ maximumPriceError || priceRangeError }}
            </p>
          </label>
        </div>
      </div>
    </div>

    <div class="h-[1px] w-full bg-cinnamon-ice/20"></div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p
        class="text-[13px]"
        :class="hasFeedbackError ? 'font-medium text-burning-orange' : 'text-noble-black/45'"
      >
        {{ feedbackMessage }}
      </p>

      <button
        type="submit"
        class="px-8 py-2.5 bg-burning-orange text-white rounded-full font-bold text-[15px] hover:bg-blue-estate transition-all shadow-md active:scale-95 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
        :disabled="!isFormValid || props.isSubmitting"
      >
        {{ props.isSubmitting ? "Posting..." : "Post Request" }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue"
import type { CommunityRequestComposerInput } from "~/types/community-requests"

const props = withDefaults(
  defineProps<{
    userAvatar?: string | null
    userName: string
    isSubmitting?: boolean
    serverError?: string | null
  }>(),
  {
    userAvatar: null,
    isSubmitting: false,
    serverError: null,
  },
)

const emit = defineEmits<{
  (event: "post", value: CommunityRequestComposerInput): void
}>()

const itemNeeded = ref("")
const description = ref("")
const startDate = ref("")
const endDate = ref("")
const minimumPrice = ref<string | number>("")
const maximumPrice = ref<string | number>("")

const containerRef = ref<HTMLElement | null>(null)
const itemNeededInputRef = ref<HTMLInputElement | null>(null)
const isHighlighted = ref(false)
const attemptedSubmit = ref(false)
const touchedFields = reactive({
  itemNeeded: false,
  description: false,
  startDate: false,
  endDate: false,
  minimumPrice: false,
  maximumPrice: false,
})

const hasInputValue = (value: string | number) => {
  if (typeof value === "number") return Number.isFinite(value)
  return value.trim().length > 0
}

const resetTouchedFields = () => {
  touchedFields.itemNeeded = false
  touchedFields.description = false
  touchedFields.startDate = false
  touchedFields.endDate = false
  touchedFields.minimumPrice = false
  touchedFields.maximumPrice = false
}

const markTouched = (field: keyof typeof touchedFields) => {
  touchedFields[field] = true
}

const parsedMinimumPrice = computed(() =>
  typeof minimumPrice.value === "number" ? minimumPrice.value : Number(minimumPrice.value),
)
const parsedMaximumPrice = computed(() =>
  typeof maximumPrice.value === "number" ? maximumPrice.value : Number(maximumPrice.value),
)

const itemNeededError = computed(() => (itemNeeded.value.trim() ? "" : "Item needed is required."))
const descriptionError = computed(() =>
  description.value.trim() ? "" : "Description is required.",
)
const startDateError = computed(() => (startDate.value ? "" : "Start date is required."))
const endDateError = computed(() => (endDate.value ? "" : "End date is required."))
const dateRangeError = computed(() => {
  if (!startDate.value || !endDate.value) return ""
  return endDate.value < startDate.value ? "End date must be on or after the start date." : ""
})
const minimumPriceError = computed(() => {
  if (!hasInputValue(minimumPrice.value)) return "Minimum budget is required."
  if (!Number.isFinite(parsedMinimumPrice.value) || parsedMinimumPrice.value < 0) {
    return "Minimum budget must be 0 or higher."
  }
  return ""
})
const maximumPriceError = computed(() => {
  if (!hasInputValue(maximumPrice.value)) return "Maximum budget is required."
  if (!Number.isFinite(parsedMaximumPrice.value) || parsedMaximumPrice.value < 0) {
    return "Maximum budget must be 0 or higher."
  }
  return ""
})
const priceRangeError = computed(() => {
  if (minimumPriceError.value || maximumPriceError.value) return ""
  return parsedMinimumPrice.value > parsedMaximumPrice.value
    ? "Maximum budget must be greater than or equal to minimum budget."
    : ""
})

const validationMessage = computed(() => {
  return (
    itemNeededError.value ||
    descriptionError.value ||
    startDateError.value ||
    endDateError.value ||
    dateRangeError.value ||
    minimumPriceError.value ||
    maximumPriceError.value ||
    priceRangeError.value
  )
})

const isFormValid = computed(() => validationMessage.value.length === 0)
const hasStartedForm = computed(() => {
  return (
    itemNeeded.value.trim().length > 0 ||
    description.value.trim().length > 0 ||
    Boolean(startDate.value) ||
    Boolean(endDate.value) ||
    hasInputValue(minimumPrice.value) ||
    hasInputValue(maximumPrice.value) ||
    Object.values(touchedFields).some(Boolean)
  )
})
const showItemNeededError = computed(
  () => Boolean(itemNeededError.value) && (attemptedSubmit.value || touchedFields.itemNeeded),
)
const showDescriptionError = computed(
  () => Boolean(descriptionError.value) && (attemptedSubmit.value || touchedFields.description),
)
const showStartDateError = computed(
  () => Boolean(startDateError.value) && (attemptedSubmit.value || touchedFields.startDate),
)
const showEndDateError = computed(
  () => Boolean(endDateError.value) && (attemptedSubmit.value || touchedFields.endDate),
)
const showDateRangeError = computed(
  () =>
    Boolean(dateRangeError.value) &&
    (attemptedSubmit.value || touchedFields.startDate || touchedFields.endDate),
)
const showMinimumPriceError = computed(
  () => Boolean(minimumPriceError.value) && (attemptedSubmit.value || touchedFields.minimumPrice),
)
const showMaximumPriceError = computed(
  () => Boolean(maximumPriceError.value) && (attemptedSubmit.value || touchedFields.maximumPrice),
)
const showPriceRangeError = computed(
  () =>
    Boolean(priceRangeError.value) &&
    (attemptedSubmit.value || touchedFields.minimumPrice || touchedFields.maximumPrice),
)
const feedbackMessage = computed(
  () =>
    props.serverError ||
    (hasStartedForm.value ? validationMessage.value : "") ||
    "Your request will be posted directly to the live community feed.",
)
const hasFeedbackError = computed(
  () => Boolean(props.serverError) || (hasStartedForm.value && Boolean(validationMessage.value)),
)

const resetForm = () => {
  itemNeeded.value = ""
  description.value = ""
  startDate.value = ""
  endDate.value = ""
  minimumPrice.value = ""
  maximumPrice.value = ""
  attemptedSubmit.value = false
  resetTouchedFields()
}

const hasInputValue = (value: string | number) => {
  if (typeof value === "number") return Number.isFinite(value)
  return value.trim().length > 0
}

const resetTouchedFields = () => {
  touchedFields.itemNeeded = false
  touchedFields.description = false
  touchedFields.startDate = false
  touchedFields.endDate = false
  touchedFields.minimumPrice = false
  touchedFields.maximumPrice = false
}

const markTouched = (field: keyof typeof touchedFields) => {
  touchedFields[field] = true
}

const parsedMinimumPrice = computed(() =>
  typeof minimumPrice.value === "number" ? minimumPrice.value : Number(minimumPrice.value),
)
const parsedMaximumPrice = computed(() =>
  typeof maximumPrice.value === "number" ? maximumPrice.value : Number(maximumPrice.value),
)

const itemNeededError = computed(() => (itemNeeded.value.trim() ? "" : "Item needed is required."))
const descriptionError = computed(() =>
  description.value.trim() ? "" : "Description is required.",
)
const startDateError = computed(() => (startDate.value ? "" : "Start date is required."))
const endDateError = computed(() => (endDate.value ? "" : "End date is required."))
const dateRangeError = computed(() => {
  if (!startDate.value || !endDate.value) return ""
  return endDate.value < startDate.value ? "End date must be on or after the start date." : ""
})
const minimumPriceError = computed(() => {
  if (!hasInputValue(minimumPrice.value)) return "Minimum budget is required."
  if (!Number.isFinite(parsedMinimumPrice.value) || parsedMinimumPrice.value < 0) {
    return "Minimum budget must be 0 or higher."
  }
  return ""
})
const maximumPriceError = computed(() => {
  if (!hasInputValue(maximumPrice.value)) return "Maximum budget is required."
  if (!Number.isFinite(parsedMaximumPrice.value) || parsedMaximumPrice.value < 0) {
    return "Maximum budget must be 0 or higher."
  }
  return ""
})
const priceRangeError = computed(() => {
  if (minimumPriceError.value || maximumPriceError.value) return ""
  return parsedMinimumPrice.value > parsedMaximumPrice.value
    ? "Maximum budget must be greater than or equal to minimum budget."
    : ""
})

const validationMessage = computed(() => {
  return (
    itemNeededError.value ||
    descriptionError.value ||
    startDateError.value ||
    endDateError.value ||
    dateRangeError.value ||
    minimumPriceError.value ||
    maximumPriceError.value ||
    priceRangeError.value
  )
})

const isFormValid = computed(() => validationMessage.value.length === 0)
const hasStartedForm = computed(() => {
  return (
    itemNeeded.value.trim().length > 0 ||
    description.value.trim().length > 0 ||
    Boolean(startDate.value) ||
    Boolean(endDate.value) ||
    hasInputValue(minimumPrice.value) ||
    hasInputValue(maximumPrice.value) ||
    Object.values(touchedFields).some(Boolean)
  )
})
const showItemNeededError = computed(
  () => Boolean(itemNeededError.value) && (attemptedSubmit.value || touchedFields.itemNeeded),
)
const showDescriptionError = computed(
  () => Boolean(descriptionError.value) && (attemptedSubmit.value || touchedFields.description),
)
const showStartDateError = computed(
  () => Boolean(startDateError.value) && (attemptedSubmit.value || touchedFields.startDate),
)
const showEndDateError = computed(
  () => Boolean(endDateError.value) && (attemptedSubmit.value || touchedFields.endDate),
)
const showDateRangeError = computed(
  () =>
    Boolean(dateRangeError.value) &&
    (attemptedSubmit.value || touchedFields.startDate || touchedFields.endDate),
)
const showMinimumPriceError = computed(
  () => Boolean(minimumPriceError.value) && (attemptedSubmit.value || touchedFields.minimumPrice),
)
const showMaximumPriceError = computed(
  () => Boolean(maximumPriceError.value) && (attemptedSubmit.value || touchedFields.maximumPrice),
)
const showPriceRangeError = computed(
  () =>
    Boolean(priceRangeError.value) &&
    (attemptedSubmit.value || touchedFields.minimumPrice || touchedFields.maximumPrice),
)
const feedbackMessage = computed(
  () =>
    props.serverError ||
    (hasStartedForm.value ? validationMessage.value : "") ||
    "Your request will be posted directly to the live community feed.",
)
const hasFeedbackError = computed(
  () => Boolean(props.serverError) || (hasStartedForm.value && Boolean(validationMessage.value)),
)

const resetForm = () => {
  itemNeeded.value = ""
  description.value = ""
  startDate.value = ""
  endDate.value = ""
  minimumPrice.value = ""
  maximumPrice.value = ""
  attemptedSubmit.value = false
  resetTouchedFields()
}

const triggerHighlight = () => {
  isHighlighted.value = true
  containerRef.value?.scrollIntoView({ behavior: "smooth", block: "center" })
  setTimeout(() => {
    itemNeededInputRef.value?.focus()
  }, 600)
  setTimeout(() => {
    isHighlighted.value = false
  }, 2500)
}

defineExpose({ triggerHighlight })

const handlePost = () => {
  attemptedSubmit.value = true
  if (!isFormValid.value) return

  emit("post", {
    itemNeeded: itemNeeded.value.trim(),
    description: description.value.trim(),
    startDate: startDate.value,
    endDate: endDate.value,
    minimumPrice: parsedMinimumPrice.value,
    maximumPrice: parsedMaximumPrice.value,
  })

  resetForm()
}
</script>
