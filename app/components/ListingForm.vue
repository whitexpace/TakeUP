<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue"
import type { MyListingItem } from "../composables/use-my-listings"

type ItemCategory =
  | "ELECTRONICS"
  | "BOOKS"
  | "CLOTHING"
  | "TOOLS"
  | "HOME_APPLIANCES"
  | "SPORTS_OUTDOORS"
  | "MUSIC_AUDIO"
  | "TOYS_GAMES"
  | "FURNITURE"
  | "VEHICLES_ACCESSORIES"
  | "HEALTH_BEAUTY"
  | "SCHOOL_SUPPLIES"
  | "PET_SUPPLIES"
  | "OTHER"

type ItemCondition = "NEW" | "LIKE_NEW" | "GOOD" | "FAIR" | "POOR"

type AvailabilityRange = {
  startDate: Date | null
  endDate: Date | null
  noEndDate: boolean
  status: "AVAILABLE" | "RENTED"
}

type ListingImage = {
  id: string
  url: string
  name: string
}

type PendingUploadImage = {
  id: string
  name: string
  progress: number
}

const props = defineProps<{
  mode?: "new" | "edit"
  item?: MyListingItem | null
  embedded?: boolean
  isSubmitting?: boolean
  submitError?: string | null
}>()

const emit = defineEmits<{
  submit: [data: Record<string, unknown>]
  cancel: []
}>()

const supabase = useSupabaseClient()
const runtimeConfig = useRuntimeConfig()
const itemImageBucket = runtimeConfig.public.itemImageBucket
const supabaseUrl = runtimeConfig.public.supabase.url
const supabaseKey = runtimeConfig.public.supabase.key
const MAX_GALLERY_IMAGE_COUNT = 10
const CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: "ELECTRONICS", label: "Electronics" },
  { value: "BOOKS", label: "Books" },
  { value: "CLOTHING", label: "Clothing" },
  { value: "TOOLS", label: "Tools" },
  { value: "HOME_APPLIANCES", label: "Home Appliances" },
  { value: "SPORTS_OUTDOORS", label: "Sports & Outdoors" },
  { value: "MUSIC_AUDIO", label: "Music & Audio" },
  { value: "TOYS_GAMES", label: "Toys & Games" },
  { value: "FURNITURE", label: "Furniture" },
  { value: "VEHICLES_ACCESSORIES", label: "Vehicles & Accessories" },
  { value: "HEALTH_BEAUTY", label: "Health & Beauty" },
  { value: "SCHOOL_SUPPLIES", label: "School Supplies" },
  { value: "PET_SUPPLIES", label: "Pet Supplies" },
  { value: "OTHER", label: "Other" },
]

const CONDITIONS: { value: ItemCondition; label: string }[] = [
  { value: "NEW", label: "Brand new" },
  { value: "LIKE_NEW", label: "Like new" },
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
  { value: "POOR", label: "Poor" },
]

const SUGGESTED_TAGS = [
  "ID required",
  "Popular",
  "Deposit required",
  "Student-friendly",
  "Brand new",
]

const initForm = () => ({
  name: props.item?.name ?? "",
  description: props.item?.description ?? "",
  condition: (props.item?.condition ?? "") as ItemCondition | "",
  categories: (props.item?.categories ?? []) as ItemCategory[],
  tags: props.item?.tags ?? [],
  rentalFee: props.item?.rentalFee ?? 0,
  replacementCost: props.item?.replacementCost ?? (null as number | null),
  freeToBorrow: props.item?.freeToBorrow ?? false,
  rateOption: (props.item?.rateOption ?? "PER_DAY") as "PER_HOUR" | "PER_DAY",
  whatItemOffers: props.item?.whatItemOffers ?? "",
  whatIsIncluded: props.item?.whatIsIncluded ?? "",
  knownIssues: props.item?.knownIssues ?? "",
  usageLimitations: props.item?.usageLimitations ?? "",
})

const form = reactive(initForm())
const tagInput = ref("")
const coverInput = ref<HTMLInputElement | null>(null)
const galleryInput = ref<HTMLInputElement | null>(null)
const images = ref<ListingImage[]>([])
const pendingUploads = ref<PendingUploadImage[]>([])
const primaryImageId = ref<string | null>(null)
const imageUploadError = ref<string | null>(null)
const isUploadingImages = ref(false)
const draggedGalleryImageId = ref<string | null>(null)
const lightboxImage = ref<ListingImage | null>(null)
const availabilityRanges = ref<AvailabilityRange[]>(
  props.item?.availability?.map((a) => ({
    startDate: new Date(a.startDate),
    endDate: new Date(a.endDate),
    noEndDate: false,
    status: a.status as "AVAILABLE" | "RENTED",
  })) ?? [],
)
const fieldErrors = ref<Record<string, string>>({})
const availabilityErrors = ref<string[]>([])
const currentUserId = ref<string | null>(null)
const sessionUploadedImageUrls = new Set<string>()
const pendingUploadRequests = new Map<string, XMLHttpRequest>()

const buildInitialImages = (item?: MyListingItem | null): ListingImage[] => {
  if (!item) return []

  const imageUrls = item.images.length
    ? item.images.map((image) => image.path)
    : (item.photos ?? [])

  return imageUrls.map((url, index) => ({
    id: `existing-${index}-${url}`,
    url,
    name: `Image ${index + 1}`,
  }))
}

const syncImagesFromItem = (item?: MyListingItem | null) => {
  images.value = buildInitialImages(item)
  primaryImageId.value =
    images.value.find(
      (image) =>
        image.url ===
        (item?.images.find((entry) => entry.isPrimary)?.path ?? item?.thumbnailImage ?? null),
    )?.id ??
    images.value[0]?.id ??
    null
}

syncImagesFromItem(props.item)

watch(
  () => props.item,
  (item) => {
    Object.assign(form, initForm())
    syncImagesFromItem(item)
    availabilityRanges.value =
      item?.availability?.map((a) => ({
        startDate: new Date(a.startDate),
        endDate: new Date(a.endDate),
        noEndDate: false,
        status: a.status as "AVAILABLE" | "RENTED",
      })) ?? []
  },
)

const coverImage = computed(
  () => images.value.find((image) => image.id === primaryImageId.value) ?? null,
)

const galleryImages = computed(() =>
  images.value.filter((image) => image.id !== primaryImageId.value),
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

  const response = await $fetch<{ user: { id: string } }>("/api/auth/me")
  currentUserId.value = response.user.id
  return currentUserId.value
}

const createItemImageStoragePath = (file: File, userId: string) => {
  const datePrefix = new Date().toISOString().slice(0, 10)
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  return `items/${userId}/${datePrefix}/${uniqueId}-${getSafeFileName(file.name)}`
}

const rebuildImages = (nextCoverImage: ListingImage | null, nextGalleryImages: ListingImage[]) => {
  images.value = nextCoverImage ? [nextCoverImage, ...nextGalleryImages] : [...nextGalleryImages]
  primaryImageId.value = nextCoverImage?.id ?? images.value[0]?.id ?? null
}

const setPendingUploadProgress = (id: string, progress: number) => {
  pendingUploads.value = pendingUploads.value.map((upload) =>
    upload.id === id ? { ...upload, progress } : upload,
  )
}

const removePendingUpload = (id: string) => {
  pendingUploads.value = pendingUploads.value.filter((upload) => upload.id !== id)
}

const encodeStoragePath = (path: string) => path.split("/").map(encodeURIComponent).join("/")

const uploadFileWithProgress = async (file: File): Promise<ListingImage> => {
  const userId = await fetchCurrentUserId()
  const storagePath = createItemImageStoragePath(file, userId)
  const uploadId = storagePath
  pendingUploads.value = [
    ...pendingUploads.value,
    {
      id: uploadId,
      name: file.name,
      progress: 0,
    },
  ]

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const accessToken = session?.access_token

  return await new Promise<ListingImage>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    pendingUploadRequests.set(uploadId, xhr)
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
      const progress = Math.min(100, Math.round((event.loaded / event.total) * 100))
      setPendingUploadProgress(uploadId, progress)
    }

    xhr.onerror = () => {
      pendingUploadRequests.delete(uploadId)
      removePendingUpload(uploadId)
      reject(new Error("Network error while uploading image."))
    }

    xhr.onabort = () => {
      pendingUploadRequests.delete(uploadId)
      removePendingUpload(uploadId)
      reject(new Error("Upload cancelled."))
    }

    xhr.onload = () => {
      pendingUploadRequests.delete(uploadId)
      if (xhr.status < 200 || xhr.status >= 300) {
        removePendingUpload(uploadId)
        try {
          const payload = JSON.parse(xhr.responseText) as { message?: string; error?: string }
          reject(new Error(payload.message || payload.error || "Upload failed."))
        } catch {
          reject(new Error("Upload failed."))
        }
        return
      }

      setPendingUploadProgress(uploadId, 100)
      const { data: publicUrlData } = supabase.storage
        .from(itemImageBucket)
        .getPublicUrl(storagePath)
      removePendingUpload(uploadId)
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
    // Swallow cleanup failures so they never block the listing flow.
  }
}

const abortPendingUploads = () => {
  for (const xhr of pendingUploadRequests.values()) {
    xhr.abort()
  }
  pendingUploadRequests.clear()
  pendingUploads.value = []
  isUploadingImages.value = false
}

const uploadFiles = async (files: File[], options: { asCover?: boolean } = {}) => {
  imageUploadError.value = null

  if (files.length === 0) {
    return
  }

  if (options.asCover && files.length > 1) {
    imageUploadError.value = "Please select only one cover image."
    return
  }

  if (!options.asCover && galleryImages.value.length + files.length > MAX_GALLERY_IMAGE_COUNT) {
    imageUploadError.value = `You can upload up to ${MAX_GALLERY_IMAGE_COUNT} gallery images.`
    return
  }

  isUploadingImages.value = true

  try {
    const invalidFile = files.find((file) => !file.type.startsWith("image/"))
    if (invalidFile) {
      imageUploadError.value = "Only image files can be uploaded."
      return
    }

    const uploadedImages = await Promise.all(files.map((file) => uploadFileWithProgress(file)))

    if (options.asCover) {
      const nextCoverImage = uploadedImages[0] ?? null
      rebuildImages(nextCoverImage, [
        ...(coverImage.value ? [coverImage.value] : []),
        ...galleryImages.value,
      ])
    } else {
      rebuildImages(coverImage.value, [...galleryImages.value, ...uploadedImages])
    }
  } catch (error) {
    imageUploadError.value =
      error instanceof Error
        ? `Unable to upload images: ${error.message}`
        : "Unable to upload one or more images. Please try again."
  } finally {
    isUploadingImages.value = false
  }
}

const handleCoverSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement | null
  const files = input?.files ? Array.from(input.files) : []
  await uploadFiles(files, { asCover: true })
  if (input) input.value = ""
}

const handleGallerySelect = async (event: Event) => {
  const input = event.target as HTMLInputElement | null
  const files = input?.files ? Array.from(input.files) : []
  await uploadFiles(files)
  if (input) input.value = ""
}

const triggerCoverUpload = () => {
  coverInput.value?.click()
}

const triggerGalleryUpload = () => {
  galleryInput.value?.click()
}

const removeCover = () => {
  const removedCover = coverImage.value
  const nextGalleryImages = [...galleryImages.value]
  const nextCoverImage = nextGalleryImages.shift() ?? null
  rebuildImages(nextCoverImage, nextGalleryImages)
  if (removedCover) {
    void cleanupUploadedImages([removedCover.url])
  }
}

const removeGalleryImage = (index: number) => {
  const nextGalleryImages = [...galleryImages.value]
  const [removedImage] = nextGalleryImages.splice(index, 1)
  rebuildImages(coverImage.value, nextGalleryImages)
  if (removedImage) {
    void cleanupUploadedImages([removedImage.url])
  }
}

const onDragStart = (index: number) => {
  draggedGalleryImageId.value = galleryImages.value[index]?.id ?? null
}

const onDragOver = (event: DragEvent) => {
  event.preventDefault()
}

const onDrop = (index: number) => {
  const draggedImageId = draggedGalleryImageId.value
  if (!draggedImageId) return

  const nextGalleryImages = [...galleryImages.value]
  const draggedIndex = nextGalleryImages.findIndex((image) => image.id === draggedImageId)

  if (draggedIndex === -1) return

  const [movedImage] = nextGalleryImages.splice(draggedIndex, 1)
  if (!movedImage) return

  nextGalleryImages.splice(index, 0, movedImage)
  rebuildImages(coverImage.value, nextGalleryImages)
  draggedGalleryImageId.value = null
}

const openLightbox = (image: ListingImage) => {
  lightboxImage.value = image
}

const closeLightbox = () => {
  lightboxImage.value = null
}

const toggleCategory = (cat: ItemCategory) => {
  const idx = form.categories.indexOf(cat)
  if (idx === -1) form.categories.push(cat)
  else form.categories.splice(idx, 1)
}

const addTag = () => {
  const t = tagInput.value.trim().toLowerCase()
  if (t && !form.tags.includes(t)) form.tags.push(t)
  tagInput.value = ""
}

const addSuggestedTag = (tag: string) => {
  const t = tag.trim().toLowerCase()
  if (!form.tags.includes(t)) form.tags.push(t)
}

const removeTag = (tag: string) => {
  form.tags = form.tags.filter((t) => t !== tag)
}

const handleFormEnterKeydown = (event: KeyboardEvent) => {
  const target = event.target
  if (!(target instanceof HTMLElement)) return
  if (target instanceof HTMLTextAreaElement) return
  if (target instanceof HTMLButtonElement) return
  event.preventDefault()
}

const buildPayload = () => {
  const orderedImages = [...(coverImage.value ? [coverImage.value] : []), ...galleryImages.value]
  const photos = orderedImages.map((image) => image.url)
  const thumbnailImage = coverImage.value?.url ?? photos[0] ?? undefined

  const availability = availabilityRanges.value
    .filter((r) => r.startDate)
    .map((r) => ({
      startDate: r.startDate!,
      endDate: r.noEndDate ? new Date("2099-12-31") : (r.endDate ?? new Date("2099-12-31")),
      status: r.status,
    }))

  return {
    ...(props.item?.id ? { id: props.item.id } : {}),
    name: form.name,
    description: form.description || undefined,
    condition: form.condition || undefined,
    categories: form.categories,
    tags: form.tags,
    rentalFee: Number(form.rentalFee),
    replacementCost: form.replacementCost !== null ? Number(form.replacementCost) : undefined,
    freeToBorrow: form.freeToBorrow,
    rateOption: form.freeToBorrow ? "PER_DAY" : form.rateOption,
    whatItemOffers: form.whatItemOffers || undefined,
    whatIsIncluded: form.whatIsIncluded || undefined,
    knownIssues: form.knownIssues || undefined,
    usageLimitations: form.usageLimitations || undefined,
    thumbnailImage,
    photos,
    availability,
    status: "AVAILABLE",
  }
}

const handleSubmit = () => {
  fieldErrors.value = {}
  availabilityErrors.value = []
  imageUploadError.value = null

  if (isUploadingImages.value) {
    imageUploadError.value = "Please wait for image uploads to finish."
    return
  }

  const payload = buildPayload()

  if (!form.name.trim()) {
    fieldErrors.value.name = "Item name is required."
  }
  if (!form.description.trim()) {
    fieldErrors.value.description = "Description is required."
  }
  if (!form.condition) {
    fieldErrors.value.condition = "Condition is required."
  }
  if (form.categories.length === 0) {
    fieldErrors.value.categories = "Select at least one category."
  }
  if (!form.freeToBorrow && Number(form.rentalFee) <= 0) {
    fieldErrors.value.rentalFee = "Rate must be greater than 0 for rental listings."
  }
  if (!form.whatItemOffers.trim()) {
    fieldErrors.value.whatItemOffers = "What this item offers is required."
  }
  if (!form.whatIsIncluded.trim()) {
    fieldErrors.value.whatIsIncluded = "What's included is required."
  }

  const invalidAvailability = availabilityRanges.value.some(
    (range) =>
      range.startDate &&
      !range.noEndDate &&
      range.endDate &&
      range.endDate.getTime() <= range.startDate.getTime(),
  )

  if (invalidAvailability) {
    availabilityErrors.value.push("Availability end dates must be later than start dates.")
  }

  if (Object.keys(fieldErrors.value).length > 0 || availabilityErrors.value.length > 0) {
    return
  }

  emit("submit", payload as Record<string, unknown>)
}

const cleanupSessionUploadsOnExit = () => {
  if (props.isSubmitting) return
  abortPendingUploads()
  void cleanupUploadedImages(Array.from(sessionUploadedImageUrls), { keepalive: true })
}

const handleCancel = () => {
  cleanupSessionUploadsOnExit()
  emit("cancel")
}

onMounted(() => {
  window.addEventListener("pagehide", cleanupSessionUploadsOnExit)
})

onBeforeUnmount(() => {
  window.removeEventListener("pagehide", cleanupSessionUploadsOnExit)
  cleanupSessionUploadsOnExit()
})
</script>

<template>
  <form class="space-y-6" @submit.prevent="handleSubmit" @keydown.enter="handleFormEnterKeydown">
    <!-- Header -->
    <div>
      <NuxtLink
        v-if="!props.embedded"
        to="/account/listings"
        class="inline-flex items-center gap-1 text-neutral-800/70 text-sm font-medium font-geist tracking-wide hover:text-neutral-800 transition-colors mb-4"
      >
        ← Back to My Listings
      </NuxtLink>
      <p
        v-else
        class="mb-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-noble-black/40"
      >
        New listing
      </p>
      <h1 class="text-neutral-800 text-xl sm:text-2xl font-bold font-geist">
        {{ props.mode === "new" ? "Add New Item" : "Edit Item" }}
      </h1>
      <p class="text-neutral-800 text-base sm:text-lg font-normal font-geist tracking-wide mt-1">
        {{
          props.mode === "new"
            ? "Fill in the details below to list your item for borrow or rent."
            : "Update your listing details, availability, and status"
        }}
      </p>
    </div>

    <!-- Images Section -->
    <section
      class="border-dashed-section-lg rounded-[24px] bg-cream p-8 transition-all duration-300"
    >
      <h2 class="text-[20px] font-bold text-noble-black">Images</h2>
      <p class="mt-1 text-[14px] text-noble-black/50">
        Upload photos of your item. Our AI will analyze them and auto-fill the details for you to
        review.
      </p>
      <p v-if="imageUploadError" class="mt-2 text-[13px] font-medium text-cinnabar-red">
        {{ imageUploadError }}
      </p>

      <div class="mt-8 flex flex-wrap gap-4">
        <input
          ref="coverInput"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleCoverSelect"
        />
        <input
          ref="galleryInput"
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          @change="handleGallerySelect"
        />
        <div v-if="isUploadingImages" class="mt-2 text-sm font-geist text-neutral-800/70">
          Uploading images...
        </div>
        <div class="relative group">
          <div
            v-if="coverImage"
            class="relative aspect-square w-32 overflow-hidden rounded-[18px] border border-cinnamon-ice/30 cursor-pointer"
            @click="openLightbox(coverImage)"
          >
            <img :src="coverImage.url" class="h-full w-full object-cover" />
            <button
              type="button"
              class="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-noble-black/60 text-white backdrop-blur-sm transition-all hover:bg-cinnabar-red opacity-0 group-hover:opacity-100"
              @click.stop="removeCover"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
              >
                <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <div
              class="absolute bottom-0 left-0 right-0 bg-noble-black/40 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-[2px]"
            >
              Cover
            </div>
          </div>
          <div
            v-else
            class="border-dashed-long-md flex aspect-square w-32 cursor-pointer flex-col items-center justify-center rounded-[18px] bg-white transition-colors hover:bg-white/80"
            @click="triggerCoverUpload"
          >
            <div
              class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-estate text-white"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <span class="mt-2 text-center text-[12px] font-medium text-noble-black/40">
              Select Cover
            </span>
          </div>
        </div>

        <div
          v-for="(img, index) in galleryImages"
          :key="img.id"
          class="relative group"
          draggable="true"
          @dragstart="onDragStart(index)"
          @dragover="onDragOver"
          @drop="onDrop(index)"
        >
          <div
            class="aspect-square w-32 overflow-hidden rounded-[18px] border border-cinnamon-ice/30 bg-white cursor-grab active:cursor-grabbing"
            @click="openLightbox(img)"
          >
            <img :src="img.url" class="h-full w-full object-cover pointer-events-none" />
            <button
              type="button"
              class="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-noble-black/60 text-white backdrop-blur-sm transition-all hover:bg-cinnabar-red opacity-0 group-hover:opacity-100"
              @click.stop="removeGalleryImage(index)"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
              >
                <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div
          v-for="upload in pendingUploads"
          :key="upload.id"
          class="flex aspect-square w-32 flex-col justify-between rounded-[18px] border border-cinnamon-ice/30 bg-white p-3"
        >
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-estate text-white"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <div>
            <p class="truncate text-[12px] font-medium text-noble-black/50">
              {{ upload.name }}
            </p>
            <p class="mt-1 text-[12px] font-semibold text-blue-estate">{{ upload.progress }}%</p>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-cinnamon-ice/20">
              <div
                class="h-full bg-blue-estate transition-[width] duration-150"
                :style="{ width: `${upload.progress}%` }"
              />
            </div>
          </div>
        </div>

        <div
          v-if="galleryImages.length < MAX_GALLERY_IMAGE_COUNT"
          class="border-dashed-long-md flex aspect-square w-32 cursor-pointer flex-col items-center justify-center rounded-[18px] bg-white transition-colors hover:bg-white/80"
          @click="triggerGalleryUpload"
        >
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-estate text-white"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <span class="mt-2 text-center text-[12px] font-medium text-noble-black/40">
            Add Images ({{ galleryImages.length }}/{{ MAX_GALLERY_IMAGE_COUNT }})
          </span>
        </div>
      </div>
      <p class="mt-4 text-[12px] text-noble-black/30">Drag to reorder</p>
    </section>

    <!-- Basic Information -->
    <section class="bg-orange-50 rounded-[20px] border border-red-300 p-4 sm:p-6 space-y-4">
      <div>
        <h2 class="text-neutral-800 text-xl font-semibold font-geist">Basic Information</h2>
        <p class="text-neutral-800/80 text-base font-normal font-geist tracking-wide">
          Enter the essential details about your item
        </p>
      </div>

      <!-- Item Name -->
      <div class="space-y-1">
        <label class="block text-neutral-800 text-lg font-medium font-geist tracking-wide">
          Item Name <span class="text-red-500 font-normal">*</span>
        </label>
        <input
          v-model="form.name"
          type="text"
          placeholder="e.g., Canon EOS R5 Camera with Lens Kit"
          class="w-full bg-white rounded-[5px] border border-red-300/50 px-3 py-2.5 text-base font-geist text-neutral-800 placeholder:text-neutral-800/50 focus:outline-none focus:border-orange-500 transition-colors"
          :class="{ 'border-red-500': fieldErrors.name }"
        />
        <p v-if="fieldErrors.name" class="text-red-500 text-sm font-geist">
          {{ fieldErrors.name }}
        </p>
      </div>

      <!-- Category -->
      <div class="space-y-2">
        <label class="block text-neutral-800 text-lg font-normal font-geist tracking-wide">
          Category <span class="text-red-500">*</span>
        </label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="cat in CATEGORIES"
            :key="cat.value"
            type="button"
            class="px-3 py-1.5 rounded-[5px] text-sm font-geist border transition-colors"
            :class="
              form.categories.includes(cat.value)
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-neutral-800/70 border-red-300/50 hover:border-orange-500'
            "
            @click="toggleCategory(cat.value)"
          >
            {{ cat.label }}
          </button>
        </div>
        <p v-if="fieldErrors.categories" class="text-red-500 text-sm font-geist">
          {{ fieldErrors.categories }}
        </p>
      </div>

      <!-- Description -->
      <div class="space-y-1">
        <label class="block text-neutral-800 text-lg font-normal font-geist tracking-wide">
          Description <span class="text-red-500">*</span>
        </label>
        <textarea
          v-model="form.description"
          rows="4"
          placeholder="Describe your item in detail..."
          class="w-full bg-white rounded-[5px] border border-red-300/50 px-3 py-2 text-base font-geist text-neutral-800 placeholder:text-neutral-800/50 focus:outline-none focus:border-orange-500 transition-colors resize-none"
          :class="{ 'border-red-500': fieldErrors.description }"
        />
        <p class="text-neutral-800/80 text-sm font-geist tracking-wide">
          Include details like brand, model, condition, and any unique features
        </p>
        <p v-if="fieldErrors.description" class="text-red-500 text-sm font-geist">
          {{ fieldErrors.description }}
        </p>
      </div>

      <!-- Condition -->
      <div class="space-y-1">
        <label class="block text-neutral-800 text-lg font-medium font-geist tracking-wide">
          Condition <span class="text-red-500 font-normal">*</span>
        </label>
        <select
          v-model="form.condition"
          class="w-full sm:w-48 bg-white rounded-[5px] border border-red-300/50 px-3 py-2.5 text-base font-geist text-neutral-800 focus:outline-none focus:border-orange-500 transition-colors"
          :class="{ 'border-red-500': fieldErrors.condition }"
        >
          <option value="">Select condition</option>
          <option v-for="c in CONDITIONS" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
        <p v-if="fieldErrors.condition" class="text-red-500 text-sm font-geist">
          {{ fieldErrors.condition }}
        </p>
      </div>
    </section>

    <!-- Additional Details -->
    <section class="bg-orange-50 rounded-[20px] border border-red-300 p-4 sm:p-6 space-y-4">
      <div>
        <h2 class="text-neutral-800 text-xl font-semibold font-geist">Additional Details</h2>
        <p class="text-neutral-800/80 text-base font-normal font-geist tracking-wide">
          Help renters understand what they're getting
        </p>
      </div>

      <div class="space-y-1">
        <label class="block text-neutral-800 text-lg font-medium font-geist tracking-wide">
          What This Item Offers <span class="text-red-500">*</span>
        </label>
        <textarea
          v-model="form.whatItemOffers"
          rows="3"
          placeholder="e.g., High-quality photos, 45MP full-frame sensor, 8K video recording..."
          class="w-full bg-white rounded-[5px] border border-red-300/50 px-3 py-2 text-base font-geist text-neutral-800 placeholder:text-neutral-800/50 focus:outline-none focus:border-orange-500 transition-colors resize-none"
          :class="{ 'border-red-500': fieldErrors.whatItemOffers }"
        />
        <p v-if="fieldErrors.whatItemOffers" class="text-red-500 text-sm font-geist">
          {{ fieldErrors.whatItemOffers }}
        </p>
      </div>

      <div class="space-y-1">
        <label class="block text-neutral-800 text-lg font-medium font-geist tracking-wide">
          What's Included <span class="text-red-500">*</span>
        </label>
        <textarea
          v-model="form.whatIsIncluded"
          rows="3"
          placeholder="e.g., Camera body, 24-70mm lens, battery, charger, carrying case..."
          class="w-full bg-white rounded-[5px] border border-red-300/50 px-3 py-2 text-base font-geist text-neutral-800 placeholder:text-neutral-800/50 focus:outline-none focus:border-orange-500 transition-colors resize-none"
          :class="{ 'border-red-500': fieldErrors.whatIsIncluded }"
        />
        <p v-if="fieldErrors.whatIsIncluded" class="text-red-500 text-sm font-geist">
          {{ fieldErrors.whatIsIncluded }}
        </p>
      </div>

      <div class="space-y-1">
        <label class="block text-neutral-800 text-lg font-medium font-geist tracking-wide"
          >Known Issues</label
        >
        <textarea
          v-model="form.knownIssues"
          rows="2"
          placeholder="e.g., Minor scratch on body, battery drains faster than normal..."
          class="w-full bg-white rounded-[5px] border border-red-300/50 px-3 py-2 text-base font-geist text-neutral-800 placeholder:text-neutral-800/50 focus:outline-none focus:border-orange-500 transition-colors resize-none"
        />
        <p class="text-neutral-800/80 text-sm font-geist tracking-wide">
          Being transparent about issues builds trust and prevents disputes
        </p>
      </div>

      <div class="space-y-1">
        <label class="block text-neutral-800 text-lg font-medium font-geist tracking-wide"
          >Usage Limitations</label
        >
        <textarea
          v-model="form.usageLimitations"
          rows="2"
          placeholder="e.g., Indoor use only, no rough handling..."
          class="w-full bg-white rounded-[5px] border border-red-300/50 px-3 py-2 text-base font-geist text-neutral-800 placeholder:text-neutral-800/50 focus:outline-none focus:border-orange-500 transition-colors resize-none"
        />
      </div>
    </section>

    <!-- Pricing -->
    <section class="bg-orange-50 rounded-[20px] border border-red-300 p-4 sm:p-6 space-y-4">
      <div>
        <h2 class="text-neutral-800 text-xl font-semibold font-geist">Pricing</h2>
        <p class="text-neutral-800/80 text-base font-normal font-geist tracking-wide">
          Set your rental rate or sale price
        </p>
      </div>

      <!-- Listing Type -->
      <div class="space-y-2">
        <label class="block text-neutral-800 text-lg font-medium font-geist tracking-wide">
          Listing Type <span class="text-red-500 font-normal">*</span>
        </label>
        <div class="flex gap-3">
          <button
            type="button"
            class="px-4 py-2 rounded-[5px] text-base font-geist border transition-colors"
            :class="
              form.freeToBorrow
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-neutral-800/70 border-red-300/50 hover:border-orange-500'
            "
            @click="form.freeToBorrow = true"
          >
            For Borrow
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-[5px] text-base font-geist border transition-colors"
            :class="
              !form.freeToBorrow
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-neutral-800/70 border-red-300/50 hover:border-orange-500'
            "
            @click="form.freeToBorrow = false"
          >
            For Rent
          </button>
        </div>
      </div>

      <template v-if="!form.freeToBorrow">
        <!-- Rate Option + Rate -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="block text-neutral-800 text-base font-geist">Rate period</label>
            <div class="flex gap-2">
              <button
                type="button"
                class="px-3 py-2 rounded-[5px] text-sm font-geist border transition-colors"
                :class="
                  form.rateOption === 'PER_DAY'
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-neutral-800/70 border-red-300/50'
                "
                @click="form.rateOption = 'PER_DAY'"
              >
                Per Day
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-[5px] text-sm font-geist border transition-colors"
                :class="
                  form.rateOption === 'PER_HOUR'
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-neutral-800/70 border-red-300/50'
                "
                @click="form.rateOption = 'PER_HOUR'"
              >
                Per Hr
              </button>
            </div>
          </div>

          <div class="space-y-1">
            <label class="block text-neutral-800 text-lg font-medium font-geist tracking-wide">
              Rate <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-800/60 font-geist"
                >₱</span
              >
              <input
                v-model.number="form.rentalFee"
                type="number"
                min="0"
                placeholder="0.00"
                class="w-full bg-white rounded-[5px] border border-red-300/50 pl-7 pr-3 py-2.5 text-base font-geist text-neutral-800 placeholder:text-neutral-800/50 focus:outline-none focus:border-orange-500 transition-colors"
                :class="{ 'border-red-500': fieldErrors.rentalFee }"
              />
            </div>
            <p v-if="fieldErrors.rentalFee" class="text-red-500 text-sm font-geist">
              {{ fieldErrors.rentalFee }}
            </p>
          </div>
        </div>
      </template>

      <!-- Replacement Cost -->
      <div class="space-y-1">
        <label class="block text-neutral-800 text-lg font-medium font-geist tracking-wide"
          >Replacement Cost</label
        >
        <div class="relative w-full">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-800/60 font-geist"
            >₱</span
          >
          <input
            v-model.number="form.replacementCost"
            type="number"
            min="0"
            placeholder="0.00"
            class="w-full bg-white rounded-[5px] border border-red-300/50 pl-7 pr-3 py-2.5 text-base font-geist text-neutral-800 placeholder:text-neutral-800/50 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>
        <p class="text-neutral-800/80 text-sm font-geist tracking-wide">
          This helps determine deposit amount and liability in case of damage
        </p>
      </div>
    </section>

    <!-- Availability -->
    <section class="bg-orange-50 rounded-[20px] border border-red-300 p-4 sm:p-6 space-y-4">
      <div>
        <h2 class="text-neutral-800 text-xl font-semibold font-geist">Availability</h2>
        <p class="text-neutral-800/80 text-base font-normal font-geist tracking-wide">
          Set when your item is available
        </p>
      </div>
      <AvailabilityEditor v-model="availabilityRanges" :errors="availabilityErrors" />
    </section>

    <!-- Tags -->
    <section class="bg-orange-50 rounded-[20px] border border-red-300 p-4 sm:p-6 space-y-4">
      <div>
        <h2 class="text-neutral-800 text-xl font-semibold font-geist">Tags</h2>
        <p class="text-neutral-800/80 text-base font-normal font-geist tracking-wide">
          Add tags to help others find your item
        </p>
      </div>

      <!-- Tag input -->
      <div class="flex gap-2">
        <input
          v-model="tagInput"
          type="text"
          placeholder="Add a tag..."
          class="flex-1 bg-white rounded-[5px] border border-red-300/50 px-3 py-2.5 text-base font-geist text-neutral-800 placeholder:text-neutral-800/50 focus:outline-none focus:border-orange-500 transition-colors"
          @keydown.enter.prevent="addTag"
        />
        <button
          type="button"
          class="px-4 py-2 bg-orange-500 text-white rounded-[5px] text-sm font-geist hover:bg-orange-600 transition-colors"
          @click="addTag"
        >
          Add
        </button>
      </div>

      <!-- Current tags -->
      <div v-if="form.tags.length > 0" class="flex flex-wrap gap-2">
        <span
          v-for="tag in form.tags"
          :key="tag"
          class="inline-flex items-center gap-1 px-3 py-1 bg-indigo-900 text-white text-sm font-geist rounded-2xl"
        >
          {{ tag }}
          <button
            type="button"
            class="text-white/70 hover:text-white leading-none ml-1"
            @click="removeTag(tag)"
          >
            ×
          </button>
        </span>
      </div>

      <!-- Suggested tags -->
      <div>
        <p class="text-neutral-800/80 text-sm font-geist tracking-wide mb-2">Suggested Tags:</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="tag in SUGGESTED_TAGS"
            :key="tag"
            type="button"
            class="px-3 py-1 bg-indigo-900 text-white text-sm font-geist rounded-2xl hover:bg-indigo-800 transition-colors disabled:opacity-50"
            :disabled="form.tags.includes(tag.toLowerCase())"
            @click="addSuggestedTag(tag)"
          >
            {{ tag }}
          </button>
        </div>
      </div>
    </section>

    <!-- Action buttons -->
    <div class="space-y-3 pt-2 pb-8">
      <p v-if="submitError" class="text-red-500 text-sm font-geist px-1">{{ submitError }}</p>
      <div class="flex flex-col sm:flex-row gap-3">
        <button
          type="submit"
          :disabled="isSubmitting || isUploadingImages"
          class="sm:flex-1 lg:flex-none px-8 py-3 bg-orange-500 text-white rounded-[30px] text-base font-medium font-geist hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{
            isUploadingImages
              ? "Uploading Images..."
              : isSubmitting
                ? props.mode === "new"
                  ? "Publishing..."
                  : "Saving..."
                : props.mode === "new"
                  ? "Publish Item"
                  : "Save Changes"
          }}
        </button>
        <button
          type="button"
          class="sm:flex-1 lg:flex-none px-8 py-3 border border-neutral-300 text-neutral-800 rounded-[30px] text-base font-normal font-geist hover:bg-neutral-50 transition-colors"
          @click="handleCancel"
        >
          Cancel
        </button>
      </div>
    </div>

    <div
      v-if="lightboxImage"
      class="fixed inset-0 z-50 flex items-center justify-center bg-noble-black/70 p-6"
      @click.self="closeLightbox"
    >
      <div class="relative max-w-3xl">
        <button
          type="button"
          class="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-noble-black/60 text-white"
          @click="closeLightbox"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <img
          :src="lightboxImage.url"
          :alt="lightboxImage.name"
          class="max-h-[80vh] rounded-[20px] object-contain shadow-2xl"
        />
      </div>
    </div>
  </form>
</template>
