<script setup lang="ts">
definePageMeta({
  layout: "account",
  middleware: "account-auth",
})
</script>

<template>
  <div class="space-y-6 font-geist">
    <div>
      <h1 class="text-neutral-800 text-xl sm:text-2xl font-bold">My Rewards</h1>
      <p class="text-neutral-800 text-base sm:text-lg tracking-wide mt-1">
        View your points, tier progress, and redeemable perks.
      </p>
    </div>

    <section class="bg-cream rounded-[20px] border border-cinnamon-ice p-6 sm:p-8">
      <h2 class="text-lg sm:text-xl font-semibold text-neutral-800">Rewards Center</h2>
      <p class="text-neutral-800/70 mt-2">
        Rewards features are coming soon. This page is ready for point history, milestones, and
        redemption options.
      </p>
    </section>
  </div>
</template>
