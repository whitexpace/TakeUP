<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onUnmounted } from "vue"
import { useNotifications } from "../composables/use-notifications"

definePageMeta({
  layout: false,
})

const { notifications, loadNotifications, markNotificationRead, markAllNotificationsRead } =
  useNotifications()

// --- State Management ---
const isLoading = ref(true)
const isError = ref(false)
const isMobile = ref(false)
const selectedChatId = ref<number | null>(1)
const searchQuery = ref("")
const newMessage = ref("")
const showWarning = ref(false)
const showNewChatModal = ref(false)
const userSearchQuery = ref("")

// Refs for DOM elements
const chatAreaRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const photoInputRef = ref<HTMLInputElement | null>(null)

interface Message {
  id: number
  senderId: string
  text: string
  timestamp: Date
  isCensored?: boolean
  isSeen?: boolean
}

interface Chat {
  id: number
  userName: string
  lastMessage: string
  lastTime: string
  borrowedItem?: string
  unreadCount: number
  messages: Message[]
  avatarColor: string
}

interface User {
  id: number
  name: string
  avatarColor: string
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()

const availableUsers = ref<User[]>([
  { id: 101, name: "Olivia Rodrigo", avatarColor: "bg-blue-estate" },
  { id: 102, name: "Bruno Mars", avatarColor: "bg-burning-orange" },
  { id: 103, name: "SZA", avatarColor: "bg-cinnamon-ice" },
  { id: 104, name: "Post Malone", avatarColor: "bg-blue-estate" },
])

const chats = ref<Chat[]>([
  {
    id: 1,
    userName: "Mikaela Reyes",
    lastMessage: "See you on Saturday Mikaela!",
    lastTime: "11:45 AM",
    borrowedItem: "Fujifilm X-T4",
    unreadCount: 2,
    avatarColor: "bg-burning-orange",
    messages: [
      {
        id: 1,
        senderId: "other",
        text: "Hi! Is the camera still available for borrowing?",
        timestamp: new Date(Date.now() - 3600000 * 5),
        isSeen: true,
      },
      {
        id: 2,
        senderId: "me",
        text: "Yes it is! When do you need it?",
        timestamp: new Date(Date.now() - 3600000 * 4.8),
        isSeen: true,
      },
      {
        id: 3,
        senderId: "other",
        text: "Maybe this Saturday?",
        timestamp: new Date(Date.now() - 3600000 * 4.5),
        isSeen: true,
      },
      {
        id: 4,
        senderId: "me",
        text: "Sure, I can lend you my camera this weekend!",
        timestamp: new Date(Date.now() - 3600000 * 4),
        isSeen: true,
      },
      {
        id: 5,
        senderId: "other",
        text: "That would be awesome!",
        timestamp: new Date(Date.now() - 3600000 * 3.9),
        isSeen: true,
      },
      {
        id: 6,
        senderId: "me",
        text: "I have a 64GB card inside already.",
        timestamp: new Date(Date.now() - 3600000 * 3.8),
        isSeen: true,
      },
      {
        id: 7,
        senderId: "other",
        text: "Got it. I'll bring one just in case.",
        timestamp: new Date(Date.now() - 3600000 * 3.7),
        isSeen: true,
      },
      {
        id: 8,
        senderId: "other",
        text: "Is the battery life still good?",
        timestamp: new Date(Date.now() - 3600000 * 3.6),
        isSeen: true,
      },
      {
        id: 9,
        senderId: "me",
        text: "Yes, it lasts about 400-500 shots.",
        timestamp: new Date(Date.now() - 3600000 * 3.5),
        isSeen: true,
      },
      {
        id: 10,
        senderId: "other",
        text: "You're a lifesaver!",
        timestamp: new Date(Date.now() - 3600000 * 3.4),
        isSeen: true,
      },
      {
        id: 11,
        senderId: "me",
        text: "No problem! What kind of project is it?",
        timestamp: new Date(Date.now() - 3600000 * 3.3),
        isSeen: true,
      },
      {
        id: 12,
        senderId: "other",
        text: "It's for our documentary class.",
        timestamp: new Date(Date.now() - 3600000 * 3.2),
        isSeen: true,
      },
      {
        id: 13,
        senderId: "me",
        text: "The Fujifilm colors will look great.",
        timestamp: new Date(Date.now() - 3600000 * 3.1),
        isSeen: true,
      },
      {
        id: 14,
        senderId: "other",
        text: "Exactly why I wanted to borrow it!",
        timestamp: new Date(Date.now() - 3600000 * 3),
        isSeen: true,
      },
      {
        id: 15,
        senderId: "me",
        text: "Just let me know the time.",
        timestamp: new Date(Date.now() - 3600000 * 2.9),
        isSeen: true,
      },
      {
        id: 16,
        senderId: "other",
        text: "Is 9:00 AM too early?",
        timestamp: new Date(Date.now() - 3600000 * 2.8),
        isSeen: true,
      },
      {
        id: 17,
        senderId: "me",
        text: "9:00 AM works for me.",
        timestamp: new Date(Date.now() - 3600000 * 2.7),
        isSeen: true,
      },
      {
        id: 18,
        senderId: "other",
        text: "Perfect! See you there.",
        timestamp: new Date(Date.now() - 3600000 * 2.6),
        isSeen: true,
      },
      {
        id: 19,
        senderId: "other",
        text: "Does it come with a cage?",
        timestamp: new Date(Date.now() - 3600000 * 2.5),
        isSeen: true,
      },
      {
        id: 20,
        senderId: "me",
        text: "I have a small rig cage for it.",
        timestamp: new Date(Date.now() - 3600000 * 2.4),
        isSeen: true,
      },
      {
        id: 21,
        senderId: "other",
        text: "Thank you so much!",
        timestamp: new Date(Date.now() - 3600000 * 2.3),
        isSeen: true,
      },
      {
        id: 22,
        senderId: "me",
        text: "Happy to help!",
        timestamp: new Date(Date.now() - 3600000 * 2.2),
        isSeen: true,
      },
      {
        id: 23,
        senderId: "other",
        text: "I'll handle it with care.",
        timestamp: new Date(Date.now() - 3600000 * 2.1),
        isSeen: true,
      },
      {
        id: 24,
        senderId: "me",
        text: "I appreciate that.",
        timestamp: new Date(Date.now() - 3600000 * 2),
        isSeen: true,
      },
      {
        id: 25,
        senderId: "other",
        text: "See you on Saturday Mikaela!",
        timestamp: new Date(Date.now() - 3600000 * 1.9),
        isSeen: true,
      },
    ],
  },
  {
    id: 2,
    userName: "Julian Santos",
    lastMessage: "Thanks for the drill!",
    lastTime: "Yesterday",
    borrowedItem: "Bosch Power Drill",
    unreadCount: 0,
    avatarColor: "bg-blue-estate",
    messages: [
      {
        id: 1,
        senderId: "other",
        text: "Hey, can I borrow your drill?",
        timestamp: new Date(Date.now() - 86400000),
        isSeen: true,
      },
      {
        id: 2,
        senderId: "me",
        text: "Of course!",
        timestamp: new Date(Date.now() - 86000000),
        isSeen: true,
      },
      {
        id: 3,
        senderId: "other",
        text: "Thanks for the drill!",
        timestamp: new Date(Date.now() - 80000000),
        isSeen: true,
      },
    ],
  },
  {
    id: 3,
    userName: "Elena Cruz",
    lastMessage: "I'll return the tent.",
    lastTime: "Apr 12",
    borrowedItem: "4-Person Tent",
    unreadCount: 0,
    avatarColor: "bg-cinnamon-ice",
    messages: [
      {
        id: 1,
        senderId: "me",
        text: "How's the trip?",
        timestamp: new Date("2026-04-11T16:00:00"),
        isSeen: true,
      },
      {
        id: 2,
        senderId: "other",
        text: "It's great!",
        timestamp: new Date("2026-04-11T16:30:00"),
        isSeen: true,
      },
      {
        id: 3,
        senderId: "other",
        text: "I'll return the tent.",
        timestamp: new Date("2026-04-12T10:00:00"),
        isSeen: true,
      },
    ],
  },
  {
    id: 4,
    userName: "Paolo Garcia",
    lastMessage: "Available?",
    lastTime: "Apr 11",
    unreadCount: 0,
    avatarColor: "bg-burning-orange",
    messages: [
      {
        id: 1,
        senderId: "other",
        text: "Is this available?",
        timestamp: new Date("2026-04-11T14:00:00"),
        isSeen: true,
      },
    ],
  },
  {
    id: 5,
    userName: "Sofia Villamin",
    lastMessage: "Check photos.",
    lastTime: "Apr 10",
    borrowedItem: "Designer Gown",
    unreadCount: 1,
    avatarColor: "bg-blue-estate",
    messages: [
      {
        id: 1,
        senderId: "other",
        text: "Check out the photos.",
        timestamp: new Date("2026-04-10T17:00:00"),
        isSeen: true,
      },
    ],
  },
  {
    id: 6,
    userName: "Marco Diaz",
    lastMessage: "No problem!",
    lastTime: "Apr 09",
    unreadCount: 0,
    avatarColor: "bg-cinnamon-ice",
    messages: [
      {
        id: 1,
        senderId: "me",
        text: "Thanks!",
        timestamp: new Date("2026-04-09T13:00:00"),
        isSeen: true,
      },
    ],
  },
  {
    id: 7,
    userName: "Isabella Luna",
    lastMessage: "Amazing!",
    lastTime: "Apr 08",
    borrowedItem: "Gatsby Book",
    unreadCount: 0,
    avatarColor: "bg-burning-orange",
    messages: [
      {
        id: 1,
        senderId: "other",
        text: "The book was amazing!",
        timestamp: new Date("2026-04-08T10:00:00"),
        isSeen: true,
      },
    ],
  },
  {
    id: 8,
    userName: "Gabriel Tan",
    lastMessage: "Meet at park?",
    lastTime: "Apr 07",
    unreadCount: 0,
    avatarColor: "bg-blue-estate",
    messages: [
      {
        id: 1,
        senderId: "other",
        text: "Meet at the park?",
        timestamp: new Date("2026-04-07T15:30:00"),
        isSeen: true,
      },
    ],
  },
  {
    id: 9,
    userName: "Lana Del Rey",
    lastMessage: "Summertime.",
    lastTime: "Apr 06",
    unreadCount: 1,
    avatarColor: "bg-burning-orange",
    messages: [
      {
        id: 1,
        senderId: "other",
        text: "Summertime sadness.",
        timestamp: new Date("2026-04-06T11:00:00"),
        isSeen: true,
      },
    ],
  },
  {
    id: 10,
    userName: "Kevin Parker",
    lastMessage: "Better.",
    lastTime: "Apr 05",
    unreadCount: 0,
    avatarColor: "bg-cinnamon-ice",
    messages: [
      {
        id: 1,
        senderId: "other",
        text: "The less I know.",
        timestamp: new Date("2026-04-05T21:00:00"),
        isSeen: true,
      },
    ],
  },
  {
    id: 11,
    userName: "Dua Lipa",
    lastMessage: "Don't show.",
    lastTime: "Apr 04",
    unreadCount: 0,
    avatarColor: "bg-blue-estate",
    messages: [
      {
        id: 1,
        senderId: "other",
        text: "Don't show up.",
        timestamp: new Date("2026-04-04T14:00:00"),
        isSeen: true,
      },
    ],
  },
  {
    id: 12,
    userName: "Harry Styles",
    lastMessage: "Sugar!",
    lastTime: "Apr 03",
    unreadCount: 0,
    avatarColor: "bg-burning-orange",
    messages: [
      {
        id: 1,
        senderId: "other",
        text: "Sugar high!",
        timestamp: new Date("2026-04-03T16:30:00"),
        isSeen: true,
      },
    ],
  },
  {
    id: 13,
    userName: "Taylor Swift",
    lastMessage: "Look.",
    lastTime: "Apr 02",
    unreadCount: 1,
    avatarColor: "bg-cinnamon-ice",
    messages: [
      {
        id: 1,
        senderId: "other",
        text: "Look what you made me do.",
        timestamp: new Date("2026-04-02T08:00:00"),
        isSeen: true,
      },
    ],
  },
  {
    id: 14,
    userName: "The Weeknd",
    lastMessage: "Face.",
    lastTime: "Apr 01",
    unreadCount: 0,
    avatarColor: "bg-blue-estate",
    messages: [
      {
        id: 1,
        senderId: "other",
        text: "I can't feel my face.",
        timestamp: new Date("2026-04-01T22:00:00"),
        isSeen: true,
      },
    ],
  },
])

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

const formatTimestamp = (date: Date) => {
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isToday) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  if (yesterday.toDateString() === date.toDateString()) return "Yesterday"
  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}

const formatDetailedTime = (date: Date) => {
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  if (isToday) return timeStr
  if (yesterday.toDateString() === date.toDateString()) return `Yesterday, ${timeStr}`
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${timeStr}`
}

// --- Actions ---
const selectChat = (id: number) => {
  selectedChatId.value = id
  const chat = chats.value.find((c) => c.id === id)
  if (chat) chat.unreadCount = 0
  scrollToBottom()
}
const closeChat = () => {
  selectedChatId.value = null
}
const retryFetch = () => {
  isError.value = false
  isLoading.value = true
  setTimeout(() => (isLoading.value = false), 1500)
}

const sendMessage = () => {
  if (!newMessage.value.trim() || !selectedChat.value) return
  const originalText = newMessage.value
  const hasSensitive = containsSensitiveInfo(originalText)
  const textToDisplay = hasSensitive
    ? censorText(escapeHtml(originalText))
    : escapeHtml(originalText)
  const msg: Message = {
    id: Date.now(),
    senderId: "me",
    text: textToDisplay,
    timestamp: new Date(),
    isSeen: false,
  }
  selectedChat.value.messages.push(msg)
  if (hasSensitive) {
    showWarning.value = true
    setTimeout(() => (showWarning.value = false), 8000)
  }
  newMessage.value = ""
  scrollToBottom()
  nextTick(adjustTextareaHeight)
  setTimeout(() => {
    msg.isSeen = true
  }, 2000)
}

const startNewChat = (user: User) => {
  const existingChat = chats.value.find((c) => c.userName === user.name)
  if (existingChat) selectChat(existingChat.id)
  else {
    const newChat: Chat = {
      id: Date.now(),
      userName: user.name,
      lastMessage: "",
      lastTime: "Just now",
      unreadCount: 0,
      avatarColor: user.avatarColor,
      messages: [],
    }
    chats.value.unshift(newChat)
    selectChat(newChat.id)
  }
  showNewChatModal.value = false
  userSearchQuery.value = ""
}

const PHONE_REGEX =
  /(?:\+63|0)?9\d{9}\b|(?:\+?\d{1,4}[-.\s]?)?\(?\d{3,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/g
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const containsSensitiveInfo = (text: string) =>
  text.match(PHONE_REGEX) !== null || text.match(EMAIL_REGEX) !== null
const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
const censorText = (text: string) => {
  const replacement = (match: string) => {
    const clouds = "·".repeat(match.length * 2)
    return `<span style="filter: blur(12px); background: rgba(255,255,255,0.7); color: transparent; border-radius: 100px; padding: 0 15px; margin: 0 4px; display: inline-block; pointer-events: none; user-select: none;">${clouds}</span>`
  }
  return text.replace(PHONE_REGEX, replacement).replace(EMAIL_REGEX, replacement)
}

const filteredChats = computed(() =>
  chats.value.filter((c) => c.userName.toLowerCase().includes(searchQuery.value.toLowerCase())),
)
const filteredUsers = computed(() =>
  availableUsers.value.filter((u) =>
    u.name.toLowerCase().includes(userSearchQuery.value.toLowerCase()),
  ),
)
const selectedChat = computed(() => chats.value.find((c) => c.id === selectedChatId.value))
const getChatPreview = (chat: Chat) => {
  if (!chat.messages || chat.messages.length === 0) return "Start a conversation"
  const lastMsg = chat.messages[chat.messages.length - 1]
  if (!lastMsg) return "Start a conversation"
  return lastMsg.text.replace(/<[^>]*>?/gm, "")
}
const getChatTimeFormatted = (chat: Chat) => {
  if (!chat.messages || chat.messages.length === 0) return chat.lastTime
  const lastMsg = chat.messages[chat.messages.length - 1]
  if (!lastMsg) return chat.lastTime
  return formatTimestamp(lastMsg.timestamp)
}

const triggerPhotoUpload = () => {
  photoInputRef.value?.click()
}
const triggerFileUpload = () => {
  fileInputRef.value?.click()
}
const handleFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return
  input.value = ""
}
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

onMounted(async () => {
  checkMobile()
  window.addEventListener("resize", checkMobile)
  await loadNotifications()
  setTimeout(() => (isLoading.value = false), 1200)
})
onUnmounted(() => window.removeEventListener("resize", checkMobile))
</script>

<template>
  <div class="h-screen flex flex-col font-geist text-noble-black overflow-hidden bg-white pt-14">
    <Header
      :notifications="notifications"
      @mark-notification-read="markNotificationRead"
      @mark-all-notifications-read="markAllNotificationsRead"
    />

    <div class="flex-1 flex overflow-hidden relative">
      <aside
        class="w-full lg:w-80 border-r border-cinnamon-ice/20 flex flex-col shrink-0 bg-white transition-all duration-300 overflow-hidden"
        :class="[
          isMobile && selectedChatId
            ? '-translate-x-full absolute inset-0'
            : 'translate-x-0 relative',
        ]"
      >
        <div class="p-4 flex items-center justify-between">
          <h1 class="text-2xl font-geist font-bold">Inbox</h1>
          <button
            class="p-2 hover:bg-cream rounded-full transition-colors text-noble-black/70 hover:text-burning-orange"
            @click="showNewChatModal = true"
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
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
        <div class="px-4 pb-4">
          <div class="relative group">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search users..."
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
          <div v-if="isLoading" class="p-4 space-y-4">
            <div v-for="i in 10" :key="i" class="flex gap-3 animate-pulse">
              <div class="w-12 h-12 bg-cream rounded-full"></div>
              <div class="flex-1 space-y-2 py-1">
                <div class="h-3 bg-cream rounded w-3/4"></div>
                <div class="h-2 bg-cream rounded w-1/2"></div>
              </div>
            </div>
          </div>
          <div v-else-if="isError" class="p-12 text-center flex flex-col items-center">
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
              @click="retryFetch"
            >
              Retry Action
            </button>
          </div>
          <template v-else>
            <div
              v-if="chats.length === 0"
              class="p-12 text-center flex flex-col items-center opacity-40"
            >
              <p class="text-sm font-bold mb-1">No conversations yet</p>
              <button
                class="text-xs font-bold text-burning-orange uppercase tracking-wider mt-2"
                @click="showNewChatModal = true"
              >
                Start Chat
              </button>
            </div>
            <div
              v-for="chat in filteredChats"
              v-else
              :key="chat.id"
              class="px-4 py-3 cursor-pointer transition-all duration-200 relative group"
              :class="[selectedChatId === chat.id ? 'bg-cream' : 'hover:bg-cream/40']"
              @click="selectChat(chat.id)"
            >
              <div class="flex items-start gap-3">
                <div
                  class="w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-sm shadow-sm"
                  :class="chat.avatarColor"
                >
                  {{ getInitials(chat.userName) }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex justify-between items-start mb-0.5">
                    <span
                      class="font-bold text-[15px] truncate"
                      :class="{ 'text-burning-orange': chat.unreadCount > 0 }"
                      >{{ chat.userName }}</span
                    ><span
                      class="text-[11px] text-noble-black/40 shrink-0 whitespace-nowrap ml-2"
                      >{{ getChatTimeFormatted(chat) }}</span
                    >
                  </div>
                  <div
                    v-if="chat.borrowedItem"
                    class="text-[12px] text-noble-black/50 mb-1 truncate italic"
                  >
                    {{ chat.borrowedItem }}
                  </div>
                  <p
                    class="text-[13px] text-noble-black/60 truncate"
                    :class="{ 'font-semibold text-noble-black/80': chat.unreadCount > 0 }"
                  >
                    {{ getChatPreview(chat) }}
                  </p>
                </div>
              </div>
              <div
                v-if="chat.unreadCount > 0"
                class="absolute right-4 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-burning-orange rounded-full shadow-sm"
              ></div>
            </div>
          </template>
        </div>
      </aside>

      <main
        class="flex-1 flex flex-col bg-cream relative overflow-hidden transition-all duration-300"
        :class="[
          isMobile && !selectedChatId
            ? 'translate-x-full absolute inset-0'
            : 'translate-x-0 relative',
        ]"
      >
        <div v-if="isLoading" class="flex-1 flex flex-col items-center justify-center space-y-4">
          <div
            class="w-12 h-12 border-4 border-cinnamon-ice/20 border-t-burning-orange rounded-full animate-spin"
          ></div>
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-noble-black/30">
            Fetching conversation...
          </p>
        </div>
        <div
          v-else-if="isError"
          class="flex-1 flex flex-col items-center justify-center text-center px-6"
        >
          <div
            class="w-20 h-20 bg-cinnabar-red/5 rounded-full flex items-center justify-center mb-6 text-cinnabar-red/40"
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path
                d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
              />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h2 class="text-xl font-bold mb-2">Something went wrong</h2>
          <p class="text-sm text-noble-black/50 mb-6">We couldn't load your chat.</p>
          <button
            class="bg-blue-estate text-white text-[13px] font-bold px-6 py-2.5 rounded-full hover:bg-burning-orange transition-all duration-300"
            @click="retryFetch"
          >
            Retry Action
          </button>
        </div>

        <template v-else-if="selectedChat">
          <div
            class="h-16 bg-white border-b border-cinnamon-ice/20 flex items-center justify-between px-4 lg:px-6 shrink-0 shadow-sm z-10"
          >
            <div class="flex items-center gap-3">
              <button
                class="lg:hidden p-2 -ml-2 hover:bg-cream rounded-full transition-colors"
                @click="closeChat"
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
                class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs"
                :class="selectedChat.avatarColor"
              >
                {{ getInitials(selectedChat.userName) }}
              </div>
              <div class="flex flex-col">
                <span class="font-bold text-[15px] leading-tight">{{ selectedChat.userName }}</span
                ><span v-if="selectedChat.borrowedItem" class="text-[12px] text-noble-black/50">{{
                  selectedChat.borrowedItem
                }}</span>
              </div>
            </div>
            <button
              v-if="selectedChat.borrowedItem"
              class="hidden sm:block bg-burning-orange text-white text-[13px] font-bold px-4 py-2 rounded-full hover:bg-burning-orange/90 transition-all duration-300 shadow-sm active:scale-95"
            >
              View Item
            </button>
          </div>

          <div
            ref="chatAreaRef"
            class="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-chat-scrollbar"
          >
            <div
              v-if="selectedChat.messages.length === 0"
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
            <template v-else>
              <div class="flex justify-center">
                <span
                  class="text-[11px] font-bold uppercase tracking-wider text-noble-black/30 bg-white/40 px-3 py-1 rounded-full"
                  >Today</span
                >
              </div>
              <div
                v-for="(msg, index) in selectedChat.messages"
                :key="msg.id"
                class="flex flex-col max-w-[85%] lg:max-w-[75%]"
                :class="[msg.senderId === 'me' ? 'self-end items-end' : 'self-start items-start']"
              >
                <div
                  class="px-4 py-2.5 rounded-2xl text-[14px] shadow-sm leading-relaxed relative"
                  :class="[
                    msg.senderId === 'me'
                      ? 'bg-blue-estate text-white rounded-tr-none'
                      : 'bg-white text-noble-black border border-cinnamon-ice/30 rounded-tl-none',
                  ]"
                >
                  {{ msg.text }}
                </div>
                <div class="mt-1 flex items-center gap-2">
                  <span
                    v-if="index === selectedChat.messages.length - 1"
                    class="text-[10px] text-noble-black/40 font-medium"
                    >{{ formatDetailedTime(msg.timestamp) }}</span
                  >
                  <div
                    v-if="msg.senderId === 'me' && msg.isSeen"
                    class="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[6px] text-white font-bold transition-all duration-500 scale-100"
                    :class="selectedChat.avatarColor"
                  >
                    {{ getInitials(selectedChat.userName) }}
                  </div>
                </div>
              </div>
            </template>
          </div>

          <transition name="fade"
            ><div v-if="showWarning" class="mx-6 mb-2">
              <p class="text-[11px] text-noble-black/40 text-center leading-normal">
                For your safety and privacy, we've censored information that appears to be personal
                contact details. <br />Please keep all communication within the TakeUP chat
                platform.
              </p>
            </div></transition
          >

          <div class="bg-white p-4 border-t border-cinnamon-ice/20 shrink-0 relative">
            <div class="flex items-end gap-2 lg:gap-3">
              <div class="flex gap-0.5 lg:gap-1 mb-1">
                <input
                  ref="photoInputRef"
                  type="file"
                  class="hidden"
                  accept="image/*"
                  @change="handleFileChange"
                /><input ref="fileInputRef" type="file" class="hidden" @change="handleFileChange" />
                <button
                  class="p-2 text-noble-black/50 hover:text-burning-orange transition-colors duration-200"
                  @click="triggerPhotoUpload"
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
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3-3-3 3-6-6-6 6" />
                  </svg>
                </button>
                <button
                  class="p-2 text-noble-black/50 hover:text-burning-orange transition-colors duration-200"
                  @click="triggerFileUpload"
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
                    <path
                      d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48"
                    />
                  </svg>
                </button>
              </div>
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
                <button
                  class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-noble-black/30 hover:text-burning-orange transition-colors duration-200 cursor-default"
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
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" x2="9.01" y1="9" y2="9" />
                    <line x1="15" x2="15.01" y1="9" y2="9" />
                  </svg>
                </button>
              </div>
              <button
                class="p-2.5 mb-1 bg-burning-orange text-white rounded-full shadow-md hover:bg-burning-orange/90 transition-all duration-300 active:scale-95 shrink-0"
                :disabled="!newMessage.trim()"
                :class="{ 'opacity-50 grayscale cursor-not-allowed': !newMessage.trim() }"
                @click="sendMessage"
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

    <!-- New Message Modal -->
    <transition name="fade">
      <div
        v-if="showNewChatModal"
        class="fixed inset-0 z-[2000] flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-noble-black/40 backdrop-blur-sm"
          @click="showNewChatModal = false"
        ></div>
        <div
          class="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        >
          <div class="p-6 border-b border-cinnamon-ice/10 flex items-center justify-between">
            <h2 class="text-xl font-bold font-geist">New Message</h2>
            <button
              class="p-2 hover:bg-cream rounded-full transition-colors"
              @click="showNewChatModal = false"
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
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div class="px-4 pb-4 mt-4">
            <div class="relative group">
              <input
                v-model="userSearchQuery"
                type="text"
                placeholder="Search people..."
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
          <div class="flex-1 overflow-y-auto custom-chat-scrollbar pb-6">
            <div class="px-6 mb-2">
              <p class="text-[11px] font-bold uppercase tracking-wider text-noble-black/30">
                Suggested
              </p>
            </div>
            <div
              v-for="user in filteredUsers"
              :key="user.id"
              class="px-6 py-3 flex items-center gap-4 cursor-pointer hover:bg-cream transition-colors group"
              @click="startNewChat(user)"
            >
              <div
                class="w-11 h-11 rounded-full flex-none flex items-center justify-center text-white font-bold text-xs"
                :class="user.avatarColor"
              >
                {{ getInitials(user.name) }}
              </div>
              <span
                class="font-bold text-[15px] group-hover:text-burning-orange transition-colors truncate flex-1"
                >{{ user.name }}</span
              >
            </div>
          </div>
        </div>
      </div>
    </transition>
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
