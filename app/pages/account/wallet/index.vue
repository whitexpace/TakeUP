<script setup lang="ts">
import { useWallet } from "~/composables/use-wallet"

definePageMeta({
  layout: "account",
  middleware: "account-auth",
})

const {
  transactions,
  isBalanceVisible,
  isInitialLoading,
  linkedAccounts,
  toggleBalanceVisibility,
  topUpPseudo,
  formattedBalance,
  maskedBalance,
} = useWallet()
</script>

<template>
  <div class="mx-auto max-w-[1100px] lg:px-16 xl:px-24 pb-10">
    <div v-if="isInitialLoading" class="animate-pulse space-y-10">
      <div class="space-y-3">
        <div class="h-10 w-48 bg-noble-black/20 rounded-xl"></div>
        <div class="h-4 w-96 bg-noble-black/10 rounded-lg"></div>
      </div>

      <div class="flex justify-center">
        <div
          class="rounded-[24px] bg-noble-black/10 w-full max-w-[540px] aspect-[1.586/1] max-h-[320px]"
        ></div>
      </div>

      <div class="bg-cream rounded-[24px] border border-cinnamon-ice/20 p-8 shadow-sm">
        <div class="h-8 w-48 bg-noble-black/20 rounded-lg mb-8"></div>
        <div class="space-y-6">
          <div v-for="i in 4" :key="i" class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="h-10 w-10 rounded-full bg-noble-black/10"></div>
              <div class="space-y-2">
                <div class="h-4 w-32 bg-noble-black/20 rounded"></div>
                <div class="h-3 w-24 bg-noble-black/10 rounded"></div>
              </div>
            </div>
            <div class="h-6 w-24 bg-noble-black/20 rounded"></div>
          </div>
        </div>
      </div>
    </div>

    <WalletOverview
      v-else
      title="My Wallet"
      subtitle="Manage your TakeUP wallet balance and linked accounts"
      :transactions="transactions"
      :is-balance-visible="isBalanceVisible"
      :formatted-balance="formattedBalance"
      :masked-balance="maskedBalance"
      :linked-accounts="linkedAccounts"
      :is-activity-loading="isInitialLoading && transactions.length === 0"
      :on-toggle-balance="toggleBalanceVisibility"
      :on-top-up="topUpPseudo"
    />
  </div>
</template>
