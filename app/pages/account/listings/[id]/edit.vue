<script setup lang="ts">
import { ref, onMounted } from "vue"
import { useMyListings } from "../../../../composables/use-my-listings"
import type { MyListingItem } from "../../../../composables/use-my-listings"

definePageMeta({ layout: "account", middleware: "account-auth" })

const route = useRoute()
const id = route.params.id as string

const { updateListing } = useMyListings()
const item = ref<MyListingItem | null>(null)
const isFetching = ref(true)
const notFound = ref(false)
const isSubmitting = ref(false)
const submitError = ref<string | null>(null)

onMounted(async () => {
  try {
    const result = await $fetch<MyListingItem>(`/api/items/${id}`)
    item.value = result
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode
    if (status === 404) notFound.value = true
    else if (status === 401) await navigateTo("/")
  } finally {
    isFetching.value = false
  }
})

const handleSubmit = async (data: Record<string, unknown>) => {
  isSubmitting.value = true
  submitError.value = null
  try {
    await updateListing(id, data)
    await navigateTo("/account/listings")
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode
    if (status === 403) {
      submitError.value = "You don't have permission to edit this listing."
      return
    }
    submitError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      "Failed to save changes. Please try again."
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="isFetching" class="space-y-4 animate-pulse">
      <div class="h-8 w-48 bg-orange-50 rounded" />
      <div class="h-64 bg-orange-50 rounded-[20px]" />
      <div class="h-64 bg-orange-50 rounded-[20px]" />
    </div>

    <!-- Not found -->
    <div v-else-if="notFound" class="text-center py-16 space-y-4">
      <p class="text-neutral-800/60 text-xl font-geist">Listing not found.</p>
      <NuxtLink
        to="/account/listings"
        class="inline-flex items-center gap-2 text-neutral-800/70 text-sm font-medium font-geist hover:text-neutral-800"
      >
        ← Back to My Listings
      </NuxtLink>
    </div>

    <!-- Edit form -->
    <ListingForm
      v-else
      :item="item"
      :is-submitting="isSubmitting"
      :submit-error="submitError"
      @submit="handleSubmit"
      @cancel="navigateTo('/account/listings')"
    />
  </div>
</template>
