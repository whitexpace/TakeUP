<script setup lang="ts">
import type { ListingFormSubmitData } from "../../../types/listing-form"

definePageMeta({ layout: "account", middleware: "account-auth" })

const supabase = useSupabaseClient()
const { createListing, updateListing } = useMyListings()
const { uploadAndResolvePaths } = useItemImageStorage()
const isSubmitting = ref(false)
const submitError = ref<string | null>(null)

const handleSubmit = async (data: ListingFormSubmitData) => {
  isSubmitting.value = true
  submitError.value = null
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) {
      throw new Error("Unauthorized: no active session.")
    }

    const created = await createListing(data.payload as Record<string, unknown>)
    const { photos, thumbnailImage } = await uploadAndResolvePaths({
      itemId: created.id,
      userId,
      media: data.media,
    })

    await updateListing(created.id, {
      photos,
      thumbnailImage,
    })

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
  <ListingForm
    mode="new"
    :is-submitting="isSubmitting"
    :submit-error="submitError"
    @submit="handleSubmit"
    @cancel="navigateTo('/account/listings')"
  />
</template>
