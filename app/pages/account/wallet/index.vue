<script setup lang="ts">
definePageMeta({
  layout: "account",
  middleware: "account-auth",
})
</script>

<template>
  <div class="space-y-6 font-geist">
    <div>
      <h1 class="text-neutral-800 text-xl sm:text-2xl font-bold">My Wallet</h1>
      <p class="text-neutral-800 text-base sm:text-lg tracking-wide mt-1">
        Track your balance, credits, and payout settings.
      </p>
    </div>

    <section class="bg-orange-50 rounded-[20px] border border-red-300/30 p-6 sm:p-8">
      <h2 class="text-lg sm:text-xl font-semibold text-neutral-800">Wallet Overview</h2>
      <p class="text-neutral-800/70 mt-2">
        Wallet modules are coming soon. This page is ready for balance cards, cash-in/out actions,
        and payout history.
      </p>
    </section>
  </div>
</template>
