<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: "admin-auth",
})
</script>

<template>
  <div class="space-y-5 font-geist">
    <section class="space-y-3">
      <div class="space-y-2">
        <h1 class="text-[28px] font-semibold text-noble-black">Listings</h1>
        <div class="h-0.5 w-10 bg-burning-orange"></div>
      </div>
      <p class="max-w-3xl text-[16px] font-medium leading-relaxed text-noble-black/50">
        Platform-wide listing management will be added in a dedicated follow-up work item.
      </p>
    </section>

    <section
      class="rounded-[24px] border border-cinnamon-ice/20 bg-cream px-6 py-14 text-center shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
    >
      <p class="text-[18px] font-bold text-noble-black">Listings management placeholder</p>
      <p class="mx-auto mt-2 max-w-xl text-[14px] font-medium leading-relaxed text-noble-black/45">
        Use the Overview tab for the latest listing snapshot. Full admin listing controls are out of
        scope for this branch.
      </p>
    </section>
  </div>
</template>
