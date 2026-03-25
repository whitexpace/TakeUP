<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { useBag } from "../composables/use-bag"
import type { CommunityOfferNotification } from "~/types/community-requests"

defineOptions({
  name: "AppHeader",
})

const props = withDefaults(
  defineProps<{
    notifications?: CommunityOfferNotification[]
  }>(),
  {
    notifications: () => [],
  },
)

const emit = defineEmits<{
  (event: "mark-notification-read", notificationId: number): void
  (event: "mark-all-notifications-read"): void
}>()

const { bagCount } = useBag()
const headerRef = ref<HTMLElement | null>(null)
const showNotifications = ref(false)

const unreadNotificationCount = computed(() => {
  return props.notifications.filter((notification) => !notification.read).length
})

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
})

const formatFee = (fee: number) => {
  return fee === 0 ? "Free" : currencyFormatter.format(fee)
}

const formatRelativeTime = (timestamp: Date) => {
  const minutes = Math.max(1, Math.round((Date.now() - timestamp.getTime()) / (60 * 1000)))

  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.round(hours / 24)
  return `${days}d ago`
}

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value
}

const handleNotificationClick = (notificationId: number) => {
  emit("mark-notification-read", notificationId)
}

const markAllNotificationsRead = () => {
  emit("mark-all-notifications-read")
}

const handlePointerDownOutside = (event: PointerEvent) => {
  if (!showNotifications.value) return
  if (!(event.target instanceof Node)) return
  if (headerRef.value?.contains(event.target)) return
  showNotifications.value = false
}

onMounted(() => {
  document.addEventListener("pointerdown", handlePointerDownOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handlePointerDownOutside)
})
</script>

<template>
  <header
    ref="headerRef"
    class="sticky top-0 left-0 w-full h-14 bg-white border-b border-cinnamon-ice flex items-center z-[1000] shrink-0"
  >
    <!-- Left Section: Logo & App Name (Sidebar width on desktop) -->
    <div class="w-auto lg:w-80 flex items-center px-4 sm:px-6 shrink-0 gap-4">
      <slot name="left" />
      <a href="/dashboard" class="flex items-center gap-3">
        <img src="/images/logo.svg" alt="TakeUP Logo" class="h-8 w-auto" />
      </a>
    </div>

    <!-- Middle Section: Navigation (Centered) -->
    <div class="flex-1 flex justify-center overflow-hidden px-2">
      <nav class="hidden lg:flex items-center gap-8 whitespace-nowrap px-4">
        <NuxtLink
          to="/feed"
          class="text-noble-black font-geist font-normal hover:text-burning-orange transition-colors"
          active-class="text-burning-orange"
        >
          Requests
        </NuxtLink>
        <NuxtLink
          to="/account/listings/new"
          class="text-noble-black font-geist font-normal hover:text-burning-orange transition-colors"
          active-class="text-burning-orange"
        >
          List an Item
        </NuxtLink>
      </nav>
    </div>

    <!-- Right Section: Icons (Width matches Left on desktop for perfect centering) -->
    <div class="w-auto lg:w-80 flex justify-end items-center px-4 sm:px-6 gap-4 shrink-0">
      <!-- Notification Icon -->
      <div class="relative hidden md:block">
        <button
          class="relative p-1 text-noble-black transition-colors hover:text-burning-orange"
          title="Notifications"
          aria-label="Notifications"
          aria-haspopup="dialog"
          :aria-expanded="showNotifications"
          @click="toggleNotifications"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>

          <span
            v-if="unreadNotificationCount > 0"
            class="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-white bg-burning-orange px-1 text-[10px] font-bold text-white shadow-sm"
          >
            {{ unreadNotificationCount }}
          </span>
        </button>

        <transition name="notifications-menu">
          <div
            v-if="showNotifications"
            class="absolute right-0 top-11 z-[1100] w-[360px] rounded-[22px] border border-cinnamon-ice/20 bg-white p-3 shadow-2xl"
          >
            <div class="flex items-center justify-between gap-4 px-2 pb-3">
              <div>
                <p class="text-[12px] font-bold uppercase tracking-[0.14em] text-noble-black/35">
                  Notifications
                </p>
                <p class="mt-1 text-[13px] text-noble-black/50">
                  Offer updates for your request posts
                </p>
              </div>

              <button
                v-if="unreadNotificationCount > 0"
                class="text-[12px] font-bold text-blue-estate transition-colors hover:text-burning-orange"
                @click="markAllNotificationsRead"
              >
                Mark all read
              </button>
            </div>

            <div
              v-if="notifications.length > 0"
              class="flex max-h-[360px] flex-col gap-2 overflow-y-auto pr-1"
            >
              <button
                v-for="notification in notifications"
                :key="notification.id"
                class="rounded-[18px] border px-4 py-3 text-left transition-all"
                :class="
                  notification.read
                    ? 'border-cinnamon-ice/15 bg-cream/50'
                    : 'border-blue-estate/10 bg-blue-estate/5'
                "
                @click="handleNotificationClick(notification.id)"
              >
                <p class="text-[14px] font-semibold leading-snug text-noble-black">
                  {{ notification.actorName }} offered {{ notification.itemName }}
                </p>
                <p class="mt-1 text-[13px] leading-relaxed text-noble-black/55">
                  {{ notification.requestTitle }}
                </p>
                <div class="mt-3 flex items-center justify-between gap-3">
                  <span class="text-[12px] font-bold text-burning-orange">
                    {{ formatFee(notification.fee) }}
                  </span>
                  <span class="text-[12px] text-noble-black/35">
                    {{ formatRelativeTime(notification.createdAt) }}
                  </span>
                </div>
              </button>
            </div>

            <div
              v-else
              class="rounded-[18px] border border-dashed border-cinnamon-ice/25 bg-cream/50 px-4 py-6 text-center text-[13px] leading-relaxed text-noble-black/45"
            >
              No offer notifications yet.
            </div>
          </div>
        </transition>
      </div>

      <!-- Chat Icon -->
      <button
        class="hidden md:block text-noble-black hover:text-burning-orange transition-colors p-1"
        title="Chat"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      <!-- Heart Icon (Likes) -->
      <NuxtLink
        to="/likes"
        class="hidden md:block text-noble-black hover:text-burning-orange transition-colors p-1"
        active-class="text-burning-orange"
        title="Likes"
        aria-label="Likes"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
          />
        </svg>
      </NuxtLink>

      <!-- Cart Icon -->
      <NuxtLink
        to="/bag"
        class="hidden md:block text-noble-black hover:text-burning-orange transition-colors p-1 relative"
        active-class="text-burning-orange"
        title="Bag"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
        <span
          v-if="bagCount > 0"
          class="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-burning-orange text-white text-[10px] font-bold flex items-center justify-center border border-white rounded-full px-1 shadow-sm"
        >
          {{ bagCount }}
        </span>
      </NuxtLink>

      <!-- Profile Icon (Always Visible) -->
      <NuxtLink
        to="/account"
        class="text-noble-black hover:text-burning-orange transition-colors p-1 md:pl-3 md:border-l border-cinnamon-ice md:ml-1"
        active-class="text-burning-orange"
        title="Profile"
      >
        <template #default="{ isActive }">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            :fill="isActive ? 'currentColor' : 'none'"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </template>
      </NuxtLink>
    </div>
  </header>
</template>

<style scoped>
.notifications-menu-enter-active,
.notifications-menu-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.notifications-menu-enter-from,
.notifications-menu-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
