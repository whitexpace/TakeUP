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
                Share the item you can lend, your rental terms, and confirm it is available for
                the requester.
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

          <div class="mt-6 grid gap-4 md:grid-cols-2">
            <label class="flex flex-col gap-2 md:col-span-2">
              <span class="text-[12px] font-bold uppercase tracking-[0.12em] text-noble-black/45">
                Item name
              </span>
              <input
                v-model="itemName"
                type="text"
                placeholder="DJI Mavic 3 Fly More Combo"
                class="w-full rounded-[16px] border border-cinnamon-ice/30 bg-white px-4 py-3 text-[15px] text-noble-black outline-none transition-all duration-300 placeholder:text-noble-black/30 focus:border-blue-estate/30 focus:ring-4 focus:ring-blue-estate/5"
              />
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
                  {{ option }}
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
                placeholder="Share pickup details, deposit, inclusions, and any limits the requester should know."
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
                This marks the offer as ready for the requester to review right away.
              </span>
            </div>
          </label>

          <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              class="rounded-full border border-cinnamon-ice/30 px-6 py-3 text-[14px] font-bold text-noble-black/60 transition-all hover:border-cinnamon-ice/45 hover:bg-white hover:text-noble-black"
              @click="closeModal"
            >
              Cancel
            </button>
            <button
              class="rounded-full bg-burning-orange px-6 py-3 text-[14px] font-bold text-white shadow-md transition-all hover:bg-blue-estate disabled:cursor-not-allowed disabled:opacity-35 disabled:grayscale"
              :disabled="!canSubmit"
              @click="submitOffer"
            >
              {{ existingOffer ? "Update Offer" : "Submit Offer" }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import type { CommunityOffer, CommunityOfferCondition, CommunityOfferFormInput } from "~/types/community-requests"
import { communityOfferConditions } from "~/types/community-requests"

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    requestTitle: string
    existingOffer?: CommunityOffer | null
  }>(),
  {
    existingOffer: null,
  },
)

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void
  (event: "submit", value: CommunityOfferFormInput): void
}>()

const itemName = ref("")
const rentalTerms = ref("")
const feeInput = ref("")
const condition = ref<CommunityOfferCondition>(communityOfferConditions[2]!)
const availabilityConfirmed = ref(false)

const hydrateForm = (offer: CommunityOffer | null) => {
  itemName.value = offer?.itemName ?? ""
  rentalTerms.value = offer?.rentalTerms ?? ""
  feeInput.value = offer ? String(offer.fee) : ""
  condition.value = offer?.condition ?? communityOfferConditions[2]!
  availabilityConfirmed.value = offer?.availabilityConfirmed ?? false
}

watch(
  () => [props.modelValue, props.existingOffer] as const,
  ([isOpen, offer]) => {
    if (!isOpen) return
    hydrateForm(offer)
  },
  { immediate: true },
)

const parsedFee = computed(() => Number(feeInput.value))

const canSubmit = computed(() => {
  return (
    itemName.value.trim().length > 0 &&
    rentalTerms.value.trim().length > 0 &&
    Number.isFinite(parsedFee.value) &&
    parsedFee.value >= 0 &&
    availabilityConfirmed.value
  )
})

const closeModal = () => {
  emit("update:modelValue", false)
}

const submitOffer = () => {
  if (!canSubmit.value) return

  emit("submit", {
    itemName: itemName.value.trim(),
    rentalTerms: rentalTerms.value.trim(),
    fee: parsedFee.value,
    condition: condition.value,
    availabilityConfirmed: availabilityConfirmed.value,
  })
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
