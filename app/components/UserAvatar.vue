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
      v-if="avatarUrl && !imageError"
      :src="avatarUrl"
      :alt="userName"
      class="absolute inset-0 w-full h-full object-cover z-10"
      @error="handleImageError"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"

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

const imageError = ref(false)

// Reset error state if URL changes
watch(
  () => props.avatarUrl,
  (newVal) => {
    if (newVal) {
      imageError.value = false
    }
  },
  { immediate: true },
)

const handleImageError = () => {
  imageError.value = true
}

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
