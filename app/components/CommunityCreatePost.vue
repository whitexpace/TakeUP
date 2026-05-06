<template>
  <div
    ref="containerRef"
    class="bg-cream rounded-[24px] border border-cinnamon-ice/40 transition-all duration-300"
    :class="{
      'ring-4 ring-burning-orange/5 border-burning-orange/30 shadow-lg':
        isExpanded || isHighlighted,
    }"
  >
    <!-- Collapsed State -->
    <div
      v-if="!isExpanded"
      class="p-[14px] px-4 flex items-center gap-4 cursor-pointer group"
      @click="expandForm"
    >
      <UserAvatar :avatar-url="props.userAvatar" :user-name="props.userName" size="md" />
      <div
        class="flex-1 border border-cinnamon-ice/30 rounded-[14px] px-4 py-3 text-noble-black/30 text-[15px] group-hover:border-cinnamon-ice/50 transition-colors bg-white/50"
      >
        What are you looking for?
      </div>
    </div>

    <!-- Expanded State -->
    <transition name="expand">
      <form v-if="isExpanded" class="flex flex-col relative z-50" @submit.prevent="handlePost">
        <div class="p-6 pb-4 flex gap-4">
          <UserAvatar :avatar-url="props.userAvatar" :user-name="props.userName" size="md" />

          <div class="flex-1 flex flex-col min-w-0 gap-3">
            <!-- Title Input -->
            <div class="flex flex-col gap-1.5">
              <input
                ref="itemNeededInputRef"
                v-model="itemNeeded"
                type="text"
                placeholder="What are you looking for?"
                class="w-full h-11 px-4 rounded-[10px] border border-cinnamon-ice/30 bg-white text-[16px] font-semibold text-gray-900 placeholder:text-gray-300 outline-none transition-all focus:border-burning-orange/40 focus:ring-4 focus:ring-burning-orange/5"
                :class="{ 'border-burning-orange/50': showItemNeededError }"
                @blur="markTouched('itemNeeded')"
              />
              <p v-if="showItemNeededError" class="text-[11px] font-medium text-burning-orange">
                {{ itemNeededError }}
              </p>
            </div>

            <!-- Description Textarea -->
            <div class="flex flex-col gap-1.5">
              <textarea
                v-model="description"
                placeholder="Describe the item and requirements..."
                class="min-h-[100px] w-full resize-none rounded-[10px] border border-cinnamon-ice/30 bg-white px-4 py-3 text-[14px] text-gray-500 placeholder:text-gray-400 outline-none transition-all focus:border-burning-orange/40 focus:ring-4 focus:ring-burning-orange/5"
                @blur="markTouched('description')"
              ></textarea>
              <p v-if="showDescriptionError" class="text-[11px] font-medium text-burning-orange">
                {{ descriptionError }}
              </p>
            </div>

            <!-- Inline Metadata Row (Compact ONE row on desktop) -->
            <div class="flex flex-col lg:flex-row gap-3 mt-2">
              <!-- Unified Date Range Input -->
              <div
                class="flex-1 flex items-center border-[1.5px] border-cinnamon-ice/30 rounded-[10px] p-1 bg-white"
                :class="{ 'border-burning-orange/50': showDateRangeError }"
              >
                <!-- Start Date/Time Stacked -->
                <div class="flex-1 flex flex-col px-3 py-1">
                  <span class="text-[9px] font-bold text-gray-400 uppercase tracking-wider"
                    >Start</span
                  >
                  <div class="flex flex-col gap-1">
                    <CustomCalendar
                      v-model="startDate"
                      placeholder="Select date"
                      disable-past
                      class="date-input-compact"
                    />
                    <CustomTimePicker
                      v-model="startTime"
                      placeholder="Select time"
                      class="time-input-compact"
                      :min-time="getStartMinTime"
                    />
                  </div>
                </div>

                <div class="px-1 text-gray-300">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                  >
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </div>

                <!-- End Date/Time Stacked -->
                <div class="flex-1 flex flex-col px-3 py-1">
                  <span class="text-[9px] font-bold text-gray-400 uppercase tracking-wider"
                    >End</span
                  >
                  <div class="flex flex-col gap-1">
                    <CustomCalendar
                      v-model="endDate"
                      placeholder="Select date"
                      disable-past
                      :min-date="startDate"
                      class="date-input-compact"
                    />
                    <CustomTimePicker
                      v-model="endTime"
                      placeholder="Select time"
                      class="time-input-compact"
                      :min-time="getEndMinTime"
                    />
                  </div>
                </div>
              </div>

              <!-- Budget Range Input -->
              <div class="flex items-center gap-2">
                <div
                  class="flex items-center h-[52px] border-[1.5px] border-cinnamon-ice/30 rounded-[10px] px-3 bg-white w-28"
                  :class="{ 'border-burning-orange/50': showMinimumPriceError }"
                >
                  <span class="text-[13px] font-semibold text-gray-400 mr-1">₱</span>
                  <input
                    v-model="minimumPrice"
                    type="number"
                    placeholder="Min"
                    class="w-full bg-transparent text-[13px] text-gray-900 outline-none"
                    @blur="markTouched('minimumPrice')"
                  />
                </div>
                <span class="text-gray-300">–</span>
                <div
                  class="flex items-center h-[52px] border-[1.5px] border-cinnamon-ice/30 rounded-[10px] px-3 bg-white w-28"
                  :class="{
                    'border-burning-orange/50': showMaximumPriceError || showPriceRangeError,
                  }"
                >
                  <span class="text-[13px] font-semibold text-gray-400 mr-1">₱</span>
                  <input
                    v-model="maximumPrice"
                    type="number"
                    placeholder="Max"
                    class="w-full bg-transparent text-[13px] text-gray-900 outline-none"
                    @blur="markTouched('maximumPrice')"
                  />
                </div>
              </div>
            </div>
            <p
              v-if="showDateRangeError || showPriceRangeError"
              class="text-[11px] font-medium text-burning-orange mt-2"
            >
              {{ dateRangeError || priceRangeError }}
            </p>
          </div>
        </div>

        <!-- Form Footer -->
        <div
          class="px-6 py-4 bg-gray-50/50 border-t border-cinnamon-ice/20 flex flex-wrap items-center justify-between gap-4"
        >
          <div class="flex items-center gap-4">
            <!-- Image Upload Interaction -->
            <div class="flex items-center gap-3">
              <input
                ref="referenceImageInputRef"
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleReferenceImageSelect"
              />
              <button
                v-if="!referenceImage"
                type="button"
                class="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                :disabled="isUploadingReferenceImage || props.isSubmitting"
                @click="triggerReferenceImageUpload"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  <path d="M16 5h4M18 3v4" />
                </svg>
                <span class="text-[13px] font-medium">+ Add photo</span>
              </button>

              <!-- Image Preview Thumbnail (48x48px border-radius: 8px) -->
              <div v-else class="relative group">
                <img
                  :src="referenceImage.url"
                  class="h-12 w-12 rounded-[8px] object-cover border border-cinnamon-ice/20"
                />
                <button
                  type="button"
                  class="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-gray-900 text-white flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  @click="removeReferenceImage"
                >
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="4"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <span class="text-[12px] text-gray-400">Visible to all community members.</span>
          </div>

          <div class="flex items-center gap-3">
            <button
              type="button"
              class="h-9 px-4 border border-burning-orange text-burning-orange rounded-[10px] text-[13px] font-bold transition-all hover:bg-burning-orange/5"
              @click="collapseForm"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="h-9 px-6 bg-burning-orange text-white rounded-[10px] font-bold text-[14px] transition-all shadow-md active:scale-95 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed"
              :disabled="!isTitleValid || props.isSubmitting || isUploadingReferenceImage"
            >
              {{ props.isSubmitting ? "Posting..." : "Post Request" }}
            </button>
          </div>
        </div>
      </form>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch, nextTick } from "vue"
import type { CommunityRequestComposerInput } from "~/types/community-requests"

type UploadedReferenceImage = {
  id: string
  url: string
  name: string
}

const props = withDefaults(
  defineProps<{
    userAvatar?: string | null
    userName: string
    isSubmitting?: boolean
    serverError?: string | null
  }>(),
  {
    userAvatar: null,
    isSubmitting: false,
    serverError: null,
  },
)

const emit = defineEmits<{
  (event: "post", value: CommunityRequestComposerInput): void
}>()

const supabase = useSupabaseClient()
const runtimeConfig = useRuntimeConfig()
const itemImageBucket = runtimeConfig.public.itemImageBucket
const supabaseUrl = runtimeConfig.public.supabase.url
const supabaseKey = runtimeConfig.public.supabase.key

const isExpanded = ref(false)
const itemNeeded = ref("")
const description = ref("")
const startDate = ref("")
const startTime = ref("")
const endDate = ref("")
const endTime = ref("")
const minimumPrice = ref<string | number>("")
const maximumPrice = ref<string | number>("")
const referenceImage = ref<UploadedReferenceImage | null>(null)
const isUploadingReferenceImage = ref(false)
const referenceImageUploadError = ref<string | null>(null)
const pendingUploadProgress = ref(0)
const currentUserId = ref<string | null>(null)
const sessionUploadedImageUrls = new Set<string>()
const pendingUploadRequest = ref<XMLHttpRequest | null>(null)

const containerRef = ref<HTMLElement | null>(null)
const itemNeededInputRef = ref<HTMLInputElement | null>(null)
const referenceImageInputRef = ref<HTMLInputElement | null>(null)
const isHighlighted = ref(false)
const attemptedSubmit = ref(false)
const hasSubmitted = ref(false)
const touchedFields = reactive({
  itemNeeded: false,
  description: false,
  startDate: false,
  startTime: false,
  endDate: false,
  endTime: false,
  minimumPrice: false,
  maximumPrice: false,
})

const expandForm = () => {
  isExpanded.value = true
  nextTick(() => {
    itemNeededInputRef.value?.focus()
  })
}

const collapseForm = () => {
  if (hasStartedForm.value) {
    if (!confirm("Are you sure you want to discard your changes?")) return
  }
  isExpanded.value = false
  resetForm()
}

const hasInputValue = (value: string | number) => {
  if (typeof value === "number") return Number.isFinite(value)
  return value.trim().length > 0
}

const resetTouchedFields = () => {
  touchedFields.itemNeeded = false
  touchedFields.description = false
  touchedFields.startDate = false
  touchedFields.startTime = false
  touchedFields.endDate = false
  touchedFields.endTime = false
  touchedFields.minimumPrice = false
  touchedFields.maximumPrice = false
}

const markTouched = (field: keyof typeof touchedFields) => {
  touchedFields[field] = true
}

const parsedMinimumPrice = computed(() =>
  typeof minimumPrice.value === "number" ? minimumPrice.value : Number(minimumPrice.value),
)
const parsedMaximumPrice = computed(() =>
  typeof maximumPrice.value === "number" ? maximumPrice.value : Number(maximumPrice.value),
)

const isTitleValid = computed(() => itemNeeded.value.trim().length > 0)
const itemNeededError = computed(() => (itemNeeded.value.trim() ? "" : "Item needed is required."))
const descriptionError = computed(() =>
  description.value.trim() ? "" : "Description is required.",
)
const startDateError = computed(() => (startDate.value ? "" : "Start date is required."))
const startTimeError = computed(() => (startTime.value ? "" : "Start time is required."))
const endDateError = computed(() => (endDate.value ? "" : "End date is required."))
const endTimeError = computed(() => (endTime.value ? "" : "End time is required."))

const addHourToTime = (time: string) => {
  if (!time) return ""
  const [hours = "0", minutes = "0"] = time.split(":")
  const nextMinutes = Number(hours) * 60 + Number(minutes) + 60
  const nextHours = Math.floor(nextMinutes / 60)
  const remainderMinutes = nextMinutes % 60
  return `${nextHours.toString().padStart(2, "0")}:${remainderMinutes.toString().padStart(2, "0")}`
}

const getEndMinTime = computed(() => {
  if (!startDate.value || !startTime.value || !endDate.value || startDate.value !== endDate.value) {
    return undefined
  }
  return addHourToTime(startTime.value)
})

const getStartMinTime = computed(() => {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`

  if (startDate.value === todayStr) {
    const hours = today.getHours().toString().padStart(2, "0")
    const minutes = today.getMinutes().toString().padStart(2, "0")
    return `${hours}:${minutes}`
  }

  return undefined
})

const isTimeFrameInvalid = computed(() => {
  if (!startDate.value || !startTime.value || !endDate.value || !endTime.value) return false
  const start = new Date(`${startDate.value}T${startTime.value}`)
  const end = new Date(`${endDate.value}T${endTime.value}`)
  if (startDate.value === endDate.value) {
    const minimumEnd = new Date(start.getTime() + 60 * 60 * 1000)
    return end < minimumEnd
  }
  return end < start
})

const dateRangeError = computed(() => {
  if (!startDate.value || !endDate.value) return ""
  if (endDate.value < startDate.value) return "End date must be on or after the start date."
  if (isTimeFrameInvalid.value) {
    return startDate.value === endDate.value
      ? "End time must be at least 1 hour later."
      : "End time cannot be earlier than start time."
  }
  return ""
})
const minimumPriceError = computed(() => {
  if (!hasInputValue(minimumPrice.value)) return ""
  if (!Number.isFinite(parsedMinimumPrice.value) || parsedMinimumPrice.value < 0) {
    return "Minimum budget must be 0 or higher."
  }
  return ""
})
const maximumPriceError = computed(() => {
  if (!hasInputValue(maximumPrice.value)) return ""
  if (!Number.isFinite(parsedMaximumPrice.value) || parsedMaximumPrice.value < 0) {
    return "Maximum budget must be 0 or higher."
  }
  return ""
})
const priceRangeError = computed(() => {
  if (minimumPriceError.value || maximumPriceError.value) return ""
  if (!hasInputValue(minimumPrice.value) || !hasInputValue(maximumPrice.value)) return ""
  return parsedMinimumPrice.value > parsedMaximumPrice.value
    ? "Maximum budget must be greater than or equal to minimum budget."
    : ""
})

const isFormValid = computed(() => {
  return (
    itemNeededError.value === "" &&
    descriptionError.value === "" &&
    startDateError.value === "" &&
    startTimeError.value === "" &&
    endDateError.value === "" &&
    endTimeError.value === "" &&
    dateRangeError.value === "" &&
    priceRangeError.value === ""
  )
})

const hasStartedForm = computed(() => {
  return (
    itemNeeded.value.trim().length > 0 ||
    description.value.trim().length > 0 ||
    Boolean(startDate.value) ||
    Boolean(startTime.value) ||
    Boolean(endDate.value) ||
    Boolean(endTime.value) ||
    hasInputValue(minimumPrice.value) ||
    hasInputValue(maximumPrice.value) ||
    Boolean(referenceImage.value)
  )
})
const showItemNeededError = computed(
  () => Boolean(itemNeededError.value) && (attemptedSubmit.value || touchedFields.itemNeeded),
)
const showDescriptionError = computed(
  () => Boolean(descriptionError.value) && (attemptedSubmit.value || touchedFields.description),
)
const showDateRangeError = computed(
  () =>
    Boolean(dateRangeError.value) &&
    (attemptedSubmit.value ||
      touchedFields.startDate ||
      touchedFields.startTime ||
      touchedFields.endDate ||
      touchedFields.endTime),
)
const showMinimumPriceError = computed(
  () => Boolean(minimumPriceError.value) && (attemptedSubmit.value || touchedFields.minimumPrice),
)
const showMaximumPriceError = computed(
  () => Boolean(maximumPriceError.value) && (attemptedSubmit.value || touchedFields.maximumPrice),
)
const showPriceRangeError = computed(
  () =>
    Boolean(priceRangeError.value) &&
    (attemptedSubmit.value || touchedFields.minimumPrice || touchedFields.maximumPrice),
)

const getSafeFileName = (fileName: string) => {
  const cleaned = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return cleaned || "image"
}

const fetchCurrentUserId = async () => {
  if (currentUserId.value) return currentUserId.value

  const { authUser: cachedAuthUser, fetch: fetchAuthUser } = useAuthUser()
  const authUser = cachedAuthUser.value ?? (await fetchAuthUser())
  if (authUser) currentUserId.value = authUser.id
  return currentUserId.value
}

const createStoragePath = (file: File, userId: string) => {
  const datePrefix = new Date().toISOString().slice(0, 10)
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  return `request-references/${userId}/${datePrefix}/${uniqueId}-${getSafeFileName(file.name)}`
}

const encodeStoragePath = (path: string) => path.split("/").map(encodeURIComponent).join("/")

const cleanupUploadedImages = async (urls: string[], options: { keepalive?: boolean } = {}) => {
  const uniqueUrls = [...new Set(urls)].filter((url) => sessionUploadedImageUrls.has(url))
  if (uniqueUrls.length === 0) return

  try {
    if (options.keepalive && typeof window !== "undefined") {
      await fetch("/api/item-images/cleanup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ urls: uniqueUrls }),
        keepalive: true,
        credentials: "same-origin",
      })
    } else {
      await $fetch("/api/item-images/cleanup", {
        method: "POST",
        body: { urls: uniqueUrls },
      })
    }

    for (const url of uniqueUrls) {
      sessionUploadedImageUrls.delete(url)
    }
  } catch {
    // Best effort cleanup only.
  }
}

const resetForm = () => {
  itemNeeded.value = ""
  description.value = ""
  startDate.value = ""
  startTime.value = ""
  endDate.value = ""
  endTime.value = ""
  minimumPrice.value = ""
  maximumPrice.value = ""
  referenceImage.value = null
  referenceImageUploadError.value = null
  pendingUploadProgress.value = 0
  attemptedSubmit.value = false
  hasSubmitted.value = false
  resetTouchedFields()
}

const markUploadedImageAsPersisted = () => {
  if (!referenceImage.value) return
  sessionUploadedImageUrls.delete(referenceImage.value.url)
}

const removeReferenceImage = async () => {
  const url = referenceImage.value?.url
  referenceImage.value = null
  referenceImageUploadError.value = null
  pendingUploadProgress.value = 0

  if (url) {
    await cleanupUploadedImages([url])
  }
}

const uploadReferenceImage = async (file: File) => {
  const userId = await fetchCurrentUserId()
  if (!userId) {
    throw new Error("Please sign in again before uploading an image.")
  }

  const storagePath = createStoragePath(file, userId)

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const accessToken = session?.access_token

  return await new Promise<UploadedReferenceImage>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    pendingUploadRequest.value = xhr
    xhr.open(
      "POST",
      `${supabaseUrl}/storage/v1/object/${itemImageBucket}/${encodeStoragePath(storagePath)}`,
    )
    xhr.setRequestHeader("apikey", supabaseKey)
    if (accessToken) {
      xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`)
    }
    xhr.setRequestHeader("x-upsert", "false")
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream")

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      pendingUploadProgress.value = Math.min(100, Math.round((event.loaded / event.total) * 100))
    }

    xhr.onerror = () => {
      pendingUploadRequest.value = null
      reject(new Error("Network error while uploading image."))
    }

    xhr.onabort = () => {
      pendingUploadRequest.value = null
      reject(new Error("Upload cancelled."))
    }

    xhr.onload = () => {
      pendingUploadRequest.value = null
      if (xhr.status < 200 || xhr.status >= 300) {
        try {
          const payload = JSON.parse(xhr.responseText) as { message?: string; error?: string }
          reject(new Error(payload.message || payload.error || "Upload failed."))
        } catch {
          reject(new Error("Upload failed."))
        }
        return
      }

      const { data: publicUrlData } = supabase.storage
        .from(itemImageBucket)
        .getPublicUrl(storagePath)
      sessionUploadedImageUrls.add(publicUrlData.publicUrl)
      resolve({
        id: storagePath,
        url: publicUrlData.publicUrl,
        name: file.name,
      })
    }

    xhr.send(file)
  })
}

const triggerReferenceImageUpload = () => {
  referenceImageInputRef.value?.click()
}

const handleReferenceImageSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement | null
  const files = input?.files ? Array.from(input.files) : []
  if (input) input.value = ""
  const file = files[0]
  if (!file) return

  if (!file.type.startsWith("image/")) {
    referenceImageUploadError.value = "Only image files can be uploaded."
    return
  }

  referenceImageUploadError.value = null
  isUploadingReferenceImage.value = true
  pendingUploadProgress.value = 0

  const previousUrl = referenceImage.value?.url

  try {
    const uploadedImage = await uploadReferenceImage(file)
    referenceImage.value = uploadedImage
    if (previousUrl) {
      await cleanupUploadedImages([previousUrl])
    }
  } catch (error) {
    referenceImageUploadError.value =
      error instanceof Error
        ? `Unable to upload image: ${error.message}`
        : "Unable to upload image right now."
  } finally {
    isUploadingReferenceImage.value = false
  }
}

const triggerHighlight = () => {
  isHighlighted.value = true
  containerRef.value?.scrollIntoView({ behavior: "smooth", block: "center" })
  if (!isExpanded.value) {
    isExpanded.value = true
  }
  setTimeout(() => {
    itemNeededInputRef.value?.focus()
  }, 600)
  setTimeout(() => {
    isHighlighted.value = false
  }, 2500)
}

defineExpose({ triggerHighlight })

const handlePost = () => {
  attemptedSubmit.value = true
  referenceImageUploadError.value = null

  if (isUploadingReferenceImage.value || !isFormValid.value) return

  hasSubmitted.value = true
  emit("post", {
    itemNeeded: itemNeeded.value.trim(),
    description: description.value.trim(),
    referenceImageUrl: referenceImage.value?.url ?? null,
    startDate: startDate.value,
    startTime: startTime.value,
    endDate: endDate.value,
    endTime: endTime.value,
    minimumPrice: parsedMinimumPrice.value,
    maximumPrice: parsedMaximumPrice.value,
  })
}

watch(
  () => props.isSubmitting,
  (isSubmitting, wasSubmitting) => {
    if (!wasSubmitting || isSubmitting || !hasSubmitted.value) return
    if (props.serverError) return

    markUploadedImageAsPersisted()
    resetForm()
    isExpanded.value = false
  },
)

const cleanupPendingWork = () => {
  pendingUploadRequest.value?.abort()
  void cleanupUploadedImages(Array.from(sessionUploadedImageUrls), { keepalive: true })
}

onBeforeUnmount(() => {
  cleanupPendingWork()
})
</script>

<style scoped>
.date-input-compact :deep(input),
.time-input-compact :deep(input) {
  border: none !important;
  padding: 0 !important;
  height: auto !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.date-input-compact :deep(.calendar-icon),
.time-input-compact :deep(.clock-icon) {
  display: none !important;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.25s ease;
  max-height: 500px;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
