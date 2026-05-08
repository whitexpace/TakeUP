<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import { useChat } from "../composables/use-chat"
import type { ChatMessage } from "../composables/use-chat"
import { useNotifications } from "../composables/use-notifications"
import { insertTextAtSelection } from "../utils/chat-composer"
import { getLastOutgoingMessageId } from "../utils/chat-message-utils"
import { getChatClosedPreviewLabel } from "#shared/chat-rules"
import { containsModeratedContent, sanitizeChatMessage } from "#shared/chat-moderation"

definePageMeta({
  layout: false,
})

const EMOJI_OPTIONS = ["😀", "😂", "😍", "🥹", "😎", "😭", "👍", "🙏", "🔥", "❤️", "🎉", "👀"]
const MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024

const { notifications, loadNotifications } = useNotifications()

const {
  sortedConversations,
  activeConversation,
  messages,
  isLoadingConversations,
  isLoadingMessages,
  isOpeningConversation,
  isSending,
  isReporting,
  error,
  hasMoreMessages,
  loadConversations,
  openConversation,
  sendMessage: sendChatMessage,
  reportConversation,
  loadUnreadCount,
  mergeActiveConversationMessages,
  closeConversation,
  loadMoreMessages,
} = useChat()

const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()
const runtimeConfig = useRuntimeConfig()

const isMobile = ref(false)
const searchQuery = ref("")
const newMessage = ref("")
const showWarning = ref(false)
const showEmojiPicker = ref(false)
const showReportModal = ref(false)
const reportDescription = ref("")
const reportError = ref<string | null>(null)
const reportSuccessMessage = ref<string | null>(null)
const composerError = ref<string | null>(null)
const isUploadingImage = ref(false)
const pendingImageFile = ref<File | null>(null)
const pendingImagePreviewUrl = ref<string | null>(null)

const chatAreaRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const photoInputRef = ref<HTMLInputElement | null>(null)
const emojiMenuRef = ref<HTMLElement | null>(null)

const routeTransactionId = computed(() => {
  const transactionId = route.query.transactionId
  return typeof transactionId === "string" ? transactionId : null
})

const filteredConversations = computed(() =>
  sortedConversations.value.filter((conversation) => {
    if (!searchQuery.value) return true
    const query = searchQuery.value.toLowerCase()
    const name = getParticipantName(conversation.otherParticipant).toLowerCase()
    const itemName = conversation.item?.name?.toLowerCase() ?? ""
    return name.includes(query) || itemName.includes(query)
  }),
)

const canSendMessage = computed(
  () =>
    Boolean(newMessage.value.trim() || pendingImageFile.value) &&
    !isSending.value &&
    !isUploadingImage.value &&
    !activeConversation.value?.isExpired,
)

const lastOutgoingMessageId = computed(() =>
  getLastOutgoingMessageId(messages.value, activeConversation.value?.otherParticipant?.id),
)

const avatarColors = ["bg-burning-orange", "bg-blue-estate", "bg-cinnamon-ice"]

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()

const getParticipantName = (participant: { firstName: string; lastName: string } | null) =>
  participant ? `${participant.firstName} ${participant.lastName}` : "Unknown"

const getAvatarColor = (id: string) => {
  let hash = 0
  for (const character of id) hash = character.charCodeAt(0) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

const getFetchErrorMessage = (value: unknown, fallback: string) => {
  const maybeError = value as {
    data?: { message?: string; statusMessage?: string }
    message?: string
    statusMessage?: string
  }

  return (
    maybeError?.data?.message ||
    maybeError?.data?.statusMessage ||
    maybeError?.statusMessage ||
    maybeError?.message ||
    fallback
  )
}

const checkMobile = () => {
  isMobile.value = window.innerWidth < 1024
}

const scrollToBottom = () => {
  nextTick(() => {
    if (chatAreaRef.value) {
      chatAreaRef.value.scrollTop = chatAreaRef.value.scrollHeight
    }
  })
}

const adjustTextareaHeight = () => {
  const element = textareaRef.value
  if (!element) return
  element.style.height = "auto"
  element.style.height = `${Math.min(element.scrollHeight, 140)}px`
}

const clearComposerImage = () => {
  pendingImageFile.value = null
  if (pendingImagePreviewUrl.value) {
    URL.revokeObjectURL(pendingImagePreviewUrl.value)
    pendingImagePreviewUrl.value = null
  }
}

const resetComposer = () => {
  newMessage.value = ""
  composerError.value = null
  showEmojiPicker.value = false
  clearComposerImage()
  nextTick(adjustTextareaHeight)
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
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  if (isToday) return time
  if (yesterday.toDateString() === date.toDateString()) return `Yesterday, ${time}`
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`
}

const getChatPreview = (conversation: (typeof sortedConversations.value)[0]) => {
  const closedPreview = getChatClosedPreviewLabel(conversation.closureState)
  if (closedPreview) return closedPreview
  if (!conversation.lastMessage) return "Start a conversation"
  const preview = sanitizeChatMessage(conversation.lastMessage.body)
    .replace(/<[^>]*>?/gm, "")
    .trim()
    .slice(0, 60)
  return preview || "Photo"
}

const getChatTime = (conversation: (typeof sortedConversations.value)[0]) => {
  if (!conversation.lastMessage) return ""
  return formatTimestamp(conversation.lastMessage.createdAt)
}

const getClosedConversationLabel = (conversation: NonNullable<typeof activeConversation.value>) =>
  getChatClosedPreviewLabel(conversation.closureState) ?? "Chat unavailable"

const openConversationFromRoute = async (transactionId: string) => {
  await openConversation(transactionId)
  scrollToBottom()
}

const triggerPhotoPicker = () => {
  if (activeConversation.value?.isExpired) return
  photoInputRef.value?.click()
}

const handlePhotoSelected = (event: Event) => {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0] ?? null
  if (input) input.value = ""
  if (!file) return

  if (!file.type.startsWith("image/")) {
    composerError.value = "Only image files can be attached in chat."
    return
  }

  if (file.size > MAX_CHAT_IMAGE_BYTES) {
    composerError.value = "Chat photos must be 5 MB or smaller."
    return
  }

  composerError.value = null
  clearComposerImage()
  pendingImageFile.value = file
  pendingImagePreviewUrl.value = URL.createObjectURL(file)
  nextTick(adjustTextareaHeight)
}

const uploadChatImage = async (file: File) => {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const accessToken = session?.access_token
  if (!accessToken) {
    throw new Error("You must be signed in to upload a chat photo.")
  }

  const signedUpload = await $fetch<{ token: string; path: string; publicUrl: string }>(
    "/api/chat/upload-url",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {
        fileName: file.name,
      },
    },
  )

  const { error: uploadError } = await supabase.storage
    .from(runtimeConfig.public.chatImageBucket)
    .uploadToSignedUrl(signedUpload.path, signedUpload.token, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    })

  if (uploadError) {
    throw new Error(uploadError.message || "Unable to upload your chat photo.")
  }

  return signedUpload.publicUrl
}

const handleSelectChat = async (transactionId: string) => {
  if (!transactionId) return

  await router.replace({
    path: "/chat",
    query: { transactionId },
  })
}

const handleCloseChat = async () => {
  resetComposer()

  if (routeTransactionId.value) {
    await router.replace({ path: "/chat" })
    return
  }

  closeConversation()
}

const handleSendMessage = async () => {
  if (!canSendMessage.value || !activeConversation.value) {
    return
  }

  const body = newMessage.value
  const shouldWarn = containsModeratedContent(body)
  composerError.value = null

  try {
    let imageUrl: string | null = null
    if (pendingImageFile.value) {
      isUploadingImage.value = true
      imageUrl = await uploadChatImage(pendingImageFile.value)
    }

    const sentMessage = await sendChatMessage(body, imageUrl)
    if (!sentMessage) return

    if (shouldWarn) {
      showWarning.value = true
      window.setTimeout(() => {
        showWarning.value = false
      }, 8000)
    }

    resetComposer()
    scrollToBottom()
  } catch (uploadError) {
    composerError.value = getFetchErrorMessage(uploadError, "Unable to send your message.")
  } finally {
    isUploadingImage.value = false
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault()
    void handleSendMessage()
  }
}

const handleComposerInput = () => {
  composerError.value = null
  adjustTextareaHeight()
}

const toggleEmojiPicker = () => {
  if (activeConversation.value?.isExpired) return
  showEmojiPicker.value = !showEmojiPicker.value
}

const handleEmojiSelect = (emoji: string) => {
  const element = textareaRef.value
  const selectionStart = element?.selectionStart ?? newMessage.value.length
  const selectionEnd = element?.selectionEnd ?? newMessage.value.length
  const result = insertTextAtSelection(newMessage.value, emoji, selectionStart, selectionEnd)

  newMessage.value = result.value
  showEmojiPicker.value = false

  nextTick(() => {
    adjustTextareaHeight()
    element?.focus()
    element?.setSelectionRange(result.selectionStart, result.selectionEnd)
  })
}

const openReportModal = () => {
  reportError.value = null
  reportDescription.value = ""
  showReportModal.value = true
}

const closeReportModal = () => {
  showReportModal.value = false
  reportError.value = null
}

const handleSubmitReport = async () => {
  reportError.value = null
  const report = await reportConversation(reportDescription.value)

  if (!report) {
    reportError.value = error.value ?? "Unable to submit the chat report."
    return
  }

  closeReportModal()
  reportSuccessMessage.value =
    "Chat report submitted. Our team can now review this transaction dispute."
  window.setTimeout(() => {
    reportSuccessMessage.value = null
  }, 6000)
}

const handleDocumentClick = (event: MouseEvent) => {
  if (!showEmojiPicker.value) return
  const target = event.target as Node | null
  if (target && emojiMenuRef.value?.contains(target)) {
    return
  }
  showEmojiPicker.value = false
}

let pollTimer: ReturnType<typeof setInterval> | null = null

const startPolling = () => {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    if (!activeConversation.value) return

    try {
      await loadConversations()
      const data = await $fetch<{
        messages: ChatMessage[]
        nextCursor: string | null
        hasMore: boolean
      }>("/api/chat/messages", {
        params: {
          conversationId: activeConversation.value.conversationId,
        },
      })

      await mergeActiveConversationMessages(data.messages)
    } catch {
      // Ignore transient polling errors.
    }
  }, 5000)
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

watch(messages, () => scrollToBottom(), { deep: true })
watch([newMessage, pendingImagePreviewUrl], () => nextTick(adjustTextareaHeight))
watch(
  () => activeConversation.value?.isExpired,
  (isExpired) => {
    if (isExpired) {
      resetComposer()
    }
  },
)

watch(routeTransactionId, async (transactionId, previousTransactionId) => {
  resetComposer()

  if (transactionId) {
    await openConversationFromRoute(transactionId)
    return
  }

  if (previousTransactionId) {
    closeConversation()
  }
})

onMounted(async () => {
  checkMobile()
  window.addEventListener("resize", checkMobile)
  document.addEventListener("click", handleDocumentClick)

  await Promise.all([loadNotifications(), loadConversations(), loadUnreadCount()])

  if (routeTransactionId.value) {
    await openConversationFromRoute(routeTransactionId.value)
  }

  startPolling()
  nextTick(adjustTextareaHeight)
})

onUnmounted(() => {
  window.removeEventListener("resize", checkMobile)
  document.removeEventListener("click", handleDocumentClick)
  stopPolling()
  clearComposerImage()
})
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden bg-white pt-14 font-geist text-noble-black">
    <Header :notifications="notifications" />

    <div class="relative flex flex-1 overflow-hidden">
      <aside
        class="relative flex w-full shrink-0 flex-col overflow-hidden border-r border-cinnamon-ice/20 bg-white transition-all duration-300 lg:w-80"
        :class="[
          isMobile && routeTransactionId ? '-translate-x-full absolute inset-0' : 'translate-x-0',
        ]"
      >
        <div class="flex items-center justify-between p-4">
          <h1 class="text-2xl font-bold">Inbox</h1>
        </div>

        <div class="px-4 pb-4">
          <div class="group relative">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search conversations..."
              class="w-full rounded-full border border-cinnamon-ice/30 bg-cream/50 py-2 pl-11 pr-4 text-[14px] outline-none transition-all duration-300 focus:border-burning-orange/50 focus:bg-white"
            />
            <Icon
              name="ph:magnifying-glass-light"
              class="absolute left-4 top-1/2 -translate-y-1/2 text-noble-black/30 transition-colors group-focus-within:text-burning-orange"
              size="16"
            />
          </div>
        </div>

        <div class="custom-chat-scrollbar flex-1 overflow-y-auto">
          <div v-if="isLoadingConversations" class="space-y-4 p-4">
            <div v-for="index in 6" :key="index" class="flex animate-pulse gap-3">
              <div class="h-12 w-12 rounded-full bg-cream"></div>
              <div class="flex-1 space-y-2 py-1">
                <div class="h-3 w-3/4 rounded bg-cream"></div>
                <div class="h-2 w-1/2 rounded bg-cream"></div>
              </div>
            </div>
          </div>

          <div
            v-else-if="error && !sortedConversations.length && !routeTransactionId"
            class="flex flex-col items-center p-12 text-center"
          >
            <div
              class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cinnabar-red/5 text-cinnabar-red/60"
            >
              <Icon name="ph:warning-circle-light" size="24" />
            </div>
            <p class="mb-4 text-sm font-medium text-noble-black/60">Failed to load conversations</p>
            <button
              class="text-xs font-bold uppercase tracking-wider text-blue-estate transition-colors hover:text-burning-orange"
              @click="loadConversations"
            >
              Retry
            </button>
          </div>

          <template v-else>
            <div
              v-if="sortedConversations.length === 0 && !isLoadingConversations"
              class="flex flex-col items-center p-12 text-center opacity-40"
            >
              <p class="mb-1 text-sm font-bold">No conversations yet</p>
              <p class="text-xs">Conversations appear once a booking has been accepted.</p>
            </div>

            <div
              v-for="conversation in filteredConversations"
              v-else
              :key="conversation.conversationId"
              class="group relative cursor-pointer px-4 py-3 transition-all duration-200"
              :class="[
                routeTransactionId === conversation.transactionId ||
                activeConversation?.transactionId === conversation.transactionId
                  ? 'bg-cream'
                  : 'hover:bg-cream/40',
              ]"
              @click="handleSelectChat(conversation.transactionId)"
            >
              <div class="flex items-start gap-3">
                <div
                  v-if="conversation.otherParticipant?.avatarUrl"
                  class="h-12 w-12 shrink-0 overflow-hidden rounded-full"
                >
                  <img
                    :src="conversation.otherParticipant.avatarUrl"
                    :alt="getParticipantName(conversation.otherParticipant)"
                    class="h-full w-full object-cover"
                  />
                </div>
                <div
                  v-else
                  class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
                  :class="
                    getAvatarColor(conversation.otherParticipant?.id ?? conversation.conversationId)
                  "
                >
                  {{ getInitials(getParticipantName(conversation.otherParticipant)) }}
                </div>

                <div class="min-w-0 flex-1">
                  <div class="mb-0.5 flex items-start justify-between">
                    <span
                      class="truncate text-[15px] font-bold"
                      :class="{ 'text-burning-orange': conversation.unreadCount > 0 }"
                    >
                      {{ getParticipantName(conversation.otherParticipant) }}
                    </span>
                    <span class="ml-2 shrink-0 whitespace-nowrap text-[11px] text-noble-black/40">
                      {{ getChatTime(conversation) }}
                    </span>
                  </div>
                  <div
                    v-if="conversation.item"
                    class="mb-1 truncate text-[12px] italic text-noble-black/50"
                  >
                    {{ conversation.item.name }}
                  </div>
                  <p
                    class="truncate text-[13px] text-noble-black/60"
                    :class="{ 'font-semibold text-noble-black/80': conversation.unreadCount > 0 }"
                  >
                    {{ getChatPreview(conversation) }}
                  </p>
                </div>
              </div>

              <div
                v-if="conversation.unreadCount > 0"
                class="absolute right-4 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-burning-orange shadow-sm"
              ></div>
            </div>
          </template>
        </div>
      </aside>

      <main
        class="relative flex flex-1 flex-col overflow-hidden bg-cream transition-all duration-300"
        :class="[
          isMobile && !routeTransactionId ? 'translate-x-full absolute inset-0' : 'translate-x-0',
        ]"
      >
        <div
          v-if="isOpeningConversation && !activeConversation"
          class="flex flex-1 flex-col items-center justify-center space-y-4"
        >
          <div
            class="h-12 w-12 animate-spin rounded-full border-4 border-cinnamon-ice/20 border-t-burning-orange"
          ></div>
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-noble-black/30">
            Opening conversation...
          </p>
        </div>

        <div
          v-else-if="isLoadingMessages && !messages.length"
          class="flex flex-1 flex-col items-center justify-center space-y-4"
        >
          <div
            class="h-12 w-12 animate-spin rounded-full border-4 border-cinnamon-ice/20 border-t-burning-orange"
          ></div>
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-noble-black/30">
            Loading messages...
          </p>
        </div>

        <template v-else-if="activeConversation">
          <div
            class="z-10 flex h-16 shrink-0 items-center justify-between border-b border-cinnamon-ice/20 bg-white px-4 shadow-sm lg:px-6"
          >
            <div class="flex items-center gap-3">
              <button
                class="-ml-2 rounded-full p-2 transition-colors hover:bg-cream lg:hidden"
                @click="handleCloseChat"
              >
                <Icon name="ph:caret-left-light" size="20" />
              </button>

              <NuxtLink
                v-if="activeConversation.otherParticipant?.username"
                :to="`/profile/${activeConversation.otherParticipant.username}`"
                class="flex items-center gap-3 group/participant"
              >
                <div
                  v-if="activeConversation.otherParticipant?.avatarUrl"
                  class="h-10 w-10 overflow-hidden rounded-full group-hover/participant:scale-105 transition-transform"
                >
                  <img
                    :src="activeConversation.otherParticipant.avatarUrl"
                    :alt="getParticipantName(activeConversation.otherParticipant)"
                    class="h-full w-full object-cover"
                  />
                </div>
                <div
                  v-else
                  class="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white group-hover/participant:scale-105 transition-transform"
                  :class="
                    getAvatarColor(
                      activeConversation.otherParticipant?.id ?? activeConversation.conversationId,
                    )
                  "
                >
                  {{ getInitials(getParticipantName(activeConversation.otherParticipant)) }}
                </div>

                <div class="flex flex-col">
                  <span
                    class="text-[15px] font-bold leading-tight group-hover:text-burning-orange transition-colors"
                    >{{ getParticipantName(activeConversation.otherParticipant) }}</span
                  >
                  <span v-if="activeConversation.item" class="text-[12px] text-noble-black/50">{{
                    activeConversation.item.name
                  }}</span>
                </div>
              </NuxtLink>
              <div v-else class="flex items-center gap-3">
                <div
                  v-if="activeConversation.otherParticipant?.avatarUrl"
                  class="h-10 w-10 overflow-hidden rounded-full"
                >
                  <img
                    :src="activeConversation.otherParticipant.avatarUrl"
                    :alt="getParticipantName(activeConversation.otherParticipant)"
                    class="h-full w-full object-cover"
                  />
                </div>
                <div
                  v-else
                  class="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white"
                  :class="
                    getAvatarColor(
                      activeConversation.otherParticipant?.id ?? activeConversation.conversationId,
                    )
                  "
                >
                  {{ getInitials(getParticipantName(activeConversation.otherParticipant)) }}
                </div>

                <div class="flex flex-col">
                  <span class="text-[15px] font-bold leading-tight">{{
                    getParticipantName(activeConversation.otherParticipant)
                  }}</span>
                  <span v-if="activeConversation.item" class="text-[12px] text-noble-black/50">{{
                    activeConversation.item.name
                  }}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                class="rounded-full border border-burning-orange/60 px-3 py-2 text-[12px] font-semibold text-burning-orange transition-colors hover:bg-burning-orange/5 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="isReporting"
                @click="openReportModal"
              >
                {{ isReporting ? "Reporting..." : "Report" }}
              </button>
              <NuxtLink
                v-if="activeConversation.item"
                :to="`/items/${activeConversation.item.id}`"
                class="hidden rounded-full bg-burning-orange px-4 py-2 text-[13px] font-bold text-white shadow-sm transition-all duration-300 hover:bg-burning-orange/90 sm:block"
              >
                View Item
              </NuxtLink>
            </div>
          </div>

          <div
            v-if="activeConversation.isExpired"
            class="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center"
          >
            <p class="text-xs font-medium text-amber-700">
              {{ activeConversation.closedNotice }}
            </p>
          </div>

          <div
            v-if="reportSuccessMessage"
            class="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-center"
          >
            <p class="text-xs font-medium text-emerald-700">{{ reportSuccessMessage }}</p>
          </div>

          <div
            ref="chatAreaRef"
            class="custom-chat-scrollbar flex flex-1 flex-col gap-6 overflow-y-auto p-6"
          >
            <div v-if="hasMoreMessages" class="flex justify-center">
              <button
                class="text-[11px] font-bold uppercase tracking-wider text-noble-black/30 transition-colors hover:text-burning-orange"
                :disabled="isLoadingMessages"
                @click="loadMoreMessages"
              >
                {{ isLoadingMessages ? "Loading..." : "Load earlier messages" }}
              </button>
            </div>

            <div
              v-if="messages.length === 0 && !isLoadingMessages"
              class="flex flex-1 flex-col items-center justify-center py-12 text-center opacity-40"
            >
              <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white">
                <Icon name="ph:chat-centered-dots-light" size="24" />
              </div>
              <p class="text-sm font-bold">No messages yet</p>
              <p class="text-xs">Start the conversation</p>
            </div>

            <template v-else>
              <div class="flex justify-center">
                <span
                  class="rounded-full bg-white/40 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-noble-black/30"
                  >Today</span
                >
              </div>

              <div
                v-for="message in messages"
                :key="message.id"
                class="flex max-w-[85%] flex-col lg:max-w-[70%] min-w-0"
                :class="[
                  message.senderUserId !== activeConversation.otherParticipant?.id
                    ? 'self-end items-end'
                    : 'self-start items-start',
                ]"
              >
                <div
                  class="relative rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed shadow-sm min-w-0"
                  :class="[
                    message.senderUserId !== activeConversation.otherParticipant?.id
                      ? 'rounded-tr-none bg-blue-estate text-white'
                      : 'rounded-tl-none border border-cinnamon-ice/30 bg-white text-noble-black',
                  ]"
                >
                  <img
                    v-if="message.imageUrl"
                    :src="message.imageUrl"
                    alt="Chat attachment"
                    class="mb-3 max-h-64 w-full rounded-2xl object-cover"
                  />
                  <p
                    v-if="message.body.trim()"
                    class="whitespace-pre-wrap break-all md:break-words overflow-hidden"
                  >
                    {{ sanitizeChatMessage(message.body) }}
                  </p>
                </div>

                <span
                  v-if="message.senderUserId === activeConversation.otherParticipant?.id"
                  class="mt-1 text-[10px] font-medium text-noble-black/40"
                >
                  {{ formatDetailedTime(message.createdAt) }}
                </span>
                <span
                  v-else-if="message.id === lastOutgoingMessageId"
                  class="mt-1 text-[10px] font-medium text-noble-black/40"
                >
                  {{ message.isRead ? "Seen" : "Sent" }} ·
                  {{ formatDetailedTime(message.createdAt) }}
                </span>
                <span v-else class="mt-1 text-[10px] font-medium text-noble-black/40">
                  {{ formatDetailedTime(message.createdAt) }}
                </span>
              </div>
            </template>
          </div>

          <transition name="fade">
            <div v-if="showWarning" class="mx-6 mb-2">
              <p class="text-center text-[11px] leading-normal text-noble-black/40">
                Personal contact details and profanity are automatically censored in chat and inbox
                previews. Please keep all communication inside TakeUP.
              </p>
            </div>
          </transition>

          <div
            v-if="activeConversation.isExpired"
            class="shrink-0 border-t border-cinnamon-ice/20 bg-white p-4"
          >
            <div
              class="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3"
            >
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-200 text-stone-600"
              >
                <Icon name="ph:minus-circle-light" size="18" />
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-noble-black">
                  {{ getClosedConversationLabel(activeConversation) }}
                </p>
                <p class="text-xs text-noble-black/60">
                  {{ activeConversation.closedNotice }}
                </p>
              </div>
            </div>
          </div>

          <div v-else class="relative shrink-0 border-t border-cinnamon-ice/20 bg-white p-4 pb-6">
            <div
              v-if="pendingImagePreviewUrl"
              class="mb-3 flex items-start gap-3 rounded-2xl border border-cinnamon-ice/20 bg-cream/70 p-3"
            >
              <img
                :src="pendingImagePreviewUrl"
                alt="Pending chat upload"
                class="h-20 w-20 rounded-xl object-cover"
              />
              <div class="flex flex-1 flex-col gap-2">
                <p class="text-xs font-semibold text-noble-black/70">Photo ready to send</p>
                <button
                  class="w-fit rounded-full border border-cinnamon-ice/30 px-3 py-1 text-[11px] font-semibold text-noble-black/60 transition-colors hover:border-cinnabar-red/30 hover:text-cinnabar-red"
                  type="button"
                  @click="clearComposerImage"
                >
                  Remove photo
                </button>
              </div>
            </div>

            <div class="flex items-end gap-2 lg:gap-3">
              <!-- Photo Icon (Outside) -->
              <button
                class="mb-1 rounded-full p-2 text-noble-black/40 transition-colors hover:bg-cream hover:text-burning-orange disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                :disabled="isUploadingImage"
                @click="triggerPhotoPicker"
              >
                <Icon name="ph:image-light" size="20" />
              </button>

              <div
                class="relative flex flex-1 items-end rounded-[24px] border border-cinnamon-ice/20 bg-cream transition-all duration-300 focus-within:border-burning-orange/50"
              >
                <!-- Aa Icon (Inside Left) -->
                <div
                  class="mb-1 ml-3 flex h-8 w-8 items-center justify-center text-[15px] font-bold italic tracking-tighter text-noble-black/25 select-none"
                >
                  Aa
                </div>

                <textarea
                  ref="textareaRef"
                  v-model="newMessage"
                  rows="1"
                  :disabled="isUploadingImage"
                  placeholder="Type your message..."
                  class="custom-chat-scrollbar w-full resize-none bg-transparent px-2 py-2.5 text-[14px] leading-relaxed outline-none placeholder:text-noble-black/30"
                  style="min-height: 44px; max-height: 140px"
                  @input="handleComposerInput"
                  @keydown="handleKeydown"
                ></textarea>

                <div ref="emojiMenuRef" class="relative mb-1 mr-2">
                  <button
                    class="rounded-full p-2 text-noble-black/40 transition-colors hover:bg-white hover:text-burning-orange disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    @click.stop="toggleEmojiPicker"
                  >
                    <Icon name="ph:smiley-light" size="18" />
                  </button>

                  <div
                    v-if="showEmojiPicker"
                    class="absolute bottom-12 right-0 z-20 grid w-52 grid-cols-4 gap-2 rounded-2xl border border-cinnamon-ice/20 bg-white p-3 shadow-xl"
                  >
                    <button
                      v-for="emoji in EMOJI_OPTIONS"
                      :key="emoji"
                      class="rounded-xl px-2 py-2 text-lg transition-colors hover:bg-cream"
                      type="button"
                      @click="handleEmojiSelect(emoji)"
                    >
                      {{ emoji }}
                    </button>
                  </div>
                </div>
              </div>

              <button
                class="mb-1 shrink-0 rounded-full p-2.5 text-white shadow-md transition-all duration-300"
                :class="[
                  'bg-burning-orange hover:bg-burning-orange/90',
                  { 'cursor-not-allowed opacity-50 grayscale': !canSendMessage },
                ]"
                :disabled="!canSendMessage"
                @click="handleSendMessage"
              >
                <Icon name="ph:paper-plane-tilt-light" size="20" />
              </button>
            </div>

            <input
              ref="photoInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handlePhotoSelected"
            />

            <p v-if="isUploadingImage" class="mt-2 text-[11px] text-noble-black/40">
              Uploading photo...
            </p>
            <p v-if="composerError" class="mt-2 text-[11px] text-cinnabar-red">
              {{ composerError }}
            </p>
          </div>
        </template>

        <div
          v-else-if="error"
          class="flex flex-1 flex-col items-center justify-center bg-cream px-6 text-center"
        >
          <div
            class="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-cinnamon-ice/20 bg-white text-cinnabar-red/70 shadow-sm"
          >
            <Icon name="ph:warning-circle-light" size="32" />
          </div>
          <h2 class="mb-2 text-xl font-bold">Unable to open chat</h2>
          <p class="max-w-sm text-sm text-noble-black/60">{{ error }}</p>
        </div>

        <div
          v-else
          class="flex flex-1 flex-col items-center justify-center bg-cream px-6 text-center opacity-50"
        >
          <div
            class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <Icon name="ph:chat-centered-dots-light" size="32" />
          </div>
          <h2 class="mb-2 text-xl font-bold">Select a conversation</h2>
          <p class="max-w-sm text-sm text-noble-black/60">
            Choose a thread from the inbox to continue chatting.
          </p>
        </div>
      </main>
    </div>

    <Teleport to="body">
      <transition name="fade">
        <div
          v-if="showReportModal"
          class="fixed inset-0 z-[2000] flex items-center justify-center bg-noble-black/35 px-4"
        >
          <div
            class="w-full max-w-lg rounded-[28px] bg-white shadow-2xl overflow-hidden flex flex-col"
          >
            <!-- Header -->
            <div class="px-8 pt-8 pb-4 flex items-start justify-between gap-4 shrink-0">
              <div>
                <h2 class="text-[24px] font-bold text-noble-black">Report This Chat</h2>
                <p class="mt-1 text-[13px] font-medium text-noble-black/40">
                  Submit a report for inappropriate chat behavior.
                </p>
              </div>
              <button
                type="button"
                class="flex h-10 w-10 items-center justify-center rounded-full text-noble-black transition hover:bg-gray-100"
                @click="closeReportModal"
              >
                <Icon name="ph:x-light" size="18" />
              </button>
            </div>

            <!-- Content -->
            <div class="px-8 py-4 flex-1">
              <p class="text-sm leading-relaxed text-noble-black/60 mb-6">
                This will flag the conversation for review by our team and initiate a dispute
                process for this transaction if necessary.
              </p>

              <div class="relative">
                <label
                  class="block text-[13px] font-bold uppercase tracking-wider text-noble-black/50 mb-2"
                  for="chat-report-description"
                >
                  Report Details
                </label>
                <textarea
                  id="chat-report-description"
                  v-model="reportDescription"
                  rows="5"
                  maxlength="500"
                  class="w-full rounded-[12px] border-[1.5px] border-gray-200 bg-white px-4 py-3.5 text-sm outline-none transition-all focus:border-cinnabar-red focus:ring-4 focus:ring-cinnabar-red/5"
                  placeholder="Describe what happened in this conversation..."
                ></textarea>
                <div class="flex justify-between items-center mt-2">
                  <p v-if="reportError" class="text-[12px] font-medium text-cinnabar-red">
                    {{ reportError }}
                  </p>
                  <div class="ml-auto text-[11px] font-bold text-gray-400 tabular-nums">
                    {{ reportDescription.length }} / 500
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex gap-3">
              <button
                class="flex-1 h-12 rounded-[10px] border-[1.5px] border-cinnabar-red bg-white text-[15px] font-bold text-cinnabar-red transition-all hover:bg-cinnabar-red/5"
                @click="closeReportModal"
              >
                Cancel
              </button>
              <button
                class="flex-1 h-12 rounded-[10px] bg-cinnabar-red text-[15px] font-bold text-white transition-all shadow-lg shadow-cinnabar-red/20 hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="isReporting || !reportDescription.trim()"
                @click="handleSubmitReport"
              >
                {{ isReporting ? "Submitting..." : "Submit Report" }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>
