<template>
  <div class="flex flex-col gap-3 group/reply relative">
    <!-- Main Reply Block -->
    <div class="flex items-start gap-3">
      <!-- User Avatar -->
      <NuxtLink :to="`/profile/${reply.user.username}`" class="group/avatar" @click.stop>
        <UserAvatar
          :avatar-url="reply.user.avatar"
          :user-name="reply.user.name"
          size="sm"
          class="group-hover/avatar:scale-105 transition-transform"
        />
      </NuxtLink>

      <div class="flex flex-col flex-1">
        <!-- Reply Bubble -->
        <div
          class="bg-white rounded-[20px] p-4 border border-cinnamon-ice/5 shadow-sm group-hover/reply:border-cinnamon-ice/20 transition-all duration-300"
        >
          <NuxtLink
            :to="`/profile/${reply.user.username}`"
            class="text-[13px] font-bold text-noble-black hover:text-burning-orange transition-colors"
            @click.stop
          >
            {{ reply.user.name }}
          </NuxtLink>
          <p class="text-[14px] text-noble-black/70 mt-1 leading-relaxed">{{ reply.text }}</p>
        </div>

        <!-- Reply Actions -->
        <div class="flex items-center gap-5 mt-2 ml-2">
          <button
            class="flex items-center gap-1.5 text-[11px] font-bold transition-all duration-300 group/upvote"
            :class="
              isUpvoted
                ? 'text-burning-orange scale-105'
                : 'text-noble-black/30 hover:text-burning-orange'
            "
            @click="toggleUpvote"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              class="group-hover/upvote:translate-y-[-1px] transition-transform"
              :class="{ 'fill-burning-orange/5': isUpvoted }"
            >
              <path d="M7 11l5-5 5 5M12 18V6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>{{ reply.upvotes + (isUpvoted ? 1 : 0) }}</span>
          </button>
          <button
            class="text-[11px] font-bold text-noble-black/30 hover:text-blue-estate transition-colors"
            @click="$emit('reply', reply.user.name, reply.id)"
          >
            Reply
          </button>
        </div>
      </div>
    </div>

    <!-- Nested Thread -->
    <div
      v-if="reply.replies && reply.replies.length > 0"
      class="flex flex-col gap-4 pl-6 mt-1 relative"
    >
      <!-- Vertical Thread Line -->
      <div
        class="absolute left-[15px] top-0 bottom-0 w-[1.5px] bg-cinnamon-ice/20 group-hover/reply:bg-cinnamon-ice/40 transition-colors"
      ></div>

      <CommunityReplyItem
        v-for="nestedReply in reply.replies"
        :key="nestedReply.id"
        :reply="nestedReply"
        @reply="(name, id) => $emit('reply', name, id)"
        @upvote-reply="(id) => $emit('upvote-reply', id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import type { Reply } from "~/types/community-requests"

const props = defineProps<{
  reply: Reply
}>()

const emit = defineEmits(["reply", "upvote-reply"])

const isUpvoted = ref(false)
const toggleUpvote = () => {
  isUpvoted.value = !isUpvoted.value
  emit("upvote-reply", props.reply.id)
}
</script>
