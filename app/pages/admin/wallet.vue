<script setup lang="ts">
import { useWallet } from "~/composables/use-wallet"

definePageMeta({
  layout: "admin",
  middleware: "admin-auth",
})

const { transactions, isBalanceVisible, toggleBalanceVisibility, formattedBalance, maskedBalance } =
  useWallet({
    basePath: "/api/admin/wallet",
    linkedAccounts: [],
  })
</script>

<template>
  <WalletOverview
    title="System Wallet"
    subtitle="View the centralized platform revenue wallet shared across administrators"
    :transactions="transactions"
    :is-balance-visible="isBalanceVisible"
    :formatted-balance="formattedBalance"
    :masked-balance="maskedBalance"
    :show-linked-accounts="false"
    :allow-top-up="false"
    :allow-withdraw="false"
    activity-title="Commission Activity"
    activity-subtitle="Track accumulated commission revenue"
    protection-title="This wallet is admin-only."
    protection-message="This centralized wallet collects platform commission from completed wallet transactions and is shared across all admin users."
    member-since-label="Platform Revenue Wallet"
    read-only-badge-label="Read Only"
    :on-toggle-balance="toggleBalanceVisibility"
  />
</template>
