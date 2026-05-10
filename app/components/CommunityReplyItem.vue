<template>
  <div class="flex flex-col gap-4 group/reply relative">
    <!-- Main Reply Block -->
    <div class="flex items-start gap-3">
      <!-- User Avatar (Luxury Circle) -->
      <NuxtLink :to="`/profile/${reply.user.username}`" class="group/avatar shrink-0" @click.stop>
        <div
          class="relative p-[2px] rounded-full bg-gradient-to-tr from-cinnamon-ice/20 to-transparent"
        >
          <UserAvatar
            :avatar-url="reply.user.avatar"
            :user-name="reply.user.name"
            size="sm"
            class="group-hover/avatar:scale-105 transition-transform duration-500"
          />
        </div>
      </NuxtLink>

      <div class="flex flex-col flex-1 min-w-0">
        <!-- Reply Content Area -->
        <div
          class="bg-cream/30 rounded-[20px] p-4 border border-cinnamon-ice/10 group-hover/reply:bg-white group-hover/reply:border-cinnamon-ice/30 group-hover/reply:shadow-sm transition-all duration-500"
        >
          <div class="flex items-center justify-between mb-1">
            <NuxtLink
              :to="`/profile/${reply.user.username}`"
              class="text-[13px] font-bold text-noble-black hover:text-burning-orange transition-colors"
              @click.stop
            >
              {{ reply.user.name }}
            </NuxtLink>
            <span class="text-[11px] text-noble-black/30 font-medium">
              {{ formatRelativeTime(reply.createdAt) }}
            </span>
          </div>
          <p class="text-[14px] text-noble-black/80 font-geist leading-relaxed">
            {{ reply.text }}
          </p>
        </div>

        <!-- Reply Actions (Elegant Styling) -->
        <div class="flex items-center gap-6 mt-2 ml-2">
          <!-- Upvote Button -->
          <button
            class="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase transition-all duration-300 group/upvote"
            :class="
              isUpvoted
                ? 'text-burning-orange scale-105'
                : 'text-noble-black/40 hover:text-burning-orange'
            "
            @click="toggleUpvote"
          >
            <Icon
              :name="isUpvoted ? 'ph:arrow-fat-up-fill' : 'ph:arrow-fat-up'"
              class="w-[14px] h-[14px] group-hover/upvote:-translate-y-0.5 transition-transform"
            />
            <span class="font-geist">{{
              reply.upvotes + (isUpvoted && !reply.isUpvoted ? 1 : 0)
            }}</span>
          </button>

          <!-- Reply Toggle -->
          <button
            class="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase text-noble-black/40 hover:text-blue-estate transition-colors"
            @click="$emit('reply', reply.user.name, reply.id)"
          >
            <Icon name="ph:chat-centered-text" class="w-[14px] h-[14px]" />
            Reply
          </button>

          <!-- Expand/Collapse Toggle (Reddit-style) -->
          <button
            v-if="hasReplies"
            class="flex items-center gap-1 text-[11px] font-bold tracking-wider uppercase text-noble-black/40 hover:text-burning-orange transition-colors"
            @click="isExpanded = !isExpanded"
          >
            <Icon
              :name="isExpanded ? 'ph:caret-up-bold' : 'ph:caret-down-bold'"
              class="w-[12px] h-[12px]"
            />
            <span class="font-geist text-[11px] font-bold uppercase tracking-wider"
              >{{ isExpanded ? "Hide" : `Show ${replyCount}` }} replies</span
            >
          </button>
        </div>
      </div>
    </div>

    <!-- Nested Thread (Recursive) -->
    <div
      v-if="hasReplies && isExpanded"
      class="flex flex-col gap-5 pl-8 mt-1 relative animate-in fade-in slide-in-from-top-1 duration-300"
    >
      <!-- Vertical Luxury Thread Line -->
      <div
        class="absolute left-[17px] top-0 bottom-6 w-[1.5px] bg-gradient-to-b from-cinnamon-ice/40 to-cinnamon-ice/5 rounded-full"
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
import { ref, computed } from "vue"
import type { Reply } from "~/types/community-requests"

const props = defineProps<{
  reply: Reply
}>()

const emit = defineEmits(["reply", "upvote-reply"])

const isUpvoted = ref(props.reply.isUpvoted || false)
const isExpanded = ref(false)

const hasReplies = computed(() => props.reply.replies && props.reply.replies.length > 0)
const replyCount = computed(() => props.reply.replies?.length || 0)

const toggleUpvote = () => {
  isUpvoted.value = !isUpvoted.value
  emit("upvote-reply", props.reply.id)
}

const formatRelativeTime = (timestamp: Date) => {
  const diff = Date.now() - new Date(timestamp).getTime()
  const minutes = Math.max(1, Math.round(diff / (60 * 1000)))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  return `${days}d`
}
</script>
