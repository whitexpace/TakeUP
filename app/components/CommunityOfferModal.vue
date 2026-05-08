<template>
  <Teleport to="body">
    <transition name="offer-modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[2100] flex items-center justify-center bg-noble-black/55 p-4"
        @click.self="closeModal"
      >
        <div
          class="w-full max-w-2xl rounded-[28px] border border-cinnamon-ice/30 bg-cream p-6 shadow-2xl md:p-7"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex flex-col gap-1">
              <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-estate/60">
                {{ existingOffer ? "Update offer" : "Offer item" }}
              </p>
              <h2 class="text-[26px] font-bold leading-tight text-noble-black">
                {{ requestTitle }}
              </h2>
              <p class="text-[14px] leading-relaxed text-noble-black/55">
                Pick one of your listings, set the terms, and send the offer directly to the
                borrower.
              </p>
            </div>

            <button
              class="rounded-full p-2 text-noble-black/40 transition-colors hover:bg-white hover:text-noble-black"
              aria-label="Close offer form"
              @click="closeModal"
            >
              <Icon name="ph:x-light" class="w-[18px] h-[18px]" />
            </button>
          </div>

          <div
            v-if="items.length === 0"
            class="mt-6 rounded-[18px] border border-dashed border-cinnamon-ice/30 bg-white/70 px-5 py-5"
          >
            <p class="text-[14px] font-semibold text-noble-black">No offerable items found.</p>
            <p class="mt-1 text-[13px] leading-relaxed text-noble-black/50">
              Create a listing first so you can attach a real item to this offer.
            </p>
            <button
              type="button"
              class="mt-4 rounded-full bg-burning-orange px-5 py-2.5 text-[13px] font-bold text-white transition-all hover:bg-blue-estate"
              @click="emit('create-item')"
            >
              Add new item
            </button>
          </div>

          <div v-else class="mt-6 grid gap-4 md:grid-cols-2">
            <label class="flex flex-col gap-2 md:col-span-2">
              <span class="flex items-center justify-between gap-3">
                <span class="text-[12px] font-bold uppercase tracking-[0.12em] text-noble-black/45">
                  Your item
                </span>
                <button
                  type="button"
                  class="rounded-full border border-cinnamon-ice/25 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-blue-estate transition-all hover:border-blue-estate/20 hover:bg-blue-estate/5"
                  @click="emit('create-item')"
                >
                  Add new item
                </button>
              </span>
              <select
                v-model="selectedItemIdInput"
                class="w-full rounded-[16px] bg-white px-4 py-3 text-[15px] text-noble-black outline-none transition-all duration-300"
                :class="
                  showItemError
                    ? 'border border-burning-orange/50 ring-4 ring-burning-orange/10'
                    : 'border border-cinnamon-ice/30 focus:border-blue-estate/30 focus:ring-4 focus:ring-blue-estate/5'
                "
                @blur="markTouched('item')"
              >
                <option value="">Select an item</option>
                <option v-for="item in items" :key="item.numericId" :value="String(item.numericId)">
                  {{ item.name }} · {{ formatFee(item.freeToBorrow ? 0 : item.rentalFee) }}
                </option>
              </select>
              <p v-if="showItemError" class="text-[12px] font-medium text-burning-orange">
                {{ itemError }}
              </p>
            </label>

            <div
              v-if="selectedItem"
              class="md:col-span-2 overflow-hidden rounded-[18px] border border-cinnamon-ice/20 bg-white"
            >
              <div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <div class="h-28 w-full overflow-hidden rounded-[16px] bg-cream sm:w-36">
                  <img
                    v-if="selectedItem.thumbnailImage"
                    :src="selectedItem.thumbnailImage"
                    :alt="selectedItem.name"
                    class="h-full w-full object-cover"
                  />
                  <div
                    v-else
                    class="flex h-full w-full items-center justify-center text-[12px] font-semibold uppercase tracking-[0.12em] text-noble-black/30"
                  >
                    No image
                  </div>
                </div>
                <div class="flex flex-1 flex-col gap-1">
                  <p class="text-[16px] font-semibold text-noble-black">{{ selectedItem.name }}</p>
                  <p class="text-[13px] text-noble-black/55">
                    {{ formatCondition(selectedItem.condition) }} ·
                    {{
                      selectedItem.freeToBorrow
                        ? "Free to borrow"
                        : formatFee(selectedItem.rentalFee)
                    }}
                  </p>
                  <p class="text-[13px] text-noble-black/45">
                    This image will be shown with your offer so the borrower can identify the item.
                  </p>
                </div>
              </div>
            </div>

            <label class="flex flex-col gap-2">
              <span class="text-[12px] font-bold uppercase tracking-[0.12em] text-noble-black/45">
                Rental fee
              </span>
              <div
                class="flex items-center rounded-[16px] bg-white px-4"
                :class="
                  showFeeError
                    ? 'border border-burning-orange/50 ring-4 ring-burning-orange/10'
                    : 'border border-cinnamon-ice/30 focus-within:border-blue-estate/30 focus-within:ring-4 focus-within:ring-blue-estate/5'
                "
              >
                <span class="text-[15px] font-semibold text-noble-black/45">PHP</span>
                <input
                  v-model="feeInput"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  step="1"
                  placeholder="0"
                  class="w-full border-none bg-transparent px-3 py-3 text-[15px] text-noble-black outline-none"
                  @blur="markTouched('fee')"
                />
              </div>
              <p v-if="showFeeError" class="text-[12px] font-medium text-burning-orange">
                {{ feeError }}
              </p>
            </label>

            <label class="flex flex-col gap-2">
              <span class="text-[12px] font-bold uppercase tracking-[0.12em] text-noble-black/45">
                Condition
              </span>
              <select
                v-model="condition"
                class="w-full rounded-[16px] border border-cinnamon-ice/30 bg-white px-4 py-3 text-[15px] text-noble-black outline-none transition-all duration-300 focus:border-blue-estate/30 focus:ring-4 focus:ring-blue-estate/5"
              >
                <option v-for="option in communityOfferConditions" :key="option" :value="option">
                  {{ formatCondition(option) }}
                </option>
              </select>
            </label>

            <label class="flex flex-col gap-2 md:col-span-2">
              <span class="text-[12px] font-bold uppercase tracking-[0.12em] text-noble-black/45">
                Rental terms
              </span>
              <textarea
                v-model="rentalTerms"
                rows="5"
                placeholder="Share pickup details, inclusions, and any conditions the borrower should know."
                class="w-full resize-none rounded-[16px] bg-white px-4 py-3 text-[15px] leading-relaxed text-noble-black outline-none transition-all duration-300 placeholder:text-noble-black/30"
                :class="
                  showRentalTermsError
                    ? 'border border-burning-orange/50 ring-4 ring-burning-orange/10'
                    : 'border border-cinnamon-ice/30 focus:border-blue-estate/30 focus:ring-4 focus:ring-blue-estate/5'
                "
                @blur="markTouched('rentalTerms')"
              ></textarea>
              <p v-if="showRentalTermsError" class="text-[12px] font-medium text-burning-orange">
                {{ rentalTermsError }}
              </p>
            </label>
          </div>

          <label
            class="mt-5 flex items-start gap-3 rounded-[18px] bg-white px-4 py-3"
            :class="
              showAvailabilityError
                ? 'border border-burning-orange/40 ring-4 ring-burning-orange/10'
                : 'border border-cinnamon-ice/25'
            "
          >
            <input
              v-model="availabilityConfirmed"
              type="checkbox"
              class="mt-1 h-4 w-4 rounded border-cinnamon-ice text-blue-estate focus:ring-blue-estate/20"
              @change="markTouched('availability')"
            />
            <div class="flex flex-col gap-1">
              <span class="text-[14px] font-semibold text-noble-black">
                I confirm this item is available
              </span>
              <span class="text-[13px] leading-relaxed text-noble-black/50">
                The borrower will see this offer immediately after submission.
              </span>
            </div>
          </label>
          <p v-if="showAvailabilityError" class="mt-3 text-[12px] font-medium text-burning-orange">
            {{ availabilityError }}
          </p>

          <p v-if="hasFeedbackError" class="mt-4 text-[13px] font-medium text-burning-orange">
            {{ feedbackMessage }}
          </p>

          <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              v-if="existingOffer"
              class="rounded-full border border-burning-orange/20 px-6 py-3 text-[14px] font-bold text-burning-orange transition-all hover:bg-burning-orange/5 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="isSubmitting"
              @click="emitCancel"
            >
              Cancel Offer
            </button>
            <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:ml-auto">
              <button
                class="rounded-full border border-cinnamon-ice/30 px-6 py-3 text-[14px] font-bold text-noble-black/60 transition-all hover:border-cinnamon-ice/45 hover:bg-white hover:text-noble-black"
                :disabled="isSubmitting"
                @click="closeModal"
              >
                Close
              </button>
              <button
                class="rounded-full bg-burning-orange px-6 py-3 text-[14px] font-bold text-white shadow-md transition-all hover:bg-blue-estate disabled:cursor-not-allowed disabled:opacity-35 disabled:grayscale"
                :disabled="!canSubmit || isSubmitting"
                @click="submitOffer"
              >
                {{ isSubmitting ? "Saving..." : existingOffer ? "Update Offer" : "Submit Offer" }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue"
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

const emitCancel = () => {
  if (!props.existingOffer) return
  emit("cancel-offer", props.existingOffer.id)
}
</script>

<style scoped>
.offer-modal-enter-active,
.offer-modal-leave-active {
  transition: opacity 0.22s ease;
}

.offer-modal-enter-active > div,
.offer-modal-leave-active > div {
  transition:
    transform 0.22s ease,
    opacity 0.22s ease;
}

.offer-modal-enter-from,
.offer-modal-leave-to {
  opacity: 0;
}

.offer-modal-enter-from > div,
.offer-modal-leave-to > div {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
</style>
