<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, nextTick } from "vue"
import type { MyListingItem } from "../composables/use-my-listings"
import { mergeParsedTags } from "../utils/tag-input"

const STEPS = [
  { id: "photos", label: "Photos" },
  { id: "basic-info", label: "Basic Info" },
  { id: "details", label: "Details" },
  { id: "pricing", label: "Pricing & Availability" },
  { id: "tags", label: "Tags" },
]

const currentActiveStep = ref("photos")

const scrollToSection = (stepId: string) => {
  const el = document.getElementById(`section-${stepId}`)
  if (el) {
    const offset = 120
    const top = el.getBoundingClientRect().top + window.pageYOffset - offset
    window.scrollTo({ top, behavior: "smooth" })
    currentActiveStep.value = stepId
  }
}

const handleScroll = () => {
  const sections = STEPS.map((s) => document.getElementById(`section-${s.id}`))
  const scrollPosition = window.pageYOffset + 150

  for (let i = sections.length - 1; i >= 0; i--) {
    const section = sections[i]
    if (section && section.offsetTop <= scrollPosition) {
      currentActiveStep.value = STEPS[i]!.id
      break
    }
  }
}

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
  { value: "NEW", label: "Brand New" },
  { value: "LIKE_NEW", label: "Like New" },
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
const galleryInput = ref<HTMLInputElement | null>(null)
const images = ref<ListingImage[]>([])
const pendingUploads = ref<PendingUploadImage[]>([])
const primaryImageId = ref<string | null>(null)
const imageUploadError = ref<string | null>(null)
const isUploadingImages = ref(false)
const lightboxImage = ref<ListingImage | null>(null)
const showErrors = ref(false)
const isDragging = ref(false)
const showCancelModal = ref(false)

const pendingUploadRequests = new Map<string, XMLHttpRequest>()
const sessionUploadedImageUrls = new Set<string>()

const isAvailabilityEndInvalid = (row: AvailabilityRow) => {
  if (!row.startDate || !row.startTime || !row.endDate || !row.endTime) return false
  const startStr = `${row.startDate}T${row.startTime}`
  const endStr = `${row.endDate}T${row.endTime}`
  const start = new Date(startStr)
  const end = new Date(endStr)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false
  return end < start
}

const initialFormState = ref("")
const getFormStateString = () =>
  JSON.stringify({
    form,
    whatThisItemOffers: whatThisItemOffers.value,
    whatsIncluded: whatsIncluded.value,
    images: images.value.map((i) => i.id),
    primaryImageId: primaryImageId.value,
    availabilityRows: availabilityRows.value.map((r) => ({ ...r, id: "" })),
  })

const isDirty = computed(() => {
  if (!initialFormState.value) return false
  return initialFormState.value !== getFormStateString()
})

defineExpose({
  isDirty,
  triggerCancel: () => {
    showCancelModal.value = true
  },
})

const handleDrop = (event: DragEvent) => {
  isDragging.value = false
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    void uploadFiles(Array.from(files))
  }
}

const isCategoryDropdownOpen = ref(false)
const isRateUnitDropdownOpen = ref(false)
const focusedField = ref<"name" | "rentalFee" | "replacementCost" | "knownIssues" | null>(null)

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

const todayStr = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`
})

const currentTimeStr = computed(() => {
  const d = new Date()
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
})

const categoryDropdownRef = ref<HTMLElement | null>(null)
const rateUnitDropdownRef = ref<HTMLElement | null>(null)

const getExistingImageId = (url: string, index: number) => `existing-${index}-${url}`

const syncFromItem = (item?: MyListingItem | null) => {
  Object.assign(form, initForm())

  whatThisItemOffers.value = item?.whatItemOffers?.split("\n").filter(Boolean) ?? []
  whatsIncluded.value = item?.whatIsIncluded?.split("\n").filter(Boolean) ?? []
  const primaryExistingImage = item?.images.find((entry) => entry.isPrimary)

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
  window.addEventListener("scroll", handleScroll)

  nextTick(() => {
    initialFormState.value = getFormStateString()
  })
})

watch(
  () => props.item,
  (item) => {
    syncFromItem(item)
  },
)

onBeforeUnmount(() => {
  document.removeEventListener("click", handleClickOutside)
  window.removeEventListener("scroll", handleScroll)
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

const removeIncluded = (index: number) => {
  whatsIncluded.value.splice(index, 1)
}

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

const formatRateValue = (value: string) => {
  const digitsOnly = value.replace(/[^0-9]/g, "")
  if (!digitsOnly) return ""
  return Number(digitsOnly).toLocaleString("en-US")
}

const parseRateValue = (value: string) => {
  const digitsOnly = value.replace(/[^0-9]/g, "")
  return digitsOnly ? Number(digitsOnly) : 0
}

const handleRateInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  form.rentalFee = target.value.replace(/[^0-9,]/g, "")
}

const focusRate = () => {
  focusedField.value = "rentalFee"
  if (form.rentalFee) {
    form.rentalFee = form.rentalFee.replace(/,/g, "")
  }
}

const blurRate = () => {
  focusedField.value = null
  if (form.rentalFee) {
    form.rentalFee = formatRateValue(form.rentalFee)
  }
}

const handleReplacementCostInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  form.replacementCost = target.value.replace(/[^0-9,]/g, "")
}

const focusReplacementCost = () => {
  focusedField.value = "replacementCost"
  if (form.replacementCost) {
    form.replacementCost = form.replacementCost.replace(/,/g, "")
  }
}

const blurReplacementCost = () => {
  focusedField.value = null
  if (form.replacementCost) {
    form.replacementCost = formatRateValue(form.replacementCost)
  }
}

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

const uploadFiles = async (files: File[]) => {
  imageUploadError.value = null
  if (files.length === 0) return
  isUploadingImages.value = true
  try {
    const uploaded = await Promise.all(files.map((f) => uploadFileWithProgress(f)))
    images.value = [...images.value, ...uploaded]
    if (!primaryImageId.value) primaryImageId.value = uploaded[0]!.id
  } catch {
    imageUploadError.value = "Failed to upload images."
  } finally {
    isUploadingImages.value = false
    if (galleryInput.value) {
      galleryInput.value.value = ""
    }
  }
}

const handleGallerySelect = (event: Event) => {
  const files = (event.target as HTMLInputElement).files
  if (files) void uploadFiles(Array.from(files))
}

const removeGalleryImage = (id: string) => {
  images.value = images.value.filter((img) => img.id !== id)
  if (primaryImageId.value === id) primaryImageId.value = images.value[0]?.id ?? null
}

const triggerGalleryUpload = () => galleryInput.value?.click()

const openLightbox = (img: ListingImage) => {
  lightboxImage.value = img
}
const closeLightbox = () => {
  lightboxImage.value = null
}

const addTag = () => {
  form.tags = mergeParsedTags(form.tags, tagInput.value)
  tagInput.value = ""
}

const removeTag = (tag: string) => {
  form.tags = form.tags.filter((t) => t !== tag)
}

const addSuggestedTag = (tag: string) => {
  const t = tag.toLowerCase()
  if (!form.tags.includes(t)) form.tags.push(t)
}

const confirmCancel = () => {
  showCancelModal.value = false
  emit("cancel")
}

const cleanupSessionUploadsOnExit = () => {
  for (const xhr of pendingUploadRequests.values()) xhr.abort()
}

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

const showPreview = ref(false)
const previewData = computed(() => {
  const payload = buildPayload()
  return {
    ...payload,
    images: payload.photos.map((p, i) => ({ path: p, isPrimary: i === 0 })),
    categories: form.categories,
    condition: form.condition || "GOOD",
    lender: {
      user: {
        firstName: props.item?.ownerName?.split(" ")[0] ?? "You",
        lastName: props.item?.ownerName?.split(" ").slice(1).join(" ") ?? "",
        avatarUrl: null,
      },
      lenderRating: props.item?.rating ?? 5.0,
    },
    ownerName: props.item?.ownerName ?? "You",
    rating: props.item?.rating ?? 5.0,
  }
})

const handleSubmit = () => {
  if (tagInput.value.trim()) addTag()
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

const isStepCompleted = (stepId: string) => {
  switch (stepId) {
    case "photos":
      return images.value.length > 0
    case "basic-info":
      return form.name.trim() !== "" && form.categories.length > 0 && form.description.trim() !== ""
    case "details":
      return whatThisItemOffers.value.length > 0 || whatsIncluded.value.length > 0
    case "pricing":
      return form.freeToBorrow !== null
    case "tags":
      return form.tags.length > 0
    default:
      return false
  }
}

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
  if (availabilityRowErrors.value.some((row) => Object.keys(row).length > 0))
    errors.availability = "Please complete the availability details"
  return errors
})

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
</script>

<template>
  <div class="mx-auto w-full max-w-[1100px] font-geist pb-20 lg:px-16 xl:px-24">
    <div v-if="!embedded" class="mb-10">
      <NuxtLink
        to="/account/listings"
        class="flex items-center gap-2 text-noble-black hover:text-burning-orange transition-colors mb-8 group w-fit"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="transition-transform group-hover:-translate-x-1"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        <span class="text-[15px] font-bold">Back to My Listings</span>
      </NuxtLink>
      <section class="space-y-3">
        <div class="space-y-2">
          <h1 class="text-[28px] font-semibold text-noble-black">
            {{ props.mode === "new" ? "Add New Item" : "Edit Listing" }}
          </h1>
          <div class="w-10 h-0.5 bg-burning-orange"></div>
        </div>
        <p class="text-[16px] font-medium text-noble-black/50">
          {{
            props.mode === "new"
              ? "Share your items with the community and earn rewards."
              : "Update your item details and availability."
          }}
        </p>
      </section>
    </div>

    <div
      class="sticky top-0 z-50 -mx-6 sm:-mx-12 lg:-mx-16 xl:-mx-24 bg-white border-b border-cinnamon-ice/15 shadow-sm pb-6 pt-4 mb-10"
    >
      <div class="mx-auto max-w-[1100px] lg:px-16 xl:px-24 w-full relative">
        <div class="flex items-center justify-between relative z-10">
          <div
            v-for="(step, index) in STEPS"
            :key="step.id"
            class="flex flex-col items-center gap-2.5 relative group cursor-pointer"
            @click="scrollToSection(step.id)"
          >
            <div
              class="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 border-2"
              :class="[
                isStepCompleted(step.id)
                  ? 'bg-burning-orange border-burning-orange text-white shadow-lg shadow-burning-orange/20'
                  : currentActiveStep === step.id
                    ? 'bg-white border-burning-orange text-burning-orange shadow-md'
                    : 'bg-white border-cinnamon-ice/20 text-noble-black/40',
              ]"
            >
              <svg
                v-if="isStepCompleted(step.id)"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span v-else class="text-[13px] font-bold">{{ index + 1 }}</span>
            </div>
            <span
              class="text-[10px] font-bold uppercase tracking-wider transition-colors duration-300"
              :class="[
                currentActiveStep === step.id
                  ? 'text-burning-orange'
                  : 'text-noble-black/30 group-hover:text-noble-black/50',
              ]"
              >{{ step.label }}</span
            >
          </div>
        </div>
        <div class="absolute top-[18px] left-8 right-8 h-[2px] bg-noble-black/10 -z-0">
          <div
            class="h-full bg-burning-orange transition-all duration-500"
            :style="{
              width: `${(STEPS.findIndex((s) => s.id === currentActiveStep) / (STEPS.length - 1)) * 100}%`,
            }"
          ></div>
        </div>
      </div>
    </div>

    <form class="flex flex-col gap-10 mt-12" @submit.prevent="handleSubmit">
      <section
        id="section-photos"
        class="form-section transition-all duration-300"
        :class="{
          'ring-2 ring-cinnabar-red/20 border-cinnabar-red/30': showErrors && formErrors.coverImage,
        }"
      >
        <div class="flex items-center justify-between mb-6">
          <div class="section-header">
            <h2 class="section-title">Images</h2>
            <p class="section-subtitle">
              Upload at least one real photo of your item. This is required for verification.
            </p>
          </div>
          <div v-if="images.length > 0" class="text-[12px] font-bold text-noble-black/30">
            {{ images.length }} / {{ MAX_GALLERY_IMAGE_COUNT }}
          </div>
        </div>
        <p
          v-if="showErrors && formErrors.coverImage"
          class="mb-4 text-[13px] font-medium text-cinnabar-red"
        >
          {{ formErrors.coverImage }}
        </p>
        <div class="space-y-6">
          <div
            class="upload-dropzone group"
            :class="{ 'is-dragging': isDragging }"
            @click="triggerGalleryUpload"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
          >
            <input
              ref="galleryInput"
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              @change="handleGallerySelect"
              @click.stop
            />
            <div class="flex flex-col items-center text-center">
              <div
                class="w-12 h-12 rounded-full bg-noble-black/5 flex items-center justify-center mb-4 group-hover:bg-burning-orange/10 transition-colors"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="text-noble-black/40 group-hover:text-burning-orange transition-colors"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  <path d="M16 5h4M18 3v4" stroke-width="2.5" />
                </svg>
              </div>
              <p
                class="text-[15px] font-bold text-noble-black/60 group-hover:text-noble-black transition-colors"
              >
                Drag photos here or click to browse
              </p>
              <p class="mt-1 text-[13px] font-medium text-noble-black/40">
                + Cover photo · PNG, JPG or WebP
              </p>
            </div>
          </div>
          <div
            v-if="images.length > 0 || pendingUploads.length > 0"
            class="flex items-center gap-4 overflow-x-auto pt-5 pb-3 px-2 scrollbar-hide"
          >
            <div v-for="img in images" :key="img.id" class="relative shrink-0 group/thumb">
              <div
                class="w-20 h-20 rounded-[12px] border overflow-hidden bg-noble-black/5 cursor-pointer relative transition-all duration-300"
                :class="
                  img.id === primaryImageId
                    ? 'border-burning-orange ring-1 ring-burning-orange/20'
                    : 'border-cinnamon-ice/20'
                "
                @click="openLightbox(img)"
              >
                <img
                  :src="img.url"
                  class="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-110"
                />
                <div
                  v-if="img.id === primaryImageId"
                  class="absolute inset-0 bg-noble-black/40 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-200 pointer-events-none"
                >
                  <span
                    class="text-white text-[10px] font-black uppercase tracking-[0.1em] drop-shadow-sm"
                    >Cover</span
                  >
                </div>
              </div>
              <button
                type="button"
                class="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-noble-black/60 text-white flex items-center justify-center shadow-lg backdrop-blur-sm opacity-0 group-hover/thumb:opacity-100 transition-all hover:bg-cinnabar-red active:scale-90"
                @click.stop="removeGalleryImage(img.id)"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div
              v-for="upload in pendingUploads"
              :key="upload.id"
              class="w-20 h-20 rounded-[12px] border-2 border-dashed border-cinnamon-ice/20 flex flex-col items-center justify-center p-2 shrink-0 bg-noble-black/5"
            >
              <div class="relative w-full h-1 bg-noble-black/10 rounded-full overflow-hidden">
                <div
                  class="absolute inset-y-0 left-0 bg-blue-estate transition-all duration-300"
                  :style="{ width: `${upload.progress}%` }"
                ></div>
              </div>
              <span class="mt-2 text-[10px] font-bold text-blue-estate"
                >{{ upload.progress }}%</span
              >
            </div>
          </div>
        </div>
      </section>

      <section id="section-basic-info" class="form-section">
        <div class="section-header">
          <h2 class="section-title">Basic Information</h2>
          <p class="section-subtitle">Enter the essential details about your item.</p>
        </div>
        <div class="mt-8 flex flex-col gap-6">
          <div class="flex flex-col gap-2">
            <label class="form-label">Item Name <span class="text-cinnabar-red">*</span></label>
            <input
              v-model="form.name"
              type="text"
              placeholder="e.g., Sony Alpha a7 IV Mirrorless Camera"
              class="form-input"
              :class="{
                'border-cinnabar-red/50 focus:border-cinnabar-red/50':
                  showErrors && formErrors.name,
              }"
            />
            <p
              v-if="showErrors && formErrors.name"
              class="text-[12px] font-medium text-cinnabar-red"
            >
              {{ formErrors.name }}
            </p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="flex flex-col gap-2">
              <label class="form-label">Category <span class="text-cinnabar-red">*</span></label>
              <div ref="categoryDropdownRef" class="relative">
                <div
                  class="flex min-h-[44px] w-full cursor-pointer flex-wrap gap-2 rounded-[10px] border-[1.5px] border-cinnamon-ice/20 bg-white p-2 transition-all hover:border-burning-orange/40"
                  :class="{ 'border-cinnabar-red/50': showErrors && formErrors.categories }"
                  @click="toggleCategoryDropdown"
                >
                  <div
                    v-for="cat in form.categories"
                    :key="cat"
                    class="flex items-center gap-1.5 rounded-full bg-noble-black/10 px-2.5 py-0.5 text-[12px] font-medium text-noble-black"
                  >
                    <span>{{ CATEGORIES.find((c) => c.value === cat)?.label }}</span
                    ><button type="button" @click.stop="selectCategory(cat)">
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
                    class="px-1.5 py-1 text-[14px] text-noble-black/30"
                    >Select categories</span
                  >
                </div>
                <transition
                  enter-active-class="transition duration-200"
                  enter-from-class="opacity-0 -translate-y-2"
                  enter-to-class="opacity-100 translate-y-0"
                  ><div
                    v-if="isCategoryDropdownOpen"
                    class="absolute z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-[14px] border border-cinnamon-ice/30 bg-white shadow-xl p-2"
                  >
                    <div class="grid grid-cols-1 gap-1">
                      <button
                        v-for="cat in CATEGORIES"
                        :key="cat.value"
                        type="button"
                        class="px-3 py-1.5 text-left text-[13px] rounded-lg transition-colors"
                        :class="
                          form.categories.includes(cat.value)
                            ? 'bg-burning-orange text-white font-bold'
                            : 'hover:bg-noble-black/5 text-noble-black/70'
                        "
                        @click="selectCategory(cat.value)"
                      >
                        {{ cat.label }}
                      </button>
                    </div>
                  </div></transition
                >
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <label class="form-label">Condition <span class="text-cinnabar-red">*</span></label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="c in CONDITIONS"
                  :key="c.value"
                  type="button"
                  class="px-4 py-1.5 rounded-full border-[1.5px] text-[13px] font-semibold transition-all duration-300"
                  :class="
                    form.condition === c.value
                      ? 'bg-blue-estate text-white border-blue-estate shadow-sm'
                      : 'bg-white text-noble-black/50 border-cinnamon-ice/20 hover:border-burning-orange/30'
                  "
                  @click="form.condition = c.value"
                >
                  {{ c.label }}
                </button>
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <label class="form-label">Description <span class="text-cinnabar-red">*</span></label>
            <textarea
              v-model="form.description"
              placeholder="Describe your item in detail."
              class="form-textarea min-h-[140px]"
              :class="{
                'border-cinnabar-red/50 focus:border-cinnabar-red/50':
                  showErrors && formErrors.description,
              }"
            ></textarea>
            <p class="helper-text">
              Include key features, use cases, or anything specific renters should know.
            </p>
          </div>
        </div>
      </section>

      <section id="section-details" class="form-section">
        <div class="section-header">
          <h2 class="section-title">Additional Details</h2>
          <p class="section-subtitle">Help renters understand what they're getting.</p>
        </div>
        <div class="mt-8 flex flex-col gap-8">
          <div class="flex flex-col gap-2">
            <label class="form-label"
              >What This Item Offers <span class="text-cinnabar-red">*</span></label
            >
            <div
              class="flex min-h-[48px] w-full flex-wrap gap-2 rounded-[10px] border-[1.5px] border-cinnamon-ice/20 bg-white p-2 transition-all focus-within:border-burning-orange/50"
            >
              <div
                v-for="(offer, idx) in whatThisItemOffers"
                :key="idx"
                class="flex items-center gap-1.5 rounded-full bg-noble-black/10 px-2.5 py-0.5 text-[12px] font-medium text-noble-black"
              >
                <span>{{ offer }}</span
                ><button type="button" @click="removeOffer(idx)">
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
                placeholder="Type and press enter..."
                class="flex-1 bg-transparent px-1.5 text-[14px] outline-none"
                @keydown.enter.prevent="addOffer"
                @keydown.,.prevent="addOffer"
                @blur="addOffer"
              />
            </div>
            <p class="helper-text">List top 3-5 features. Press enter or comma to add.</p>
          </div>
          <div class="flex flex-col gap-2">
            <label class="form-label"
              >What's Included <span class="text-cinnabar-red">*</span></label
            >
            <div
              class="flex min-h-[48px] w-full flex-wrap gap-2 rounded-[10px] border-[1.5px] border-cinnamon-ice/20 bg-white p-2 transition-all focus-within:border-burning-orange/50"
            >
              <div
                v-for="(includedItem, idx) in whatsIncluded"
                :key="idx"
                class="flex items-center gap-1.5 rounded-full bg-noble-black/10 px-2.5 py-0.5 text-[12px] font-medium text-noble-black"
              >
                <span>{{ includedItem }}</span
                ><button type="button" @click="removeIncluded(idx)">
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
                placeholder="Type and press enter..."
                class="flex-1 bg-transparent px-1.5 text-[14px] outline-none"
                @keydown.enter.prevent="addIncluded"
                @keydown.,.prevent="addIncluded"
                @blur="addIncluded"
              />
            </div>
            <p class="helper-text">
              List all accessories, chargers, or manuals. Press enter or comma to add.
            </p>
          </div>
          <div class="flex flex-col gap-2">
            <label class="form-label">Known Issues</label>
            <textarea
              v-model="form.knownIssues"
              placeholder="Be transparent about any scratches, dents, or defects."
              class="form-textarea min-h-[100px] transition-all duration-300"
              :class="
                focusedField === 'knownIssues'
                  ? 'border-amber-400 bg-amber-50/50 ring-4 ring-amber-100/50'
                  : 'border-cinnamon-ice/20'
              "
              @focus="focusedField = 'knownIssues'"
              @blur="focusedField = null"
            ></textarea>
            <p class="helper-text">Being transparent builds trust and prevents disputes.</p>
          </div>
        </div>
      </section>

      <div id="section-pricing" class="space-y-10">
        <section class="form-section">
          <div class="section-header">
            <h2 class="section-title">Pricing</h2>
            <p class="section-subtitle">
              Choose how you want to list your item and set your rates.
            </p>
          </div>
          <div class="mt-8 flex flex-col gap-8">
            <div class="flex flex-col gap-4">
              <label class="form-label"
                >Listing Type <span class="text-cinnabar-red">*</span></label
              >
              <div class="flex items-center gap-8">
                <label class="flex cursor-pointer items-center gap-2"
                  ><input
                    v-model="form.freeToBorrow"
                    type="radio"
                    :value="true"
                    class="h-5 w-5 border-cinnamon-ice/40 text-burning-orange focus:ring-burning-orange"
                  /><span class="text-[14px] font-medium text-noble-black/70"
                    >For Borrow</span
                  ></label
                >
                <label class="flex cursor-pointer items-center gap-2"
                  ><input
                    v-model="form.freeToBorrow"
                    type="radio"
                    :value="false"
                    class="h-5 w-5 border-cinnamon-ice/40 text-burning-orange focus:ring-burning-orange"
                  /><span class="text-[14px] font-medium text-noble-black/70">For Rent</span></label
                >
              </div>
            </div>
            <div v-if="form.freeToBorrow === false" class="flex flex-col gap-2">
              <label class="form-label">Rate <span class="text-cinnabar-red">*</span></label>
              <div
                class="flex items-center rounded-[10px] border-[1.5px] border-cinnamon-ice/20 bg-white transition-all focus-within:border-burning-orange focus-within:ring-4 focus-within:ring-burning-orange/10"
              >
                <div
                  class="flex items-center justify-center w-12 h-11 bg-noble-black/5 border-r border-cinnamon-ice/10 text-noble-black/40 font-medium"
                >
                  ₱
                </div>
                <input
                  :value="form.rentalFee"
                  type="text"
                  inputmode="numeric"
                  placeholder="0"
                  class="flex-1 h-11 px-4 text-[14px] font-medium text-noble-black outline-none bg-transparent"
                  @input="handleRateInput"
                  @blur="blurRate"
                  @focus="focusRate"
                />
                <div ref="rateUnitDropdownRef" class="relative">
                  <button
                    type="button"
                    class="h-11 flex items-center gap-2 px-4 bg-noble-black/5 border-l border-cinnamon-ice/10 text-[13px] font-bold text-noble-black/70 hover:bg-noble-black/10 transition-colors"
                    @click="toggleRateUnitDropdown"
                  >
                    {{ form.rateOption === "PER_DAY" ? "Per Day" : "Per Hour"
                    }}<svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  <div
                    v-if="isRateUnitDropdownOpen"
                    class="absolute right-0 z-50 mt-1 w-32 bg-white border border-cinnamon-ice/20 rounded-[10px] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                  >
                    <button
                      type="button"
                      class="w-full px-4 py-2.5 text-left text-[13px] font-medium hover:bg-noble-black/5"
                      @mousedown.prevent="selectRateUnit('PER_DAY')"
                    >
                      Per Day</button
                    ><button
                      type="button"
                      class="w-full px-4 py-2.5 text-left text-[13px] font-medium hover:bg-noble-black/5"
                      @mousedown.prevent="selectRateUnit('PER_HOUR')"
                    >
                      Per Hour
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex flex-col gap-3">
              <div class="flex items-center gap-2">
                <label class="form-label !mb-0">Replacement Cost</label>
              </div>
              <div class="relative">
                <span
                  class="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-medium text-noble-black/60"
                  >₱</span
                ><input
                  :value="form.replacementCost"
                  type="text"
                  inputmode="numeric"
                  placeholder="0"
                  class="form-input !pl-8"
                  @input="handleReplacementCostInput"
                  @blur="blurReplacementCost"
                  @focus="focusReplacementCost"
                />
              </div>
              <p class="helper-text">
                The amount to be paid if the item is lost or damaged beyond repair. This helps
                protect your listing.
              </p>
            </div>
          </div>
        </section>

        <section class="form-section">
          <div class="section-header">
            <h2 class="section-title">Availability</h2>
            <p class="section-subtitle">
              Select the dates and times your item will be available for others to book.
            </p>
          </div>
          <div class="mt-8 space-y-8">
            <div
              v-for="(availability, index) in availabilityRows"
              :key="availability.id"
              class="relative space-y-6"
            >
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label class="form-label opacity-50 uppercase tracking-widest !text-[10px]"
                    >Available From <span class="text-cinnabar-red">*</span></label
                  >
                  <div class="flex gap-3">
                    <CustomCalendar
                      :model-value="availability.startDate"
                      class="flex-1"
                      :min-date="todayStr"
                      @update:model-value="updateAvailabilityField(index, 'startDate', $event)"
                    /><CustomTimePicker
                      :model-value="availability.startTime"
                      class="w-32"
                      :min-time="availability.startDate === todayStr ? currentTimeStr : ''"
                      @update:model-value="updateAvailabilityField(index, 'startTime', $event)"
                    />
                  </div>
                </div>
                <div class="space-y-2">
                  <label class="form-label opacity-50 uppercase tracking-widest !text-[10px]"
                    >Available Until <span class="text-cinnabar-red">*</span></label
                  >
                  <div class="flex gap-3">
                    <CustomCalendar
                      :model-value="availability.endDate"
                      class="flex-1"
                      :min-date="availability.startDate || todayStr"
                      @update:model-value="updateAvailabilityField(index, 'endDate', $event)"
                    /><CustomTimePicker
                      :model-value="availability.endTime"
                      class="w-32"
                      :min-time="
                        availability.startDate === availability.endDate
                          ? availability.startTime
                          : availability.endDate === todayStr
                            ? currentTimeStr
                            : ''
                      "
                      @update:model-value="updateAvailabilityField(index, 'endTime', $event)"
                    />
                  </div>
                </div>
              </div>
              <div v-if="availabilityRows.length > 1" class="flex justify-end">
                <button
                  type="button"
                  class="text-[12px] font-bold text-cinnabar-red/60 hover:text-cinnabar-red hover:underline transition-colors"
                  @click="removeAvailabilityRow(index)"
                >
                  Remove date range
                </button>
              </div>
              <div
                v-if="index !== availabilityRows.length - 1"
                class="h-[1px] bg-cinnamon-ice/10 w-full"
              ></div>
            </div>
            <button
              type="button"
              class="w-full flex items-center justify-center gap-2 p-3 rounded-[10px] border-[1.5px] border-dashed border-cinnamon-ice/20 bg-white text-[13px] font-bold text-noble-black/50 hover:border-burning-orange hover:text-burning-orange hover:bg-burning-orange/[0.02] transition-all"
              @click="addAvailabilityRow"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 5v14M5 12h14" /></svg
              >Add another availability date
            </button>
          </div>
        </section>
      </div>

      <section id="section-tags" class="form-section">
        <div class="section-header">
          <h2 class="section-title">Tags</h2>
          <p class="section-subtitle">
            Add relevant tags to help others find your item more easily.
          </p>
        </div>
        <div class="mt-8 flex flex-col gap-6">
          <div
            class="flex min-h-[56px] w-full flex-wrap gap-2 rounded-[10px] border-[1.5px] border-cinnamon-ice/20 bg-white p-2.5 focus-within:border-burning-orange/50 transition-all"
          >
            <div
              v-for="tag in form.tags"
              :key="tag"
              class="flex items-center gap-1.5 rounded-full bg-burning-orange/[0.08] border border-burning-orange/20 px-2.5 py-0.5 text-[12px] font-bold text-burning-orange"
            >
              <span>{{ tag }}</span
              ><button type="button" @click="removeTag(tag)">
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
              placeholder="Add tags..."
              class="flex-1 bg-transparent px-1.5 text-[14px] font-medium outline-none"
              @keydown.enter.prevent="addTag"
              @keydown.,.prevent="addTag"
              @blur="addTag"
            />
          </div>
          <div class="space-y-3">
            <p class="text-[11px] font-black uppercase tracking-widest text-noble-black/30">
              Suggested Tags
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tag in SUGGESTED_TAGS"
                :key="tag"
                type="button"
                class="px-4 py-1.5 rounded-full border-[1.5px] text-[13px] font-semibold transition-all duration-300"
                :class="
                  form.tags.includes(tag.toLowerCase())
                    ? 'border-burning-orange bg-burning-orange/[0.04] text-burning-orange'
                    : 'border-cinnamon-ice/20 bg-white text-noble-black/50 hover:border-burning-orange/30'
                "
                @click="addSuggestedTag(tag)"
              >
                {{ tag }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <slot name="danger-zone"></slot>

      <div
        class="mt-8 pt-8 border-t border-cinnamon-ice/10 flex items-center justify-end gap-4 pb-20"
      >
        <button
          type="button"
          class="h-12 inline-flex items-center justify-center rounded-[10px] border-[1.5px] border-burning-orange text-burning-orange bg-white px-8 text-[15px] font-bold transition-all hover:bg-burning-orange/5 active:scale-95"
          @click="showPreview = true"
        >
          Preview
        </button>
        <button
          type="submit"
          :disabled="isSubmitting || isUploadingImages"
          class="h-12 inline-flex items-center justify-center rounded-[10px] bg-burning-orange px-10 text-[15px] font-bold text-white shadow-[0_4px_14px_rgba(232,101,10,0.3)] transition-all duration-300 hover:scale-[1.02] hover:brightness-110 active:scale-95 disabled:opacity-50"
        >
          {{
            isUploadingImages
              ? "Uploading..."
              : isSubmitting
                ? props.mode === "new"
                  ? "Publishing..."
                  : "Saving..."
                : props.mode === "new"
                  ? "Publish Listing"
                  : "Save Changes"
          }}
        </button>
      </div>
    </form>

    <Teleport to="body">
      <ItemPreviewModal :show="showPreview" :data="previewData" @close="showPreview = false" />
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
              class="h-10 rounded-xl border border-cinnamon-ice/10 px-6 text-[14px] font-semibold text-noble-black/60 hover:bg-noble-black/5"
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
  </div>
</template>

<style scoped>
.form-section {
  border-radius: 24px;
  border: 1px solid theme("colors.cinnamon-ice / 20%");
  background-color: theme("colors.cream");
  padding: 32px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
}
.form-section:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}
.section-header {
  border-left: 3px solid theme("colors.burning-orange");
  padding-left: 16px;
}
.section-title {
  font-family: theme("fontFamily.geist");
  font-size: 17px;
  font-weight: 600;
  color: theme("colors.noble-black");
}
.section-subtitle {
  font-family: theme("fontFamily.geist");
  font-size: 13px;
  color: theme("colors.noble-black / 50%");
  margin-top: 2px;
}
.form-label {
  display: block;
  font-family: theme("fontFamily.geist");
  font-size: 13px;
  font-weight: 600;
  color: theme("colors.noble-black / 70%");
  margin-bottom: 4px;
}
.form-input {
  height: 44px;
  width: 100%;
  background-color: theme("colors.white");
  border: 1.5px solid theme("colors.cinnamon-ice / 20%");
  border-radius: 10px;
  padding: 0 16px;
  font-size: 14px;
  color: theme("colors.noble-black");
  outline: none;
  transition: all 0.2s ease;
}
.form-input::placeholder {
  color: theme("colors.noble-black / 30%");
}
.form-input:focus {
  border-color: theme("colors.burning-orange");
  box-shadow: 0 0 0 3px theme("colors.burning-orange / 10%");
}
.form-textarea {
  width: 100%;
  background-color: theme("colors.white");
  border: 1.5px solid theme("colors.cinnamon-ice / 20%");
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 14px;
  color: theme("colors.noble-black");
  outline: none;
  transition: all 0.2s ease;
  resize: vertical;
}
.form-textarea::placeholder {
  color: theme("colors.noble-black / 30%");
}
input::placeholder,
textarea::placeholder {
  color: theme("colors.noble-black / 30%");
}
.form-textarea:focus {
  border-color: theme("colors.burning-orange");
  box-shadow: 0 0 0 3px theme("colors.burning-orange / 10%");
}
.helper-text {
  font-size: 12px;
  color: theme("colors.noble-black / 50%");
  margin-top: 4px;
}
.upload-dropzone {
  width: 100%;
  padding: 40px;
  border: 2px dashed theme("colors.cinnamon-ice / 20%");
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  background-color: theme("colors.white");
}
.upload-dropzone:hover,
.upload-dropzone.is-dragging {
  border-color: theme("colors.burning-orange");
  background-color: theme("colors.burning-orange / 4%");
}
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
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
