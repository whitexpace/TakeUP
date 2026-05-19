<script setup lang="ts">
import { useWallet } from "~/composables/use-wallet"
import { computed } from "vue"
import type { WalletTransaction } from "~/types/wallet"

const props = defineProps<{
  amount: number
  relatedEntityType?: string
  relatedEntityId?: string
  variant?: "default" | "minimal"
}>()

const isMinimal = computed(() => props.variant === "minimal")

const emit = defineEmits<{
  (e: "success", data: { transaction: Pick<WalletTransaction, "referenceCode" | "status"> }): void
  (e: "cancel"): void
}>()

const {
  wallet,
  balance,
  formattedBalance,
  isBalanceVisible,
  maskedBalance,
  isLoading,
  payWithWallet,
} = useWallet()

const canAfford = computed(() => {
  if (!wallet.value) return false
  return balance.value >= props.amount
})

const handlePayment = async () => {
  if (!canAfford.value) return

  try {
    const result = await payWithWallet(
      props.amount,
      props.relatedEntityType || "SYSTEM",
      props.relatedEntityId || "DEMO",
    )

    emit("success", {
      transaction: {
        referenceCode: result.transaction.referenceCode,
        status: result.transaction.status,
      },
    })
  } catch (error) {
    console.error("Payment error:", error)
    // Error is handled/logged in composable, but could add UI feedback here
  }
}
</script>

<template>
  <div
    class="font-geist"
    :class="[
      isMinimal
        ? 'space-y-6'
        : 'bg-white rounded-3xl border border-neutral-100 p-6 space-y-6 shadow-sm',
    ]"
  >
    <div v-if="!isMinimal" class="flex items-center justify-between">
      <h3 class="text-lg font-bold text-neutral-800">Payment Method</h3>
      <div class="px-3 py-1 bg-blue-estate/10 rounded-full">
        <span class="text-[10px] font-bold text-blue-estate uppercase tracking-wider"
          >TakeUP Wallet</span
        >
      </div>
    </div>

    <div
      class="p-5 rounded-2xl space-y-4"
      :class="isMinimal ? 'bg-noble-black/[0.02] border border-cinnamon-ice/10' : 'bg-neutral-50'"
    >
      <div class="flex justify-between items-center text-sm">
        <span class="text-noble-black/50 font-medium">Amount to pay</span>
        <span class="font-bold text-noble-black text-[22px]"
          >₱{{ amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) }}</span
        >
      </div>
      <div class="h-px bg-noble-black/5"></div>
      <div class="flex justify-between items-center text-[13px]">
        <span class="text-noble-black/50 font-medium">Wallet Balance</span>
        <div class="flex items-center gap-2">
          <span class="font-semibold text-noble-black">
            {{ isBalanceVisible ? formattedBalance : maskedBalance }}
          </span>
          <div class="w-1.5 h-1.5 rounded-full bg-success-green"></div>
        </div>
      </div>
    </div>

    <div
      v-if="!canAfford && wallet"
      class="p-4 bg-cinnabar-red/5 border border-cinnabar-red/20 rounded-2xl flex items-start gap-3"
    >
      <Icon name="ph:warning-circle" class="text-cinnabar-red shrink-0 mt-0.5 w-[18px] h-[18px]" />
      <div>
        <p class="text-[13px] font-bold text-cinnabar-red">Insufficient balance</p>
        <p class="text-[12px] text-cinnabar-red/70 mt-0.5">
          Please top up your wallet to continue with this payment.
        </p>
      </div>
    </div>

    <div class="flex gap-3 pt-2">
      <button
        type="button"
        class="flex-1 h-12 items-center justify-center rounded-[10px] border-[1.5px] border-burning-orange bg-white text-[15px] font-semibold text-burning-orange transition-all duration-200 hover:bg-burning-orange/5 disabled:opacity-50"
        :disabled="isLoading"
        @click="$emit('cancel')"
      >
        Cancel
      </button>
      <button
        type="button"
        :disabled="!canAfford || isLoading"
        class="flex-[2] h-12 items-center justify-center rounded-[10px] bg-gradient-to-br from-burning-orange to-orange-500 text-[15px] font-semibold text-white transition-all duration-300 shadow-lg shadow-burning-orange/35 hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        @click="handlePayment"
      >
        {{ isLoading ? "Paying..." : "Pay with Wallet" }}
      </button>
    </div>
  </div>
</template>
