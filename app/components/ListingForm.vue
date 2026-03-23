<script setup lang="ts">
import { reactive, ref, watch } from "vue"
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

const props = defineProps<{
  mode?: "new" | "edit"
  item?: MyListingItem | null
  isSubmitting?: boolean
  submitError?: string | null
}>()

const emit = defineEmits<{
  submit: [data: Record<string, unknown>]
  cancel: []
}>()

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
  thumbnailImage: props.item?.thumbnailImage ?? "",
  photoUrls: props.item?.photos?.join("\n") ?? "",
})

const form = reactive(initForm())
const tagInput = ref("")
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

watch(
  () => props.item,
  (item) => {
    if (!item) return
    Object.assign(form, initForm())
    availabilityRanges.value =
      item.availability?.map((a) => ({
        startDate: new Date(a.startDate),
        endDate: new Date(a.endDate),
        noEndDate: false,
        status: a.status as "AVAILABLE" | "RENTED",
      })) ?? []
  },
)

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

const buildPayload = () => {
  const photos = form.photoUrls
    .split("\n")
    .map((u) => u.trim())
    .filter(Boolean)

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
    thumbnailImage: (photos[0] ?? form.thumbnailImage) || undefined,
    photos,
    availability,
    status: "AVAILABLE",
  }
}

const handleSubmit = () => {
  fieldErrors.value = {}
  availabilityErrors.value = []
  const payload = buildPayload()

  if (!form.name.trim()) {
    fieldErrors.value.name = "Item name is required."
  }
  if (!form.condition) {
    fieldErrors.value.condition = "Condition is required."
  }
  if (form.categories.length === 0) {
    fieldErrors.value.categories = "Select at least one category."
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
</script>

<template>
  <form class="space-y-6" @submit.prevent="handleSubmit">
    <!-- Header -->
    <div>
      <NuxtLink
        to="/account/listings"
        class="inline-flex items-center gap-1 text-neutral-800/70 text-sm font-medium font-geist tracking-wide hover:text-neutral-800 transition-colors mb-4"
      >
        ← Back to My Listings
      </NuxtLink>
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
    <section class="bg-orange-50 rounded-[20px] border border-red-300 p-4 sm:p-6 space-y-4">
      <div>
        <h2 class="text-neutral-800 text-xl font-semibold font-geist">Images</h2>
        <p class="text-neutral-800/80 text-base font-normal font-geist tracking-wide">
          Upload photos of your item. Add image URLs below (one per line, up to 10).
        </p>
        <p class="text-neutral-800/60 text-xs font-geist mt-1">
          Drag to reorder — the first URL becomes the cover image.
        </p>
      </div>
      <div>
        <label class="block text-neutral-400 text-xs font-geist mb-1">
          Add Images ({{ form.photoUrls.split("\n").filter(Boolean).length }}/10)
        </label>
        <textarea
          v-model="form.photoUrls"
          rows="4"
          placeholder="https://example.com/photo1.jpg&#10;https://example.com/photo2.jpg"
          class="w-full bg-white rounded-[5px] border border-red-300/50 px-3 py-2 text-sm font-geist text-neutral-800 placeholder:text-neutral-800/50 focus:outline-none focus:border-orange-500 transition-colors resize-none"
        />
        <!-- Preview -->
        <div
          v-if="form.photoUrls.split('\n').filter(Boolean).length > 0"
          class="flex flex-wrap gap-2 mt-2"
        >
          <div
            v-for="(url, i) in form.photoUrls.split('\n').filter(Boolean).slice(0, 10)"
            :key="i"
            class="relative"
          >
            <img
              :src="url"
              :alt="`Photo ${i + 1}`"
              class="w-16 h-16 object-cover rounded-lg border border-red-300/30"
              @error="($event.target as HTMLImageElement).src = 'https://placehold.co/64x64'"
            />
            <span
              v-if="i === 0"
              class="absolute -bottom-1 left-0 right-0 text-center text-white text-[9px] bg-orange-500 rounded-b-lg"
              >Cover</span
            >
          </div>
        </div>
      </div>
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
          :disabled="isSubmitting"
          class="sm:flex-1 lg:flex-none px-8 py-3 bg-orange-500 text-white rounded-[30px] text-base font-medium font-geist hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{
            isSubmitting
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
          @click="emit('cancel')"
        >
          Cancel
        </button>
      </div>
    </div>
  </form>
</template>
