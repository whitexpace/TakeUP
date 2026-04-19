<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, nextTick } from "vue"
import type { MyListingItem } from "../composables/use-my-listings"
import { mergeParsedTags } from "../utils/tag-input"

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

type AvailabilityRow = {
  id: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
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
  "Student-friendly",
  "Brand new",
  "Deposit required",
  "ID required",
  "Popular",
]

const initForm = () => ({
  name: props.item?.name ?? "",
  description: props.item?.description ?? "",
  condition: (props.item?.condition ?? "") as ItemCondition | "",
  categories: (props.item?.categories ?? []) as ItemCategory[],
  tags: props.item?.tags ?? [],
  rentalFee: props.item?.rentalFee ? Number(props.item.rentalFee).toLocaleString("en-US") : "",
  replacementCost: props.item?.replacementCost
    ? Number(props.item.replacementCost).toLocaleString("en-US")
    : "",
  freeToBorrow: (props.item?.freeToBorrow ?? null) as boolean | null,
  rateOption: (props.item?.rateOption ?? "PER_DAY") as "PER_HOUR" | "PER_DAY",
  knownIssues: props.item?.knownIssues ?? "",
  usageLimitations: props.item?.usageLimitations ?? "",
})

const form = reactive(initForm())
const whatThisItemOffers = ref<string[]>([])
const offersInput = ref("")
const whatsIncluded = ref<string[]>([])
const includedInput = ref("")
const tagInput = ref("")
const coverInput = ref<HTMLInputElement | null>(null)
const galleryInput = ref<HTMLInputElement | null>(null)
const images = ref<ListingImage[]>([])
const pendingUploads = ref<PendingUploadImage[]>([])
const primaryImageId = ref<string | null>(null)
const imageUploadError = ref<string | null>(null)
const isUploadingImages = ref(false)
const lightboxImage = ref<ListingImage | null>(null)
const showErrors = ref(false)
const isCategoryDropdownOpen = ref(false)
const isRateUnitDropdownOpen = ref(false)
const focusedField = ref<"name" | "rentalFee" | "replacementCost" | null>(null)
const showCancelModal = ref(false)

const createAvailabilityRow = (overrides: Partial<AvailabilityRow> = {}): AvailabilityRow => ({
  id:
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
  ...overrides,
})

const availabilityRows = ref<AvailabilityRow[]>([createAvailabilityRow()])

const categoryDropdownRef = ref<HTMLElement | null>(null)
const rateUnitDropdownRef = ref<HTMLElement | null>(null)

const getExistingImageId = (url: string, index: number) => `existing-${index}-${url}`

const syncFromItem = (item?: MyListingItem | null) => {
  Object.assign(form, initForm())

  whatThisItemOffers.value = item?.whatItemOffers?.split("\n").filter(Boolean) ?? []
  whatsIncluded.value = item?.whatIsIncluded?.split("\n").filter(Boolean) ?? []
  const primaryExistingImage = item?.images.find((entry) => entry.isPrimary)

  // Images
  const initialImages = (
    item?.images.length
      ? item.images.map((image) => ({
          id: getExistingImageId(image.path, image.sortOrder),
          url: image.path,
          name: `Image`,
        }))
      : (item?.photos ?? []).map((url, index) => ({
          id: getExistingImageId(url, index),
          url,
          name: `Image ${index + 1}`,
        }))
  ) as ListingImage[]

  images.value = initialImages
  primaryImageId.value =
    (primaryExistingImage
      ? getExistingImageId(primaryExistingImage.path, primaryExistingImage.sortOrder)
      : undefined) ??
    initialImages.find((img) => img.url === item?.thumbnailImage)?.id ??
    initialImages[0]?.id ??
    null

  availabilityRows.value =
    item?.availability && item.availability.length > 0
      ? item.availability.map((range) => {
          const start = new Date(range.startDate)
          const end = new Date(range.endDate)

          return createAvailabilityRow({
            startDate: formatDateToYyyyMmDd(start),
            startTime: formatTimeToHhMm(start),
            endDate: end.getFullYear() < 2099 ? formatDateToYyyyMmDd(end) : "",
            endTime: end.getFullYear() < 2099 ? formatTimeToHhMm(end) : "",
          })
        })
      : [createAvailabilityRow()]
}

const formatDateToYyyyMmDd = (date: Date) => {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`
}

const formatTimeToHhMm = (date: Date) => {
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`
}

const addHourToTime = (time: string) => {
  if (!time) return undefined

  const [hours = "0", minutes = "0"] = time.split(":")
  const nextMinutes = Number(hours) * 60 + Number(minutes) + 60
  const nextHours = Math.floor(nextMinutes / 60)
  const remainderMinutes = nextMinutes % 60

  return `${nextHours.toString().padStart(2, "0")}:${remainderMinutes.toString().padStart(2, "0")}`
}

const getEndMinTime = (row: AvailabilityRow) => {
  if (!row.startDate || !row.startTime || !row.endDate || row.startDate !== row.endDate) {
    return undefined
  }

  return addHourToTime(row.startTime)
}

const normalizeAvailabilityRow = (row: AvailabilityRow) => {
  if (!row.endDate) {
    row.endTime = ""
    return
  }

  if (row.startDate && row.endDate < row.startDate) {
    row.endDate = row.startDate
  }

  const endMinTime = getEndMinTime(row)
  if (endMinTime && row.endTime && row.endTime < endMinTime) {
    row.endTime = ""
  }
}

const updateAvailabilityField = (
  index: number,
  field: "startDate" | "startTime" | "endDate" | "endTime",
  value: string,
) => {
  const row = availabilityRows.value[index]
  if (!row) return

  row[field] = value
  normalizeAvailabilityRow(row)
}

const addAvailabilityRow = () => {
  availabilityRows.value.push(createAvailabilityRow())
}

const removeAvailabilityRow = (index: number) => {
  if (availabilityRows.value.length === 1) return
  availabilityRows.value.splice(index, 1)
}

onMounted(() => {
  syncFromItem(props.item)
  document.addEventListener("click", handleClickOutside)
})

watch(
  () => props.item,
  (item) => {
    syncFromItem(item)
  },
)

onBeforeUnmount(() => {
  document.removeEventListener("click", handleClickOutside)
  cleanupSessionUploadsOnExit()
})

const handleClickOutside = (event: MouseEvent) => {
  if (categoryDropdownRef.value && !categoryDropdownRef.value.contains(event.target as Node)) {
    isCategoryDropdownOpen.value = false
  }
  if (rateUnitDropdownRef.value && !rateUnitDropdownRef.value.contains(event.target as Node)) {
    isRateUnitDropdownOpen.value = false
  }
}

const coverImage = computed(
  () => images.value.find((image) => image.id === primaryImageId.value) ?? null,
)

const galleryImages = computed(() =>
  images.value.filter((image) => image.id !== primaryImageId.value),
)

// Pill Logic Helpers
const addOffer = () => {
  const items = offersInput.value
    .split(",")
    .map((i) => i.trim())
    .filter(Boolean)
  items.forEach((item) => {
    if (!whatThisItemOffers.value.includes(item)) {
      whatThisItemOffers.value.push(item)
    }
  })
  offersInput.value = ""
}

const handleOfferInput = () => {
  if (offersInput.value.includes(",")) {
    addOffer()
  }
}

const removeOffer = (index: number) => {
  whatThisItemOffers.value.splice(index, 1)
}

const addIncluded = () => {
  const items = includedInput.value
    .split(",")
    .map((i) => i.trim())
    .filter(Boolean)
  items.forEach((item) => {
    if (!whatsIncluded.value.includes(item)) {
      whatsIncluded.value.push(item)
    }
  })
  includedInput.value = ""
}

const handleIncludedInput = () => {
  if (includedInput.value.includes(",")) {
    addIncluded()
  }
}

const removeIncluded = (index: number) => {
  whatsIncluded.value.splice(index, 1)
}

// Dropdown Logic
const toggleCategoryDropdown = () => {
  isCategoryDropdownOpen.value = !isCategoryDropdownOpen.value
  isRateUnitDropdownOpen.value = false
}

const toggleRateUnitDropdown = () => {
  isRateUnitDropdownOpen.value = !isRateUnitDropdownOpen.value
  isCategoryDropdownOpen.value = false
}

const selectCategory = (cat: ItemCategory) => {
  if (!form.categories.includes(cat)) {
    form.categories.push(cat)
  } else {
    form.categories = form.categories.filter((c) => c !== cat)
  }
}

const selectRateUnit = (unit: "PER_DAY" | "PER_HOUR") => {
  form.rateOption = unit
  isRateUnitDropdownOpen.value = false
}

// Image Logic
const sessionUploadedImageUrls = new Set<string>()
const pendingUploadRequests = new Map<string, XMLHttpRequest>()

const getSafeFileName = (fileName: string) => {
  return (
    fileName
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "image"
  )
}

const uploadFileWithProgress = async (file: File): Promise<ListingImage> => {
  const response = await $fetch<{ user: { id: string } }>("/api/auth/me")
  const userId = response.user.id

  const datePrefix = new Date().toISOString().slice(0, 10)
  const uniqueId = crypto.randomUUID()
  const storagePath = `items/${userId}/${datePrefix}/${uniqueId}-${getSafeFileName(file.name)}`

  const uploadId = storagePath
  pendingUploads.value.push({ id: uploadId, name: file.name, progress: 0 })

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const accessToken = session?.access_token

  return new Promise<ListingImage>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    pendingUploadRequests.set(uploadId, xhr)
    xhr.open(
      "POST",
      `${supabaseUrl}/storage/v1/object/${itemImageBucket}/${storagePath.split("/").map(encodeURIComponent).join("/")}`,
    )
    xhr.setRequestHeader("apikey", supabaseKey)
    if (accessToken) xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`)
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream")

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      const progress = Math.min(100, Math.round((event.loaded / event.total) * 100))
      pendingUploads.value = pendingUploads.value.map((u) =>
        u.id === uploadId ? { ...u, progress } : u,
      )
    }

    xhr.onerror = () => {
      pendingUploadRequests.delete(uploadId)
      pendingUploads.value = pendingUploads.value.filter((u) => u.id !== uploadId)
      reject(new Error("Network error"))
    }

    xhr.onload = () => {
      pendingUploadRequests.delete(uploadId)
      pendingUploads.value = pendingUploads.value.filter((u) => u.id !== uploadId)
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error("Upload failed"))
        return
      }
      const { data: publicUrlData } = supabase.storage
        .from(itemImageBucket)
        .getPublicUrl(storagePath)
      sessionUploadedImageUrls.add(publicUrlData.publicUrl)
      resolve({ id: storagePath, url: publicUrlData.publicUrl, name: file.name })
    }
    xhr.send(file)
  })
}

const uploadFiles = async (files: File[], options: { asCover?: boolean } = {}) => {
  imageUploadError.value = null
  if (files.length === 0) return
  isUploadingImages.value = true
  try {
    const uploaded = await Promise.all(files.map((f) => uploadFileWithProgress(f)))
    if (options.asCover) {
      const nextCover = uploaded[0]!
      images.value = [nextCover, ...images.value]
      primaryImageId.value = nextCover.id
    } else {
      images.value = [...images.value, ...uploaded]
      if (!primaryImageId.value) primaryImageId.value = uploaded[0]!.id
    }
  } catch {
    imageUploadError.value = "Failed to upload images."
  } finally {
    isUploadingImages.value = false
  }
}

const handleCoverSelect = (event: Event) => {
  const files = (event.target as HTMLInputElement).files
  if (files) uploadFiles([files[0]!], { asCover: true })
}

const handleGallerySelect = (event: Event) => {
  const files = (event.target as HTMLInputElement).files
  if (files) uploadFiles(Array.from(files))
}

const removeCover = () => {
  images.value = images.value.filter((img) => img.id !== primaryImageId.value)
  primaryImageId.value = images.value[0]?.id ?? null
}

const removeGalleryImage = (id: string) => {
  images.value = images.value.filter((img) => img.id !== id)
  if (primaryImageId.value === id) primaryImageId.value = images.value[0]?.id ?? null
}

const triggerCoverUpload = () => coverInput.value?.click()
const triggerGalleryUpload = () => galleryInput.value?.click()

// Drag and Drop
const draggedIndex = ref<number | null>(null)
const onDragStart = (index: number) => {
  draggedIndex.value = index
}
const onDragOver = (event: DragEvent) => {
  event.preventDefault()
}
const onDrop = (targetIndex: number) => {
  if (draggedIndex.value === null) return
  const gImages = [...galleryImages.value]
  const itemToMove = gImages.splice(draggedIndex.value, 1)[0]!
  gImages.splice(targetIndex, 0, itemToMove)
  images.value = [coverImage.value!, ...gImages].filter(Boolean) as ListingImage[]
  draggedIndex.value = null
}

const openLightbox = (img: ListingImage) => {
  lightboxImage.value = img
}
const closeLightbox = () => {
  lightboxImage.value = null
}

// Tags
const addTag = () => {
  form.tags = mergeParsedTags(form.tags, tagInput.value)
  tagInput.value = ""
}

const handleTagInput = () => {
  if (tagInput.value.includes(",")) addTag()
}
const removeTag = (tag: string) => {
  form.tags = form.tags.filter((t) => t !== tag)
}
const addSuggestedTag = (tag: string) => {
  const t = tag.toLowerCase()
  if (!form.tags.includes(t)) form.tags.push(t)
}

// Cancellation
const handleCancel = () => {
  showCancelModal.value = true
}
const confirmCancel = () => {
  showCancelModal.value = false
  emit("cancel")
}

const cleanupSessionUploadsOnExit = () => {
  for (const xhr of pendingUploadRequests.values()) xhr.abort()
}

const isAvailabilityEndInvalid = (row: AvailabilityRow) => {
  if (!row.startDate || !row.startTime || !row.endDate) return false

  const start = new Date(`${row.startDate}T${row.startTime}`)
  const end = new Date(`${row.endDate}T${row.endTime || "23:59"}`)

  if (row.startDate === row.endDate) {
    const minimumEnd = new Date(start.getTime() + 60 * 60 * 1000)
    return end < minimumEnd
  }

  return end < start
}

const availabilityRowErrors = computed(() =>
  availabilityRows.value.map((row) => {
    const errors: Record<string, string> = {}

    if (!row.startDate) errors.startDate = "Start date is required"
    if (!row.startTime) errors.startTime = "Start time is required"
    if (isAvailabilityEndInvalid(row)) {
      errors.endTime =
        row.startDate === row.endDate
          ? "End time must be at least 1 hour later"
          : "End time cannot be earlier than start time"
    }

    return errors
  }),
)

// Validation & Submission
const formErrors = computed(() => {
  const errors: Record<string, string> = {}
  if (!coverImage.value) errors.coverImage = "Please upload a cover image"
  if (!form.name.trim()) errors.name = "Item name is required"
  if (form.categories.length === 0) errors.categories = "Please select at least one category"
  if (!form.description.trim()) errors.description = "Description is required"
  if (whatThisItemOffers.value.length === 0)
    errors.whatThisItemOffers = "Please add at least one feature"
  if (whatsIncluded.value.length === 0)
    errors.whatsIncluded = "Please add at least one included item"
  if (form.freeToBorrow === null) errors.listingType = "Please select a listing type"
  if (form.freeToBorrow === false && parseRateValue(form.rentalFee) <= 0)
    errors.rentalFee = "Rate is required for rent"
  if (availabilityRowErrors.value.some((row) => Object.keys(row).length > 0)) {
    errors.availability = "Please complete the availability details"
  }
  return errors
})

const buildPayload = () => {
  const orderedImages = [...(coverImage.value ? [coverImage.value] : []), ...galleryImages.value]
  const photos = orderedImages.map((image) => image.url)
  const thumbnailImage = coverImage.value?.url ?? photos[0] ?? undefined

  const availability = availabilityRows.value.map((row) => ({
    startDate: new Date(`${row.startDate}T${row.startTime || "00:00"}`),
    endDate: row.endDate
      ? new Date(`${row.endDate}T${row.endTime || "23:59"}`)
      : new Date("2099-12-31T23:59:59"),
    status: "AVAILABLE" as const,
  }))

  return {
    ...(props.item?.id ? { id: props.item.id } : {}),
    name: form.name,
    description: form.description || undefined,
    condition: form.condition || "GOOD",
    categories: form.categories,
    tags: form.tags,
    rentalFee: parseRateValue(form.rentalFee),
    replacementCost: form.replacementCost ? parseRateValue(form.replacementCost) : undefined,
    freeToBorrow: form.freeToBorrow,
    rateOption: form.freeToBorrow ? "PER_DAY" : form.rateOption,
    whatItemOffers: whatThisItemOffers.value.join("\n"),
    whatIsIncluded: whatsIncluded.value.join("\n"),
    knownIssues: form.knownIssues || undefined,
    usageLimitations: form.usageLimitations || undefined,
    thumbnailImage,
    photos,
    availability,
    status: "AVAILABLE",
  }
}

const formatRateValue = (value: string) => {
  const digitsOnly = value.replace(/[^0-9]/g, "")
  if (!digitsOnly) return ""
  return Number(digitsOnly).toLocaleString("en-US")
}

const parseRateValue = (value: string) => {
  const digitsOnly = value.replace(/[^0-9]/g, "")
  return digitsOnly ? Number(digitsOnly) : 0
}

const blockInvalidRateInput = (event: InputEvent) => {
  if (event.data && /[^0-9,]/.test(event.data)) {
    event.preventDefault()
  }
}

const handleRateInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  form.freeToBorrow = false
  form.rentalFee = input.value.replace(/[^0-9,]/g, "")
}

const focusRate = () => {
  focusedField.value = "rentalFee"
  form.rentalFee = form.rentalFee.replace(/,/g, "")
}

const handleRateEnter = (event: KeyboardEvent) => {
  event.preventDefault()
  ;(event.target as HTMLInputElement).blur()
}

const blurRate = () => {
  focusedField.value = null
  form.rentalFee = formatRateValue(form.rentalFee)
}

const handleReplacementCostInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  form.replacementCost = input.value.replace(/[^0-9,]/g, "")
}

const focusReplacementCost = () => {
  focusedField.value = "replacementCost"
  form.replacementCost = form.replacementCost.replace(/,/g, "")
}

const blurReplacementCost = () => {
  focusedField.value = null
  form.replacementCost = formatRateValue(form.replacementCost)
}

const showPreview = ref(false)
const previewData = computed(() => {
  const payload = buildPayload()
  return {
    ...payload,
    categories: form.categories, // buildPayload returns the raw values
    condition: form.condition || "GOOD",
    ownerName: props.item?.ownerName,
    rating: props.item?.rating,
    bookingCount: props.item?.bookingCount,
  }
})

const handleSubmit = () => {
  if (tagInput.value.trim()) {
    addTag()
  }

  imageUploadError.value = null

  if (Object.keys(formErrors.value).length > 0) {
    showErrors.value = true
    nextTick(() => {
      const firstError = document.querySelector(".text-cinnabar-red")
      if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" })
    })
    return
  }

  if (isUploadingImages.value) {
    imageUploadError.value = "Please wait for image uploads to finish."
    return
  }

  emit("submit", buildPayload() as Record<string, unknown>)
}
</script>

<template>
  <form class="mx-auto w-full max-w-4xl font-geist" @submit.prevent="handleSubmit">
    <!-- Header -->
    <div v-if="!embedded">
      <NuxtLink
        to="/account/listings"
        class="inline-flex items-center gap-2 bg-transparent py-2 text-sm transition-colors hover:text-burning-orange"
      >
        <span>← Back to My Listings</span>
      </NuxtLink>
      <div class="mt-10">
        <h1 class="text-[28px] font-bold tracking-tight text-noble-black sm:text-[32px]">
          {{ props.mode === "new" ? "Add New Item" : "Edit Item" }}
        </h1>
        <p class="mt-2 text-[15px] leading-relaxed text-noble-black/55 sm:text-[16px]">
          {{
            props.mode === "new" ? "List an item for borrow or rent" : "Update your listing details"
          }}
        </p>
      </div>
    </div>

    <!-- Form Sections -->
    <div class="mt-12 flex flex-col gap-8">
      <!-- Section 1: Images -->
      <section
        class="border-dashed-section-lg rounded-[24px] bg-cream p-8 transition-all duration-300"
        :class="{
          'ring-2 ring-cinnabar-red/20 border-cinnabar-red/30': showErrors && formErrors.coverImage,
        }"
      >
        <h2 class="text-[20px] font-bold text-noble-black">Images</h2>
        <p class="mt-1 text-[14px] text-noble-black/50">
          Upload at least one real photo of your item. This is required for verification and helps
          other users trust the listing.
        </p>
        <p
          v-if="showErrors && formErrors.coverImage"
          class="mt-2 text-[13px] font-medium text-cinnabar-red"
        >
          {{ formErrors.coverImage }}
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

          <!-- Cover Image Slot -->
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
              <span class="mt-2 text-center text-[12px] font-medium text-noble-black/40"
                >Select Cover</span
              >
            </div>
          </div>

          <!-- Gallery Images -->
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
                @click.stop="removeGalleryImage(img.id)"
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

          <!-- Pending Uploads -->
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
              <p class="truncate text-[12px] font-medium text-noble-black/50">{{ upload.name }}</p>
              <p class="mt-1 text-[12px] font-semibold text-blue-estate">{{ upload.progress }}%</p>
              <div class="mt-2 h-2 overflow-hidden rounded-full bg-cinnamon-ice/20">
                <div
                  class="h-full bg-blue-estate transition-[width] duration-150"
                  :style="{ width: `${upload.progress}%` }"
                />
              </div>
            </div>
          </div>

          <!-- Add Button -->
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
            <span class="mt-2 text-center text-[12px] font-medium text-noble-black/40"
              >Add Images</span
            >
          </div>
        </div>
        <p class="mt-4 text-[12px] text-noble-black/30">Drag to reorder gallery</p>
      </section>

      <!-- Section 2: Basic Information -->
      <section class="rounded-[24px] border border-cinnamon-ice bg-cream p-8">
        <h2 class="text-[20px] font-bold text-noble-black">Basic Information</h2>
        <p class="mt-1 text-[14px] text-noble-black/50">
          Enter the essential details about your item.
        </p>

        <div class="mt-8 flex flex-col gap-6">
          <!-- Item Name -->
          <div class="flex flex-col gap-2">
            <label class="text-[14px] font-semibold text-noble-black"
              >Item Name <span class="text-cinnabar-red">*</span></label
            >
            <div class="relative">
              <input
                v-model="form.name"
                type="text"
                placeholder="e.g., Sony Alpha a7 IV Mirrorless Camera"
                class="h-12 w-full rounded-[14px] border bg-white px-4 pr-10 text-[14px] outline-none transition-all placeholder:text-noble-black/40 focus:border-burning-orange/50 focus:ring-1 focus:ring-burning-orange/20"
                :class="
                  showErrors && formErrors.name
                    ? 'border-cinnabar-red/50 ring-1 ring-cinnabar-red/10'
                    : 'border-cinnamon-ice/30'
                "
                @focus="focusedField = 'name'"
                @blur="focusedField = null"
              />
              <button
                v-if="form.name && focusedField === 'name'"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-noble-black/30 hover:text-noble-black transition-colors"
                @click="form.name = ''"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p
              v-if="showErrors && formErrors.name"
              class="text-[12px] font-medium text-cinnabar-red"
            >
              {{ formErrors.name }}
            </p>
          </div>

          <!-- Category -->
          <div class="flex flex-col gap-2">
            <label class="text-[14px] font-semibold text-noble-black"
              >Category <span class="text-cinnabar-red">*</span></label
            >
            <div ref="categoryDropdownRef" class="relative">
              <div
                class="flex min-h-[48px] w-full cursor-pointer flex-wrap gap-2 rounded-[14px] border bg-white p-2.5 transition-all hover:border-burning-orange/40"
                :class="[
                  isCategoryDropdownOpen
                    ? 'border-burning-orange/50 ring-1 ring-burning-orange/20'
                    : '',
                  showErrors && formErrors.categories
                    ? 'border-cinnabar-red/50 ring-1 ring-cinnabar-red/10'
                    : 'border-cinnamon-ice/30',
                ]"
                @click="toggleCategoryDropdown"
              >
                <div
                  v-for="cat in form.categories"
                  :key="cat"
                  class="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1 text-[13px] font-medium text-noble-black"
                >
                  <span>{{ CATEGORIES.find((c) => c.value === cat)?.label }}</span>
                  <button type="button" @click.stop="selectCategory(cat)">
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <span
                  v-if="form.categories.length === 0"
                  class="px-1.5 text-[14px] text-noble-black/40"
                  >Select categories</span
                >
              </div>
              <transition
                enter-active-class="transition duration-200"
                enter-from-class="opacity-0 -translate-y-2"
                enter-to-class="opacity-100 translate-y-0"
              >
                <div
                  v-if="isCategoryDropdownOpen"
                  class="absolute z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-[18px] border border-cinnamon-ice/30 bg-white shadow-xl p-2"
                >
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    <button
                      v-for="cat in CATEGORIES"
                      :key="cat.value"
                      type="button"
                      class="px-4 py-2 text-left text-[14px] rounded-xl transition-colors"
                      :class="
                        form.categories.includes(cat.value)
                          ? 'bg-burning-orange text-white font-bold'
                          : 'hover:bg-cream text-noble-black/80'
                      "
                      @click="selectCategory(cat.value)"
                    >
                      {{ cat.label }}
                    </button>
                  </div>
                </div>
              </transition>
            </div>
            <p
              v-if="showErrors && formErrors.categories"
              class="text-[12px] font-medium text-cinnabar-red"
            >
              {{ formErrors.categories }}
            </p>
          </div>

          <!-- Description -->
          <div class="flex flex-col gap-2">
            <label class="text-[14px] font-semibold text-noble-black"
              >Description <span class="text-cinnabar-red">*</span></label
            >
            <textarea
              v-model="form.description"
              placeholder="Describe your item in detail."
              class="min-h-[120px] w-full rounded-[14px] border bg-white p-4 text-[14px] outline-none transition-all placeholder:text-noble-black/40 focus:border-burning-orange/50 focus:ring-1 focus:ring-burning-orange/20"
              :class="
                showErrors && formErrors.description
                  ? 'border-cinnabar-red/50 ring-1 ring-cinnabar-red/10'
                  : 'border-cinnamon-ice/30'
              "
            ></textarea>
            <p
              v-if="showErrors && formErrors.description"
              class="text-[12px] font-medium text-cinnabar-red"
            >
              {{ formErrors.description }}
            </p>
          </div>

          <!-- Condition -->
          <div class="flex flex-col gap-2">
            <label class="text-[14px] font-semibold text-noble-black"
              >Condition <span class="text-cinnabar-red">*</span></label
            >
            <div class="flex flex-wrap gap-2">
              <button
                v-for="c in CONDITIONS"
                :key="c.value"
                type="button"
                class="px-4 py-2 rounded-full border text-sm font-medium transition-all"
                :class="
                  form.condition === c.value
                    ? 'bg-blue-estate text-white border-blue-estate shadow-md'
                    : 'bg-white text-noble-black/60 border-cinnamon-ice/30 hover:border-blue-estate/40'
                "
                @click="form.condition = c.value"
              >
                {{ c.label }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 3: Additional Details -->
      <section class="rounded-[24px] border border-cinnamon-ice bg-cream p-8">
        <h2 class="text-[20px] font-bold text-noble-black">Additional Details</h2>
        <p class="mt-1 text-[14px] text-noble-black/50">
          Help renters understand what they're getting.
        </p>
        <div class="mt-8 flex flex-col gap-6">
          <!-- Offers -->
          <div class="flex flex-col gap-2">
            <label class="text-[14px] font-semibold text-noble-black"
              >What This Item Offers <span class="text-cinnabar-red">*</span></label
            >
            <div
              class="flex min-h-[56px] w-full flex-wrap gap-2 rounded-[14px] border bg-white p-2.5 transition-all focus-within:border-burning-orange/50"
              :class="
                showErrors && formErrors.whatThisItemOffers
                  ? 'border-cinnabar-red/50'
                  : 'border-cinnamon-ice/30'
              "
            >
              <div
                v-for="(offer, idx) in whatThisItemOffers"
                :key="idx"
                class="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1 text-[13px] font-medium text-noble-black"
              >
                <span>{{ offer }}</span>
                <button type="button" @click="removeOffer(idx)">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <input
                v-model="offersInput"
                type="text"
                :placeholder="
                  whatThisItemOffers.length > 0
                    ? ''
                    : 'e.g., 4K 60p Video Recording, 33MP Full-Frame Sensor'
                "
                class="flex-1 bg-transparent px-1.5 text-[14px] outline-none placeholder:text-noble-black/40"
                @input="handleOfferInput"
                @blur="addOffer"
                @keydown.enter.prevent="addOffer"
              />
            </div>
            <p
              v-if="showErrors && formErrors.whatThisItemOffers"
              class="text-[12px] font-medium text-cinnabar-red"
            >
              {{ formErrors.whatThisItemOffers }}
            </p>
            <p v-else class="text-[12px] text-noble-black/30">Separate features with commas</p>
          </div>
          <!-- Included -->
          <div class="flex flex-col gap-2">
            <label class="text-[14px] font-semibold text-noble-black"
              >What's Included <span class="text-cinnabar-red">*</span></label
            >
            <div
              class="flex min-h-[56px] w-full flex-wrap gap-2 rounded-[14px] border bg-white p-2.5 transition-all focus-within:border-burning-orange/50"
              :class="
                showErrors && formErrors.whatsIncluded
                  ? 'border-cinnabar-red/50'
                  : 'border-cinnamon-ice/30'
              "
            >
              <div
                v-for="(includedItem, idx) in whatsIncluded"
                :key="idx"
                class="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1 text-[13px] font-medium text-noble-black"
              >
                <span>{{ includedItem }}</span>
                <button type="button" @click="removeIncluded(idx)">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <input
                v-model="includedInput"
                type="text"
                :placeholder="
                  whatsIncluded.length > 0 ? '' : 'e.g., Battery Charger, Camera Strap, Lens Cap'
                "
                class="flex-1 bg-transparent px-1.5 text-[14px] outline-none placeholder:text-noble-black/40"
                @input="handleIncludedInput"
                @blur="addIncluded"
                @keydown.enter.prevent="addIncluded"
              />
            </div>
            <p
              v-if="showErrors && formErrors.whatsIncluded"
              class="text-[12px] font-medium text-cinnabar-red"
            >
              {{ formErrors.whatsIncluded }}
            </p>
            <p v-else class="text-[12px] text-noble-black/30">Separate items with commas</p>
          </div>
          <!-- Known Issues -->
          <div class="flex flex-col gap-2">
            <label class="text-[14px] font-semibold text-noble-black">Known Issues</label>
            <textarea
              v-model="form.knownIssues"
              placeholder="e.g., Minor scratch on body, battery drains faster than normal..."
              class="min-h-[100px] w-full rounded-[14px] border border-cinnamon-ice/30 bg-white p-4 text-[14px] outline-none transition-all placeholder:text-noble-black/40 focus:border-burning-orange/50 focus:ring-1 focus:ring-burning-orange/20"
            ></textarea>
            <p class="text-[12px] text-noble-black/30">
              Being transparent about issues builds trust and prevents disputes.
            </p>
          </div>
          <!-- Usage Limitations -->
          <div class="flex flex-col gap-2">
            <label class="text-[14px] font-semibold text-noble-black">Usage Limitations</label>
            <textarea
              v-model="form.usageLimitations"
              placeholder="e.g., No indoor use, for professional use only, handle with care..."
              class="min-h-[100px] w-full rounded-[14px] border border-cinnamon-ice/30 bg-white p-4 text-[14px] outline-none transition-all placeholder:text-noble-black/40 focus:border-burning-orange/50 focus:ring-1 focus:ring-burning-orange/20"
            ></textarea>
            <p class="text-[12px] text-noble-black/30">
              Mention any restrictions on how the item should be used.
            </p>
          </div>
        </div>
      </section>

      <!-- Section 4: Pricing -->
      <section class="rounded-[24px] border border-cinnamon-ice bg-cream p-8">
        <h2 class="text-[20px] font-bold text-noble-black">Pricing</h2>
        <p class="mt-1 text-[14px] text-noble-black/50">Set your rental rate or sale price.</p>
        <div class="mt-8 flex flex-col gap-8">
          <!-- Type -->
          <div class="flex flex-col gap-4">
            <label class="text-[14px] font-semibold text-noble-black"
              >Listing Type <span class="text-cinnabar-red">*</span></label
            >
            <div class="flex items-center gap-8">
              <label class="flex cursor-pointer items-center gap-2">
                <div class="relative flex items-center justify-center">
                  <input
                    v-model="form.freeToBorrow"
                    type="radio"
                    :value="true"
                    class="peer h-5 w-5 appearance-none rounded-full border-[1.5px] border-cinnamon-ice bg-white transition-all duration-300 checked:border-burning-orange"
                  />
                  <div
                    class="pointer-events-none absolute h-3.5 w-3.5 rounded-full bg-burning-orange scale-0 transition-transform duration-300 peer-checked:scale-100"
                  ></div>
                </div>
                <span class="text-[14px] font-medium text-noble-black/70">For Borrow</span>
              </label>
              <label class="flex cursor-pointer items-center gap-2">
                <div class="relative flex items-center justify-center">
                  <input
                    v-model="form.freeToBorrow"
                    type="radio"
                    :value="false"
                    class="peer h-5 w-5 appearance-none rounded-full border-[1.5px] border-cinnamon-ice bg-white transition-all duration-300 checked:border-burning-orange"
                  />
                  <div
                    class="pointer-events-none absolute h-3.5 w-3.5 rounded-full bg-burning-orange scale-0 transition-transform duration-300 peer-checked:scale-100"
                  ></div>
                </div>
                <span class="text-[14px] font-medium text-noble-black/70">For Rent</span>
              </label>
            </div>
            <p
              v-if="showErrors && formErrors.listingType"
              class="text-[12px] font-medium text-cinnabar-red"
            >
              {{ formErrors.listingType }}
            </p>
          </div>
          <div v-if="form.freeToBorrow !== true" class="flex flex-col gap-2">
            <label class="text-[14px] font-semibold text-noble-black"
              >Rate <span class="text-cinnabar-red">*</span></label
            >
            <div class="flex items-center gap-3">
              <div class="relative flex-1">
                <span
                  class="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-medium text-noble-black/60"
                  >₱</span
                >
                <input
                  :value="form.rentalFee"
                  type="text"
                  inputmode="numeric"
                  placeholder="0"
                  class="h-12 w-full rounded-[14px] border bg-white pl-8 pr-10 text-[14px] outline-none transition-all"
                  :class="
                    showErrors && formErrors.rentalFee
                      ? 'border-cinnabar-red/50'
                      : 'border-cinnamon-ice/30'
                  "
                  @beforeinput="blockInvalidRateInput"
                  @input="handleRateInput"
                  @focus="focusRate"
                  @keydown.enter="handleRateEnter"
                  @blur="blurRate"
                />
              </div>
              <div ref="rateUnitDropdownRef" class="relative w-40">
                <div
                  class="flex h-12 w-full cursor-pointer items-center justify-between rounded-[14px] border border-cinnamon-ice/30 bg-white px-4 transition-all"
                  @click="toggleRateUnitDropdown"
                >
                  <span class="text-[14px] text-noble-black">{{
                    form.rateOption === "PER_DAY" ? "Per Day" : "Per Hour"
                  }}</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    :class="{ 'rotate-180': isRateUnitDropdownOpen }"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
                <transition
                  enter-active-class="transition duration-200"
                  enter-from-class="opacity-0 -translate-y-2"
                  enter-to-class="opacity-100 translate-y-0"
                >
                  <div
                    v-if="isRateUnitDropdownOpen"
                    class="absolute z-50 mt-2 w-full overflow-hidden rounded-[18px] border border-cinnamon-ice/30 bg-white shadow-xl py-2"
                  >
                    <button
                      type="button"
                      class="w-full px-4 py-2.5 text-left text-[14px] hover:bg-cream"
                      @click="selectRateUnit('PER_DAY')"
                    >
                      Per Day
                    </button>
                    <button
                      type="button"
                      class="w-full px-4 py-2.5 text-left text-[14px] hover:bg-cream"
                      @click="selectRateUnit('PER_HOUR')"
                    >
                      Per Hour
                    </button>
                  </div>
                </transition>
              </div>
            </div>
            <p
              v-if="showErrors && formErrors.rentalFee"
              class="text-[12px] font-medium text-cinnabar-red"
            >
              {{ formErrors.rentalFee }}
            </p>
          </div>

          <!-- Replacement Cost -->
          <div class="flex flex-col gap-2">
            <label class="text-[14px] font-semibold text-noble-black">Replacement Cost</label>
            <div class="relative">
              <span
                class="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-medium text-noble-black/60"
                >₱</span
              >
              <input
                :value="form.replacementCost"
                type="text"
                inputmode="numeric"
                placeholder="0"
                class="h-12 w-full rounded-[14px] border border-cinnamon-ice/30 bg-white pl-8 pr-10 text-[14px] outline-none transition-all placeholder:text-noble-black/40 focus:border-burning-orange/50 focus:ring-1 focus:ring-burning-orange/20"
                @beforeinput="blockInvalidRateInput"
                @input="handleReplacementCostInput"
                @focus="focusReplacementCost"
                @keydown.enter="handleRateEnter"
                @blur="blurReplacementCost"
              />
            </div>
            <p class="text-[12px] text-noble-black/30">
              The amount to be paid if the item is lost or damaged beyond repair.
            </p>
          </div>
        </div>
      </section>

      <!-- Section 5: Availability -->
      <section class="rounded-[24px] border border-cinnamon-ice bg-cream p-8">
        <h2 class="text-[20px] font-bold text-noble-black">Availability</h2>
        <p class="mt-1 text-[14px] text-noble-black/50">Set when your item is available.</p>
        <div class="mt-8 flex flex-col gap-6">
          <div
            v-for="(availability, index) in availabilityRows"
            :key="availability.id"
            class="flex flex-col gap-4"
          >
            <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div class="flex flex-col gap-2">
                <label class="text-[14px] font-semibold text-noble-black"
                  >Available From <span class="text-cinnabar-red">*</span></label
                >
                <div class="flex flex-wrap gap-3">
                  <CustomCalendar
                    :model-value="availability.startDate"
                    placeholder="Select date"
                    disable-past
                    class="flex-1 min-w-[180px]"
                    :class="{
                      'ring-1 ring-cinnabar-red/50 rounded-[10px]':
                        showErrors && availabilityRowErrors[index]?.startDate,
                    }"
                    @update:model-value="updateAvailabilityField(index, 'startDate', $event)"
                  />
                  <CustomTimePicker
                    :model-value="availability.startTime"
                    placeholder="Select time"
                    class="w-48"
                    :class="{
                      'ring-1 ring-cinnabar-red/50 rounded-[10px]':
                        showErrors && availabilityRowErrors[index]?.startTime,
                    }"
                    @update:model-value="updateAvailabilityField(index, 'startTime', $event)"
                  />
                </div>
                <p
                  v-if="showErrors && availabilityRowErrors[index]?.startDate"
                  class="text-[12px] font-medium text-cinnabar-red"
                >
                  {{ availabilityRowErrors[index]?.startDate }}
                </p>
                <p
                  v-if="showErrors && availabilityRowErrors[index]?.startTime"
                  class="text-[12px] font-medium text-cinnabar-red"
                >
                  {{ availabilityRowErrors[index]?.startTime }}
                </p>
              </div>
              <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between gap-3">
                  <label class="text-[14px] font-semibold text-noble-black">Available Until</label>
                  <button
                    v-if="availabilityRows.length > 1"
                    type="button"
                    class="text-[12px] font-medium text-cinnabar-red transition-colors hover:text-noble-black"
                    @click="removeAvailabilityRow(index)"
                  >
                    Remove
                  </button>
                </div>
                <div class="flex flex-wrap gap-3">
                  <CustomCalendar
                    :model-value="availability.endDate"
                    placeholder="Select date"
                    disable-past
                    :min-date="availability.startDate"
                    class="flex-1 min-w-[180px]"
                    :class="{
                      'ring-1 ring-cinnabar-red/50 rounded-[10px]':
                        showErrors && availabilityRowErrors[index]?.endTime,
                    }"
                    @update:model-value="updateAvailabilityField(index, 'endDate', $event)"
                  />
                  <CustomTimePicker
                    :model-value="availability.endTime"
                    placeholder="Select time"
                    class="w-48"
                    :min-time="getEndMinTime(availability)"
                    :strict-min="false"
                    :class="{
                      'ring-1 ring-cinnabar-red/50 rounded-[10px]':
                        showErrors && availabilityRowErrors[index]?.endTime,
                    }"
                    @update:model-value="updateAvailabilityField(index, 'endTime', $event)"
                  />
                </div>
                <p
                  v-if="showErrors && availabilityRowErrors[index]?.endTime"
                  class="text-[12px] font-medium text-cinnabar-red"
                >
                  {{ availabilityRowErrors[index]?.endTime }}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            class="flex items-center gap-2 text-[14px] font-medium text-burning-orange transition-colors hover:text-orange-600"
            @click="addAvailabilityRow"
          >
            <span class="text-lg leading-none">+</span>
            <span>Add another availability date</span>
          </button>
        </div>
      </section>

      <!-- Section 6: Tags -->
      <section class="rounded-[24px] border border-cinnamon-ice bg-cream p-8">
        <h2 class="text-[20px] font-bold text-noble-black">Tags</h2>
        <p class="mt-1 text-[14px] text-noble-black/50">Add tags to help others find your item.</p>
        <div class="mt-8 flex flex-col gap-4">
          <div
            class="flex min-h-[56px] w-full flex-wrap gap-2 rounded-[14px] border border-cinnamon-ice/30 bg-white p-2.5 focus-within:border-burning-orange/50"
          >
            <div
              v-for="tag in form.tags"
              :key="tag"
              class="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1 text-[13px] font-medium text-noble-black"
            >
              <span>{{ tag }}</span>
              <button type="button" @click="removeTag(tag)">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <input
              v-model="tagInput"
              type="text"
              placeholder="Add tags with commas or spaces"
              class="flex-1 bg-transparent px-1.5 text-[14px] outline-none"
              @input="handleTagInput"
              @blur="addTag"
              @keydown.enter.prevent="addTag"
            />
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="tag in SUGGESTED_TAGS"
              :key="tag"
              type="button"
              class="rounded-full bg-blue-estate px-4 py-1.5 text-[12px] font-medium text-white shadow-md transition-all hover:bg-blue-estate/90 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              :disabled="form.tags.includes(tag.toLowerCase())"
              @click="addSuggestedTag(tag)"
            >
              {{ tag }}
            </button>
          </div>
        </div>
      </section>
    </div>

    <!-- Action Buttons -->
    <div class="mt-12 flex items-center justify-end gap-6 pb-20">
      <button
        type="button"
        class="text-[15px] font-semibold text-noble-black transition-colors hover:text-cinnabar-red"
        @click="handleCancel"
      >
        Cancel
      </button>

      <div class="flex items-center gap-3">
        <button
          type="button"
          class="rounded-full border border-cinnamon-ice bg-white px-8 py-3.5 text-[15px] font-bold text-noble-black transition-all hover:bg-cream active:scale-95"
          @click="showPreview = true"
        >
          Preview
        </button>

        <button
          type="submit"
          :disabled="isSubmitting || isUploadingImages"
          class="rounded-full bg-burning-orange px-10 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-burning-orange/20 transition-all duration-300 hover:scale-[1.02] hover:bg-blue-estate disabled:opacity-50"
        >
          {{
            isUploadingImages
              ? "Uploading..."
              : isSubmitting
                ? props.mode === "new"
                  ? "Publishing..."
                  : "Saving..."
                : props.mode === "new"
                  ? "Publish Item"
                  : "Save Changes"
          }}
        </button>
      </div>
    </div>

    <!-- Lightbox & Modals -->
    <ItemPreviewModal :show="showPreview" :data="previewData" @close="showPreview = false" />

    <Teleport to="body">
      <div
        v-if="lightboxImage"
        class="fixed inset-0 z-[3000] flex items-center justify-center bg-noble-black/90 backdrop-blur-md p-4"
        @click="closeLightbox"
      >
        <button
          class="absolute right-6 top-6 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          @click="closeLightbox"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div class="flex flex-col items-center gap-4" @click.stop>
          <img :src="lightboxImage.url" class="max-h-[80vh] w-auto rounded-2xl shadow-2xl" />
          <p class="text-white/70">{{ lightboxImage.name }}</p>
        </div>
      </div>
      <div
        v-if="showCancelModal"
        class="fixed inset-0 z-[2000] flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-noble-black/40 backdrop-blur-[2px]"
          @click="showCancelModal = false"
        />
        <div
          class="relative w-full max-w-[360px] overflow-hidden rounded-[28px] bg-white shadow-2xl p-8 text-center"
        >
          <div
            class="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-cream mx-auto text-cinnabar-red shadow-inner"
          >
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M12 9V14M12 17.01L12.01 16.998M10.29 3.86L1.82 18C1.55 18.3 1.55 18.99 1.81 19.99C1.98 20.29 2.23 20.54 2.53 20.72L3.53 21H20.47L21.46 20.72C21.76 20.54 22.01 20.29 22.18 19.99C22.35 19.68 22.44 19.34 22.44 18.99C22.44 18.64 22.35 18.3 22.18 18L13.71 3.86C13.53 3.56 13.28 3.32 12.98 3.15C12.68 2.98 12.34 2.89 12 2.89C11.65 2.89 11.31 2.98 11.01 3.15C10.71 3.32 10.46 3.56 10.29 3.86Z"
              />
            </svg>
          </div>
          <h3 class="mb-3 text-[22px] font-bold text-noble-black">Discard changes?</h3>
          <p class="mb-10 text-[14px] text-noble-black/40">
            You have unsaved changes. Are you sure you want to discard them?
          </p>
          <div class="flex gap-3 justify-center">
            <button
              class="h-10 rounded-xl border border-cinnamon-ice/30 px-6 text-[14px] font-semibold text-noble-black/60 hover:bg-pale-cashmere"
              @click="showCancelModal = false"
            >
              Stay</button
            ><button
              class="h-10 rounded-xl bg-cinnabar-red px-6 text-[14px] font-semibold text-white hover:bg-noble-black transition-all"
              @click="confirmCancel"
            >
              Yes, Discard
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </form>
</template>

<style scoped>
.border-dashed-section-lg {
  background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='24' ry='24' stroke='%23dbbba7' stroke-width='2' stroke-dasharray='18%2c 10' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-size: 100% 100%;
}

.border-dashed-long-md {
  background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='18' ry='18' stroke='%237D6D5466' stroke-width='1.5' stroke-dasharray='12%2c 8' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e");
}
</style>
