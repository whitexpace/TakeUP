<template>
  <div
    class="rounded-full overflow-hidden shrink-0 flex items-center justify-center text-white font-bold shadow-sm border border-black/5 relative"
    :class="sizeClass"
    :style="avatarStyle"
  >
    <!-- Base Layer: Initials (Always there as fallback/placeholder) -->
    <span :class="textClass" class="relative z-0 select-none">{{ initials }}</span>

    <!-- Top Layer: Profile Image (Only shows if URL exists and hasn't failed) -->
    <img
      v-if="shouldShowImage"
      :key="avatarSrc"
      :src="avatarSrc"
      :alt="userName"
      class="absolute inset-0 w-full h-full object-cover z-10"
      referrerpolicy="no-referrer"
      loading="eager"
      decoding="async"
      @load="handleImageLoad"
      @error="handleImageError"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"

const props = withDefaults(
  defineProps<{
    avatarUrl?: string | null
    userName: string
    size?: "sm" | "md" | "lg"
  }>(),
  {
    avatarUrl: null,
    size: "md",
  },
)

const MAX_IMAGE_RETRY_COUNT = 3
const IMAGE_RETRY_DELAY_MS = 600

const imageFailed = ref(false)
const imageRetryCount = ref(0)
const imageRetryNonce = ref(0)
let imageRetryTimer: ReturnType<typeof setTimeout> | null = null

const clearImageRetryTimer = () => {
  if (imageRetryTimer) {
    clearTimeout(imageRetryTimer)
    imageRetryTimer = null
  }
}

const withRetryNonce = (src: string, nonce: number) => {
  if (nonce === 0 || src.startsWith("data:") || src.startsWith("blob:")) {
    return src
  }

  try {
    const isAbsoluteHttpUrl = /^https?:\/\//i.test(src)
    const url = new URL(src, "http://takeup.local")
    url.searchParams.set("takeup_avatar_retry", String(nonce))

    return isAbsoluteHttpUrl ? url.toString() : `${url.pathname}${url.search}${url.hash}`
  } catch {
    return src
  }
}

const avatarSrc = computed(() => {
  if (!props.avatarUrl) return undefined
  return withRetryNonce(props.avatarUrl, imageRetryNonce.value)
})

const shouldShowImage = computed(() => Boolean(avatarSrc.value) && !imageFailed.value)

// Reset error state if URL changes
watch(
  () => props.avatarUrl,
  () => {
    clearImageRetryTimer()
    imageFailed.value = false
    imageRetryCount.value = 0
    imageRetryNonce.value = 0
  },
  { immediate: true },
)

const handleImageLoad = () => {
  clearImageRetryTimer()
  imageFailed.value = false
}

const handleImageError = () => {
  clearImageRetryTimer()

  if (imageRetryCount.value >= MAX_IMAGE_RETRY_COUNT) {
    imageFailed.value = true
    return
  }

  imageRetryTimer = setTimeout(() => {
    imageRetryCount.value += 1
    imageRetryNonce.value += 1
    imageFailed.value = false
  }, IMAGE_RETRY_DELAY_MS)
}

onBeforeUnmount(clearImageRetryTimer)

const initials = computed(() => {
  const name = props.userName?.trim() || "User"
  const parts = name.split(/\s+/).filter(Boolean)

  if (parts.length === 0) return "U"
  if (parts.length === 1) return parts[0]![0]!.toUpperCase()

  const firstInitial = parts[0]![0]!.toUpperCase()
  const lastInitial = parts[parts.length - 1]![0]!.toUpperCase()

  return `${firstInitial}${lastInitial}`
})

const sizeClass = computed(() => {
  switch (props.size) {
    case "sm":
      return "w-8 h-8"
    case "lg":
      return "w-12 h-12"
    default:
      return "w-10 h-10"
  }
})

const textClass = computed(() => {
  switch (props.size) {
    case "sm":
      return "text-[11px]"
    case "lg":
      return "text-lg"
    default:
      return "text-[14px]"
  }
})

const avatarStyle = computed(() => {
  // Deterministic color based on name
  const colors = ["#dbbba7", "#ff7124", "#3b4883"] // cinnamon-ice, burning-orange, blue-estate
  let hash = 0
  const name = props.userName || "User"
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const color = colors[Math.abs(hash) % colors.length]

  return {
    backgroundColor: color,
  }
})
</script>
