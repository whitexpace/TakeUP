<script setup lang="ts">
import { ref, onMounted } from "vue"
import {
  getPrefetchedMyListingDetail,
  prefetchMyListingEdit,
  seedPrefetchedMyListingDetail,
  useMyListings,
} from "../../../../composables/use-my-listings"
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
const isUpdatingStatus = ref(false)
const deleteError = ref<string | null>(null)
const deleteSuccessMessage = ref<string | null>(null)
const formRef = ref<{ isDirty: boolean; triggerCancel: () => void } | null>(null)

onBeforeRouteLeave((to, from, next) => {
  if (isSubmitting.value || isDeleting.value || isUpdatingStatus.value || !formRef.value?.isDirty) {
    next()
    return
  }

  formRef.value.triggerCancel()
  next(false)
})

onMounted(async () => {
  try {
    const prefetched =
      getPrefetchedMyListingDetail<MyListingItem>(id) ?? (await prefetchMyListingEdit(id))

    if (prefetched) {
      item.value = prefetched as MyListingItem
      return
    }

    const result = await $fetch<MyListingItem>(`/api/items/${id}`)
    seedPrefetchedMyListingDetail(result)
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
  if (!item.value || isDeleting.value || isUpdatingStatus.value) return

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

const handleStatusAction = async () => {
  if (!item.value || isDeleting.value || isUpdatingStatus.value) return

  const nextStatus = item.value.status === "DEACTIVATED" ? "AVAILABLE" : "DEACTIVATED"
  isUpdatingStatus.value = true
  deleteError.value = null
  deleteSuccessMessage.value = null

  try {
    const updatedItem = await toggleStatus(item.value.id, nextStatus)
    item.value = updatedItem
    deleteSuccessMessage.value =
      nextStatus === "AVAILABLE"
        ? "Listing reactivated successfully."
        : "Listing deactivated successfully. Existing transaction records remain intact."
  } catch (err: unknown) {
    deleteError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      `Unable to ${nextStatus === "AVAILABLE" ? "reactivate" : "deactivate"} listing right now. Please try again.`
  } finally {
    isUpdatingStatus.value = false
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
      ref="formRef"
      mode="edit"
      :item="item"
      :is-submitting="isSubmitting"
      :submit-error="submitError"
      @submit="handleSubmit"
      @cancel="navigateTo('/account/listings')"
    >
      <template #danger-zone>
        <section
          v-if="!isFetching && !notFound && item"
          class="rounded-[24px] border border-cinnamon-ice/20 bg-cream px-5 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300 sm:px-6 sm:py-6 font-geist"
        >
          <div class="border-l-[3px] border-burning-orange pl-4">
            <h2 class="text-[20px] font-bold text-noble-black">Danger Zone</h2>
            <p class="text-[13px] font-medium text-noble-black/50">
              Irreversible actions related to your listing.
            </p>
          </div>

          <div class="mt-8 space-y-4 border-t border-cinnamon-ice/10 pt-6">
            <p v-if="deleteError" class="font-geist text-[13px] font-medium text-cinnabar-red mb-4">
              {{ deleteError }}
            </p>
            <p
              v-else-if="deleteSuccessMessage"
              class="font-geist text-[13px] font-medium text-burning-orange mb-4"
            >
              {{ deleteSuccessMessage }}
            </p>

            <!-- Listing Status -->
            <div
              class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white/40 rounded-[20px] p-5 border border-cinnamon-ice/5 transition-all duration-300 hover:bg-white/60"
            >
              <div class="max-w-md space-y-1">
                <h3 class="text-[16px] font-bold text-noble-black">
                  {{ item.status === "DEACTIVATED" ? "Reactivate Listing" : "Deactivate Listing" }}
                </h3>
                <p class="text-[13px] font-medium text-noble-black/50">
                  {{
                    item.status === "DEACTIVATED"
                      ? "Make this listing available to borrowers again."
                      : "Hide this listing temporarily to keep system records consistent."
                  }}
                </p>
              </div>
              <button
                type="button"
                class="inline-flex h-10 items-center justify-center rounded-[12px] border-[1.5px] border-cinnabar-red/30 bg-white px-5 text-[13px] font-semibold text-cinnabar-red transition hover:border-cinnabar-red hover:bg-cinnabar-red/5 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="isDeleting || isUpdatingStatus"
                @click="handleStatusAction"
              >
                {{
                  isUpdatingStatus
                    ? item.status === "DEACTIVATED"
                      ? "Reactivating..."
                      : "Deactivating..."
                    : item.status === "DEACTIVATED"
                      ? "Reactivate Listing"
                      : "Deactivate Instead"
                }}
              </button>
            </div>

            <!-- Delete Listing -->
            <div
              class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white/40 rounded-[20px] p-5 border border-cinnamon-ice/5 transition-all duration-300 hover:bg-white/60"
            >
              <div class="max-w-md space-y-1">
                <h3 class="text-[16px] font-bold text-noble-black">Delete Listing</h3>
                <p class="text-[13px] font-medium text-noble-black/50">
                  Delete this listing only when it has no active or upcoming transactions.
                </p>
              </div>
              <button
                type="button"
                class="inline-flex h-10 items-center justify-center rounded-[12px] bg-cinnabar-red px-5 text-[13px] font-semibold text-white transition hover:bg-noble-black shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="isDeleting || isUpdatingStatus"
                @click="handleDelete"
              >
                {{ isDeleting ? "Processing..." : "Delete Listing" }}
              </button>
            </div>
          </div>
        </section>
      </template>
    </ListingForm>
  </div>
</template>
