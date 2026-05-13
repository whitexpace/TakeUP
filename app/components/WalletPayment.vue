<script setup lang="ts">
import { useWallet } from "~/composables/use-wallet"
import { computed } from "vue"
import type { WalletTransaction } from "~/types/wallet"

const props = defineProps<{
  amount: number
  relatedEntityType?: string
  relatedEntityId?: string
  noPadding?: boolean
}>()

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

const formatPesoAmount = (value: number) =>
  `₱${new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`

const handlePayment = async () => {
  if (!canAfford.value || isLoading.value) return

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
  }
}

defineExpose({
  handlePayment,
  isLoading,
  canAfford,
})
</script>

<template>
  <div
    class="flex flex-col gap-6"
    :class="{ 'bg-white rounded-[20px] border border-gray-100 p-6 shadow-sm': !noPadding }"
  >
    <div class="flex items-center justify-between">
      <h3 class="text-[17px] font-semibold text-noble-black">Payment Method</h3>
      <div class="h-6 px-3 bg-blue-estate/10 rounded-full flex items-center justify-center">
        <span class="text-[10px] font-bold text-blue-estate uppercase tracking-wider leading-none"
          >TakeUP Wallet</span
        >
      </div>
    </div>

    <div class="flex flex-col gap-4">
      <div class="flex justify-between items-center text-[14px]">
        <span class="text-noble-black/50 font-medium">Amount to pay</span>
        <span class="font-bold text-noble-black text-[18px]">
          {{ formatPesoAmount(amount) }}
        </span>
      </div>
      <div class="h-px bg-gray-100"></div>
      <div class="flex justify-between items-center text-[14px]">
        <span class="text-noble-black/50 font-medium">Wallet Balance</span>
        <span class="font-semibold text-noble-black">
          {{ isBalanceVisible ? formattedBalance : maskedBalance }}
        </span>
      </div>
    </div>

    <div
      v-if="!canAfford && wallet"
      class="p-4 bg-cinnabar-red/5 border border-cinnabar-red/10 rounded-[12px] flex items-start gap-3"
    >
      <Icon name="ph:warning-circle" class="text-cinnabar-red shrink-0 mt-0.5 w-[18px] h-[18px]" />
      <div>
        <p class="text-sm font-bold text-cinnabar-red">Insufficient balance</p>
        <p class="text-[12px] text-cinnabar-red/70 mt-0.5">
          Please top up your wallet to continue with this payment.
        </p>
      </div>
    </div>
  </div>
</template>
