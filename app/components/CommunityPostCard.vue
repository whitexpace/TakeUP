<template>
  <div
    class="bg-cream rounded-[24px] border border-cinnamon-ice/30 p-6 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow duration-300"
  >
    <!-- Post Header -->
    <div class="flex items-start justify-between">
      <div class="flex items-center gap-3 flex-1">
        <UserAvatar :avatar-url="request.user.avatar" :user-name="request.user.name" />
        <div class="flex flex-col flex-1">
          <div class="flex items-center justify-between w-full">
            <div class="flex items-center gap-2">
              <span class="text-[15px] font-bold text-noble-black">{{ request.user.name }}</span>
              <span class="text-[12px] text-noble-black/40">{{ request.timeAgo }}</span>
            </div>
            <span
              class="text-[10px] font-bold text-blue-estate tracking-[0.1em] uppercase px-2.5 py-1 bg-blue-estate/5 border border-blue-estate/10 rounded-full"
            >
              {{ request.flair }}
            </span>
          </div>
        </div>
      </div>
      <button class="text-noble-black/20 hover:text-noble-black/40 transition-colors ml-4">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      </button>
    </div>

    <!-- Post Content -->
    <div class="flex flex-col gap-2">
      <h3 class="text-[18px] font-bold text-noble-black leading-tight">{{ request.title }}</h3>
      <p class="text-[15px] text-noble-black/70 leading-relaxed">{{ request.description }}</p>
    </div>

    <!-- Post Actions -->
    <div class="flex items-center gap-6 mt-2 pt-4 border-t border-cinnamon-ice/10">
      <button
        class="flex items-center gap-2 group transition-all duration-300"
        :class="
          isUpvoted
            ? 'text-burning-orange scale-105'
            : 'text-noble-black/40 hover:text-burning-orange'
        "
        @click="toggleUpvote"
      >
        <div class="p-2 rounded-full group-hover:bg-burning-orange/5 transition-colors">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            :class="{ 'fill-burning-orange/10': isUpvoted }"
          >
            <path d="M7 11l5-5 5 5M12 18V6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <span class="text-[13px] font-bold tracking-tight">{{
          request.upvotes + (isUpvoted ? 1 : 0)
        }}</span>
      </button>

      <button
        class="flex items-center gap-2 group transition-all duration-300"
        :class="
          showReplies ? 'text-blue-estate scale-105' : 'text-noble-black/40 hover:text-blue-estate'
        "
        @click="toggleReplies"
      >
        <div class="p-2 rounded-full group-hover:bg-blue-estate/5 transition-colors">
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
            <path
              d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
            />
          </svg>
        </div>
        <span class="text-[13px] font-bold tracking-tight">{{ request.repliesCount }} Replies</span>
      </button>
    </div>

    <!-- Replies Section -->
    <div v-if="showReplies" class="flex flex-col gap-4 mt-2">
      <div class="flex flex-col gap-4 pl-4 border-l border-cinnamon-ice/15">
        <CommunityReplyItem
          v-for="reply in visibleReplies"
          :key="reply.id"
          :reply="reply"
          @reply="(name, id) => focusReplyInput(name, id)"
          @upvote-reply="(id) => $emit('upvote-reply', { postId: request.id, replyId: id })"
        />

        <button
          v-if="hasMoreReplies"
          class="text-[12px] font-bold text-burning-orange hover:text-blue-estate transition-all w-fit ml-11 mt-1 px-3 py-1.5 rounded-lg hover:bg-burning-orange/5"
          @click="loadMoreReplies"
        >
          View more replies ({{ request.replies.length - visibleReplies.length }})
        </button>
      </div>

      <!-- Reply Input Area -->
      <div class="flex gap-3 mt-4 pl-4 items-start">
        <UserAvatar :avatar-url="currentUserAvatar" :user-name="currentUserName" size="sm" />
        <div class="flex-1 flex flex-col gap-2">
          <transition name="fade">
            <div
              v-if="replyingTo"
              class="bg-blue-estate border-blue-estate/20 flex w-fit items-center gap-2 rounded-lg border px-3 py-1.5 text-white shadow-sm"
            >
              <span class="text-[10px] font-bold uppercase tracking-wider"
                >Replying to {{ replyingTo }}</span
              >
              <button class="text-white/70 transition-colors hover:text-white" @click="cancelReply">
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

          <div
            class="flex items-center gap-3 bg-white rounded-full border border-cinnamon-ice/20 px-4 py-2 focus-within:border-cinnamon-ice/40 transition-all duration-300"
          >
            <input
              ref="replyInputRef"
              v-model="newReplyText"
              placeholder="Write a reply"
              class="flex-1 bg-transparent border-none focus:ring-0 text-[14px] text-noble-black placeholder:text-noble-black/30 outline-none"
              @keydown.enter="handleReply"
            />
            <button
              class="text-[13px] font-bold text-burning-orange hover:text-blue-estate transition-colors disabled:opacity-20 disabled:grayscale transition-all duration-300"
              :disabled="!newReplyText.trim()"
              @click="handleReply"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import type { CommunityRequest } from "~/types/community-requests"

const props = defineProps<{
  request: CommunityRequest
  currentUserAvatar?: string | null
  currentUserName: string
}>()

const emit = defineEmits(["upvote-post", "upvote-reply", "add-reply"])

const showReplies = ref(false)
const isUpvoted = ref(false)
const newReplyText = ref("")
const visibleCount = ref(5)
const replyInputRef = ref<HTMLInputElement | null>(null)
const replyingTo = ref("")
const replyingToId = ref<string | null>(null)

const visibleReplies = computed(() => {
  return [...props.request.replies].slice(0, visibleCount.value)
})

const hasMoreReplies = computed(() => {
  return props.request.replies.length > visibleCount.value
})

const toggleReplies = () => {
  showReplies.value = !showReplies.value
}

const toggleUpvote = () => {
  isUpvoted.value = !isUpvoted.value
  emit("upvote-post", props.request.id)
}

const loadMoreReplies = () => {
  visibleCount.value += 5
}

const focusReplyInput = (userName?: string, replyId?: string) => {
  showReplies.value = true
  if (userName) {
    replyingTo.value = userName
    replyingToId.value = replyId || null
  }
  setTimeout(() => {
    replyInputRef.value?.focus()
  }, 0)
}

const cancelReply = () => {
  replyingTo.value = ""
  replyingToId.value = null
}

const handleReply = () => {
  if (!newReplyText.value.trim()) return

  emit("add-reply", {
    postId: props.request.id,
    parentReplyId: replyingToId.value,
    text: newReplyText.value,
    userName: props.currentUserName,
    userAvatar: props.currentUserAvatar,
  })

  newReplyText.value = ""
  cancelReply()
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
