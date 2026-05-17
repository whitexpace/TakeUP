<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useBag } from "../composables/use-bag"
import { useChat } from "../composables/use-chat"
import { useCommunityFeedPrefetch } from "../composables/use-community-feed-cache"
import { useLikes } from "../composables/use-likes"
import { useViewerSession } from "../composables/use-viewer-session"
import { useNotifications } from "../composables/use-notifications"
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
    notifications: undefined,
    scrollContainerSelector: "",
    showNav: true,
    hideIcons: false,
    customPadding: "",
  },
)

const emit = defineEmits<{
  (event: "mark-notification-read", notificationId: string | number): void
  (event: "mark-all-notifications-read" | "sign-in"): void
  (event: "visibility-change", visible: boolean): void
}>()

const { bagCount } = useBag()
const { likesCount, loadLikesCount } = useLikes()
const { totalUnreadCount: chatUnreadCount, loadUnreadCount: loadChatUnreadCount } = useChat()
const user = useSupabaseUser()
const route = useRoute()
const { warmCommunityFeed } = useCommunityFeedPrefetch()
const { authUser, hasFreshCache: hasFreshAuthUserCache, fetch: fetchAuthUser } = useAuthUser()
const {
  notifications: globalNotifications,
  isLoading: isGlobalNotificationsLoading,
  loadNotifications: loadGlobalNotifications,
  markNotificationRead: globalMarkRead,
  markAllNotificationsRead: globalMarkAllRead,
} = useNotifications()

const NOTIFICATION_RENDER_LIMIT = 20

const getNotificationKey = (n: CommunityOfferNotification | AppHeaderNotification) => {
  if ("type" in n) return `app-${n.id}`
  return `offer-${n.id}`
}

const displayNotifications = computed(() => {
  const propNotifs = props.notifications || []
  const globalNotifs = globalNotifications.value || []

  if (propNotifs.length === 0) return globalNotifs
  if (globalNotifs.length === 0) return propNotifs

  const map = new Map<string | number, CommunityOfferNotification | AppHeaderNotification>()

  globalNotifs.forEach((n) => map.set(getNotificationKey(n), n))
  propNotifs.forEach((n) => map.set(getNotificationKey(n), n))

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
})
const visibleNotifications = computed(() =>
  displayNotifications.value.slice(0, NOTIFICATION_RENDER_LIMIT),
)
const hiddenNotificationCount = computed(() =>
  Math.max(0, displayNotifications.value.length - visibleNotifications.value.length),
)

const cookieAccountType = useState<string | null>("session-cookie-account-type", () => null)
const headerRef = ref<HTMLElement | null>(null)
const showNotifications = ref(false)
const isVisible = ref(true)
const accountType = ref<string | null>(authUser.value?.accountType ?? cookieAccountType.value)
const isAccountSectionActive = computed(
  () => route.path === "/account" || route.path.startsWith("/account/"),
)
const isAdminSectionActive = computed(
  () => route.path === "/admin" || route.path.startsWith("/admin/"),
)

const warmCommunityFeedNavigation = () => {
  if (route.path === "/feed" || route.path.startsWith("/feed/")) return
  warmCommunityFeed()
}

const bridgeAndLoadAccountType = async () => {
  if (!user.value) {
    accountType.value = null
    return
  }

  if (authUser.value) {
    accountType.value = authUser.value.accountType
    return
  }

  if (cookieAccountType.value) {
    accountType.value = cookieAccountType.value
    return
  }

  const { ensureBridgedSession } = useViewerSession()
  if (!(await ensureBridgedSession())) {
    accountType.value = null
    return
  }

  if (!hasFreshAuthUserCache.value && !authUser.value) {
    const fetchedUser = await fetchAuthUser()
    accountType.value = fetchedUser?.accountType ?? null
    return
  }
}

let accountTypeLoadTimeout: ReturnType<typeof setTimeout> | null = null

const scheduleAccountTypeLoad = () => {
  if (accountTypeLoadTimeout !== null) {
    clearTimeout(accountTypeLoadTimeout)
  }

  const delay = route.path.startsWith("/dashboard") ? 250 : 0
  accountTypeLoadTimeout = setTimeout(() => {
    accountTypeLoadTimeout = null
    void bridgeAndLoadAccountType()
  }, delay)
}

watch(user, () => {
  scheduleAccountTypeLoad()
})

watch(isVisible, (val) => {
  emit("visibility-change", val)
})

const lastScrollY = ref(0)
const scrollThreshold = 10 // Minimum scroll to trigger hide
const isScrolled = ref(false)
let activeScrollTarget: Window | Element | null = null

const handleScroll = () => {
  const currentScrollY =
    activeScrollTarget instanceof Element ? activeScrollTarget.scrollTop : window.scrollY

  isScrolled.value = currentScrollY > 20

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
  return displayNotifications.value.filter((notification) => !notification.read).length
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

const isAppHeaderNotification = (
  notification: CommunityOfferNotification | AppHeaderNotification,
): notification is AppHeaderNotification => "title" in notification

const isDisputeRebuttal = (notification: CommunityOfferNotification | AppHeaderNotification) => {
  return isAppHeaderNotification(notification) && notification.type.includes("DISPUTE_REBUTTAL")
}

const isDispute = (notification: CommunityOfferNotification | AppHeaderNotification) => {
  return isAppHeaderNotification(notification) && notification.type.includes("DISPUTE")
}

const notificationEmptyState = computed(() =>
  isAccountSectionActive.value ? "No account notifications yet." : "No offer notifications yet.",
)

const getNotificationTitle = (notification: CommunityOfferNotification | AppHeaderNotification) => {
  if (isAppHeaderNotification(notification)) return notification.title
  return `${notification.actorName} offered ${notification.itemName}`
}

const getNotificationBody = (notification: CommunityOfferNotification | AppHeaderNotification) => {
  if (isAppHeaderNotification(notification)) return notification.body
  return notification.requestTitle
}

const getNotificationAccent = (
  notification: CommunityOfferNotification | AppHeaderNotification,
) => {
  if (isAppHeaderNotification(notification)) {
    switch (notification.type) {
      case "DISPUTE_SUBMITTED":
      case "DISPUTE_OPENED":
        return "Review dispute"
      case "DISPUTE_REBUTTAL_SUBMITTED":
        return "View rebuttal"
      case "DISPUTE_RESOLVED":
        return "View outcome"
      case "BOOKING_RETURN_REQUESTED":
        return "View return"
      default:
        return null
    }
  }

  return formatFee(notification.fee)
}

const getNotificationActionPath = (
  notification: CommunityOfferNotification | AppHeaderNotification,
) => {
  if (isAppHeaderNotification(notification)) return notification.actionPath ?? null
  return null
}

const handleNotificationClick = async (
  notification: CommunityOfferNotification | AppHeaderNotification,
) => {
  emit("mark-notification-read", notification.id)
  if (isAppHeaderNotification(notification)) {
    void globalMarkRead(notification.id)
  }
  const actionPath = getNotificationActionPath(notification)
  if (actionPath) {
    showNotifications.value = false
    await navigateTo(actionPath)
  }
}

const markAllNotificationsRead = () => {
  emit("mark-all-notifications-read")
  if (displayNotifications.value.some(isAppHeaderNotification)) {
    void globalMarkAllRead()
  }
}

const handlePointerDownOutside = (event: PointerEvent) => {
  if (!showNotifications.value) return
  if (!(event.target instanceof Node)) return
  if (headerRef.value?.contains(event.target)) return
  showNotifications.value = false
}

const setupScrollListener = () => {
  activeScrollTarget?.removeEventListener("scroll", handleScroll)

  activeScrollTarget = props.scrollContainerSelector
    ? (document.querySelector(props.scrollContainerSelector) ?? window)
    : window

  activeScrollTarget.addEventListener("scroll", handleScroll, { passive: true })
}

watch(() => props.scrollContainerSelector, setupScrollListener)

onMounted(() => {
  document.addEventListener("pointerdown", handlePointerDownOutside)
  setupScrollListener()
  scheduleAccountTypeLoad()
  void loadLikesCount()
  void loadChatUnreadCount()
  void loadGlobalNotifications()
})

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handlePointerDownOutside)
  activeScrollTarget?.removeEventListener("scroll", handleScroll)
  activeScrollTarget = null
  if (accountTypeLoadTimeout !== null) {
    clearTimeout(accountTypeLoadTimeout)
    accountTypeLoadTimeout = null
  }
})
</script>

<template>
  <header
    ref="headerRef"
    class="fixed top-0 left-0 w-full h-16 border-b transition-all duration-300 ease-in-out z-[1000] shrink-0 flex items-center"
    :class="[
      !isVisible ? '-translate-y-full' : '',
      isScrolled
        ? 'bg-white/80 backdrop-blur-md border-cinnamon-ice/30'
        : 'bg-white border-cinnamon-ice/30',
    ]"
  >
    <!-- Left Section: Logo & App Name -->
    <div
      class="flex items-center shrink-0 gap-4"
      :class="[showNav ? 'lg:w-80' : '', customPadding || 'px-4 sm:px-6']"
    >
      <slot name="left" />
      <NuxtLink to="/dashboard" class="flex items-center gap-3">
        <img src="/images/takeup-logo.png" alt="TakeUP Logo" class="h-8 w-auto" />
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
          :prefetch-on="{ interaction: true }"
          class="nav-link flex items-center text-[15px] text-noble-black font-geist font-normal transition-colors duration-300 ease-in-out hover:text-burning-orange"
          active-class="active-nav-link"
          @pointerenter="warmCommunityFeedNavigation"
          @focus="warmCommunityFeedNavigation"
          @touchstart.passive="warmCommunityFeedNavigation"
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
      class="flex justify-end items-stretch gap-1 sm:gap-2 shrink-0 h-full"
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
            <div class="relative flex items-center justify-center">
              <Icon
                name="ph:bell"
                class="w-[22px] h-[22px] transition-transform duration-300 ease-in-out group-hover:scale-110 group-active:scale-95 shrink-0"
              />

              <span
                v-if="unreadNotificationCount > 0"
                class="absolute -top-1.5 -right-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-[1.5px] border-white bg-burning-orange px-1 text-[10px] font-bold text-white shadow-sm"
              >
                {{ unreadNotificationCount }}
              </span>
            </div>
          </button>

          <div class="custom-tooltip">
            Notifications
            <div class="tooltip-arrow"></div>
          </div>

          <transition name="notifications-menu">
            <div
              v-if="showNotifications"
              class="absolute right-0 top-[calc(100%+12px)] z-[1100] w-[380px] rounded-[16px] border border-gray-100 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12)] flex flex-col max-h-[480px]"
            >
              <!-- Triangle Pointer -->
              <div
                class="absolute -top-2 right-6 w-4 h-4 bg-white border-t border-l border-gray-100 rotate-45"
              ></div>

              <!-- Header Row -->
              <div
                class="relative z-10 flex items-center justify-between px-4 py-4 border-b border-gray-100 shrink-0"
              >
                <span class="font-montravia text-[20px] font-semibold text-noble-black">
                  Notifications
                </span>
                <button
                  v-if="unreadNotificationCount > 0"
                  class="text-[13px] font-semibold text-burning-orange hover:opacity-80 transition-opacity"
                  @click="markAllNotificationsRead"
                >
                  Mark all read
                </button>
              </div>

              <!-- Notifications List -->
              <div
                v-if="isGlobalNotificationsLoading"
                class="px-4 py-6 space-y-5 animate-pulse relative z-10"
              >
                <div v-for="i in 3" :key="i" class="flex gap-4">
                  <div class="h-10 w-10 rounded-full bg-noble-black/10 shrink-0"></div>
                  <div class="flex-1 space-y-2 py-1">
                    <div class="h-3 w-3/4 bg-noble-black/20 rounded"></div>
                    <div class="h-2 w-1/2 bg-noble-black/10 rounded"></div>
                  </div>
                </div>
              </div>

              <div
                v-else-if="displayNotifications.length > 0"
                class="overflow-y-auto custom-scrollbar flex-1 relative z-10 rounded-b-[16px]"
              >
                <div class="flex flex-col">
                  <button
                    v-for="notification in visibleNotifications"
                    :key="getNotificationKey(notification)"
                    class="relative flex gap-3 px-4 py-3.5 text-left border-b border-gray-50 last:border-b-0 transition-all hover:bg-gray-50/50 group"
                    :class="[
                      !notification.read
                        ? 'bg-burning-orange/[0.03] border-l-[3px] border-l-burning-orange'
                        : 'bg-white',
                    ]"
                    @click="handleNotificationClick(notification)"
                  >
                    <!-- Unread Dot -->
                    <div
                      v-if="!notification.read"
                      class="absolute top-4 right-4 w-2 h-2 rounded-full bg-burning-orange"
                    ></div>

                    <!-- Icon Circle -->
                    <div class="shrink-0">
                      <div
                        v-if="isDisputeRebuttal(notification)"
                        class="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-estate"
                      >
                        <Icon name="ph:chat-centered-text" class="w-[18px] h-[18px] shrink-0" />
                      </div>
                      <div
                        v-else-if="isDispute(notification)"
                        class="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center text-cinnabar-red"
                      >
                        <Icon name="ph:warning" class="w-[18px] h-[18px] shrink-0" />
                      </div>
                      <div
                        v-else
                        class="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center text-success-green"
                      >
                        <Icon name="ph:calendar-blank" class="w-[18px] h-[18px] shrink-0" />
                      </div>
                    </div>

                    <!-- Content -->
                    <div class="flex-1 min-w-0">
                      <h4 class="text-[14px] font-semibold text-noble-black truncate leading-none">
                        {{ getNotificationTitle(notification) }}
                      </h4>
                      <p class="mt-1.5 text-[13px] text-gray-500 line-clamp-2 leading-snug">
                        {{ getNotificationBody(notification) }}
                      </p>
                      <div class="mt-2.5 flex items-center justify-between">
                        <span
                          class="text-[12px] font-semibold text-burning-orange group-hover:underline leading-none"
                        >
                          {{ getNotificationAccent(notification) ?? "View Details" }} →
                        </span>
                        <span class="text-[11px] text-gray-400 leading-none">
                          {{ formatRelativeTime(notification.createdAt) }}
                        </span>
                      </div>
                    </div>
                  </button>
                  <div
                    v-if="hiddenNotificationCount > 0"
                    class="px-4 py-3 text-center text-[12px] font-medium text-gray-400"
                  >
                    Showing latest {{ NOTIFICATION_RENDER_LIMIT }} of
                    {{ displayNotifications.length }} notifications
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div v-else class="p-10 text-center relative z-10 rounded-b-[16px]">
                <div
                  class="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3"
                >
                  <Icon name="ph:bell" class="w-6 h-6 text-gray-300 shrink-0" />
                </div>
                <p class="text-[13px] text-gray-400 leading-relaxed px-4">
                  {{ notificationEmptyState }}
                </p>
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
            <div class="relative flex items-center justify-center">
              <Icon
                name="ph:chat-centered-text"
                class="w-[22px] h-[22px] transition-transform duration-300 ease-in-out group-hover:scale-110 group-active:scale-95 shrink-0"
              />
              <span
                v-if="chatUnreadCount > 0"
                class="absolute -top-1.5 -right-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-[1.5px] border-white bg-burning-orange px-1 text-[10px] font-bold text-white shadow-sm"
              >
                {{ chatUnreadCount }}
              </span>
            </div>
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
            <div class="relative flex items-center justify-center">
              <Icon
                name="ph:heart"
                class="w-[22px] h-[22px] transition-transform duration-300 ease-in-out group-hover:scale-110 group-active:scale-95 shrink-0"
              />
              <span
                v-if="likesCount > 0"
                class="absolute -top-1.5 -right-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-[1.5px] border-white bg-burning-orange px-1 text-[10px] font-bold text-white shadow-sm"
              >
                {{ likesCount }}
              </span>
            </div>
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
            <div class="relative flex items-center justify-center">
              <Icon
                name="ph:handbag"
                class="w-[22px] h-[22px] transition-transform duration-300 ease-in-out group-hover:scale-110 group-active:scale-95 shrink-0"
              />
              <span
                v-if="bagCount > 0"
                class="absolute -top-1.5 -right-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-[1.5px] border-white bg-burning-orange px-1 text-[10px] font-bold text-white shadow-sm"
              >
                {{ bagCount }}
              </span>
            </div>
          </NuxtLink>
          <div class="custom-tooltip">
            Bag
            <div class="tooltip-arrow"></div>
          </div>
        </div>

        <!-- Vertical Divider -->
        <div class="flex items-center px-2 sm:px-3">
          <div class="h-6 w-px bg-cinnamon-ice/30"></div>
        </div>

        <!-- Admin Panel Icon -->
        <div
          v-if="accountType === 'ADMIN'"
          class="relative hidden md:flex items-stretch group/tooltip"
        >
          <NuxtLink
            to="/admin"
            class="nav-link relative flex items-center px-2 text-noble-black hover:text-burning-orange transition-colors duration-300 ease-in-out group"
            :class="{ 'active-nav-link': isAdminSectionActive }"
            active-class="active-nav-link"
          >
            <Icon
              name="ph:shield-check"
              class="w-[22px] h-[22px] transition-transform duration-300 ease-in-out group-hover:scale-110 group-active:scale-95 shrink-0"
            />
          </NuxtLink>
          <div class="custom-tooltip">
            Admin Panel
            <div class="tooltip-arrow"></div>
          </div>
        </div>

        <!-- Account Icon -->
        <div class="relative flex items-stretch group/tooltip">
          <NuxtLink
            to="/account"
            :prefetch-on="{ interaction: true }"
            class="nav-link relative flex items-center px-2 text-noble-black hover:text-burning-orange transition-colors duration-300 ease-in-out group"
            :class="{ 'active-nav-link': isAccountSectionActive }"
            active-class="active-nav-link"
          >
            <Icon
              name="ph:user"
              class="w-[22px] h-[22px] transition-transform duration-300 ease-in-out group-hover:scale-110 group-active:scale-95 shrink-0"
            />
          </NuxtLink>
          <div class="custom-tooltip">
            Account
            <div class="tooltip-arrow"></div>
          </div>
        </div>
      </template>

      <!-- Auth Action (Login Button for Landing/Guests) -->
      <template v-else-if="!user">
        <div class="flex items-center">
          <button
            type="button"
            class="h-10 px-6 border-[1.5px] border-burning-orange text-burning-orange bg-white rounded-[10px] font-semibold text-[14px] hover:bg-burning-orange hover:text-white transition-all duration-300 active:scale-95 whitespace-nowrap"
            @click="$emit('sign-in')"
          >
            Sign In
          </button>
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
