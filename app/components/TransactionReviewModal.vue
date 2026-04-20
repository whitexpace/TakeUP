<script setup lang="ts">
import { computed, ref, watch } from "vue"
import {
  ALLOWED_REVIEW_IMAGE_TYPES,
  MAX_REVIEW_IMAGES,
  MAX_REVIEW_IMAGE_BYTES,
  type ReviewType,
} from "../../shared/schemas/review"
import { normalizeReviewImageUrl } from "../utils/review-image"

type ReviewContext = {
  transactionId: string
  reviewType: ReviewType | null
  currentUserRole: "LENDER" | "BORROWER"
  itemName: string
  counterpartName: string
  itemId: string | null
  targetUserId: string | null
}

type SubmittedReviewPayload = {
  transactionId: string
  reviewType: ReviewType
  currentUserRole: "BORROWER" | "LENDER"
  itemId: string | null
}

const props = defineProps<{
  open: boolean
  context: ReviewContext | null
}>()

const emit = defineEmits<{
  close: []
  submitted: [payload: SubmittedReviewPayload]
}>()

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const runtimeConfig = useRuntimeConfig()
const itemImageBucket = runtimeConfig.public.itemImageBucket
const supabaseUrl = runtimeConfig.public.supabase.url
const supabaseKey = runtimeConfig.public.supabase.key

const rating = ref(5)
const reviewText = ref("")
const isAnonymous = ref(false)
const isSubmitting = ref(false)
const isLoadingDraft = ref(false)
const isSavingDraft = ref(false)
const isFinalizingSubmit = ref(false)
const isUploadingImages = ref(false)
const uploadProgress = ref(0)
const errorMessage = ref("")
const draftMessage = ref("")
const persistedDraftImages = ref<string[]>([])
const pendingUploadRequests = new Map<string, XMLHttpRequest>()

type LocalDraftPayload = {
  rating: number
  reviewText: string
  images: string[]
  isAnonymous: boolean
  updatedAt: string
}

const reviewTypeLabelMap: Record<ReviewType, string> = {
  ITEM_REVIEW: "Item Review",
  LENDER_REVIEW: "Lender Review",
  BORROWER_REVIEW: "Borrower Review",
}

const reviewPromptLabelMap: Record<ReviewType, string> = {
  ITEM_REVIEW: "Tell future borrowers about the item condition, quality, and overall experience.",
  LENDER_REVIEW: "Tell others what it was like working with this lender.",
  BORROWER_REVIEW: "Tell others what it was like lending to this borrower.",
}

const isItemReview = computed(() => props.context?.reviewType === "ITEM_REVIEW")
const hasDraftableContent = computed(
  () =>
    reviewText.value.trim().length > 0 ||
    rating.value !== 5 ||
    isAnonymous.value ||
    persistedDraftImages.value.length > 0,
)
const hasAutoSavableContentOnClose = computed(
  () => reviewText.value.trim().length > 0 || rating.value !== 5 || isAnonymous.value,
)
const localDraftKey = computed(() => {
  if (!props.context?.transactionId || !props.context.reviewType || !user.value?.id) return null
  return `takeup:review-draft:${user.value.id}:${props.context.transactionId}:${props.context.reviewType}`
})

const resetState = () => {
  for (const xhr of pendingUploadRequests.values()) {
    xhr.abort()
  }
  pendingUploadRequests.clear()

  rating.value = 5
  reviewText.value = ""
  isAnonymous.value = false
  isSubmitting.value = false
  isLoadingDraft.value = false
  isSavingDraft.value = false
  isUploadingImages.value = false
  uploadProgress.value = 0
  errorMessage.value = ""
  draftMessage.value = ""
  persistedDraftImages.value = []
}

const getSafeFileName = (fileName: string) =>
  fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "image"

const getReviewImageUrl = (image: string) =>
  normalizeReviewImageUrl(image, {
    supabaseUrl,
    bucket: itemImageBucket,
  })

const readLocalDraft = (): LocalDraftPayload | null => {
  if (typeof window === "undefined" || !localDraftKey.value) return null

  const raw = window.localStorage.getItem(localDraftKey.value)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<LocalDraftPayload>
    return {
      rating:
        typeof parsed.rating === "number" && parsed.rating >= 1 && parsed.rating <= 5
          ? parsed.rating
          : 5,
      reviewText: typeof parsed.reviewText === "string" ? parsed.reviewText : "",
      images: Array.isArray(parsed.images)
        ? parsed.images.filter(
            (image): image is string => typeof image === "string" && image.length > 0,
          )
        : [],
      isAnonymous: Boolean(parsed.isAnonymous),
      updatedAt:
        typeof parsed.updatedAt === "string" && parsed.updatedAt.length > 0
          ? parsed.updatedAt
          : new Date().toISOString(),
    }
  } catch {
    window.localStorage.removeItem(localDraftKey.value)
    return null
  }
}

const writeLocalDraft = (payload: LocalDraftPayload) => {
  if (typeof window === "undefined" || !localDraftKey.value) return
  window.localStorage.setItem(localDraftKey.value, JSON.stringify(payload))
}

const clearLocalDraft = () => {
  if (typeof window === "undefined" || !localDraftKey.value) return
  window.localStorage.removeItem(localDraftKey.value)
}

const applyDraftPayload = (draft: LocalDraftPayload) => {
  rating.value = draft.rating
  reviewText.value = draft.reviewText
  isAnonymous.value = draft.isAnonymous
  persistedDraftImages.value = draft.images
}

const dedupeImageUrls = (images: string[]) => [...new Set(images)]

const validateFiles = (files: File[]) => {
  if (!isItemReview.value) {
    errorMessage.value = "Images can only be attached to item reviews."
    return false
  }

  if (persistedDraftImages.value.length + files.length > MAX_REVIEW_IMAGES) {
    errorMessage.value = `You can upload up to ${MAX_REVIEW_IMAGES} images for an item review.`
    return false
  }

  for (const file of files) {
    if (
      !ALLOWED_REVIEW_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_REVIEW_IMAGE_TYPES)[number])
    ) {
      errorMessage.value = "Only JPG, PNG, and WebP images are supported."
      return false
    }

    if (file.size > MAX_REVIEW_IMAGE_BYTES) {
      errorMessage.value = "Each image must be 5 MB or smaller."
      return false
    }
  }

  return true
}

const persistDraft = async (images: string[]) => {
  if (!props.context?.transactionId || !props.context.reviewType) return

  const uniqueImages = dedupeImageUrls(images)

  await $fetch("/api/transaction-review-drafts", {
    method: "POST",
    body: {
      transactionId: props.context.transactionId,
      reviewType: props.context.reviewType,
      rating: rating.value,
      reviewText: reviewText.value.trim(),
      images: uniqueImages,
      isAnonymous: isAnonymous.value,
    },
  })

  writeLocalDraft({
    rating: rating.value,
    reviewText: reviewText.value.trim(),
    images: uniqueImages,
    isAnonymous: isAnonymous.value,
    updatedAt: new Date().toISOString(),
  })
}

const cleanupDraftImages = async (urls: string[]) => {
  if (urls.length === 0) return

  try {
    await $fetch("/api/item-images/cleanup", {
      method: "POST",
      body: {
        urls,
      },
    })
  } catch {
    // Best effort only.
  }
}

const handleImageSelection = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []

  if (files.length === 0) return

  errorMessage.value = ""
  if (!validateFiles(files)) {
    input.value = ""
    return
  }

  input.value = ""

  isUploadingImages.value = true
  uploadProgress.value = 0

  try {
    const uploadedImages = await uploadReviewImages(files)
    const mergedImages = [...persistedDraftImages.value, ...uploadedImages]

    try {
      await persistDraft(mergedImages)
      persistedDraftImages.value = mergedImages
      draftMessage.value =
        uploadedImages.length === 1 ? "Image saved to your draft." : "Images saved to your draft."
    } catch (error) {
      await cleanupDraftImages(uploadedImages)
      const payload = (error as { data?: { message?: string; statusMessage?: string } })?.data
      throw new Error(
        payload?.message ??
          payload?.statusMessage ??
          (error instanceof Error ? error.message : "We couldn't save your draft right now."),
      )
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "We couldn't upload your image right now."
  } finally {
    isUploadingImages.value = false
    uploadProgress.value = 0
  }
}

const removePersistedDraftImage = async (imageUrl: string) => {
  try {
    const nextImages = persistedDraftImages.value.filter((entry) => entry !== imageUrl)
    await persistDraft(nextImages)
    persistedDraftImages.value = nextImages
    await cleanupDraftImages([imageUrl])
    draftMessage.value = nextImages.length > 0 ? "Draft image removed." : "Draft updated."
  } catch (error) {
    const payload = (error as { data?: { message?: string; statusMessage?: string } })?.data
    errorMessage.value =
      payload?.message ??
      payload?.statusMessage ??
      (error instanceof Error ? error.message : "We couldn't update your draft right now.")
  }
}

const buildUploadErrorMessage = (status?: number, responseText?: string) => {
  const normalizedResponse = responseText?.trim()

  if (status === 403) {
    return "Review image upload was denied by storage policy. Check the item-images review upload policy in Supabase."
  }

  if (status === 404) {
    return "Review image upload failed because the storage bucket or path was not found."
  }

  if (normalizedResponse) {
    return `Review image upload failed (${status ?? "unknown"}): ${normalizedResponse.slice(0, 180)}`
  }

  return "Review image upload failed. Check the browser console for the storage response."
}

const uploadReviewImages = async (files: File[]): Promise<string[]> => {
  if (!isItemReview.value || files.length === 0) {
    return []
  }

  const response = await $fetch<{ user: { id: string } }>("/api/auth/me")
  const userId = response.user.id

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const accessToken = session?.access_token

  const uploadedUrls: string[] = []
  const total = files.length

  for (const [index, file] of files.entries()) {
    const datePrefix = new Date().toISOString().slice(0, 10)
    const storagePath = `items/${userId}/reviews/${datePrefix}/${crypto.randomUUID()}-${getSafeFileName(file.name)}`
    const uploadId = storagePath

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      pendingUploadRequests.set(uploadId, xhr)
      xhr.open(
        "POST",
        `${supabaseUrl}/storage/v1/object/${itemImageBucket}/${storagePath.split("/").map(encodeURIComponent).join("/")}`,
      )
      xhr.setRequestHeader("apikey", supabaseKey)
      if (accessToken) xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`)
      xhr.setRequestHeader("content-type", file.type || "application/octet-stream")

      xhr.upload.onprogress = (progressEvent) => {
        if (!progressEvent.lengthComputable) return
        const fileProgress = progressEvent.loaded / progressEvent.total
        uploadProgress.value = Math.min(100, Math.round(((index + fileProgress) / total) * 100))
      }

      xhr.onerror = () => {
        pendingUploadRequests.delete(uploadId)
        const message = "Review image upload failed because the network request did not complete."
        console.error("[TransactionReviewModal] review image upload network error", {
          storagePath,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        })
        reject(new Error(message))
      }
      xhr.onload = () => {
        pendingUploadRequests.delete(uploadId)
        if (xhr.status < 200 || xhr.status >= 300) {
          const message = buildUploadErrorMessage(xhr.status, xhr.responseText)
          console.error("[TransactionReviewModal] review image upload failed", {
            status: xhr.status,
            responseText: xhr.responseText,
            storagePath,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          })
          reject(new Error(message))
          return
        }

        const { data: publicUrlData } = supabase.storage
          .from(itemImageBucket)
          .getPublicUrl(storagePath)
        uploadedUrls.push(publicUrlData.publicUrl)
        resolve()
      }

      xhr.send(file)
    })
  }

  uploadProgress.value = 100
  return uploadedUrls
}

const deleteDraft = async (options?: { keepMessage?: boolean }) => {
  if (!props.context?.transactionId || !props.context.reviewType) return

  await $fetch("/api/transaction-review-drafts", {
    method: "DELETE",
    body: {
      transactionId: props.context.transactionId,
      reviewType: props.context.reviewType,
    },
  })

  if (!options?.keepMessage) {
    draftMessage.value = ""
  }

  clearLocalDraft()
}

const loadDraft = async () => {
  if (!props.context?.transactionId || !props.context.reviewType) return

  isLoadingDraft.value = true
  errorMessage.value = ""

  try {
    const draft = await $fetch<{
      rating: number
      reviewText: string
      images: string[]
      isAnonymous: boolean
      updatedAt: string
    } | null>("/api/transaction-review-drafts", {
      query: {
        transactionId: props.context.transactionId,
        reviewType: props.context.reviewType,
      },
    })

    if (draft) {
      const normalizedDraft: LocalDraftPayload = {
        rating: draft.rating,
        reviewText: draft.reviewText,
        images: draft.images,
        isAnonymous: draft.isAnonymous,
        updatedAt: draft.updatedAt,
      }

      applyDraftPayload(normalizedDraft)
      writeLocalDraft(normalizedDraft)
      draftMessage.value = "Draft restored from your account."
      return
    }

    const localDraft = readLocalDraft()
    if (localDraft) {
      applyDraftPayload(localDraft)
      draftMessage.value = "Draft restored from this device."
    }
  } catch (error) {
    const payload = (error as { data?: { message?: string; statusMessage?: string } })?.data
    const localDraft = readLocalDraft()

    if (localDraft) {
      applyDraftPayload(localDraft)
      draftMessage.value = "Draft restored from this device."
      errorMessage.value = ""
    } else {
      errorMessage.value =
        payload?.message ??
        payload?.statusMessage ??
        "We couldn't load your saved draft. You can still write and submit a review."
    }
  } finally {
    isLoadingDraft.value = false
  }
}

const saveDraft = async (options?: { silent?: boolean }) => {
  if (
    !props.context?.transactionId ||
    !props.context.reviewType ||
    isSavingDraft.value ||
    isSubmitting.value ||
    isFinalizingSubmit.value
  ) {
    return false
  }

  isSavingDraft.value = true
  errorMessage.value = ""

  try {
    if (!hasDraftableContent.value) {
      await deleteDraft({ keepMessage: options?.silent })
      if (!options?.silent) {
        draftMessage.value = "Nothing to save yet."
      }
      return false
    }

    await persistDraft(dedupeImageUrls(persistedDraftImages.value))

    if (!options?.silent) {
      draftMessage.value = "Draft saved to your account."
    }

    return true
  } catch (error) {
    const payload = (error as { data?: { message?: string; statusMessage?: string } })?.data
    errorMessage.value =
      payload?.message ??
      payload?.statusMessage ??
      (error instanceof Error ? error.message : "We couldn't save your draft right now.")
    return false
  } finally {
    isSavingDraft.value = false
    uploadProgress.value = 0
  }
}

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      resetState()
      return
    }

    resetState()
    await loadDraft()
  },
  { immediate: true },
)

const canSubmit = computed(
  () =>
    Boolean(props.context?.transactionId && props.context?.reviewType) &&
    rating.value >= 1 &&
    reviewText.value.trim().length > 0 &&
    !isSubmitting.value &&
    !isLoadingDraft.value &&
    !isSavingDraft.value &&
    !isUploadingImages.value,
)

const modalTitle = computed(() =>
  props.context?.reviewType ? reviewTypeLabelMap[props.context.reviewType] : "Write Review",
)

const promptText = computed(() =>
  props.context?.reviewType ? reviewPromptLabelMap[props.context.reviewType] : "",
)

const statusMessage = computed(() => {
  if (isUploadingImages.value) {
    return `Uploading images... ${uploadProgress.value}%`
  }

  if (isSavingDraft.value) {
    return "Saving draft..."
  }

  if (isSubmitting.value || isFinalizingSubmit.value) {
    return "Submitting review..."
  }

  return ""
})

const closeModal = async () => {
  if (isSubmitting.value || isSavingDraft.value || isUploadingImages.value) return

  if (hasAutoSavableContentOnClose.value) {
    const didSaveDraft = await saveDraft({ silent: true })
    if (!didSaveDraft) {
      errorMessage.value ||= "We couldn't save your draft yet, so the review form stayed open."
      return
    }
  }

  emit("close")
}

const submitReview = async () => {
  if (!props.context?.transactionId || !props.context?.reviewType || !canSubmit.value) return

  isSubmitting.value = true
  isFinalizingSubmit.value = true
  errorMessage.value = ""

  try {
    const uniqueImages = dedupeImageUrls(persistedDraftImages.value)

    await $fetch("/api/transaction-reviews", {
      method: "POST",
      body: {
        transactionId: props.context.transactionId,
        reviewType: props.context.reviewType,
        rating: rating.value,
        reviewText: reviewText.value.trim(),
        images: uniqueImages,
        isAnonymous: isAnonymous.value,
      },
    })

    persistedDraftImages.value = []
    clearLocalDraft()

    emit("submitted", {
      transactionId: props.context.transactionId,
      reviewType: props.context.reviewType,
      currentUserRole: props.context.currentUserRole,
      itemId: props.context.itemId,
    })
    emit("close")
  } catch (error) {
    const payload = (error as { data?: { message?: string; statusMessage?: string } })?.data

    errorMessage.value =
      payload?.message ??
      payload?.statusMessage ??
      (error instanceof Error
        ? error.message
        : "We couldn't submit your review right now. Please try again.")
  } finally {
    isSubmitting.value = false
    isFinalizingSubmit.value = false
    uploadProgress.value = 0
  }
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="open" class="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm" @click="closeModal"></div>

      <div
        class="relative w-full max-w-2xl rounded-[32px] bg-white p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div class="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 class="text-2xl font-bold text-noble-black">{{ modalTitle }}</h2>
            <p v-if="context" class="mt-1 text-sm text-noble-black/60">
              Share your experience with {{ context.counterpartName }} for {{ context.itemName }}.
            </p>
            <p v-if="promptText" class="mt-2 text-sm text-noble-black/50">
              {{ promptText }}
            </p>
          </div>

          <button
            class="text-noble-black/40 hover:text-noble-black transition-colors"
            @click="closeModal"
          >
            <span class="sr-only">Close review form</span>
            <svg viewBox="0 0 24 24" class="w-6 h-6" fill="none" stroke="currentColor">
              <path
                d="M18 6 6 18M6 6l12 12"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              />
            </svg>
          </button>
        </div>

        <div class="space-y-5">
          <div>
            <p class="text-sm font-semibold text-noble-black mb-3">Your rating</p>
            <div class="flex items-center gap-2">
              <button
                v-for="star in 5"
                :key="star"
                type="button"
                class="transition-transform hover:scale-105"
                @click="rating = star"
              >
                <svg
                  class="w-8 h-8"
                  viewBox="0 0 24 24"
                  :fill="star <= rating ? '#ff7124' : 'none'"
                  :stroke="star <= rating ? '#ff7124' : '#b9b0a7'"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M12 3.75l2.664 5.398 5.958.866-4.311 4.202 1.018 5.934L12 17.348l-5.329 2.802 1.018-5.934-4.311-4.202 5.958-.866L12 3.75z"
                  />
                </svg>
              </button>
            </div>
          </div>

          <label class="block">
            <span class="text-sm font-semibold text-noble-black">Review</span>
            <textarea
              v-model="reviewText"
              rows="5"
              maxlength="1000"
              class="mt-2 w-full rounded-2xl border border-cinnamon-ice bg-cream/60 px-4 py-3 text-sm text-noble-black outline-none focus:border-burning-orange"
              placeholder="Write your review here."
            ></textarea>
          </label>

          <p
            v-if="draftMessage"
            class="rounded-2xl border border-cinnamon-ice bg-cream/50 px-4 py-3 text-sm text-noble-black/70"
          >
            {{ draftMessage }}
          </p>

          <div v-if="isItemReview" class="rounded-2xl border border-cinnamon-ice bg-cream/40 p-4">
            <div class="flex items-center justify-between gap-3 mb-3">
              <div>
                <p class="text-sm font-semibold text-noble-black">Review Images</p>
                <p class="text-xs text-noble-black/60">
                  Optional. Up to {{ MAX_REVIEW_IMAGES }} images, JPG/PNG/WebP, 5 MB each.
                </p>
                <p class="mt-1 text-xs text-noble-black/50">
                  Saved drafts stay with your account and keep uploaded draft images.
                </p>
              </div>

              <label
                class="inline-flex cursor-pointer items-center rounded-xl bg-burning-orange px-4 py-2 text-sm font-semibold text-white hover:bg-cinnabar-red transition-colors"
              >
                Add Images
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  class="sr-only"
                  @change="handleImageSelection"
                />
              </label>
            </div>

            <div v-if="persistedDraftImages.length > 0" class="flex flex-wrap gap-3">
              <div v-for="image in persistedDraftImages" :key="image" class="relative">
                <img
                  :src="getReviewImageUrl(image)"
                  :alt="`${modalTitle} draft image`"
                  class="h-24 w-24 rounded-2xl object-cover border border-cinnamon-ice/70"
                />
                <button
                  type="button"
                  class="absolute -top-2 -right-2 rounded-full bg-noble-black p-1 text-white"
                  @click="removePersistedDraftImage(image)"
                >
                  <span class="sr-only">Remove saved image</span>
                  <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor">
                    <path d="M18 6 6 18M6 6l12 12" stroke-width="2" stroke-linecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <label class="flex items-center gap-3 text-sm text-noble-black/70">
            <input
              v-model="isAnonymous"
              type="checkbox"
              class="h-4 w-4 rounded border-cinnamon-ice text-burning-orange focus:ring-burning-orange"
            />
            Submit anonymously
          </label>

          <p
            v-if="statusMessage"
            class="rounded-2xl border border-cinnamon-ice bg-cream/50 px-4 py-3 text-sm text-noble-black/70"
          >
            {{ statusMessage }}
          </p>

          <p
            v-if="errorMessage"
            class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
          >
            {{ errorMessage }}
          </p>

          <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              class="rounded-2xl bg-cream px-5 py-3 text-sm font-semibold text-noble-black hover:bg-pale-cashmere transition-colors"
              @click="closeModal"
            >
              Cancel
            </button>
            <button
              type="button"
              :disabled="!canSubmit"
              class="rounded-2xl bg-burning-orange px-5 py-3 text-sm font-semibold text-white hover:bg-cinnabar-red transition-colors disabled:opacity-60"
              @click="submitReview"
            >
              {{ isSubmitting ? "Submitting..." : "Submit Review" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>
