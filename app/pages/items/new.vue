<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from "vue"

definePageMeta({
  layout: "account",
  auth: false,
})

const router = useRouter()
const categoryDropdownRef = ref<HTMLElement | null>(null)
const rateUnitDropdownRef = ref<HTMLElement | null>(null)

const handleClickOutside = (event: MouseEvent) => {
  if (categoryDropdownRef.value && !categoryDropdownRef.value.contains(event.target as Node)) {
    isCategoryDropdownOpen.value = false
  }
  if (rateUnitDropdownRef.value && !rateUnitDropdownRef.value.contains(event.target as Node)) {
    isRateUnitDropdownOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside)
})

// Form State
const itemName = ref("")
const category = ref("")
const description = ref("")

// Pill-based state
const whatThisItemOffers = ref<string[]>([])
const offersInput = ref("")
const whatsIncluded = ref<string[]>([])
const includedInput = ref("")

const knownIssues = ref("")

// Pill Logic Helpers
const addOffer = () => {
  const items = offersInput.value.split(",").map(i => i.trim()).filter(Boolean)
  items.forEach(item => {
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
  const items = includedInput.value.split(",").map(i => i.trim()).filter(Boolean)
  items.forEach(item => {
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

const listingType = ref<"Borrow" | "Rent" | null>(null)
const rateAmount = ref("")
const rateUnit = ref("")
const replacementCost = ref("")

// Dropdown State
const isCategoryDropdownOpen = ref(false)
const isRateUnitDropdownOpen = ref(false)

const toggleCategoryDropdown = () => {
  isCategoryDropdownOpen.value = !isCategoryDropdownOpen.value
  isRateUnitDropdownOpen.value = false
}

const toggleRateUnitDropdown = () => {
  isRateUnitDropdownOpen.value = !isRateUnitDropdownOpen.value
  isCategoryDropdownOpen.value = false
}

const selectCategory = (cat: string) => {
  category.value = cat
  isCategoryDropdownOpen.value = false
}

const selectRateUnit = (unit: string) => {
  rateUnit.value = unit
  isRateUnitDropdownOpen.value = false
}

const availableFromDate = ref("")
const availableFromTime = ref("")
const availableUntilDate = ref("")
const availableUntilTime = ref("")

// Availability Validation Logic
watch(availableFromDate, (newDateFrom) => {
  if (newDateFrom && availableUntilDate.value && newDateFrom > availableUntilDate.value) {
    availableUntilDate.value = ""
  }
})

watch([availableFromTime, availableFromDate, availableUntilDate], ([newTimeFrom, newDateFrom, newDateTo]) => {
  if (newDateFrom === newDateTo && newTimeFrom && availableUntilTime.value && newTimeFrom >= availableUntilTime.value) {
    availableUntilTime.value = ""
  }
})

watch(listingType, (newType) => {
  if (newType === "Borrow") {
    rateAmount.value = "0.00"
    rateUnit.value = "Per Day"
  }
})

const tagInput = ref("")
const tags = ref<string[]>([])
const suggestedTags = ref(["Student-friendly", "Brand new", "Deposit required", "ID required", "Popular"])
const focusedField = ref<"itemName" | "rateAmount" | "replacementCost" | null>(null)

// Modal State
const showCancelModal = ref(false)

// Validation State
const showErrors = ref(false)
const formErrors = computed(() => {
  const errors: Record<string, string> = {}
  
  if (!coverImage.value) errors.coverImage = "Please upload a cover image"
  if (!itemName.value.trim()) errors.itemName = "Item name is required"
  if (!category.value) errors.category = "Please select a category"
  if (!description.value.trim()) errors.description = "Description is required"
  if (whatThisItemOffers.value.length === 0) errors.whatThisItemOffers = "Please add at least one feature"
  if (whatsIncluded.value.length === 0) errors.whatsIncluded = "Please add at least one included item"
  
  if (!listingType.value) {
    errors.listingType = "Please select a listing type"
  } else if (listingType.value === "Rent") {
    if (!rateAmount.value.trim()) errors.rateAmount = "Rate amount is required for rent"
    if (!rateUnit.value) errors.rateUnit = "Rate unit is required for rent"
  }
  
  if (!availableFromDate.value) errors.availableFromDate = "Start date is required"
  if (!availableFromTime.value) errors.availableFromTime = "Start time is required"
  
  return errors
})

const isFormValid = computed(() => Object.keys(formErrors.value).length === 0)

// Image State
interface ImageItem {
  url: string
  name: string
}

const coverImage = ref<ImageItem | null>(null)
const galleryImages = ref<ImageItem[]>([])
const coverInput = ref<HTMLInputElement | null>(null)
const galleryInput = ref<HTMLInputElement | null>(null)

const triggerCoverUpload = () => coverInput.value?.click()
const triggerGalleryUpload = () => galleryInput.value?.click()

const handleCoverSelect = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    if (coverImage.value) URL.revokeObjectURL(coverImage.value.url)
    coverImage.value = {
      url: URL.createObjectURL(file),
      name: file.name,
    }
  }
}

const handleGallerySelect = (event: Event) => {
  const files = (event.target as HTMLInputElement).files
  if (files) {
    const remainingSlots = 10 - galleryImages.value.length
    const filesToProcess = Array.from(files).slice(0, remainingSlots)

    filesToProcess.forEach((file) => {
      galleryImages.value.push({
        url: URL.createObjectURL(file),
        name: file.name,
      })
    })
  }
  if (galleryInput.value) galleryInput.value.value = ""
}

const removeCover = () => {
  if (coverImage.value) URL.revokeObjectURL(coverImage.value.url)
  coverImage.value = null
}

const removeGalleryImage = (index: number) => {
  const [removed] = galleryImages.value.splice(index, 1)
  if (removed) URL.revokeObjectURL(removed.url)
}

// Drag and Drop Logic
const draggedIndex = ref<number | null>(null)

const onDragStart = (index: number) => {
  draggedIndex.value = index
}

const onDragOver = (event: DragEvent) => {
  event.preventDefault()
}

const onDrop = (targetIndex: number) => {
  if (draggedIndex.value === null || draggedIndex.value === targetIndex) return

  const itemToMove = galleryImages.value[draggedIndex.value]
  if (!itemToMove) return

  galleryImages.value.splice(draggedIndex.value, 1)
  galleryImages.value.splice(targetIndex, 0, itemToMove)
  draggedIndex.value = null
}

// Lightbox State
const lightboxImage = ref<ImageItem | null>(null)
const openLightbox = (img: ImageItem) => {
  lightboxImage.value = img
}
const closeLightbox = () => {
  lightboxImage.value = null
}

const categories = [
  "Electronics",
  "Books",
  "Clothing",
  "Tools",
  "Home Appliances",
  "Sports & Outdoors",
  "Music & Audio",
  "Toys & Games",
  "Furniture",
  "Vehicles & Accessories",
  "Health & Beauty",
  "School Supplies",
  "Pet Supplies",
  "Other",
]

// Tag Logic
const addTag = () => {
  const newTags = tagInput.value.split(",").map(t => t.trim()).filter(Boolean)
  newTags.forEach(tag => {
    if (!tags.value.includes(tag)) {
      tags.value.push(tag)
      suggestedTags.value = suggestedTags.value.filter((t) => t !== tag)
    }
  })
  tagInput.value = ""
}

const handleTagInput = () => {
  if (tagInput.value.includes(",")) {
    addTag()
  }
}

const removeTag = (tag: string) => {
  tags.value = tags.value.filter((t) => t !== tag)
  const originalSuggestions = [
    "Student-friendly",
    "Brand new",
    "Deposit required",
    "ID required",
    "Popular",
  ]
  if (originalSuggestions.includes(tag) && !suggestedTags.value.includes(tag)) {
    suggestedTags.value.push(tag)
  }
}

const addSuggestedTag = (tag: string) => {
  if (!tags.value.includes(tag)) {
    tags.value.push(tag)
    suggestedTags.value = suggestedTags.value.filter((t) => t !== tag)
  }
}

const handleCancel = () => {
  showCancelModal.value = true
}

const confirmCancel = () => {
  showCancelModal.value = false
  router.back()
}

const handlePublish = () => {
  if (!isFormValid.value) {
    showErrors.value = true
    // Scroll to the first error
    nextTick(() => {
      const firstError = document.querySelector(".text-cinnabar-red")
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    })
    return
  }

  // Create mock listing object
  const newListing = {
    id: `mock-${Date.now()}`,
    type: listingType.value,
    status: "ACTIVE",
    image: coverImage.value?.url || "/images/popular/camera.jpg",
    category: category.value,
    name: itemName.value,
    rating: 0,
    reviews: 0,
    price: listingType.value === "Rent" ? parseFloat(rateAmount.value.replace(/,/g, "")) : undefined,
    requestCount: 0,
    createdAt: new Date().toISOString()
  }

  // Store in localStorage
  if (typeof localStorage !== 'undefined') {
    const existingMockListings = JSON.parse(localStorage.getItem("mockMyListings") || "[]")
    localStorage.setItem("mockMyListings", JSON.stringify([newListing, ...existingMockListings]))
  }

  // Navigate back to account page (it will handle tab=my-listings by default now)
  router.push("/account?tab=my-listings")
}

const setFocusedField = (field: "itemName" | "rateAmount" | "replacementCost") => {
  focusedField.value = field
}

const formatMoney = (value: string) => {
  if (!value || value === "0") return value === "0" ? "0.00" : ""
  // Remove commas to parse correctly
  const cleanValue = value.replace(/,/g, "")
  const num = parseFloat(cleanValue)
  if (isNaN(num)) return ""
  
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

const handleRateInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  // Allow only numbers, commas, and periods
  const sanitized = input.value.replace(/[^0-9,.]/g, "")
  rateAmount.value = sanitized
}

const handleReplacementCostInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  // Allow only numbers, commas, and periods
  const sanitized = input.value.replace(/[^0-9,.]/g, "")
  replacementCost.value = sanitized
}

const blurInput = (event: Event) => {
  const field = focusedField.value
  focusedField.value = null
  
  if (field === "rateAmount") {
    rateAmount.value = formatMoney(rateAmount.value)
  } else if (field === "replacementCost") {
    replacementCost.value = formatMoney(replacementCost.value)
  }
  
  ;(event.target as HTMLElement).blur()
}
</script>

<template>
  <div class="mx-auto w-full max-w-4xl">
    <!-- Back Button -->
    <NuxtLink
      to="/account?tab=my-listings"
      class="inline-flex items-center gap-2 bg-transparent py-2 font-geist text-sm transition-colors hover:text-burning-orange"
    >
      <span aria-hidden="true">←</span>
      <span>Back to My Listings</span>
    </NuxtLink>

    <!-- Header -->
    <div class="mt-10">
      <h1 class="text-[34px] font-bold tracking-tight text-noble-black sm:text-[40px]">
        Add New Item
      </h1>
      <p class="mt-2 text-[16px] leading-relaxed text-noble-black/55 sm:text-[18px]">
        List an item for borrow or rent
      </p>
    </div>

    <!-- Form Sections -->
    <div class="mt-12 flex flex-col gap-8">
      <!-- Section 1: Images -->
      <section 
        class="border-dashed-section-lg rounded-[24px] bg-cream p-8 transition-all duration-300"
        :class="{ 'ring-2 ring-cinnabar-red/20 border-cinnabar-red/30': showErrors && formErrors.coverImage }"
      >
        <h2 class="text-[20px] font-bold text-noble-black">Images</h2>
        <p class="mt-1 text-[14px] text-noble-black/50">
          Upload photos of your item. Our AI will analyze them and auto-fill the details for you to
          review.
        </p>
        <p v-if="showErrors && formErrors.coverImage" class="mt-2 text-[13px] font-medium text-cinnabar-red">
          {{ formErrors.coverImage }}
        </p>

        <div class="mt-8 flex flex-wrap gap-4">
          <!-- Hidden Inputs -->
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
            :key="img.url"
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

          <!-- Add Images Slot -->
          <div
            v-if="galleryImages.length < 10"
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
              Add Images ({{ galleryImages.length }}/10)
            </span>
          </div>
        </div>
        <p class="mt-4 text-[12px] text-noble-black/30">Drag to reorder</p>
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
            <label class="text-[14px] font-semibold text-noble-black">
              Item Name <span class="text-cinnabar-red">*</span>
            </label>
            <div class="relative">
              <input
                v-model="itemName"
                type="text"
                placeholder="e.g., Canon EOS R5 Camera with Lens Kit"
                class="h-12 w-full rounded-[14px] border bg-white pl-4 pr-10 text-[14px] outline-none transition-all placeholder:text-noble-black/40 focus:border-burning-orange/50 focus:ring-1 focus:ring-burning-orange/20"
                :class="showErrors && formErrors.itemName ? 'border-cinnabar-red/50 ring-1 ring-cinnabar-red/10' : 'border-cinnamon-ice/30'"
                @focus="setFocusedField('itemName')"
                @blur="blurInput"
                @keydown.enter.prevent="blurInput"
              />
              <button
                v-if="itemName && focusedField === 'itemName'"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-noble-black/30 hover:text-noble-black transition-colors"
                @click="itemName = ''"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p v-if="showErrors && formErrors.itemName" class="text-[12px] font-medium text-cinnabar-red">{{ formErrors.itemName }}</p>
          </div>

          <!-- Category -->
          <div class="flex flex-col gap-2">
            <label class="text-[14px] font-semibold text-noble-black">
              Category <span class="text-cinnabar-red">*</span>
            </label>
            <div ref="categoryDropdownRef" class="relative">
              <div
                class="flex h-12 w-full cursor-pointer items-center justify-between rounded-[14px] border bg-white px-4 transition-all hover:border-burning-orange/40"
                :class="[
                  isCategoryDropdownOpen ? 'border-burning-orange/50 ring-1 ring-burning-orange/20' : '',
                  showErrors && formErrors.category ? 'border-cinnabar-red/50 ring-1 ring-cinnabar-red/10' : 'border-cinnamon-ice/30'
                ]"
                @click="toggleCategoryDropdown"
              >
                <span
                  class="text-[14px] transition-colors"
                  :class="category ? 'text-noble-black font-normal' : 'text-noble-black/40'"
                >
                  {{ category || 'Select Category' }}
                </span>
                <div class="text-noble-black/30 transition-transform duration-300" :class="{ 'rotate-180': isCategoryDropdownOpen }">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </div>
              </div>

              <transition
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="transform -translate-y-2 opacity-0"
                enter-to-class="transform translate-y-0 opacity-100"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="transform translate-y-0 opacity-100"
                leave-to-class="transform -translate-y-2 opacity-0"
              >
                <div
                  v-if="isCategoryDropdownOpen"
                  class="absolute z-50 mt-2 w-full overflow-hidden rounded-[18px] border border-cinnamon-ice/30 bg-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)]"
                >
                  <div class="max-h-[280px] overflow-y-auto py-2 custom-scrollbar">
                    <button
                      v-for="cat in categories"
                      :key="cat"
                      class="flex w-full items-center px-4 py-2.5 text-left text-[14px] transition-colors"
                      :class="category === cat ? 'bg-burning-orange text-white font-bold' : 'text-noble-black/80 hover:bg-cream hover:text-burning-orange'"
                      @click="selectCategory(cat)"
                    >
                      {{ cat }}
                    </button>
                  </div>
                </div>
              </transition>
            </div>
            <p v-if="showErrors && formErrors.category" class="text-[12px] font-medium text-cinnabar-red">{{ formErrors.category }}</p>
          </div>
          <!-- Description -->
          <div class="flex flex-col gap-2">
            <label class="text-[14px] font-semibold text-noble-black">
              Description <span class="text-cinnabar-red">*</span>
            </label>
            <div class="relative">
              <textarea
                v-model="description"
                placeholder="Describe your item in detail."
                class="min-h-[120px] w-full resize-y rounded-[14px] border bg-white p-4 pr-10 text-[14px] outline-none transition-all placeholder:text-noble-black/40 focus:border-burning-orange/50 focus:ring-1 focus:ring-burning-orange/20"
                :class="showErrors && formErrors.description ? 'border-cinnabar-red/50 ring-1 ring-cinnabar-red/10' : 'border-cinnamon-ice/30'"
              ></textarea>
              <button
                v-if="description"
                class="absolute right-3 top-4 text-noble-black/30 hover:text-noble-black transition-colors"
                @click="description = ''"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p v-if="showErrors && formErrors.description" class="text-[12px] font-medium text-cinnabar-red">{{ formErrors.description }}</p>
            <p v-else class="text-[12px] text-noble-black/30">
              Include details like brand, model, condition, and any unique features
            </p>
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
            <!-- What This Item Offers -->
            <div class="flex flex-col gap-2">
              <label class="text-[14px] font-semibold text-noble-black">
                What This Item Offers <span class="text-cinnabar-red">*</span>
              </label>
              <div
                class="flex min-h-[56px] w-full flex-wrap gap-2 rounded-[14px] border bg-white p-2.5 transition-all focus-within:border-burning-orange/50 focus-within:ring-1 focus-within:ring-burning-orange/20"
                :class="showErrors && formErrors.whatThisItemOffers ? 'border-cinnabar-red/50 ring-1 ring-cinnabar-red/10' : 'border-cinnamon-ice/30'"
              >
                <div
                  v-for="(offer, index) in whatThisItemOffers"
                  :key="`${offer}-${index}`"
                  class="group flex items-center gap-1.5 rounded-full bg-cream px-3 py-1 text-[13px] font-medium text-noble-black transition-colors hover:bg-cinnamon-ice/20"
                >
                  <span>{{ offer }}</span>
                  <button
                    class="flex h-4 w-4 items-center justify-center rounded-full text-noble-black/40 transition-all hover:bg-cinnabar-red hover:text-white"
                    @click="removeOffer(index)"
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                    >
                      <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                </div>

                <input
                  v-model="offersInput"
                  type="text"
                  :placeholder="whatThisItemOffers.length > 0 ? '' : 'e.g., 33MP Full-Frame Sensor, 4K 60p Video Recording'"
                  class="min-w-[220px] flex-1 bg-transparent px-1.5 text-[14px] outline-none placeholder:text-noble-black/40"
                  @input="handleOfferInput"
                  @keydown.enter.prevent="blurInput"
                  @blur="addOffer"
                />
              </div>
              <p v-if="showErrors && formErrors.whatThisItemOffers" class="text-[12px] font-medium text-cinnabar-red">{{ formErrors.whatThisItemOffers }}</p>
              <p v-else class="text-[12px] text-noble-black/30">Separate features with commas</p>
            </div>

            <!-- What's Included -->
            <div class="flex flex-col gap-2">
              <label class="text-[14px] font-semibold text-noble-black">
                What's Included <span class="text-cinnabar-red">*</span>
              </label>
              <div
                class="flex min-h-[56px] w-full flex-wrap gap-2 rounded-[14px] border bg-white p-2.5 transition-all focus-within:border-burning-orange/50 focus-within:ring-1 focus-within:ring-burning-orange/20"
                :class="showErrors && formErrors.whatsIncluded ? 'border-cinnabar-red/50 ring-1 ring-cinnabar-red/10' : 'border-cinnamon-ice/30'"
              >
                <div
                  v-for="(included, index) in whatsIncluded"
                  :key="`${included}-${index}`"
                  class="group flex items-center gap-1.5 rounded-full bg-cream px-3 py-1 text-[13px] font-medium text-noble-black transition-colors hover:bg-cinnamon-ice/20"
                >
                  <span>{{ included }}</span>
                  <button
                    class="flex h-4 w-4 items-center justify-center rounded-full text-noble-black/40 transition-all hover:bg-cinnabar-red hover:text-white"
                    @click="removeIncluded(index)"
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                    >
                      <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                </div>

                <input
                  v-model="includedInput"
                  type="text"
                  :placeholder="whatsIncluded.length > 0 ? '' : 'e.g., Battery Charger, Camera Strap'"
                  class="min-w-[220px] flex-1 bg-transparent px-1.5 text-[14px] outline-none placeholder:text-noble-black/40"
                  @input="handleIncludedInput"
                  @keydown.enter.prevent="blurInput"
                  @blur="addIncluded"
                />
              </div>
              <p v-if="showErrors && formErrors.whatsIncluded" class="text-[12px] font-medium text-cinnabar-red">{{ formErrors.whatsIncluded }}</p>
              <p v-else class="text-[12px] text-noble-black/30">Separate items with commas</p>
            </div>
          <!-- Known Issues -->
          <div class="flex flex-col gap-2">
            <label class="text-[14px] font-semibold text-noble-black">
              Known Issues
            </label>
            <div class="relative">
              <textarea
                v-model="knownIssues"
                placeholder="e.g., Minor scratch on body, battery drains faster than normal..."
                class="min-h-[100px] w-full rounded-[14px] border border-cinnamon-ice/30 bg-white p-4 pr-10 text-[14px] outline-none transition-all placeholder:text-noble-black/40 focus:border-burning-orange/50 focus:ring-1 focus:ring-burning-orange/20"
              ></textarea>
              <button
                v-if="knownIssues"
                class="absolute right-3 top-4 text-noble-black/30 hover:text-noble-black transition-colors"
                @click="knownIssues = ''"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p class="text-[12px] text-noble-black/30">
              Being transparent about issues builds trust and prevents disputes
            </p>
          </div>
        </div>
        </section>

        <!-- Section 4: Pricing -->
        <section class="rounded-[24px] border border-cinnamon-ice bg-cream p-8">
        <h2 class="text-[20px] font-bold text-noble-black">Pricing</h2>
        <p class="mt-1 text-[14px] text-noble-black/50">Set your rental rate or sale price</p>

        <div class="mt-8 flex flex-col gap-8">
          <!-- Listing Type -->
          <div class="flex flex-col gap-4">
            <label class="text-[14px] font-semibold text-noble-black">
              Listing Type <span class="text-cinnabar-red">*</span>
            </label>
            <div class="flex items-center gap-8">
              <label class="flex cursor-pointer items-center gap-2">
                <div class="relative flex items-center justify-center">
                  <input
                    v-model="listingType"
                    type="radio"
                    value="Borrow"
                    class="peer h-5 w-5 appearance-none rounded-full border border-cinnamon-ice/60 bg-white transition-all checked:border-burning-orange"
                    :class="showErrors && formErrors.listingType ? 'border-cinnabar-red/50 ring-1 ring-cinnabar-red/10' : ''"
                  />
                  <div
                    class="absolute h-2.5 w-2.5 scale-0 rounded-full bg-burning-orange transition-transform peer-checked:scale-100"
                  ></div>
                </div>
                <span class="text-[14px] font-medium text-noble-black/70">For Borrow</span>
              </label>
              <label class="flex cursor-pointer items-center gap-2">
                <div class="relative flex items-center justify-center">
                  <input
                    v-model="listingType"
                    type="radio"
                    value="Rent"
                    class="peer h-5 w-5 appearance-none rounded-full border border-cinnamon-ice/60 bg-white transition-all checked:border-burning-orange"
                    :class="showErrors && formErrors.listingType ? 'border-cinnabar-red/50 ring-1 ring-cinnabar-red/10' : ''"
                  />
                  <div
                    class="absolute h-2.5 w-2.5 scale-0 rounded-full bg-burning-orange transition-transform peer-checked:scale-100"
                  ></div>
                </div>
                <span class="text-[14px] font-medium text-noble-black/70">For Rent</span>
              </label>
            </div>
            <p v-if="showErrors && formErrors.listingType" class="text-[12px] font-medium text-cinnabar-red">{{ formErrors.listingType }}</p>
          </div>

          <!-- Rate -->
          <div class="flex flex-col gap-2">
            <label class="text-[14px] font-semibold text-noble-black">
              Rate <span class="text-cinnabar-red">*</span>
            </label>
            <div class="flex items-center gap-3">
              <div class="relative flex-1">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-medium text-noble-black/60">₱</span>
                <input
                  v-model="rateAmount"
                  type="text"
                  placeholder="0.00"
                  class="h-12 w-full rounded-[14px] border bg-white pl-8 pr-10 text-[14px] outline-none transition-all placeholder:text-noble-black/40 focus:border-burning-orange/50 focus:ring-1 focus:ring-burning-orange/20"
                  :class="showErrors && formErrors.rateAmount ? 'border-cinnabar-red/50 ring-1 ring-cinnabar-red/10' : 'border-cinnamon-ice/30'"
                  :disabled="listingType === 'Borrow'"
                  @focus="setFocusedField('rateAmount')"
                  @input="handleRateInput"
                  @blur="blurInput"
                  @keydown.enter.prevent="blurInput"
                />
                <button
                  v-if="rateAmount && focusedField === 'rateAmount'"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-noble-black/30 hover:text-noble-black transition-colors"
                  :class="{ 'hidden': listingType === 'Borrow' }"
                  @click="rateAmount = ''"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div ref="rateUnitDropdownRef" class="relative w-40">
                  <div
                    class="flex h-12 w-full cursor-pointer items-center justify-between rounded-[14px] border bg-white px-4 transition-all hover:border-burning-orange/40"
                    :class="[
                      isRateUnitDropdownOpen ? 'border-burning-orange/50 ring-1 ring-burning-orange/20' : '',
                      showErrors && formErrors.rateUnit ? 'border-cinnabar-red/50 ring-1 ring-cinnabar-red/10' : 'border-cinnamon-ice/30',
                      listingType === 'Borrow' ? 'opacity-50 cursor-not-allowed grayscale-[0.5]' : ''
                    ]"
                    @click="listingType !== 'Borrow' && toggleRateUnitDropdown()"
                  >
                    <span
                      class="text-[14px] transition-colors"
                      :class="rateUnit ? 'text-noble-black font-normal' : 'text-noble-black/40'"
                    >
                      {{ rateUnit || 'Per' }}
                    </span>
                    <div class="text-noble-black/30 transition-transform duration-300" :class="{ 'rotate-180': isRateUnitDropdownOpen }">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </div>
                </div>

                <transition
                  enter-active-class="transition duration-200 ease-out"
                  enter-from-class="transform -translate-y-2 opacity-0"
                  enter-to-class="transform translate-y-0 opacity-100"
                  leave-active-class="transition duration-150 ease-in"
                  leave-from-class="transform translate-y-0 opacity-100"
                  leave-to-class="transform -translate-y-2 opacity-0"
                >
                  <div
                    v-if="isRateUnitDropdownOpen"
                    class="absolute z-50 mt-2 w-full overflow-hidden rounded-[18px] border border-cinnamon-ice/30 bg-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)]"
                  >
                    <div class="py-2">
                      <button
                        v-for="unit in ['Per Day', 'Per Hour']"
                        :key="unit"
                        class="flex w-full items-center px-4 py-2.5 text-left text-[14px] transition-colors"
                        :class="rateUnit === unit ? 'bg-burning-orange text-white font-bold' : 'text-noble-black/80 hover:bg-cream hover:text-burning-orange'"
                        @click="selectRateUnit(unit)"
                      >
                        {{ unit }}
                      </button>
                    </div>
                  </div>
                </transition>
              </div>            </div>
            <p v-if="showErrors && (formErrors.rateAmount || formErrors.rateUnit)" class="text-[12px] font-medium text-cinnabar-red">
              {{ formErrors.rateAmount || formErrors.rateUnit }}
            </p>
          </div>

          <!-- Replacement Cost -->
          <div class="flex flex-col gap-2">
            <label class="text-[14px] font-semibold text-noble-black">
              Replacement Cost
            </label>
            <div class="relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-medium text-noble-black/60">₱</span>
              <input
                v-model="replacementCost"
                type="text"
                placeholder="0.00"
                class="h-12 w-full rounded-[14px] border bg-white pl-8 pr-10 text-[14px] outline-none transition-all placeholder:text-noble-black/40 focus:border-burning-orange/50 focus:ring-1 focus:ring-burning-orange/20"
                :class="showErrors && formErrors.replacementCost ? 'border-cinnabar-red/50 ring-1 ring-cinnabar-red/10' : 'border-cinnamon-ice/30'"
                @focus="setFocusedField('replacementCost')"
                @input="handleReplacementCostInput"
                @blur="blurInput"
                @keydown.enter.prevent="blurInput"
              />
              <button
                v-if="replacementCost && focusedField === 'replacementCost'"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-noble-black/30 hover:text-noble-black transition-colors"
                @click="replacementCost = ''"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p class="text-[12px] text-noble-black/30">
              This helps determine deposit amount and liability in case of damage
            </p>
          </div>
        </div>
        </section>
      <!-- Section 5: Availability -->
      <section class="rounded-[24px] border border-cinnamon-ice bg-cream p-8">
        <h2 class="text-[20px] font-bold text-noble-black">Availability</h2>
        <p class="mt-1 text-[14px] text-noble-black/50">Set when your item is available</p>

        <div class="mt-8 flex flex-col gap-6">
          <!-- Available From -->
          <div class="flex flex-col gap-2">
            <label class="text-[14px] font-semibold text-noble-black">
              Available From <span class="text-cinnabar-red">*</span>
            </label>
            <div class="flex flex-wrap items-center gap-3">
              <CustomCalendar
                v-model="availableFromDate"
                placeholder="Select date"
                disable-past
                class="w-full sm:flex-1"
                :class="{ 'ring-1 ring-cinnabar-red/50 rounded-[10px]': showErrors && formErrors.availableFromDate }"
              />
              <CustomTimePicker
                v-model="availableFromTime"
                placeholder="Select time"
                class="w-full sm:w-48"
                :class="{ 'ring-1 ring-cinnabar-red/50 rounded-[10px]': showErrors && formErrors.availableFromTime }"
              />
            </div>
            <p v-if="showErrors && (formErrors.availableFromDate || formErrors.availableFromTime)" class="text-[12px] font-medium text-cinnabar-red">
              {{ formErrors.availableFromDate || formErrors.availableFromTime }}
            </p>
          </div>

          <!-- Available Until -->
          <div class="flex flex-col gap-2">
            <label class="text-[14px] font-semibold text-noble-black">
              Available Until
            </label>
            <div class="flex flex-wrap items-center gap-3">
              <CustomCalendar
                v-model="availableUntilDate"
                placeholder="Select date"
                disable-past
                :min-date="availableFromDate"
                class="w-full sm:flex-1"
              />
              <CustomTimePicker
                v-model="availableUntilTime"
                placeholder="Select time"
                :min-time="availableFromDate === availableUntilDate ? availableFromTime : ''"
                strict-min
                class="w-full sm:w-48"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- Section 6: Tags -->
      <section class="rounded-[24px] border border-cinnamon-ice bg-cream p-8">
        <h2 class="text-[20px] font-bold text-noble-black">Tags</h2>
        <p class="mt-1 text-[14px] text-noble-black/50">Add tags to help others find your item</p>

        <div class="mt-8">
          <div
            class="flex min-h-[56px] w-full flex-wrap gap-2 rounded-[14px] border border-cinnamon-ice/30 bg-white p-2.5 transition-all focus-within:border-burning-orange/50 focus-within:ring-1 focus-within:ring-burning-orange/20"
          >
            <div
              v-for="tag in tags"
              :key="tag"
              class="group flex items-center gap-1.5 rounded-full bg-cream px-3 py-1 text-[13px] font-medium text-noble-black transition-colors hover:bg-cinnamon-ice/20"
            >
              <span>{{ tag }}</span>
              <button
                class="flex h-4 w-4 items-center justify-center rounded-full text-noble-black/40 transition-all hover:bg-cinnabar-red hover:text-white"
                @click="removeTag(tag)"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                >
                  <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
            <input
              v-model="tagInput"
              type="text"
              :placeholder="tags.length > 0 ? '' : 'Add a tag'"
              class="min-w-[120px] flex-1 bg-transparent px-1.5 text-[14px] outline-none placeholder:text-noble-black/40"
              @input="handleTagInput"
              @keydown.enter.prevent="blurInput"
              @blur="addTag"
            />
          </div>
          <p class="mt-2 text-[12px] text-noble-black/30">Separate tags with commas</p>

          <div v-if="suggestedTags.length > 0" class="mt-6">
            <p class="text-[13px] font-semibold text-noble-black/40">Suggested Tags:</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <button
                v-for="tag in suggestedTags"
                :key="tag"
                class="rounded-full bg-blue-estate px-4 py-1.5 text-[12px] font-medium text-white shadow-md transition-all hover:bg-blue-estate/90 hover:scale-[1.02] active:scale-95"
                @click="addSuggestedTag(tag)"
              >
                {{ tag }}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Action Buttons -->
    <div class="mt-12 flex items-center justify-end gap-8 pb-20">
      <button
        class="text-[15px] font-semibold text-noble-black transition-colors hover:text-cinnabar-red"
        @click="handleCancel"
      >
        Cancel
      </button>
      <button
        class="rounded-full bg-burning-orange px-10 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-burning-orange/20 transition-all duration-300 ease-in-out hover:scale-[1.02] hover:bg-blue-estate hover:shadow-xl hover:shadow-blue-estate/20 active:scale-95"
        @click="handlePublish"
      >
        Publish Item
      </button>
    </div>

    <!-- Lightbox -->
    <Teleport to="body">
      <div
        v-if="lightboxImage"
        class="fixed inset-0 z-[3000] flex items-center justify-center bg-noble-black/90 backdrop-blur-md p-4 sm:p-10"
        @click="closeLightbox"
      >
        <button
          class="absolute right-6 top-6 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
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
            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <div class="flex w-full max-w-5xl flex-col items-center gap-4" @click.stop>
          <div class="relative overflow-hidden rounded-2xl shadow-2xl">
            <img :src="lightboxImage.url" class="max-h-[80vh] w-auto object-contain" />
          </div>
          <p
            class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[14px] font-medium text-white/70"
          >
            {{ lightboxImage.name }}
          </p>
        </div>
      </div>
    </Teleport>

    <!-- Cancel Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="showCancelModal"
        class="fixed inset-0 z-[2000] flex items-center justify-center p-4 font-geist"
      >
        <div
          class="absolute inset-0 bg-noble-black/40 backdrop-blur-[2px] transition-opacity"
          @click="showCancelModal = false"
        />

        <div class="relative w-full max-w-[360px] overflow-hidden rounded-[28px] bg-white shadow-2xl">
          <div class="flex flex-col items-center px-8 py-10 text-center">
            <div
              class="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-cream shadow-inner"
            >
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                class="text-cinnabar-red"
              >
                <path
                  d="M12 9V14M12 17.01L12.01 16.998M10.29 3.86L1.82 18C1.64531 18.3024 1.55299 18.6452 1.55197 18.9939C1.55095 19.3427 1.6413 19.6858 1.81414 19.9893C1.98698 20.2928 2.23611 20.5463 2.53696 20.7247C2.83781 20.9031 3.18021 20.9999 3.53 21H20.47C20.8198 20.9999 21.1622 20.9031 21.463 20.7247C21.7639 20.5463 22.013 20.2928 22.1859 19.9893C22.3587 19.6858 22.4491 19.3427 22.448 18.9939C22.447 18.6452 22.3547 18.3024 22.18 18L13.71 3.86C13.5317 3.56611 13.2807 3.32319 12.9812 3.15449C12.6817 2.98579 12.3437 2.89746 12 2.89746C11.6563 2.89746 11.3183 2.98579 11.0188 3.15449C10.7193 3.32319 10.4683 3.56611 10.29 3.86Z"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>

            <h3 class="mb-3 text-[22px] font-bold tracking-tight text-noble-black">Discard changes?</h3>
            <p class="mb-10 text-[14px] leading-relaxed text-noble-black/40 max-w-[260px]">
              You have unsaved changes. Are you sure you want to go back?
            </p>

            <div class="flex items-center justify-center gap-3">
              <button
                class="h-10 rounded-xl border border-cinnamon-ice/30 px-6 text-[14px] font-semibold text-noble-black/60 transition-all hover:bg-pale-cashmere hover:text-noble-black"
                @click="showCancelModal = false"
              >
                No, Stay
              </button>
              <button
                class="h-10 rounded-xl bg-cinnabar-red px-6 text-[14px] font-semibold text-white shadow-sm transition-all hover:bg-noble-black hover:shadow-md"
                @click="confirmCancel"
              >
                Yes, Discard
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
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

::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: theme("colors.cinnamon-ice / 40%");
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: theme("colors.cinnamon-ice / 60%");
}

textarea::-webkit-resizer {
  background-image: url("data:image/svg+xml,%3csvg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M14 14L14 10M14 14L10 14M14 14L6 6' stroke='%23dbbba7' stroke-width='1.5' stroke-linecap='round'/%3e%3cpath d='M14 6L14 2M14 6L10 6' stroke='%23dbbba7' stroke-width='1.5' stroke-linecap='round' opacity='0.4'/%3e%3cpath d='M6 14L2 14M6 14L6 10' stroke='%23dbbba7' stroke-width='1.5' stroke-linecap='round' opacity='0.4'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: bottom right;
}
</style>
