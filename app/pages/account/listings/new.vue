<script setup lang="ts">
definePageMeta({ layout: "account", middleware: "account-auth" })

const { createListing } = useMyListings()
const isSubmitting = ref(false)
const submitError = ref<string | null>(null)

const handleSubmit = async (data: Record<string, unknown>) => {
  isSubmitting.value = true
  submitError.value = null
  try {
    await createListing(data)
    await navigateTo("/account/listings")
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode
    if (status === 401) {
      await navigateTo("/")
      return
    }
    submitError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      "Failed to publish listing. Please try again."
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Page header -->
    <div>
      <h1 class="text-neutral-800 text-xl sm:text-2xl font-bold font-geist">Add New Item</h1>
      <p class="text-neutral-800/70 text-sm sm:text-base font-geist mt-1">
        Fill in the details below to list your item for borrow or rent.
      </p>
    </div>

    <ListingForm
      mode="new"
      :is-submitting="isSubmitting"
      :submit-error="submitError"
      @submit="handleSubmit"
      @cancel="navigateTo('/account/listings')"
    />
  </div>
</template>
