<script setup lang="ts">
import { useWallet } from "~/composables/use-wallet"

definePageMeta({
  layout: "account",
  middleware: "account-auth",
})

const {
  transactions,
  isBalanceVisible,
  linkedAccounts,
  toggleBalanceVisibility,
  topUpPseudo,
  formattedBalance,
  maskedBalance,
  isInitialLoading,
} = useWallet()
</script>

<template>
  <div class="mx-auto max-w-[1100px] lg:px-16 xl:px-24 pb-10">
    <WalletOverviewSkeleton v-if="isInitialLoading" />

    <WalletOverview
      v-else
      title="My Wallet"
      subtitle="Manage your TakeUP wallet balance and linked accounts"
      :transactions="transactions"
      :is-balance-visible="isBalanceVisible"
      :formatted-balance="formattedBalance"
      :masked-balance="maskedBalance"
      :linked-accounts="linkedAccounts"
      :on-toggle-balance="toggleBalanceVisibility"
      :on-top-up="topUpPseudo"
    />
  </div>
</template>
