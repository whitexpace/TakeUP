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
} = useWallet()
</script>

<template>
  <WalletOverview
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
</template>
