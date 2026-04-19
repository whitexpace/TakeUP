<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onUnmounted, watch } from "vue"
import { useNotifications } from "../composables/use-notifications"
import { useChat } from "../composables/use-chat"
import type { ChatMessage } from "../composables/use-chat"

definePageMeta({
  layout: false,
})

const { notifications, loadNotifications, markNotificationRead, markAllNotificationsRead } =
  useNotifications()

const {
  sortedConversations,
  activeConversation,
  messages,
  isLoadingConversations,
  isLoadingMessages,
  isSending,
  error,
  hasMoreMessages,
  loadConversations,
  selectConversation,
  sendMessage: sendChatMessage,
  loadUnreadCount,
  onIncomingMessage,
  closeConversation,
  loadMoreMessages,
} = useChat()

// --- State Management ---
const isMobile = ref(false)
const searchQuery = ref("")
const newMessage = ref("")
const showWarning = ref(false)

// Refs for DOM elements
const chatAreaRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()

const getParticipantName = (p: { firstName: string; lastName: string } | null) =>
  p ? `${p.firstName} ${p.lastName}` : "Unknown"

// --- Utilities ---
const checkMobile = () => {
  isMobile.value = window.innerWidth < 1024
}
const scrollToBottom = () => {
  nextTick(() => {
    if (chatAreaRef.value) chatAreaRef.value.scrollTop = chatAreaRef.value.scrollHeight
  })
}
const adjustTextareaHeight = () => {
  const el = textareaRef.value
  if (!el) return
  el.style.height = "auto"
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`
}

const formatTimestamp = (dateStr: string | Date) => {
  const date = new Date(dateStr)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isToday) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  if (yesterday.toDateString() === date.toDateString()) return "Yesterday"
  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}

const formatDetailedTime = (dateStr: string | Date) => {
  const date = new Date(dateStr)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  if (isToday) return timeStr
  if (yesterday.toDateString() === date.toDateString()) return `Yesterday, ${timeStr}`
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${timeStr}`
}

// --- Sensitive info detection ---
const PHONE_REGEX =
  /(?:\+63|0)?9\d{9}\b|(?:\+?\d{1,4}[-.\s]?)?\(?\d{3,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/g
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const containsSensitiveInfo = (text: string) =>
  text.match(PHONE_REGEX) !== null || text.match(EMAIL_REGEX) !== null
type MessageSegment = { type: "text"; value: string } | { type: "masked"; value: string }

const buildMessageSegments = (body: string): MessageSegment[] => {
  const matches = [...body.matchAll(new RegExp(`${PHONE_REGEX.source}|${EMAIL_REGEX.source}`, "g"))]

  if (matches.length === 0) {
    return [{ type: "text", value: body }]
  }

  const segments: MessageSegment[] = []
  let currentIndex = 0

  for (const match of matches) {
    const matchText = match[0]
    const matchIndex = match.index ?? 0

    if (matchIndex > currentIndex) {
      segments.push({
        type: "text",
        value: body.slice(currentIndex, matchIndex),
      })
    }

    segments.push({
      type: "masked",
      value: "·".repeat(Math.max(matchText.length * 2, 6)),
    })

    currentIndex = matchIndex + matchText.length
  }

  if (currentIndex < body.length) {
    segments.push({
      type: "text",
      value: body.slice(currentIndex),
    })
  }

  return segments
}

// --- Actions ---
const handleSelectChat = (conversationId: string) => {
  selectConversation(conversationId)
  scrollToBottom()
}
const handleCloseChat = () => {
  closeConversation()
}

const handleSendMessage = async () => {
  if (!newMessage.value.trim() || !activeConversation.value) return
  const body = newMessage.value
  const hasSensitive = containsSensitiveInfo(body)
  newMessage.value = ""
  nextTick(adjustTextareaHeight)

  if (hasSensitive) {
    showWarning.value = true
    setTimeout(() => (showWarning.value = false), 8000)
  }

  await sendChatMessage(body)
  scrollToBottom()
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault()
    handleSendMessage()
  }
}

// --- Computed ---
const filteredConversations = computed(() =>
  sortedConversations.value.filter((c) => {
    if (!searchQuery.value) return true
    const q = searchQuery.value.toLowerCase()
    const name = getParticipantName(c.otherParticipant).toLowerCase()
    const itemName = c.item?.name?.toLowerCase() ?? ""
    return name.includes(q) || itemName.includes(q)
  }),
)

const getChatPreview = (conv: (typeof sortedConversations.value)[0]) => {
  if (!conv.lastMessage) return "Start a conversation"
  return conv.lastMessage.body.replace(/<[^>]*>?/gm, "").slice(0, 60)
}

const getChatTime = (conv: (typeof sortedConversations.value)[0]) => {
  if (!conv.lastMessage) return ""
  return formatTimestamp(conv.lastMessage.createdAt)
}

const avatarColors = ["bg-burning-orange", "bg-blue-estate", "bg-cinnamon-ice"]
const getAvatarColor = (id: string) => {
  let hash = 0
  for (const ch of id) hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

// Watch messages to auto-scroll
watch(messages, () => scrollToBottom(), { deep: true })

// --- Polling for new messages ---
let pollTimer: ReturnType<typeof setInterval> | null = null

const startPolling = () => {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    if (!activeConversation.value) return
    try {
      await loadConversations()
      const params: Record<string, string> = {
        conversationId: activeConversation.value.conversationId,
      }
      const data = await $fetch<{
        messages: ChatMessage[]
        nextCursor: string | null
        hasMore: boolean
      }>("/api/chat/messages", { params })
      // Find new messages not in current list
      const existingIds = new Set(messages.value.map((m) => m.id))
      for (const msg of data.messages) {
        if (!existingIds.has(msg.id)) {
          onIncomingMessage(msg)
        }
      }
    } catch {
      // Silently ignore polling errors
    }
  }, 5000)
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onMounted(async () => {
  checkMobile()
  window.addEventListener("resize", checkMobile)
  await Promise.all([loadNotifications(), loadConversations(), loadUnreadCount()])
  startPolling()
})

onUnmounted(() => {
  window.removeEventListener("resize", checkMobile)
  stopPolling()
})
</script>

<template>
  <div class="h-screen flex flex-col font-geist text-noble-black overflow-hidden bg-white pt-14">
    <Header
      :notifications="notifications"
      @mark-notification-read="markNotificationRead"
      @mark-all-notifications-read="markAllNotificationsRead"
    />

    <div class="flex-1 flex overflow-hidden relative">
      <!-- Sidebar -->
      <aside
        class="w-full lg:w-80 border-r border-cinnamon-ice/20 flex flex-col shrink-0 bg-white transition-all duration-300 overflow-hidden"
        :class="[
          isMobile && activeConversation
            ? '-translate-x-full absolute inset-0'
            : 'translate-x-0 relative',
        ]"
      >
        <div class="p-4 flex items-center justify-between">
          <h1 class="text-2xl font-geist font-bold">Inbox</h1>
        </div>
        <div class="px-4 pb-4">
          <div class="relative group">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search conversations..."
              class="w-full bg-cream/50 border border-cinnamon-ice/30 rounded-full py-2 pl-11 pr-4 text-[14px] font-geist outline-none focus:border-burning-orange/50 focus:bg-white transition-all duration-300"
            /><svg
              class="absolute left-4 top-1/2 -translate-y-1/2 text-noble-black/30 group-focus-within:text-burning-orange transition-colors"
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
        </div>
        <div class="flex-1 overflow-y-auto custom-chat-scrollbar">
          <!-- Loading -->
          <div v-if="isLoadingConversations" class="p-4 space-y-4">
            <div v-for="i in 6" :key="i" class="flex gap-3 animate-pulse">
              <div class="w-12 h-12 bg-cream rounded-full"></div>
              <div class="flex-1 space-y-2 py-1">
                <div class="h-3 bg-cream rounded w-3/4"></div>
                <div class="h-2 bg-cream rounded w-1/2"></div>
              </div>
            </div>
          </div>
          <!-- Error -->
          <div
            v-else-if="error && !sortedConversations.length"
            class="p-12 text-center flex flex-col items-center"
          >
            <div
              class="w-16 h-16 bg-cinnabar-red/5 rounded-full flex items-center justify-center mb-4 text-cinnabar-red/60"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" x2="12" y1="8" y2="12" />
                <line x1="12" x2="12.01" y1="16" y2="16" />
              </svg>
            </div>
            <p class="text-sm font-medium text-noble-black/60 mb-4">Failed to load conversations</p>
            <button
              class="text-xs font-bold text-blue-estate hover:text-burning-orange transition-colors uppercase tracking-wider"
              @click="loadConversations"
            >
              Retry
            </button>
          </div>
          <!-- Empty -->
          <template v-else>
            <div
              v-if="sortedConversations.length === 0 && !isLoadingConversations"
              class="p-12 text-center flex flex-col items-center opacity-40"
            >
              <p class="text-sm font-bold mb-1">No conversations yet</p>
              <p class="text-xs">Conversations are created when you have active transactions.</p>
            </div>
            <!-- Conversation list -->
            <div
              v-for="conv in filteredConversations"
              v-else
              :key="conv.conversationId"
              class="px-4 py-3 cursor-pointer transition-all duration-200 relative group"
              :class="[
                activeConversation?.conversationId === conv.conversationId
                  ? 'bg-cream'
                  : 'hover:bg-cream/40',
              ]"
              @click="handleSelectChat(conv.conversationId)"
            >
              <div class="flex items-start gap-3">
                <div
                  v-if="conv.otherParticipant?.avatarUrl"
                  class="w-12 h-12 rounded-full shrink-0 overflow-hidden"
                >
                  <img
                    :src="conv.otherParticipant.avatarUrl"
                    :alt="getParticipantName(conv.otherParticipant)"
                    class="w-full h-full object-cover"
                  />
                </div>
                <div
                  v-else
                  class="w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-sm shadow-sm"
                  :class="getAvatarColor(conv.otherParticipant?.id ?? conv.conversationId)"
                >
                  {{ getInitials(getParticipantName(conv.otherParticipant)) }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex justify-between items-start mb-0.5">
                    <span
                      class="font-bold text-[15px] truncate"
                      :class="{ 'text-burning-orange': conv.unreadCount > 0 }"
                      >{{ getParticipantName(conv.otherParticipant) }}</span
                    >
                    <span class="text-[11px] text-noble-black/40 shrink-0 whitespace-nowrap ml-2">
                      {{ getChatTime(conv) }}
                    </span>
                  </div>
                  <div
                    v-if="conv.item"
                    class="text-[12px] text-noble-black/50 mb-1 truncate italic"
                  >
                    {{ conv.item.name }}
                  </div>
                  <p
                    class="text-[13px] text-noble-black/60 truncate"
                    :class="{ 'font-semibold text-noble-black/80': conv.unreadCount > 0 }"
                  >
                    {{ getChatPreview(conv) }}
                  </p>
                </div>
              </div>
              <div
                v-if="conv.unreadCount > 0"
                class="absolute right-4 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-burning-orange rounded-full shadow-sm"
              ></div>
            </div>
          </template>
        </div>
      </aside>

      <!-- Main Chat Area -->
      <main
        class="flex-1 flex flex-col bg-cream relative overflow-hidden transition-all duration-300"
        :class="[
          isMobile && !activeConversation
            ? 'translate-x-full absolute inset-0'
            : 'translate-x-0 relative',
        ]"
      >
        <!-- Loading messages -->
        <div
          v-if="isLoadingMessages && !messages.length"
          class="flex-1 flex flex-col items-center justify-center space-y-4"
        >
          <div
            class="w-12 h-12 border-4 border-cinnamon-ice/20 border-t-burning-orange rounded-full animate-spin"
          ></div>
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-noble-black/30">
            Loading messages...
          </p>
        </div>

        <!-- Active conversation -->
        <template v-else-if="activeConversation">
          <!-- Chat header -->
          <div
            class="h-16 bg-white border-b border-cinnamon-ice/20 flex items-center justify-between px-4 lg:px-6 shrink-0 shadow-sm z-10"
          >
            <div class="flex items-center gap-3">
              <button
                class="lg:hidden p-2 -ml-2 hover:bg-cream rounded-full transition-colors"
                @click="handleCloseChat"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <div
                v-if="activeConversation.otherParticipant?.avatarUrl"
                class="w-10 h-10 rounded-full overflow-hidden"
              >
                <img
                  :src="activeConversation.otherParticipant.avatarUrl"
                  :alt="getParticipantName(activeConversation.otherParticipant)"
                  class="w-full h-full object-cover"
                />
              </div>
              <div
                v-else
                class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs"
                :class="
                  getAvatarColor(
                    activeConversation.otherParticipant?.id ?? activeConversation.conversationId,
                  )
                "
              >
                {{ getInitials(getParticipantName(activeConversation.otherParticipant)) }}
              </div>
              <div class="flex flex-col">
                <span class="font-bold text-[15px] leading-tight">{{
                  getParticipantName(activeConversation.otherParticipant)
                }}</span>
                <span v-if="activeConversation.item" class="text-[12px] text-noble-black/50">{{
                  activeConversation.item.name
                }}</span>
              </div>
            </div>
            <NuxtLink
              v-if="activeConversation.item"
              :to="`/items/${activeConversation.item.id}`"
              class="hidden sm:block bg-burning-orange text-white text-[13px] font-bold px-4 py-2 rounded-full hover:bg-burning-orange/90 transition-all duration-300 shadow-sm active:scale-95"
            >
              View Item
            </NuxtLink>
          </div>

          <!-- Expired banner -->
          <div
            v-if="activeConversation.isExpired"
            class="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center"
          >
            <p class="text-xs text-amber-700 font-medium">
              Direct messaging is disabled because this transaction is under dispute review.
            </p>
          </div>

          <!-- Messages area -->
          <div
            ref="chatAreaRef"
            class="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-chat-scrollbar"
          >
            <!-- Load more button -->
            <div v-if="hasMoreMessages" class="flex justify-center">
              <button
                class="text-[11px] font-bold uppercase tracking-wider text-noble-black/30 hover:text-burning-orange transition-colors"
                :disabled="isLoadingMessages"
                @click="loadMoreMessages"
              >
                {{ isLoadingMessages ? "Loading..." : "Load earlier messages" }}
              </button>
            </div>

            <!-- Empty messages -->
            <div
              v-if="messages.length === 0 && !isLoadingMessages"
              class="flex-1 flex flex-col items-center justify-center text-center opacity-40 py-12"
            >
              <div class="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p class="text-sm font-bold">No messages yet</p>
              <p class="text-xs">Start the conversation</p>
            </div>

            <!-- Message bubbles -->
            <template v-else>
              <div class="flex justify-center">
                <span
                  class="text-[11px] font-bold uppercase tracking-wider text-noble-black/30 bg-white/40 px-3 py-1 rounded-full"
                  >Today</span
                >
              </div>
              <div
                v-for="(msg, index) in messages"
                :key="msg.id"
                class="flex flex-col max-w-[85%] lg:max-w-[75%]"
                :class="[
                  msg.senderUserId !== activeConversation.otherParticipant?.id
                    ? 'self-end items-end'
                    : 'self-start items-start',
                ]"
              >
                <div
                  class="px-4 py-2.5 rounded-2xl text-[14px] shadow-sm leading-relaxed relative"
                  :class="[
                    msg.senderUserId !== activeConversation.otherParticipant?.id
                      ? 'bg-blue-estate text-white rounded-tr-none'
                      : 'bg-white text-noble-black border border-cinnamon-ice/30 rounded-tl-none',
                  ]"
                >
                  <template
                    v-for="(segment, segmentIndex) in buildMessageSegments(msg.body)"
                    :key="`${msg.id}-${segmentIndex}`"
                  >
                    <span v-if="segment.type === 'text'" class="whitespace-pre-wrap break-words">
                      {{ segment.value }}
                    </span>
                    <span
                      v-else
                      class="mx-1 inline-block select-none rounded-full px-4 text-transparent"
                      style="
                        filter: blur(12px);
                        background: rgba(255, 255, 255, 0.7);
                        pointer-events: none;
                      "
                    >
                      {{ segment.value }}
                    </span>
                  </template>
                </div>
                <div class="mt-1 flex items-center gap-2">
                  <span
                    v-if="index === messages.length - 1"
                    class="text-[10px] text-noble-black/40 font-medium"
                    >{{ formatDetailedTime(msg.createdAt) }}</span
                  >
                  <div
                    v-if="
                      msg.senderUserId !== activeConversation.otherParticipant?.id && msg.isRead
                    "
                    class="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[6px] text-white font-bold transition-all duration-500 scale-100"
                    :class="getAvatarColor(activeConversation.otherParticipant?.id ?? '')"
                  >
                    {{ getInitials(getParticipantName(activeConversation.otherParticipant)) }}
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Sensitive info warning -->
          <transition name="fade">
            <div v-if="showWarning" class="mx-6 mb-2">
              <p class="text-[11px] text-noble-black/40 text-center leading-normal">
                For your safety and privacy, we've censored information that appears to be personal
                contact details. <br />Please keep all communication within the TakeUP chat
                platform.
              </p>
            </div>
          </transition>

          <!-- Message input (hidden when expired) -->
          <div
            v-if="!activeConversation.isExpired"
            class="bg-white p-4 border-t border-cinnamon-ice/20 shrink-0 relative"
          >
            <div class="flex items-end gap-2 lg:gap-3">
              <div
                class="flex-1 bg-cream border border-cinnamon-ice/20 rounded-[22px] transition-all duration-300 focus-within:border-burning-orange/50 relative flex items-end"
              >
                <textarea
                  ref="textareaRef"
                  v-model="newMessage"
                  rows="1"
                  placeholder="Type your message..."
                  class="w-full bg-transparent py-2.5 px-4 lg:px-6 pr-14 text-[14px] font-geist outline-none placeholder:text-noble-black/30 resize-none overflow-y-auto custom-chat-scrollbar leading-relaxed"
                  style="min-height: 42px; max-height: 120px"
                  @keydown="handleKeydown"
                ></textarea>
              </div>
              <button
                class="p-2.5 mb-1 bg-burning-orange text-white rounded-full shadow-md hover:bg-burning-orange/90 transition-all duration-300 active:scale-95 shrink-0"
                :disabled="!newMessage.trim() || isSending"
                :class="{
                  'opacity-50 grayscale cursor-not-allowed': !newMessage.trim() || isSending,
                }"
                @click="handleSendMessage"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <line x1="22" x2="11" y1="2" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        </template>

        <!-- No chat selected -->
        <div
          v-else-if="!isMobile"
          class="flex-1 flex flex-col items-center justify-center bg-cream text-center px-6 opacity-40"
        >
          <div
            class="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-cinnamon-ice/20"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h2 class="text-xl font-bold mb-2">Select a conversation</h2>
          <p class="text-sm">Choose a chat from the inbox to start messaging.</p>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.custom-chat-scrollbar::-webkit-scrollbar {
  width: 5px;
}

.custom-chat-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-chat-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(219, 187, 167, 0.4) !important;
  border-radius: 20px;
}

.custom-chat-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(219, 187, 167, 0.7) !important;
}

/* Firefox support */
.custom-chat-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgba(219, 187, 167, 0.4) transparent;
}
</style>
