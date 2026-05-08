<script setup lang="ts">
import { computed, ref, watch } from "vue"
import {
  ALLOWED_REVIEW_IMAGE_TYPES,
  MAX_REVIEW_IMAGES,
  MAX_REVIEW_IMAGE_BYTES,
  type ReviewType,
} from "#shared/schemas/review"
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
const hoverRating = ref(0)
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
  hoverRating.value = 0
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

  const { authUser: cachedAuthUser, fetch: fetchAuthUser } = useAuthUser()
  const authUser = cachedAuthUser.value ?? (await fetchAuthUser())
  if (!authUser) throw new Error("Not authenticated")
  const userId = authUser.id

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
    <Teleport to="body">
      <div v-if="open" class="fixed inset-0 z-[1300] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm" @click="closeModal"></div>

        <div
          class="relative w-full max-w-lg rounded-[28px] bg-white shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          <!-- Header -->
          <div class="px-8 pt-8 pb-4 flex items-start justify-between gap-4 shrink-0">
            <div>
              <h2 class="text-[24px] font-bold text-noble-black">{{ modalTitle }}</h2>
              <p
                v-if="context"
                class="mt-1 text-[13px] font-medium text-noble-black/40 leading-snug"
              >
                Share your experience with {{ context.counterpartName }} for
                {{ context.itemName }} — help future borrowers make informed decisions.
              </p>
            </div>

            <button
              class="flex h-10 w-10 items-center justify-center rounded-full text-noble-black transition hover:bg-gray-100"
              @click="closeModal"
            >
              <Icon name="ph:x-light" class="w-6 h-6" />
            </button>
          </div>

          <!-- Scrollable Content -->
          <div class="px-8 py-4 flex-1 overflow-y-auto custom-modal-scrollbar">
            <div class="space-y-6">
              <!-- Rating Stars -->
              <div class="flex flex-col items-center py-2">
                <div class="flex items-center gap-2">
                  <button
                    v-for="star in 5"
                    :key="star"
                    type="button"
                    class="transition-all duration-200 transform active:scale-90"
                    @click="rating = star"
                    @mouseenter="hoverRating = star"
                    @mouseleave="hoverRating = 0"
                  >
                    <Icon
                      :name="(hoverRating || rating) >= star ? 'ph:star-fill' : 'ph:star-light'"
                      class="w-8 h-8 transition-colors"
                      :class="
                        (hoverRating || rating) >= star ? 'text-burning-orange' : 'text-gray-200'
                      "
                    />
                  </button>
                </div>
                <p class="mt-2 text-[12px] font-bold uppercase tracking-widest text-burning-orange">
                  {{ rating }} / 5 Stars
                </p>
              </div>

              <!-- Review Textarea -->
              <div class="relative">
                <label
                  class="block text-[13px] font-bold uppercase tracking-wider text-noble-black/50 mb-2"
                  for="review-text"
                >
                  Your Review
                </label>
                <textarea
                  id="review-text"
                  v-model="reviewText"
                  rows="5"
                  maxlength="1000"
                  class="w-full rounded-[12px] border-[1.5px] border-gray-200 bg-white px-4 py-3.5 text-sm outline-none transition-all focus:border-burning-orange focus:ring-4 focus:ring-burning-orange/5"
                  placeholder="Write your review here..."
                ></textarea>
              </div>

              <!-- Slim Image Upload Row -->
              <div v-if="isItemReview" class="flex flex-col gap-4">
                <div class="flex items-center justify-between">
                  <label class="flex items-center gap-2 cursor-pointer group">
                    <Icon
                      name="ph:camera-plus-light"
                      class="w-5 h-5 text-gray-400 group-hover:text-burning-orange transition-colors"
                    />
                    <span
                      class="text-[13px] font-medium text-gray-500 group-hover:text-gray-700 transition-colors"
                    >
                      + Add photos (optional, up to {{ MAX_REVIEW_IMAGES }})
                    </span>
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
                  <div v-for="image in persistedDraftImages" :key="image" class="relative group">
                    <img
                      :src="getReviewImageUrl(image)"
                      class="h-16 w-16 rounded-[10px] object-cover border border-gray-100"
                    />
                    <button
                      type="button"
                      class="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-gray-900 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      @click="removePersistedDraftImage(image)"
                    >
                      <Icon name="ph:x-light" class="h-2 w-2" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Anonymous Toggle -->
              <div class="flex items-center gap-2 group/anon">
                <button
                  type="button"
                  class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 outline-none"
                  :class="isAnonymous ? 'bg-burning-orange' : 'bg-gray-200'"
                  @click="isAnonymous = !isAnonymous"
                >
                  <span
                    class="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200"
                    :class="isAnonymous ? 'translate-x-5' : 'translate-x-1'"
                  />
                </button>
                <span class="text-[13px] font-medium text-gray-600">Submit anonymously</span>
                <div class="relative group/tooltip">
                  <Icon name="ph:question-light" class="w-4 h-4 text-gray-400 cursor-help" />
                  <div
                    class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-[11px] font-medium rounded-lg whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all"
                  >
                    Your name won't be visible on the review
                    <div
                      class="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900"
                    ></div>
                  </div>
                </div>
              </div>

              <div v-if="draftMessage || statusMessage || errorMessage" class="space-y-2">
                <p
                  v-if="draftMessage"
                  class="text-[11px] font-bold uppercase tracking-wider text-blue-estate"
                >
                  {{ draftMessage }}
                </p>
                <p v-if="statusMessage" class="text-[12px] font-medium text-gray-500 italic">
                  {{ statusMessage }}
                </p>
                <p v-if="errorMessage" class="text-[12px] font-medium text-cinnabar-red">
                  {{ errorMessage }}
                </p>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex gap-3 shrink-0">
            <button
              type="button"
              class="flex-1 h-12 rounded-[10px] border-[1.5px] border-burning-orange bg-white text-[15px] font-bold text-burning-orange transition-all hover:bg-burning-orange/5"
              @click="closeModal"
            >
              Cancel
            </button>
            <button
              type="button"
              :disabled="!canSubmit"
              class="flex-1 h-12 rounded-[10px] bg-burning-orange text-[15px] font-bold text-white transition-all shadow-lg shadow-burning-orange/20 hover:brightness-105 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed"
              @click="submitReview"
            >
              {{ isSubmitting ? "Submitting..." : "Submit Review" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </Transition>
</template>

<style scoped>
.custom-modal-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-modal-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-modal-scrollbar::-webkit-scrollbar-thumb {
  background: theme("colors.cinnamon-ice / 40%");
  border-radius: 20px;
}
</style>
