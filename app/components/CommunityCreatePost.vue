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
      <UserAvatar :avatar-url="userAvatar" :user-name="userName" size="lg" />

      <div class="flex-1 flex flex-col gap-3">
        <input
          ref="itemNeededInputRef"
          v-model="itemNeeded"
          type="text"
          placeholder="What are you looking for?"
          class="w-full bg-white/50 border border-transparent focus:border-cinnamon-ice focus:bg-white rounded-[14px] focus:ring-4 focus:ring-cinnamon-ice/5 text-[18px] font-semibold text-noble-black placeholder:text-noble-black/30 px-4 py-3 transition-all duration-300 outline-none"
        />

        <textarea
          v-model="description"
          placeholder="Describe the item, how you plan to use it, and any important requirements."
          class="w-full bg-white/50 border border-transparent focus:border-cinnamon-ice focus:bg-white rounded-[14px] focus:ring-4 focus:ring-cinnamon-ice/5 text-[15px] text-noble-black placeholder:text-noble-black/30 resize-none min-h-[110px] px-4 py-3 transition-all duration-300 outline-none"
        ></textarea>

        <div class="grid gap-3 md:grid-cols-2">
          <label class="flex flex-col gap-2">
            <span class="text-[12px] font-bold uppercase tracking-[0.12em] text-noble-black/45">
              Start date
            </span>
            <input
              v-model="startDate"
              type="date"
              class="w-full rounded-[14px] border border-cinnamon-ice/30 bg-white px-4 py-3 text-[14px] text-noble-black outline-none transition-all duration-300 focus:border-blue-estate/30 focus:ring-4 focus:ring-blue-estate/5"
            />
          </label>

          <label class="flex flex-col gap-2">
            <span class="text-[12px] font-bold uppercase tracking-[0.12em] text-noble-black/45">
              End date
            </span>
            <input
              v-model="endDate"
              type="date"
              class="w-full rounded-[14px] border border-cinnamon-ice/30 bg-white px-4 py-3 text-[14px] text-noble-black outline-none transition-all duration-300 focus:border-blue-estate/30 focus:ring-4 focus:ring-blue-estate/5"
            />
          </label>

          <label class="flex flex-col gap-2">
            <span class="text-[12px] font-bold uppercase tracking-[0.12em] text-noble-black/45">
              Min budget
            </span>
            <div
              class="flex items-center rounded-[14px] border border-cinnamon-ice/30 bg-white px-4 focus-within:border-blue-estate/30 focus-within:ring-4 focus-within:ring-blue-estate/5"
            >
              <span class="text-[14px] font-semibold text-noble-black/45">PHP</span>
              <input
                v-model="minimumPrice"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                class="w-full border-none bg-transparent px-3 py-3 text-[14px] text-noble-black outline-none"
              />
            </div>
          </label>

          <label class="flex flex-col gap-2">
            <span class="text-[12px] font-bold uppercase tracking-[0.12em] text-noble-black/45">
              Max budget
            </span>
            <div
              class="flex items-center rounded-[14px] border border-cinnamon-ice/30 bg-white px-4 focus-within:border-blue-estate/30 focus-within:ring-4 focus-within:ring-blue-estate/5"
            >
              <span class="text-[14px] font-semibold text-noble-black/45">PHP</span>
              <input
                v-model="maximumPrice"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                class="w-full border-none bg-transparent px-3 py-3 text-[14px] text-noble-black outline-none"
              />
            </div>
          </label>
        </div>
      </div>
    </div>

    <div class="h-[1px] w-full bg-cinnamon-ice/20"></div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-[13px] text-noble-black/45">
        {{ validationMessage || "Your request will be posted directly to the live community feed." }}
      </p>

      <button
        type="submit"
        class="px-8 py-2.5 bg-burning-orange text-white rounded-full font-bold text-[15px] hover:bg-blue-estate transition-all shadow-md active:scale-95 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
        :disabled="!isFormValid || isSubmitting"
      >
        {{ isSubmitting ? "Posting..." : "Post Request" }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import type { CommunityRequestComposerInput } from "~/types/community-requests"

defineProps<{
  userAvatar?: string | null
  userName: string
  isSubmitting?: boolean
}>()

const emit = defineEmits<{
  (event: "post", value: CommunityRequestComposerInput): void
}>()

const itemNeeded = ref("")
const description = ref("")
const startDate = ref("")
const endDate = ref("")
const minimumPrice = ref("")
const maximumPrice = ref("")

const containerRef = ref<HTMLElement | null>(null)
const itemNeededInputRef = ref<HTMLInputElement | null>(null)
const isHighlighted = ref(false)

const parsedMinimumPrice = computed(() => Number(minimumPrice.value))
const parsedMaximumPrice = computed(() => Number(maximumPrice.value))

const validationMessage = computed(() => {
  if (!itemNeeded.value.trim()) return "Item needed is required."
  if (!description.value.trim()) return "Description is required."
  if (!startDate.value) return "Start date is required."
  if (!endDate.value) return "End date is required."
  if (endDate.value < startDate.value) return "End date must be on or after the start date."
  if (!minimumPrice.value.trim()) return "Minimum budget is required."
  if (!maximumPrice.value.trim()) return "Maximum budget is required."
  if (!Number.isFinite(parsedMinimumPrice.value) || parsedMinimumPrice.value < 0) {
    return "Minimum budget must be 0 or higher."
  }
  if (!Number.isFinite(parsedMaximumPrice.value) || parsedMaximumPrice.value < 0) {
    return "Maximum budget must be 0 or higher."
  }
  if (parsedMinimumPrice.value > parsedMaximumPrice.value) {
    return "Maximum budget must be greater than or equal to minimum budget."
  }
  return ""
})

const isFormValid = computed(() => validationMessage.value.length === 0)

const resetForm = () => {
  itemNeeded.value = ""
  description.value = ""
  startDate.value = ""
  endDate.value = ""
  minimumPrice.value = ""
  maximumPrice.value = ""
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
