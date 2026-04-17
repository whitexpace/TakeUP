<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useBag } from "../composables/use-bag"
import { useChat } from "../composables/use-chat"
import { useLikes } from "../composables/use-likes"
import type { CommunityOfferNotification } from "~/types/community-requests"
import type { AppHeaderNotification } from "../types/notifications"

defineOptions({
  name: "AppHeader",
})

const props = withDefaults(
  defineProps<{
    notifications?: Array<CommunityOfferNotification | AppHeaderNotification>
    scrollContainerSelector?: string
    showNav?: boolean
    hideIcons?: boolean
    customPadding?: string
  }>(),
  {
    notifications: () => [],
    scrollContainerSelector: "",
    showNav: true,
    hideIcons: false,
    customPadding: "",
  },
)

const emit = defineEmits<{
  (event: "mark-notification-read", notificationId: string | number): void
  (event: "mark-all-notifications-read"): void
  (event: "visibility-change", visible: boolean): void
}>()

const { bagCount } = useBag()
const { likesCount, loadLikesCount } = useLikes()
const { totalUnreadCount: chatUnreadCount, loadUnreadCount: loadChatUnreadCount } = useChat()
const route = useRoute()
const headerRef = ref<HTMLElement | null>(null)
const showNotifications = ref(false)
const isVisible = ref(true)
const isAccountSectionActive = computed(
  () => route.path === "/account" || route.path.startsWith("/account/"),
)

watch(isVisible, (val) => {
  emit("visibility-change", val)
})

const lastScrollY = ref(0)
const scrollThreshold = 10 // Minimum scroll to trigger hide

const handleScroll = () => {
  let currentScrollY = window.scrollY

  if (props.scrollContainerSelector) {
    const container = document.querySelector(props.scrollContainerSelector)
    if (container) {
      currentScrollY = container.scrollTop
    }
  }

  // Always show at the very top
  if (currentScrollY < 50) {
    isVisible.value = true
    lastScrollY.value = currentScrollY
    return
  }

  // Determine direction
  if (Math.abs(currentScrollY - lastScrollY.value) < scrollThreshold) return

  if (currentScrollY > lastScrollY.value) {
    // Scrolling down
    isVisible.value = false
  } else {
    // Scrolling up
    isVisible.value = true
  }

  lastScrollY.value = currentScrollY
}

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

const getNotificationTitle = (notification: CommunityOfferNotification | AppHeaderNotification) => {
  if ("title" in notification) return notification.title
  return `${notification.actorName} offered ${notification.itemName}`
}

const getNotificationBody = (notification: CommunityOfferNotification | AppHeaderNotification) => {
  if ("body" in notification) return notification.body
  return notification.requestTitle
}

const getNotificationAccent = (
  notification: CommunityOfferNotification | AppHeaderNotification,
) => {
  if ("title" in notification) return null
  return formatFee(notification.fee)
}

const getNotificationActionPath = (
  notification: CommunityOfferNotification | AppHeaderNotification,
) => {
  if ("actionPath" in notification) return notification.actionPath ?? null
  return null
}

const handleNotificationClick = async (
  notification: CommunityOfferNotification | AppHeaderNotification,
) => {
  emit("mark-notification-read", notification.id)
  const actionPath = getNotificationActionPath(notification)
  if (actionPath) {
    showNotifications.value = false
    await navigateTo(actionPath)
  }
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

const setupScrollListener = () => {
  // Clean up previous listener if any
  window.removeEventListener("scroll", handleScroll)
  if (props.scrollContainerSelector) {
    const container = document.querySelector(props.scrollContainerSelector)
    container?.removeEventListener("scroll", handleScroll)
  }

  // Set up new listener
  if (props.scrollContainerSelector) {
    const container = document.querySelector(props.scrollContainerSelector)
    if (container) {
      container.addEventListener("scroll", handleScroll, { passive: true })
    } else {
      // If container not found yet, wait and retry or fallback
      window.addEventListener("scroll", handleScroll, { passive: true })
    }
  } else {
    window.addEventListener("scroll", handleScroll, { passive: true })
  }
}

watch(() => props.scrollContainerSelector, setupScrollListener)

onMounted(() => {
  document.addEventListener("pointerdown", handlePointerDownOutside)
  setupScrollListener()
  void loadLikesCount()
  void loadChatUnreadCount()
})

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handlePointerDownOutside)
  window.removeEventListener("scroll", handleScroll)
  if (props.scrollContainerSelector) {
    const container = document.querySelector(props.scrollContainerSelector)
    container?.removeEventListener("scroll", handleScroll)
  }
})
</script>

<template>
  <header
    ref="headerRef"
    class="fixed top-0 left-0 w-full h-14 bg-white border-b border-cinnamon-ice flex items-center z-[1000] shrink-0 transition-transform duration-500 ease-in-out"
    :class="{ '-translate-y-full': !isVisible }"
  >
    <!-- Left Section: Logo & App Name -->
    <div
      class="flex items-center shrink-0 gap-4"
      :class="[showNav ? 'lg:w-80' : '', customPadding || 'px-4 sm:px-6']"
    >
      <slot name="left" />
      <NuxtLink to="/dashboard" class="flex items-center gap-3">
        <img src="/images/logo.svg" alt="TakeUP Logo" class="h-8 w-auto" />
      </NuxtLink>
    </div>

    <!-- Middle Section: Navigation (Centered) -->
    <div v-if="showNav" class="flex-1 flex justify-center overflow-hidden px-2 h-full">
      <nav class="hidden lg:flex items-stretch gap-10 whitespace-nowrap px-4 h-full">
        <NuxtLink
          to="/dashboard"
          class="nav-link flex items-center text-[15px] text-noble-black font-geist font-normal transition-colors duration-300 ease-in-out hover:text-burning-orange"
          active-class="active-nav-link"
        >
          Dashboard
        </NuxtLink>
        <NuxtLink
          to="/feed"
          class="nav-link flex items-center text-[15px] text-noble-black font-geist font-normal transition-colors duration-300 ease-in-out hover:text-burning-orange"
          active-class="active-nav-link"
        >
          Community Feed
        </NuxtLink>
        <NuxtLink
          to="/account/listings/new"
          class="nav-link flex items-center text-[15px] text-noble-black font-geist font-normal transition-colors duration-300 ease-in-out hover:text-burning-orange"
          active-class="active-nav-link"
        >
          List an Item
        </NuxtLink>
      </nav>
    </div>
    <div v-else class="flex-1"></div>

    <!-- Right Section: Icons -->
    <div
      class="flex justify-end items-stretch gap-2 shrink-0 h-full"
      :class="[showNav ? 'lg:w-80' : '', customPadding || 'px-4 sm:px-6']"
    >
      <slot name="right" />

      <template v-if="!hideIcons">
        <!-- Notification Icon -->
        <div class="relative hidden md:flex items-stretch group/tooltip">
          <button
            class="nav-link flex items-center px-2 text-noble-black transition-colors duration-300 ease-in-out hover:text-burning-orange group"
            :class="{ 'active-nav-link': showNotifications }"
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
              class="transition-transform duration-300 ease-in-out group-hover:scale-110 group-active:scale-95"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>

            <span
              v-if="unreadNotificationCount > 0"
              class="absolute top-2.5 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-white bg-burning-orange px-1 text-[10px] font-bold text-white shadow-sm scale-90"
            >
              {{ unreadNotificationCount }}
            </span>
          </button>

          <div class="custom-tooltip">
            Notifications
            <div class="tooltip-arrow"></div>
          </div>

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
                  class="text-[12px] font-bold text-blue-estate transition-colors duration-300 hover:text-burning-orange"
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
                  class="rounded-[18px] border px-4 py-3 text-left transition-all duration-300"
                  :class="
                    notification.read
                      ? 'border-cinnamon-ice/15 bg-cream/50'
                      : 'border-blue-estate/10 bg-blue-estate/5'
                  "
                  @click="handleNotificationClick(notification)"
                >
                  <p class="text-[14px] font-semibold leading-snug text-noble-black">
                    {{ getNotificationTitle(notification) }}
                  </p>
                  <p class="mt-1 text-[13px] leading-relaxed text-noble-black/55">
                    {{ getNotificationBody(notification) }}
                  </p>
                  <div class="mt-3 flex items-center justify-between gap-3">
                    <span class="text-[12px] font-bold text-burning-orange">
                      {{ getNotificationAccent(notification) ?? "Open" }}
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
        <div class="relative hidden md:flex items-stretch group/tooltip">
          <NuxtLink
            to="/chat"
            class="nav-link relative flex items-center px-2 text-noble-black hover:text-burning-orange transition-colors duration-300 ease-in-out group"
            active-class="active-nav-link"
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
              class="transition-transform duration-300 ease-in-out group-hover:scale-110 group-active:scale-95"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span
              v-if="chatUnreadCount > 0"
              class="absolute top-2.5 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-white bg-burning-orange px-1 text-[10px] font-bold text-white shadow-sm scale-90"
            >
              {{ chatUnreadCount }}
            </span>
          </NuxtLink>
          <div class="custom-tooltip">
            Chat
            <div class="tooltip-arrow"></div>
          </div>
        </div>

        <!-- Heart Icon (Likes) -->
        <div class="relative hidden md:flex items-stretch group/tooltip">
          <NuxtLink
            to="/likes"
            class="nav-link relative flex items-center px-2 text-noble-black hover:text-burning-orange transition-colors duration-300 ease-in-out group"
            active-class="active-nav-link"
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
              class="transition-transform duration-300 ease-in-out group-hover:scale-110 group-active:scale-95"
            >
              <path
                d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
              />
            </svg>
            <span
              v-if="likesCount > 0"
              class="absolute top-2.5 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-white bg-burning-orange px-1 text-[10px] font-bold text-white shadow-sm scale-90"
            >
              {{ likesCount }}
            </span>
          </NuxtLink>
          <div class="custom-tooltip">
            Likes
            <div class="tooltip-arrow"></div>
          </div>
        </div>

        <!-- Cart Icon -->
        <div class="relative hidden md:flex items-stretch group/tooltip">
          <NuxtLink
            to="/bag"
            class="nav-link relative flex items-center px-2 text-noble-black hover:text-burning-orange transition-colors duration-300 ease-in-out group"
            active-class="active-nav-link"
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
              class="transition-transform duration-300 ease-in-out group-hover:scale-110 group-active:scale-95"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <span
              v-if="bagCount > 0"
              class="absolute top-2.5 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-white bg-burning-orange px-1 text-[10px] font-bold text-white shadow-sm scale-90"
            >
              {{ bagCount }}
            </span>
          </NuxtLink>
          <div class="custom-tooltip">
            Bag
            <div class="tooltip-arrow"></div>
          </div>
        </div>

        <!-- Profile Icon (Always Visible) -->
        <div class="flex items-stretch md:ml-1">
          <div class="flex items-center px-2 md:px-4">
            <div class="h-6 w-px bg-cinnamon-ice/30"></div>
          </div>
          <div class="relative flex items-stretch group/tooltip">
            <NuxtLink
              to="/account"
              class="nav-link relative flex items-center px-2 text-noble-black hover:text-burning-orange transition-colors duration-300 ease-in-out group"
              :class="{ 'active-nav-link': isAccountSectionActive }"
              active-class="active-nav-link"
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
                class="transition-transform duration-300 ease-in-out group-hover:scale-110 group-active:scale-95"
              >
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </NuxtLink>
            <div class="custom-tooltip">
              Profile
              <div class="tooltip-arrow"></div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </header>
</template>

<style scoped>
.nav-link {
  position: relative;
}

.nav-link::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background-color: theme("colors.burning-orange");
  border-radius: 9999px;
  transform: scaleX(0);
  transform-origin: center;
  transition:
    transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0;
}

/* Hover state: subtle preview line */
.nav-link:hover::after {
  transform: scaleX(0.4);
  opacity: 0.2;
}

/* Active state: full line, overrides hover */
.nav-link.active-nav-link {
  color: theme("colors.burning-orange");
}

.nav-link.active-nav-link::after,
.nav-link.active-nav-link:hover::after {
  transform: scaleX(1);
  opacity: 1;
}

/* Custom Tooltip Styling */
.custom-tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(10px);
  background-color: theme("colors.cream");
  color: theme("colors.noble-black");
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid theme("colors.cinnamon-ice / 30%");
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease,
    visibility 0.2s;
  z-index: 1200;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.tooltip-arrow {
  position: absolute;
  top: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 5px solid theme("colors.cinnamon-ice / 30%");
}

.tooltip-arrow::after {
  content: "";
  position: absolute;
  top: 1px;
  left: -5px;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 5px solid theme("colors.cream");
}

.group\/tooltip:hover .custom-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(14px);
}

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
