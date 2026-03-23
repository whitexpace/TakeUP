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
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div v-if="items.length === 0" class="mt-6 rounded-[18px] border border-dashed border-cinnamon-ice/30 bg-white/70 px-5 py-5">
            <p class="text-[14px] font-semibold text-noble-black">No offerable items found.</p>
            <p class="mt-1 text-[13px] leading-relaxed text-noble-black/50">
              Create a listing first so you can attach a real item to this offer.
            </p>
          </div>

          <div v-else class="mt-6 grid gap-4 md:grid-cols-2">
            <label class="flex flex-col gap-2 md:col-span-2">
              <span class="text-[12px] font-bold uppercase tracking-[0.12em] text-noble-black/45">
                Your item
              </span>
              <select
                v-model="selectedItemIdInput"
                class="w-full rounded-[16px] border border-cinnamon-ice/30 bg-white px-4 py-3 text-[15px] text-noble-black outline-none transition-all duration-300 focus:border-blue-estate/30 focus:ring-4 focus:ring-blue-estate/5"
              >
                <option value="">Select an item</option>
                <option v-for="item in items" :key="item.numericId" :value="String(item.numericId)">
                  {{ item.name }} · {{ formatFee(item.freeToBorrow ? 0 : item.rentalFee) }}
                </option>
              </select>
            </label>

            <label class="flex flex-col gap-2">
              <span class="text-[12px] font-bold uppercase tracking-[0.12em] text-noble-black/45">
                Rental fee
              </span>
              <div
                class="flex items-center rounded-[16px] border border-cinnamon-ice/30 bg-white px-4 focus-within:border-blue-estate/30 focus-within:ring-4 focus-within:ring-blue-estate/5"
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
                />
              </div>
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
                class="w-full resize-none rounded-[16px] border border-cinnamon-ice/30 bg-white px-4 py-3 text-[15px] leading-relaxed text-noble-black outline-none transition-all duration-300 placeholder:text-noble-black/30 focus:border-blue-estate/30 focus:ring-4 focus:ring-blue-estate/5"
              ></textarea>
            </label>
          </div>

          <label
            class="mt-5 flex items-start gap-3 rounded-[18px] border border-cinnamon-ice/25 bg-white px-4 py-3"
          >
            <input
              v-model="availabilityConfirmed"
              type="checkbox"
              class="mt-1 h-4 w-4 rounded border-cinnamon-ice text-blue-estate focus:ring-blue-estate/20"
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

          <p v-if="validationMessage" class="mt-4 text-[13px] font-medium text-burning-orange">
            {{ validationMessage }}
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
import { computed, ref, watch } from "vue"
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
    existingOffer?: CommunityOffer | null
    isSubmitting?: boolean
  }>(),
  {
    existingOffer: null,
    isSubmitting: false,
  },
)

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void
  (event: "submit", value: CommunityOfferFormInput): void
  (event: "cancel-offer", offerId: number): void
}>()

const selectedItemIdInput = ref("")
const rentalTerms = ref("")
const feeInput = ref("")
const condition = ref<CommunityOfferCondition>(communityOfferConditions[2]!)
const availabilityConfirmed = ref(false)

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
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase())
}

const hydrateForm = () => {
  const initialItemId = props.existingOffer?.itemID ?? props.items[0]?.numericId ?? null
  const initialItem = props.items.find((item) => item.numericId === initialItemId) ?? props.items[0] ?? null

  selectedItemIdInput.value = initialItemId ? String(initialItemId) : ""
  rentalTerms.value = props.existingOffer?.rentalTerms ?? ""
  feeInput.value = String(props.existingOffer?.rentalFee ?? (initialItem?.freeToBorrow ? 0 : initialItem?.rentalFee ?? ""))
  condition.value = props.existingOffer?.condition ?? initialItem?.condition ?? communityOfferConditions[2]!
  availabilityConfirmed.value = props.existingOffer?.availability ?? false
}

watch(
  () => [props.modelValue, props.existingOffer, props.items] as const,
  ([isOpen]) => {
    if (!isOpen) return
    hydrateForm()
  },
  { immediate: true },
)

watch(selectedItem, (item) => {
  if (!item) return

  if (!props.existingOffer || item.numericId !== props.existingOffer.itemID) {
    feeInput.value = String(item.freeToBorrow ? 0 : item.rentalFee)
    condition.value = item.condition
  }
})

const validationMessage = computed(() => {
  if (props.items.length === 0) return "You need at least one active listing before you can submit an offer."
  if (!selectedItem.value) return "Select one of your items."
  if (!rentalTerms.value.trim()) return "Rental terms are required."
  if (!Number.isFinite(parsedFee.value) || parsedFee.value < 0) return "Rental fee must be 0 or higher."
  if (!availabilityConfirmed.value) return "Confirm item availability before submitting."
  return ""
})

const canSubmit = computed(() => validationMessage.value.length === 0)

const closeModal = () => {
  emit("update:modelValue", false)
}

const submitOffer = () => {
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
