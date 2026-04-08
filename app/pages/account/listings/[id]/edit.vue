<script setup lang="ts">
import { ref, onMounted } from "vue"
import { useMyListings } from "../../../../composables/use-my-listings"
import type { MyListingItem } from "../../../../composables/use-my-listings"

definePageMeta({ layout: "account", middleware: "account-auth" })

const route = useRoute()
const id = route.params.id as string

const { updateListing, toggleStatus, deleteListing } = useMyListings()
const item = ref<MyListingItem | null>(null)
const isFetching = ref(true)
const notFound = ref(false)
const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const isDeleting = ref(false)
const deleteError = ref<string | null>(null)
const deleteSuccessMessage = ref<string | null>(null)

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

const handleDelete = async () => {
  if (!item.value || isDeleting.value) return

  isDeleting.value = true
  deleteError.value = null
  deleteSuccessMessage.value = null

  try {
    await deleteListing(item.value.id)
    deleteSuccessMessage.value = "Listing deleted successfully."
    await navigateTo("/account/listings")
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode
    if (status === 403) {
      deleteError.value = "You don't have permission to delete this listing."
      return
    }

    deleteError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      "Failed to delete listing. Please try again."
  } finally {
    isDeleting.value = false
  }
}

const handleDeactivateInstead = async () => {
  if (!item.value || item.value.status === "DEACTIVATED" || isDeleting.value) return

  isDeleting.value = true
  deleteError.value = null

  try {
    const updatedItem = await toggleStatus(item.value.id, "DEACTIVATED")
    item.value = updatedItem
    deleteSuccessMessage.value =
      "Listing deactivated successfully. Existing transaction records remain intact."
  } catch (err: unknown) {
    deleteError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      "Unable to deactivate listing right now. Please try again."
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="isFetching" class="space-y-4 animate-pulse">
      <div class="h-8 w-48 bg-cream rounded" />
      <div class="h-64 bg-cream rounded-[20px]" />
      <div class="h-64 bg-cream rounded-[20px]" />
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

    <div
      v-if="!isFetching && !notFound && item"
      class="mt-6 rounded-[20px] border border-cinnabar-red/15 bg-white p-5"
    >
      <h2 class="font-geist text-lg font-semibold text-neutral-800">Danger Zone</h2>
      <p class="mt-2 font-geist text-sm text-neutral-800/65">
        Delete this listing only when it has no active or upcoming transactions. If deletion is
        blocked, deactivate it instead to keep system records consistent.
      </p>

      <p v-if="deleteError" class="mt-4 font-geist text-sm text-cinnabar-red">
        {{ deleteError }}
      </p>
      <p v-else-if="deleteSuccessMessage" class="mt-4 font-geist text-sm text-burning-orange">
        {{ deleteSuccessMessage }}
      </p>

      <div class="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          class="rounded-[14px] bg-cinnabar-red px-5 py-2.5 font-geist text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="isDeleting"
          @click="handleDelete"
        >
          {{ isDeleting ? "Processing..." : "Delete Listing" }}
        </button>

        <button
          type="button"
          class="rounded-[14px] border border-cinnamon-ice px-5 py-2.5 font-geist text-sm font-medium text-neutral-800 transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="isDeleting || item.status === 'DEACTIVATED'"
          @click="handleDeactivateInstead"
        >
          {{ item.status === "DEACTIVATED" ? "Already Deactivated" : "Deactivate Instead" }}
        </button>
      </div>
    </div>
  </div>
</template>
