<script setup lang="ts">
definePageMeta({
  layout: "account",
  middleware: "account-auth",
})
</script>

<template>
  <div class="space-y-6 font-geist">
    <div>
      <h1 class="text-neutral-800 text-xl sm:text-2xl font-bold">Account Information</h1>
      <p class="text-neutral-800 text-base sm:text-lg tracking-wide mt-1">
        Manage your personal details and account settings.
      </p>
    </div>

    <section class="bg-cream rounded-[20px] border border-cinnamon-ice p-6 sm:p-8">
      <h2 class="text-lg sm:text-xl font-semibold text-neutral-800">Profile Overview</h2>
      <p class="text-neutral-800/70 mt-2">Account settings and profile content will go here.</p>
    </section>
  </div>
</template>
