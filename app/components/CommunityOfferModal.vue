<template>
  <Teleport to="body">
    <transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[2100] flex items-center justify-center p-4 font-geist"
      >
        <!-- Overlay -->
        <div class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm" @click="closeModal" />

        <!-- Modal Container -->
        <div
          class="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-[20px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.15)] overflow-hidden"
        >
          <!-- Header -->
          <div class="px-6 pt-8 pb-4 flex items-start justify-between gap-4 shrink-0">
            <div>
              <h2 class="text-[24px] font-semibold text-noble-black">
                {{ existingOffer ? "Update Offer" : "Make an Offer" }}
              </h2>
              <p class="mt-1 text-[13px] font-light text-noble-black/50">
                {{
                  existingOffer
                    ? "Update your terms for this request."
                    : "Set your terms and send this offer directly."
                }}
              </p>
            </div>
            <button
              type="button"
              class="flex h-10 w-10 items-center justify-center rounded-full text-noble-black transition hover:bg-gray-100"
              @click="closeModal"
            >
              <Icon name="ph:x" class="w-[18px] h-[18px]" />
            </button>
          </div>

          <!-- Scrollable Content -->
          <div class="flex-1 overflow-y-auto custom-modal-scrollbar px-6">
            <div class="space-y-5 py-4 pb-8">
              <!-- Request Title Info (Visual Hint) -->
              <div
                class="mb-2 p-4 rounded-[12px] bg-gray-50 border border-gray-100 flex items-center gap-3"
              >
                <div
                  class="w-10 h-10 rounded-full bg-burning-orange/10 flex items-center justify-center shrink-0"
                >
                  <Icon name="ph:hand-heart" class="w-5 h-5 text-burning-orange" />
                </div>
                <div class="min-w-0">
                  <p class="text-[11px] font-bold uppercase tracking-[0.1em] text-noble-black/40">
                    Responding to
                  </p>
                  <h3 class="text-[15px] font-semibold text-noble-black truncate">
                    {{ requestTitle }}
                  </h3>
                </div>
              </div>

              <!-- Empty State -->
              <div
                v-if="items.length === 0"
                class="rounded-[16px] border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center"
              >
                <Icon name="ph:package" class="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p class="text-[15px] font-semibold text-noble-black">No offerable items found</p>
                <p class="mt-1 text-[13px] text-noble-black/50">
                  Create a listing first to make an offer.
                </p>
                <button
                  type="button"
                  class="mt-4 inline-flex h-10 items-center justify-center rounded-[12px] bg-burning-orange px-6 text-[14px] font-semibold text-white transition hover:brightness-95 shadow-sm shadow-burning-orange/20"
                  @click="emit('create-item')"
                >
                  Add New Item
                </button>
              </div>

              <div v-else class="space-y-5">
                <!-- Item Selection -->
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between px-1">
                    <label class="text-[13px] font-semibold text-noble-black/70"
                      >Select your item</label
                    >
                    <button
                      type="button"
                      class="text-[12px] font-bold text-burning-orange hover:underline"
                      @click="emit('create-item')"
                    >
                      + Add New
                    </button>
                  </div>
                  <div ref="itemDropdownRef" class="relative group">
                    <div
                      class="flex w-full pl-12 pr-10 py-4 border-[1.5px] border-gray-200 rounded-[10px] bg-white cursor-pointer transition-all duration-300"
                      :class="[
                        isItemDropdownOpen
                          ? 'border-burning-orange shadow-[0_0_0_3px_rgba(232,101,10,0.1)]'
                          : 'hover:border-burning-orange/30',
                        { 'border-burning-orange/50': showItemError },
                      ]"
                      @click="toggleItemDropdown"
                    >
                      <div
                        class="absolute left-4 top-[18px] text-noble-black/40 group-hover:text-burning-orange transition-colors duration-300 z-10"
                      >
                        <Icon name="ph:package" class="w-[18px] h-[18px]" />
                      </div>
                      <span
                        class="text-[15px] transition-colors"
                        :class="selectedItemIdInput ? 'text-noble-black' : 'text-noble-black/40'"
                      >
                        {{ selectedItem?.name || "Choose from your listings" }}
                      </span>
                      <Icon
                        name="ph:caret-down"
                        class="absolute right-4 top-1/2 -translate-y-1/2 text-noble-black/40 transition-transform duration-300"
                        :class="{ 'rotate-180': isItemDropdownOpen }"
                        size="18"
                      />
                    </div>

                    <!-- Custom Dropdown List -->
                    <transition
                      enter-active-class="transition duration-300 ease-out"
                      enter-from-class="transform -translate-y-2 opacity-0"
                      enter-to-class="transform translate-y-0 opacity-100"
                      leave-active-class="transition duration-200 ease-in"
                      leave-from-class="transform translate-y-0 opacity-100"
                      leave-to-class="transform -translate-y-2 opacity-0"
                    >
                      <div
                        v-if="isItemDropdownOpen"
                        class="absolute z-[100] mt-2 w-full bg-white border border-cinnamon-ice/30 rounded-[12px] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] py-2 overflow-hidden"
                      >
                        <div class="max-h-[240px] overflow-y-auto custom-modal-scrollbar">
                          <button
                            v-for="item in items"
                            :key="item.numericId"
                            type="button"
                            class="w-full text-left px-5 py-3 text-[14px] transition-all duration-200 flex flex-col gap-0.5"
                            :class="[
                              selectedItemIdInput === String(item.numericId)
                                ? 'bg-burning-orange/5 text-burning-orange font-bold'
                                : 'text-noble-black hover:bg-gray-50 hover:text-burning-orange',
                            ]"
                            @click="selectItemOption(item.numericId)"
                          >
                            <span class="font-semibold">{{ item.name }}</span>
                            <span class="text-[11px] opacity-60">
                              {{ formatCondition(item.condition) }} ·
                              {{ item.freeToBorrow ? "Free" : formatFee(item.rentalFee) }}
                            </span>
                          </button>
                        </div>
                      </div>
                    </transition>
                  </div>
                  <p v-if="showItemError" class="text-[11px] font-medium text-burning-orange ml-1">
                    {{ itemError }}
                  </p>
                </div>

                <!-- Selected Item Preview Card -->
                <transition name="fade">
                  <div
                    v-if="selectedItem"
                    class="rounded-[12px] border border-gray-100 bg-gray-50/30 p-3"
                  >
                    <div class="flex items-center gap-4">
                      <img
                        v-if="selectedItem.thumbnailImage"
                        :src="selectedItem.thumbnailImage"
                        class="h-14 w-14 rounded-[8px] object-cover bg-white shadow-sm"
                      />
                      <div
                        v-else
                        class="h-14 w-14 rounded-[8px] bg-gray-200 flex items-center justify-center"
                      >
                        <Icon name="ph:image" class="text-gray-400" />
                      </div>
                      <div class="min-w-0">
                        <p class="text-[14px] font-semibold text-noble-black truncate">
                          {{ selectedItem.name }}
                        </p>
                        <p class="text-[12px] text-noble-black/50">
                          {{ formatCondition(selectedItem.condition) }} ·
                          {{
                            selectedItem.freeToBorrow ? "Free" : formatFee(selectedItem.rentalFee)
                          }}
                        </p>
                      </div>
                    </div>
                  </div>
                </transition>

                <!-- Rental Fee & Condition Grid -->
                <div class="grid grid-cols-2 gap-4">
                  <!-- Fee -->
                  <div class="space-y-1.5">
                    <label class="text-[13px] font-semibold text-noble-black/70 ml-1"
                      >Rental Fee</label
                    >
                    <div class="relative group">
                      <div
                        class="absolute left-4 top-[18px] text-noble-black/40 group-focus-within:text-burning-orange transition-colors duration-300 z-10"
                      >
                        <span class="text-[15px] font-bold">₱</span>
                      </div>
                      <input
                        v-model="feeInput"
                        type="text"
                        inputmode="numeric"
                        placeholder="0"
                        class="w-full pl-10 pr-4 py-4 border-[1.5px] border-gray-200 rounded-[10px] bg-white focus:border-burning-orange focus:shadow-[0_0_0_3px_rgba(232,101,10,0.1)] outline-none text-[15px] text-noble-black transition-all duration-300 font-semibold"
                        :class="{ 'border-burning-orange/50': showFeeError }"
                        @input="handlePriceInput"
                        @keypress="blockInvalidPriceChars"
                        @blur="markTouched('fee')"
                      />
                    </div>
                    <p v-if="showFeeError" class="text-[11px] font-medium text-burning-orange ml-1">
                      {{ feeError }}
                    </p>
                  </div>

                  <!-- Condition -->
                  <div class="space-y-1.5">
                    <label class="text-[13px] font-semibold text-noble-black/70 ml-1"
                      >Condition</label
                    >
                    <div ref="conditionDropdownRef" class="relative group">
                      <div
                        class="flex w-full pl-12 pr-10 py-4 border-[1.5px] border-gray-200 rounded-[10px] bg-white cursor-pointer transition-all duration-300"
                        :class="
                          isConditionDropdownOpen
                            ? 'border-burning-orange shadow-[0_0_0_3px_rgba(232,101,10,0.1)]'
                            : 'hover:border-burning-orange/30'
                        "
                        @click="toggleConditionDropdown"
                      >
                        <div
                          class="absolute left-4 top-[18px] text-noble-black/40 group-hover:text-burning-orange transition-colors duration-300 z-10"
                        >
                          <Icon name="ph:sparkle" class="w-[18px] h-[18px]" />
                        </div>
                        <span class="text-[15px] text-noble-black">
                          {{ formatCondition(condition) }}
                        </span>
                        <Icon
                          name="ph:caret-down"
                          class="absolute right-4 top-1/2 -translate-y-1/2 text-noble-black/40 transition-transform duration-300"
                          :class="{ 'rotate-180': isConditionDropdownOpen }"
                          size="18"
                        />
                      </div>

                      <!-- Custom Dropdown List -->
                      <transition
                        enter-active-class="transition duration-300 ease-out"
                        enter-from-class="transform -translate-y-2 opacity-0"
                        enter-to-class="transform translate-y-0 opacity-100"
                        leave-active-class="transition duration-200 ease-in"
                        leave-from-class="transform translate-y-0 opacity-100"
                        leave-to-class="transform -translate-y-2 opacity-0"
                      >
                        <div
                          v-if="isConditionDropdownOpen"
                          class="absolute z-[100] mt-2 w-full bg-white border border-cinnamon-ice/30 rounded-[12px] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] py-2 overflow-hidden"
                        >
                          <div class="max-h-[200px] overflow-y-auto custom-modal-scrollbar">
                            <button
                              v-for="option in communityOfferConditions"
                              :key="option"
                              type="button"
                              class="w-full text-left px-5 py-3 text-[14px] transition-all duration-200"
                              :class="[
                                condition === option
                                  ? 'bg-burning-orange/5 text-burning-orange font-bold'
                                  : 'text-noble-black hover:bg-gray-50 hover:text-burning-orange',
                              ]"
                              @click="selectConditionOption(option)"
                            >
                              {{ formatCondition(option) }}
                            </button>
                          </div>
                        </div>
                      </transition>
                    </div>
                  </div>
                </div>

                <!-- Rental Terms -->
                <div class="relative group">
                  <div
                    class="absolute left-4 top-5 text-noble-black/40 group-focus-within:text-burning-orange transition-colors duration-300"
                  >
                    <Icon name="ph:notebook" class="w-[18px] h-[18px]" />
                  </div>
                  <textarea
                    id="offer-terms"
                    v-model="rentalTerms"
                    rows="3"
                    placeholder=" "
                    class="peer w-full pl-12 pr-4 pt-7 pb-2 border-[1.5px] border-gray-200 rounded-[10px] bg-white focus:border-burning-orange focus:shadow-[0_0_0_3px_rgba(232,101,10,0.1)] outline-none text-[15px] text-noble-black transition-all duration-300 resize-none h-32"
                    @blur="markTouched('rentalTerms')"
                  ></textarea>
                  <label
                    for="offer-terms"
                    class="absolute left-12 top-5 text-noble-black/40 text-[15px] transition-all duration-300 pointer-events-none peer-placeholder-shown:top-5 peer-placeholder-shown:text-[15px] peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-burning-orange peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[11px]"
                    >Rental Terms & Details</label
                  >
                  <p
                    v-if="showRentalTermsError"
                    class="text-[11px] font-medium text-burning-orange mt-1 ml-1"
                  >
                    {{ rentalTermsError }}
                  </p>
                </div>

                <!-- Availability Confirmation -->
                <div class="pt-2">
                  <label class="flex items-center gap-3 cursor-pointer group">
                    <div class="relative">
                      <input
                        v-model="availabilityConfirmed"
                        type="checkbox"
                        class="peer h-5 w-5 appearance-none rounded-[6px] border-[1.5px] border-gray-200 bg-white transition-all checked:bg-burning-orange checked:border-burning-orange"
                        @change="markTouched('availability')"
                      />
                      <Icon
                        name="ph:check-bold"
                        class="absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                        size="12"
                      />
                    </div>
                    <div class="flex-1">
                      <span
                        class="text-[14px] font-medium text-noble-black group-hover:text-burning-orange transition-colors"
                        >Confirm item availability</span
                      >
                      <p class="text-[12px] text-noble-black/40">
                        Check that the item is ready for the requested dates.
                      </p>
                    </div>
                  </label>
                  <p
                    v-if="showAvailabilityError"
                    class="text-[11px] font-medium text-burning-orange mt-1 ml-8"
                  >
                    {{ availabilityError }}
                  </p>
                </div>
              </div>

              <!-- Server Error -->
              <transition name="fade">
                <div
                  v-if="hasFeedbackError && feedbackMessage"
                  class="rounded-[10px] bg-cinnabar-red/5 p-3 border border-cinnabar-red/10"
                >
                  <p class="text-[12px] font-medium text-cinnabar-red text-center">
                    {{ feedbackMessage }}
                  </p>
                </div>
              </transition>
            </div>
          </div>

          <!-- Footer -->
          <div
            class="px-6 py-5 border-t border-cinnamon-ice/10 bg-white flex flex-col shrink-0 gap-3"
          >
            <div v-if="existingOffer" class="w-full">
              <button
                type="button"
                class="w-full h-10 px-6 rounded-[12px] bg-cinnabar-red text-white text-[13px] font-semibold shadow-sm shadow-cinnabar-red/20 hover:brightness-110 transition-all duration-300"
                :disabled="isSubmitting"
                @click="emitCancel"
              >
                Cancel Current Offer
              </button>
            </div>
            <div class="flex gap-3 w-full">
              <button
                type="button"
                class="flex-1 h-12 items-center justify-center rounded-[10px] border-[1.5px] border-burning-orange bg-white text-[15px] font-semibold text-burning-orange transition-all duration-200 hover:bg-burning-orange/5"
                @click="closeModal"
              >
                Close
              </button>
              <button
                type="button"
                class="flex-1 h-12 items-center justify-center rounded-[10px] bg-gradient-to-br from-burning-orange to-orange-500 text-[15px] font-semibold text-white transition-all duration-300 shadow-lg shadow-burning-orange/35 hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                :disabled="!canSubmit || isSubmitting"
                @click="submitOffer"
              >
                <Icon
                  v-if="isSubmitting"
                  name="ph:spinner"
                  class="animate-spin w-4 h-4 mr-2 inline-block"
                />
                {{ isSubmitting ? "Sending..." : existingOffer ? "Update Offer" : "Submit Offer" }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, onMounted, onUnmounted } from "vue"
import type {
  CommunityOffer,
  CommunityOfferCondition,
  CommunityOfferFormInput,
  CommunityOfferableItem,
} from "~/types/community-requests"
import { communityOfferConditions } from "~/types/community-requests"

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    requestTitle: string
    items: CommunityOfferableItem[]
    preferredItemId?: number | null
    existingOffer?: CommunityOffer | null
    isSubmitting?: boolean
    serverError?: string | null
  }>(),
  {
    preferredItemId: null,
    existingOffer: null,
    isSubmitting: false,
    serverError: null,
  },
)

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void
  (event: "submit", value: CommunityOfferFormInput): void
  (event: "cancel-offer", offerId: number): void
  (event: "create-item"): void
}>()

const selectedItemIdInput = ref("")
const rentalTerms = ref("")
const feeInput = ref<string | number>("")
const condition = ref<CommunityOfferCondition>(communityOfferConditions[2]!)
const availabilityConfirmed = ref(false)
const attemptedSubmit = ref(false)
const touchedFields = reactive({
  item: false,
  fee: false,
  rentalTerms: false,
  availability: false,
})

// Dropdown State
const isItemDropdownOpen = ref(false)
const isConditionDropdownOpen = ref(false)
const itemDropdownRef = ref<HTMLElement | null>(null)
const conditionDropdownRef = ref<HTMLElement | null>(null)

const toggleItemDropdown = () => {
  isItemDropdownOpen.value = !isItemDropdownOpen.value
  if (isItemDropdownOpen.value) isConditionDropdownOpen.value = false
}

const toggleConditionDropdown = () => {
  isConditionDropdownOpen.value = !isConditionDropdownOpen.value
  if (isConditionDropdownOpen.value) isItemDropdownOpen.value = false
}

const selectItemOption = (numericId: number) => {
  selectedItemIdInput.value = String(numericId)
  isItemDropdownOpen.value = false
  markTouched("item")
}

const selectConditionOption = (option: CommunityOfferCondition) => {
  condition.value = option
  isConditionDropdownOpen.value = false
}

const handleClickOutside = (event: MouseEvent) => {
  if (itemDropdownRef.value && !itemDropdownRef.value.contains(event.target as Node)) {
    isItemDropdownOpen.value = false
  }
  if (conditionDropdownRef.value && !conditionDropdownRef.value.contains(event.target as Node)) {
    isConditionDropdownOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside)
})

const parsedFee = computed(() => Number(feeInput.value))
const selectedItemId = computed(() => Number(selectedItemIdInput.value))
const selectedItem = computed(() => {
  return props.items.find((item) => item.numericId === selectedItemId.value) ?? null
})

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
})

const formatFee = (fee: number) => {
  return fee === 0 ? "Free" : currencyFormatter.format(fee)
}

const formatCondition = (value: CommunityOfferCondition) => {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

const hasInputValue = (value: string | number) => {
  if (typeof value === "number") return Number.isFinite(value)
  return value.trim().length > 0
}

const resetTouchedFields = () => {
  touchedFields.item = false
  touchedFields.fee = false
  touchedFields.rentalTerms = false
  touchedFields.availability = false
}

const markTouched = (field: keyof typeof touchedFields) => {
  touchedFields[field] = true
}

const hydrateForm = () => {
  const initialItemId =
    props.preferredItemId ?? props.existingOffer?.itemID ?? props.items[0]?.numericId ?? null
  const initialItem =
    props.items.find((item) => item.numericId === initialItemId) ?? props.items[0] ?? null

  selectedItemIdInput.value = initialItemId ? String(initialItemId) : ""
  rentalTerms.value = props.existingOffer?.rentalTerms ?? ""
  feeInput.value = String(
    props.existingOffer?.rentalFee ??
      (initialItem?.freeToBorrow ? 0 : (initialItem?.rentalFee ?? "")),
  )
  condition.value =
    props.existingOffer?.condition ?? initialItem?.condition ?? communityOfferConditions[2]!
  availabilityConfirmed.value = props.existingOffer?.availability ?? false
  attemptedSubmit.value = false
  resetTouchedFields()
}

watch(
  () => [props.modelValue, props.existingOffer] as const,
  ([isOpen]) => {
    if (!isOpen) return
    hydrateForm()
  },
  { immediate: true },
)

watch(
  () => props.items,
  (items) => {
    if (!props.modelValue || items.length === 0) return

    if (props.preferredItemId && items.some((item) => item.numericId === props.preferredItemId)) {
      selectedItemIdInput.value = String(props.preferredItemId)
      return
    }

    if (!selectedItem.value) {
      selectedItemIdInput.value = String(items[0]?.numericId ?? "")
    }
  },
  { deep: true },
)

watch(
  () => props.preferredItemId,
  (preferredItemId) => {
    if (!props.modelValue || !preferredItemId) return
    if (!props.items.some((item) => item.numericId === preferredItemId)) return
    selectedItemIdInput.value = String(preferredItemId)
  },
)

watch(selectedItem, (item) => {
  if (!item) return

  if (!props.existingOffer || item.numericId !== props.existingOffer.itemID) {
    feeInput.value = String(item.freeToBorrow ? 0 : item.rentalFee)
    condition.value = item.condition
  }
})

const itemError = computed(() => {
  if (props.items.length === 0) {
    return "You need at least one active listing before you can submit an offer."
  }
  return selectedItem.value ? "" : "Select one of your items."
})
const feeError = computed(() =>
  !Number.isFinite(parsedFee.value) || parsedFee.value < 0 ? "Rental fee must be 0 or higher." : "",
)
const rentalTermsError = computed(() =>
  rentalTerms.value.trim() ? "" : "Rental terms are required.",
)
const availabilityError = computed(() =>
  availabilityConfirmed.value ? "" : "Confirm item availability before submitting.",
)
const validationMessage = computed(
  () => itemError.value || rentalTermsError.value || feeError.value || availabilityError.value,
)
const canSubmit = computed(() => validationMessage.value.length === 0)
const hasStartedForm = computed(() => {
  return (
    selectedItemIdInput.value.length > 0 ||
    hasInputValue(feeInput.value) ||
    rentalTerms.value.trim().length > 0 ||
    availabilityConfirmed.value ||
    Object.values(touchedFields).some(Boolean)
  )
})
const showItemError = computed(
  () =>
    Boolean(itemError.value) &&
    (props.items.length === 0 || attemptedSubmit.value || touchedFields.item),
)
const showFeeError = computed(
  () => Boolean(feeError.value) && (attemptedSubmit.value || touchedFields.fee),
)
const showRentalTermsError = computed(
  () => Boolean(rentalTermsError.value) && (attemptedSubmit.value || touchedFields.rentalTerms),
)
const showAvailabilityError = computed(
  () => Boolean(availabilityError.value) && (attemptedSubmit.value || touchedFields.availability),
)
const feedbackMessage = computed(
  () => props.serverError || (hasStartedForm.value ? validationMessage.value : ""),
)
const hasFeedbackError = computed(
  () => Boolean(props.serverError) || (hasStartedForm.value && Boolean(validationMessage.value)),
)

const closeModal = () => {
  attemptedSubmit.value = false
  resetTouchedFields()
  emit("update:modelValue", false)
}

const submitOffer = () => {
  attemptedSubmit.value = true
  if (!canSubmit.value || !selectedItem.value) return

  emit("submit", {
    itemID: selectedItem.value.numericId,
    rentalFee: parsedFee.value,
    availability: availabilityConfirmed.value,
    condition: condition.value,
    rentalTerms: rentalTerms.value.trim(),
  })
}

const blockInvalidPriceChars = (event: KeyboardEvent) => {
  if (["-", "e", "E", "+", "."].includes(event.key)) {
    event.preventDefault()
  }
}

const handlePriceInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  const value = target.value
  const sanitized = value.replace(/\D/g, "")
  if (sanitized !== value) {
    feeInput.value = sanitized
  }
}

const emitCancel = () => {
  if (!props.existingOffer) return
  emit("cancel-offer", props.existingOffer.id)
}
</script>

<style scoped>
.custom-modal-scrollbar::-webkit-scrollbar {
  width: 5px;
}

.custom-modal-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-modal-scrollbar::-webkit-scrollbar-thumb {
  background: theme("colors.cinnamon-ice / 20%");
  border-radius: 10px;
}

.custom-modal-scrollbar::-webkit-scrollbar-thumb:hover {
  background: theme("colors.cinnamon-ice / 40%");
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
