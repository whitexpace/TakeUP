<template>
  <div
    ref="containerRef"
    class="bg-cream rounded-[24px] border border-cinnamon-ice/30 p-6 flex flex-col gap-4 transition-all duration-500"
    :class="{
      'ring-4 ring-burning-orange/10 border-burning-orange/40 scale-[1.01] shadow-lg':
        isHighlighted,
    }"
  >
    <div class="flex gap-4">
      <!-- User Avatar -->
      <UserAvatar :avatar-url="userAvatar" :user-name="userName" size="lg" />

      <div class="flex-1 flex flex-col gap-3">
        <!-- Selected Flair -->
        <transition name="fade">
          <div
            v-if="selectedFlair"
            class="group mb-1 flex items-center gap-1.5 rounded-full bg-blue-estate px-3 py-1 text-white w-fit"
          >
            <span class="text-[10px] font-bold uppercase tracking-wider">{{ selectedFlair }}</span>
            <button
              class="text-white/70 transition-colors hover:text-white"
              @click="selectedFlair = ''"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </transition>

        <!-- Title Input -->
        <input
          ref="titleInputRef"
          v-model="postTitle"
          type="text"
          placeholder="What are you looking for?"
          class="w-full bg-white/50 border border-transparent focus:border-cinnamon-ice focus:bg-white rounded-[14px] focus:ring-4 focus:ring-cinnamon-ice/5 text-[18px] font-semibold text-noble-black placeholder:text-noble-black/30 px-4 py-3 transition-all duration-300 outline-none"
        />

        <!-- Description Textarea -->
        <textarea
          ref="textareaRef"
          v-model="postDescription"
          placeholder="Description"
          class="w-full bg-white/50 border border-transparent focus:border-cinnamon-ice focus:bg-white rounded-[14px] focus:ring-4 focus:ring-cinnamon-ice/5 text-[15px] text-noble-black placeholder:text-noble-black/30 resize-none min-h-[100px] px-4 py-3 transition-all duration-300 outline-none"
        ></textarea>
      </div>
    </div>

    <!-- Subtle Divider -->
    <div class="h-[1px] w-full bg-cinnamon-ice/20"></div>

    <div class="flex items-center justify-between">
      <!-- Suggested Flairs -->
      <div class="flex flex-wrap gap-2">
        <button
          v-for="tag in suggestedTags"
          :key="tag"
          class="px-4 py-1.5 rounded-full bg-white/50 border border-cinnamon-ice/20 text-[13px] font-medium text-noble-black/50 hover:border-cinnamon-ice/50 hover:text-noble-black transition-all"
          :class="{ hidden: selectedFlair === tag }"
          @click="selectedFlair = tag"
        >
          {{ tag }}
        </button>
      </div>

      <!-- Post Button -->
      <button
        class="px-8 py-2.5 bg-burning-orange text-white rounded-full font-bold text-[15px] hover:bg-blue-estate transition-all shadow-md active:scale-95 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
        :disabled="!postTitle.trim()"
        @click="handlePost"
      >
        Post
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"

defineProps<{
  userAvatar?: string | null
  userName: string
}>()

const postTitle = ref("")
const postDescription = ref("")
const selectedFlair = ref("")
const suggestedTags = ["Electronics", "Books & Academics", "Arts & Crafts", "Sports"]

const containerRef = ref<HTMLElement | null>(null)
const titleInputRef = ref<HTMLInputElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isHighlighted = ref(false)

const triggerHighlight = () => {
  isHighlighted.value = true
  containerRef.value?.scrollIntoView({ behavior: "smooth", block: "center" })
  setTimeout(() => {
    titleInputRef.value?.focus()
  }, 600)
  setTimeout(() => {
    isHighlighted.value = false
  }, 2500)
}

defineExpose({ triggerHighlight })

const emit = defineEmits(["post"])

const handlePost = () => {
  if (!postTitle.value.trim()) return
  emit("post", {
    title: postTitle.value,
    description: postDescription.value,
    flair: selectedFlair.value || "General",
  })
  postTitle.value = ""
  postDescription.value = ""
  selectedFlair.value = ""
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
