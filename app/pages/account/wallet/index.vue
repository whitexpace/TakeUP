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
  withdrawPseudo,
  formattedBalance,
  maskedBalance,
  balance,
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
      :balance="balance"
      :is-balance-visible="isBalanceVisible"
      :formatted-balance="formattedBalance"
      :masked-balance="maskedBalance"
      :linked-accounts="linkedAccounts"
      :is-activity-loading="isInitialLoading && transactions.length === 0"
      :on-toggle-balance="toggleBalanceVisibility"
      :on-top-up="topUpPseudo"
      :on-withdraw="withdrawPseudo"
    />
  </div>
</template>
