<script setup lang="ts">
definePageMeta({
  layout: "account",
  middleware: "account-auth",
})
</script>

<template>
  <div class="space-y-6 font-geist">
    <div>
      <h1 class="text-neutral-800 text-xl sm:text-2xl font-bold">My Listing Analytics</h1>
      <p class="text-neutral-800 text-base sm:text-lg tracking-wide mt-1">
        Monitor listing performance and engagement trends.
      </p>
    </div>

    <section class="bg-cream rounded-[20px] border border-cinnamon-ice p-6 sm:p-8">
      <h2 class="text-lg sm:text-xl font-semibold text-neutral-800">Analytics Overview</h2>
      <p class="text-neutral-800/70 mt-2">
        Analytics widgets are coming soon. This page is ready for views, inquiries, conversion rate,
        and top-performing listings.
      </p>
    </section>
  </div>
</template>
