<script setup lang="ts">
import { useWallet } from '~/composables/use-wallet';
import { computed } from 'vue';

const props = defineProps<{
  amount: number;
  relatedEntityType?: string;
  relatedEntityId?: string;
}>();

const emit = defineEmits<{
  (e: 'success', data: { transaction: any }): void;
  (e: 'cancel'): void;
}>();

const { wallet, formattedBalance, isBalanceVisible, maskedBalance, isLoading } = useWallet();

const canAfford = computed(() => wallet.value.balance >= props.amount);

const handlePayment = async () => {
  if (!canAfford.value) return;
  
  // In a real app, this would call payWithWallet(props.amount)
  // For now, we simulate success for the frontend demo
  emit('success', { 
    transaction: { 
      referenceCode: `WTX-PAY-${Date.now()}`,
      status: 'SUCCESS'
    } 
  });
};
</script>

<template>
  <div class="bg-white rounded-3xl border border-neutral-100 p-6 space-y-6 shadow-sm">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-bold text-neutral-800">Payment Method</h3>
      <div class="px-3 py-1 bg-blue-estate/10 rounded-full">
        <span class="text-[10px] font-bold text-blue-estate uppercase tracking-wider">TakeUP Wallet</span>
      </div>
    </div>

    <div class="p-4 bg-neutral-50 rounded-2xl space-y-3">
      <div class="flex justify-between items-center text-sm">
        <span class="text-neutral-500">Amount to pay</span>
        <span class="font-bold text-neutral-800 text-lg">₱{{ amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) }}</span>
      </div>
      <div class="h-px bg-neutral-200/50"></div>
      <div class="flex justify-between items-center text-sm">
        <span class="text-neutral-500">Wallet Balance</span>
        <span class="font-medium text-neutral-700">
          {{ isBalanceVisible ? formattedBalance : maskedBalance }}
        </span>
      </div>
    </div>

    <div v-if="!canAfford" class="p-4 bg-cinnabar-red/5 border border-cinnabar-red/20 rounded-2xl flex items-start gap-3">
      <svg class="text-cinnabar-red shrink-0 mt-0.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div>
        <p class="text-sm font-bold text-cinnabar-red">Insufficient balance</p>
        <p class="text-xs text-cinnabar-red/70 mt-0.5">Please top up your wallet to continue with this payment.</p>
      </div>
    </div>

    <div class="flex gap-3">
      <button 
        @click="$emit('cancel')"
        class="flex-1 py-3 px-4 border border-neutral-200 rounded-xl font-bold text-neutral-600 hover:bg-neutral-50 transition-all"
      >
        Cancel
      </button>
      <button 
        @click="handlePayment"
        :disabled="!canAfford || isLoading"
        class="flex-[2] py-3 px-4 bg-blue-estate text-white rounded-xl font-bold hover:bg-blue-estate/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-[0.98]"
      >
        Pay with Wallet
      </button>
    </div>
  </div>
</template>
