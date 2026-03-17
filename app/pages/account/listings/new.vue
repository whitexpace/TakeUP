<script setup lang="ts">
import { ref } from "vue"
import { useMyListings } from "../../../composables/use-my-listings"

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
    submitError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      "Failed to create listing. Please check your inputs and try again."
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <ListingForm
      mode="new"
      :is-submitting="isSubmitting"
      :submit-error="submitError"
      @submit="handleSubmit"
      @cancel="navigateTo('/account/listings')"
    />
  </div>
</template>
