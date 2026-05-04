<script setup lang="ts">
definePageMeta({ layout: "account", middleware: "account-auth" })

const { createListing } = useMyListings()
const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const formRef = ref<{ isDirty: boolean; triggerCancel: () => void } | null>(null)

onBeforeRouteLeave((to, from, next) => {
  if (isSubmitting.value || !formRef.value?.isDirty) {
    next()
    return
  }

  formRef.value.triggerCancel()
  // The modal inside ListingForm will handle the actual navigation upon confirmation
  // so we stay here for now.
  next(false)
})

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
      (err as { data?: { statusMessage?: string; error?: { message?: string } } })?.data?.error
        ?.message ??
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      (err as { statusMessage?: string })?.statusMessage ??
      (err as { message?: string })?.message ??
      "Failed to publish listing. Please try again."
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <ListingForm
    ref="formRef"
    mode="new"
    :is-submitting="isSubmitting"
    :submit-error="submitError"
    @submit="handleSubmit"
    @cancel="navigateTo('/account/listings')"
  />
</template>
