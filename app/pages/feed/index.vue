<template>
  <div class="flex flex-col h-screen font-geist bg-white overflow-hidden">
    <Header
      :notifications="currentUserNotifications"
      scroll-container-selector=".custom-main-scrollbar"
      @mark-notification-read="markNotificationRead"
      @mark-all-notifications-read="markAllNotificationsRead"
    />

    <main
      ref="feedMainRef"
      class="flex-1 overflow-y-auto custom-main-scrollbar bg-white h-screen pt-14"
    >
      <div class="container mx-auto px-4 py-8 pt-10 max-w-[1440px]">
        <div class="flex flex-col lg:flex-row gap-10">
          <aside class="hidden lg:block lg:w-[240px] xl:w-[280px] shrink-0">
            <div class="sticky top-6">
              <CommunityActivitySidebar
                :posts-made="userActivity.postsMade"
                :offers-sent="userActivity.offersSent"
                :offers-received="userActivity.offersReceived"
              />
            </div>
          </aside>

          <div class="flex-1 min-w-0 flex flex-col gap-8">
            <div class="flex flex-col">
              <h1 class="text-[28px] font-bold text-gray-900 leading-tight">Community Feed</h1>
              <div class="h-[2px] w-10 bg-burning-orange rounded-full mt-2"></div>
              <p class="mt-2 text-[14px] text-gray-400">
                Post what you need and receive offers directly from the UPC community
              </p>
            </div>

            <CommunityCreatePost
              ref="createPostRef"
              :user-avatar="currentUserAvatar"
              :user-name="currentUserName"
              :is-submitting="isCreatingRequest"
              :server-error="requestComposerError"
              @post="handleCreateRequest"
            />

            <div
              v-if="feedError"
              class="rounded-[20px] border border-burning-orange/20 bg-burning-orange/5 px-5 py-4 text-[14px] text-burning-orange"
            >
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{{ feedError }}</span>
                <button
                  class="rounded-full border border-burning-orange/20 px-4 py-2 text-[12px] font-bold text-burning-orange transition-all hover:bg-burning-orange/5"
                  @click="refreshFeed"
                >
                  Retry
                </button>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button
                v-for="filter in availableFilters"
                :key="filter.value"
                type="button"
                class="px-4 py-1.5 rounded-full text-[13px] font-medium transition-all border-[1.5px]"
                :class="
                  activeFilter === filter.value
                    ? 'bg-burning-orange/10 border-burning-orange/30 text-burning-orange'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                "
                @click="activeFilter = filter.value"
              >
                {{ filter.label }}
              </button>
            </div>

            <div v-if="isLoadingFeed" class="flex flex-col gap-6">
              <CommunityPostCardSkeleton v-for="i in 3" :key="`feed-skeleton-${i}`" />
            </div>

            <div v-else-if="sortedRequests.length > 0" class="flex flex-col gap-6">
              <CommunityPostCard
                v-for="request in sortedRequests"
                :key="request.id"
                :request="request"
                :current-user-id="currentDbUserId"
                @offer-item="openOfferComposer"
                @update-request-status="handleUpdateRequestStatus"
                @delete-request="handleDeleteRequest"
                @update-offer-status="handleUpdateOfferStatus"
              />
            </div>

            <div
              v-else
              class="flex flex-col items-center justify-center rounded-[32px] border border-dashed border-cinnamon-ice/30 bg-white px-6 py-32 text-center"
            >
              <div
                class="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-cream text-burning-orange/30"
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
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.517 15.153 3 13.66 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
              <h3 class="text-[22px] font-bold text-noble-black mb-2">No live requests yet</h3>
              <p class="text-[15px] text-noble-black/40 max-w-[360px] leading-relaxed mb-8">
                The feed is now reading directly from the database. Create the first request to get
                it started.
              </p>
              <button
                class="px-8 py-2.5 bg-burning-orange text-white rounded-full font-bold text-[14px] hover:bg-blue-estate transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                @click="triggerCreatePost"
              >
                Create Request
              </button>
            </div>
          </div>

          <aside class="hidden lg:block lg:w-[280px] xl:w-[320px] shrink-0">
            <div class="sticky top-6">
              <CommunityTrendingSidebar :trending-items="trendingItems" />
            </div>
          </aside>
        </div>
      </div>
    </main>

    <CommunityOfferModal
      :model-value="isOfferComposerOpen"
      :request-title="selectedRequestForOffer?.itemNeeded ?? ''"
      :items="offerableItems"
      :preferred-item-id="preferredOfferItemId"
      :existing-offer="existingOfferForCurrentUser"
      :is-submitting="isSubmittingOffer"
      :server-error="offerComposerError"
      @update:model-value="handleOfferComposerVisibility"
      @create-item="openNewItemComposer"
      @submit="submitOffer"
      @cancel-offer="cancelOffer"
    />

    <Teleport to="body">
      <transition name="offer-modal">
        <div
          v-if="isNewItemComposerOpen"
          class="fixed inset-0 z-[2200] flex items-center justify-center bg-noble-black/60 p-4"
          @click.self="closeNewItemComposer"
        >
          <div
            class="max-h-[calc(100vh-2rem)] w-full max-w-6xl overflow-y-auto rounded-[28px] border border-cinnamon-ice/30 bg-white p-6 shadow-2xl md:p-7"
          >
            <div class="mb-6 flex items-start justify-between gap-4">
              <div>
                <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-estate/60">
                  Add new item
                </p>
                <h2 class="mt-1 text-[28px] font-bold text-noble-black">
                  Create a listing for this offer
                </h2>
                <p class="mt-2 text-[14px] leading-relaxed text-noble-black/55">
                  Publish a listing, then return to the offer flow with the new item selected.
                </p>
              </div>
              <button
                class="rounded-full p-2 text-noble-black/40 transition-colors hover:bg-cream hover:text-noble-black"
                aria-label="Close new listing form"
                @click="closeNewItemComposer"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <ListingForm
              embedded
              mode="new"
              :is-submitting="isSubmittingNewItem"
              :submit-error="newItemComposerError"
              @submit="handleCreateOfferableItem"
              @cancel="closeNewItemComposer"
            />
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useViewerSession } from "../../composables/use-viewer-session"
import { usePersistedSessionState } from "../../composables/use-persisted-session-state"
import { recordPerfEvent, withPerfTimer } from "../../utils/performance-telemetry"

import { computed, onMounted, ref, watch } from "vue"
import type {
  CommunityMember,
  CommunityOffer,
  CommunityOfferFormInput,
  CommunityOfferNotification,
  CommunityOfferStatus,
  CommunityOfferableItem,
  CommunityRequest,
  CommunityRequestComposerInput,
  CommunityRequestStatus,
  TrendingRequest,
  UserActivity,
} from "~/types/community-requests"
import CommunityCreatePost from "~/components/CommunityCreatePost.vue"
import ListingForm from "~/components/ListingForm.vue"

definePageMeta({ layout: false })

type ApiCommunityMember = {
  profileId: number
  userId: string
  username: string
  name: string
  avatar: string
}

type ApiCommunityOffer = {
  id: number
  lenderID: number
  requestID: number
  itemID: number
  itemName: string
  rentalFee: number
  availability: boolean
  condition: string
  rentalTerms: string
  status: string
  borrowerReadAt: string | Date | null
  createdAt: string | Date
  updatedAt: string | Date
  lender: ApiCommunityMember
  itemThumbnailImage: string | null
}

type ApiCommunityRequest = {
  id: number
  borrowerID: number
  itemNeeded: string
  referenceImageUrl: string | null
  requestedDates: Array<string | Date>
  priceRange: number[]
  description: string
  status: string
  createdAt: string | Date
  updatedAt: string | Date
  offersCount: number
  borrower: ApiCommunityMember
  offers: ApiCommunityOffer[]
}

type ApiCommunityNotification = {
  id: number
  requestId: number
  requestTitle: string
  recipientId: number
  actorName: string
  itemName: string
  fee: number
  createdAt: string | Date
  read: boolean
}

type ApiOfferableItem = {
  id: string
  numericId: number
  name: string
  thumbnailImage: string | null
  condition: string
  rentalFee: number
  freeToBorrow: boolean
  status: string
  rateOption: string
  createdAt: string | Date
}

const createPostRef = ref<InstanceType<typeof CommunityCreatePost> | null>(null)
const feedMainRef = ref<HTMLElement | null>(null)

const triggerCreatePost = () => {
  createPostRef.value?.triggerHighlight()
}

const user = useSupabaseUser()

const asNonEmptyString = (value: unknown) => {
  if (typeof value !== "string") return undefined
  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : undefined
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== "object" || value === null) return null
  return value as Record<string, unknown>
}

const getIdentityMetadata = (authUser: unknown) => {
  const authUserRecord = asRecord(authUser)
  const identities = authUserRecord?.identities

  if (!Array.isArray(identities)) return []

  return identities
    .map((identity) => {
      const identityRecord = asRecord(identity)
      return asRecord(identityRecord?.identity_data) ?? asRecord(identityRecord?.provider_metadata)
    })
    .filter((identityData): identityData is Record<string, unknown> => Boolean(identityData))
}

const buildNameFromSource = (source: Record<string, unknown> | null) => {
  if (!source) return undefined

  const directName =
    asNonEmptyString(source.full_name) ||
    asNonEmptyString(source.name) ||
    asNonEmptyString(source.display_name)

  if (directName) return directName

  const firstName =
    asNonEmptyString(source.given_name) ||
    asNonEmptyString(source.first_name) ||
    asNonEmptyString(source.firstName)
  const lastName =
    asNonEmptyString(source.family_name) ||
    asNonEmptyString(source.last_name) ||
    asNonEmptyString(source.lastName)

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()
  return fullName || undefined
}

const getAvatarFromSource = (source: Record<string, unknown> | null) => {
  if (!source) return undefined

  return (
    asNonEmptyString(source.picture) ||
    asNonEmptyString(source.avatar_url) ||
    asNonEmptyString(source.photo_url) ||
    asNonEmptyString(source.profile_image) ||
    asNonEmptyString(source.image)
  )
}

const currentUserProfile = computed(() => {
  const authUser = user.value
  const authUserRecord = asRecord(authUser)
  const metadataSources = [
    asRecord(authUserRecord?.user_metadata),
    asRecord(authUserRecord?.app_metadata),
    ...getIdentityMetadata(authUser),
  ]

  const name =
    metadataSources.map(buildNameFromSource).find(Boolean) ||
    asNonEmptyString(authUserRecord?.email) ||
    "User"
  const avatar = metadataSources.map(getAvatarFromSource).find(Boolean)

  return { name, avatar }
})

const currentUserName = computed(() => currentUserProfile.value.name)
const currentUserAvatar = computed(() => currentUserProfile.value.avatar)

type FeedFilter = "Newest" | "Most Offers" | "Open" | "My Requests"

const COMMUNITY_FEED_CACHE_TTL_MS = 30_000

const activeFilter = ref<FeedFilter>("Newest")
const availableFilters = computed(() => {
  const filters: Array<{ label: string; value: FeedFilter }> = [
    { label: "Newest", value: "Newest" },
    { label: "Most Offers", value: "Most Offers" },
    { label: "Open", value: "Open" },
  ]

  if (currentDbUserId.value) {
    filters.push({ label: "My Requests", value: "My Requests" })
  }

  return filters
})

const requests = usePersistedSessionState<CommunityRequest[]>("community-feed:requests", () => [], {
  deserialize: (value) => JSON.parse(value).map(normalizeRequest),
})
const notifications = usePersistedSessionState<CommunityOfferNotification[]>(
  "community-feed:notifications",
  () => [],
  {
    deserialize: (value) => JSON.parse(value).map(normalizeNotification),
  },
)
const offerableItems = usePersistedSessionState<CommunityOfferableItem[]>(
  "community-feed:offerable-items",
  () => [],
  {
    deserialize: (value) => JSON.parse(value).map(normalizeOfferableItem),
  },
)
const currentDbUserId = usePersistedSessionState<string>(
  "community-feed:current-db-user-id",
  () => "",
)
const isLoadingFeed = ref(true)
const isCreatingRequest = ref(false)
const isSubmittingOffer = ref(false)
const feedError = ref<string | null>(null)
const requestComposerError = ref<string | null>(null)
const offerComposerError = ref<string | null>(null)
const isOfferComposerOpen = ref(false)
const activeOfferRequestId = ref<number | null>(null)
const preferredOfferItemId = ref<number | null>(null)
const isNewItemComposerOpen = ref(false)
const isSubmittingNewItem = ref(false)
const newItemComposerError = ref<string | null>(null)
const feedHydrated = usePersistedSessionState<boolean>("community-feed:hydrated", () => false)
const feedLastLoadedAt = usePersistedSessionState<number | null>(
  "community-feed:last-loaded-at",
  () => null,
)
const feedViewerKey = usePersistedSessionState<string>(
  "community-feed:viewer-key",
  () => "anonymous",
)
const { createListing } = useMyListings()

const toDate = (value: string | Date | null | undefined) => {
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}

const getFirstFieldError = (value: unknown) => {
  const record = asRecord(value)
  if (!record) return undefined

  for (const fieldValue of Object.values(record)) {
    if (!Array.isArray(fieldValue)) continue
    const message = fieldValue.find(
      (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
    )
    if (message) return message
  }

  return undefined
}

const getMeaningfulErrorMessage = (value: unknown) => {
  if (typeof value !== "string") return undefined
  const trimmedValue = value.trim()
  if (!trimmedValue) return undefined
  if (trimmedValue.startsWith("[") || trimmedValue.toLowerCase().includes("fetch failed")) {
    return undefined
  }
  return trimmedValue
}

const extractApiErrorMessage = (error: unknown, fallback: string) => {
  const errorRecord = asRecord(error)
  const data = asRecord(errorRecord?.data)
  const nestedData = asRecord(data?.data)

  return (
    getFirstFieldError(data?.fieldErrors) ||
    getFirstFieldError(nestedData?.fieldErrors) ||
    getMeaningfulErrorMessage(data?.statusMessage) ||
    getMeaningfulErrorMessage(data?.message) ||
    getMeaningfulErrorMessage(asRecord(data?.error)?.message) ||
    getMeaningfulErrorMessage(nestedData?.statusMessage) ||
    getMeaningfulErrorMessage(nestedData?.message) ||
    getMeaningfulErrorMessage(errorRecord?.statusMessage) ||
    getMeaningfulErrorMessage(errorRecord?.message) ||
    fallback
  )
}

function normalizeMember(member: ApiCommunityMember): CommunityMember {
  return {
    profileId: Number(member.profileId),
    userId: member.userId,
    username: member.username,
    name: member.name,
    avatar: member.avatar || "",
  }
}

function normalizeOffer(offer: ApiCommunityOffer): CommunityOffer {
  return {
    id: Number(offer.id),
    lenderID: Number(offer.lenderID),
    requestID: Number(offer.requestID),
    itemID: Number(offer.itemID),
    itemName: offer.itemName,
    itemThumbnailImage: offer.itemThumbnailImage,
    rentalFee: Number(offer.rentalFee),
    availability: Boolean(offer.availability),
    condition: offer.condition as CommunityOffer["condition"],
    rentalTerms: offer.rentalTerms ?? "",
    status: offer.status as CommunityOfferStatus,
    borrowerReadAt: toDate(offer.borrowerReadAt),
    createdAt: toDate(offer.createdAt) ?? new Date(),
    updatedAt: toDate(offer.updatedAt) ?? new Date(),
    lender: normalizeMember(offer.lender),
  }
}

function normalizeRequest(request: ApiCommunityRequest): CommunityRequest {
  return {
    id: Number(request.id),
    borrowerID: Number(request.borrowerID),
    itemNeeded: request.itemNeeded,
    referenceImageUrl: request.referenceImageUrl,
    requestedDates: request.requestedDates
      .map((value) => toDate(value))
      .filter((value): value is Date => Boolean(value)),
    priceRange: [Number(request.priceRange[0] ?? 0), Number(request.priceRange[1] ?? 0)],
    description: request.description,
    status: request.status as CommunityRequestStatus,
    createdAt: toDate(request.createdAt) ?? new Date(),
    updatedAt: toDate(request.updatedAt) ?? new Date(),
    offersCount: Number(request.offersCount ?? 0),
    borrower: normalizeMember(request.borrower),
    offers: request.offers.map(normalizeOffer),
  }
}

function normalizeNotification(notification: ApiCommunityNotification): CommunityOfferNotification {
  return {
    id: Number(notification.id),
    requestId: Number(notification.requestId),
    requestTitle: notification.requestTitle,
    recipientId: Number(notification.recipientId),
    actorName: notification.actorName,
    itemName: notification.itemName,
    fee: Number(notification.fee),
    createdAt: toDate(notification.createdAt) ?? new Date(),
    read: Boolean(notification.read),
  }
}

function normalizeOfferableItem(item: ApiOfferableItem): CommunityOfferableItem {
  return {
    id: item.id,
    numericId: Number(item.numericId),
    name: item.name,
    thumbnailImage: item.thumbnailImage,
    condition: item.condition as CommunityOfferableItem["condition"],
    rentalFee: Number(item.rentalFee),
    freeToBorrow: Boolean(item.freeToBorrow),
    status: item.status,
    rateOption: item.rateOption,
    createdAt: toDate(item.createdAt) ?? new Date(),
  }
}

const getAuthHeaders = async () => {
  const { getAuthHeaders } = useViewerSession()
  const headers = await getAuthHeaders()
  const authorization = headers?.Authorization ?? headers?.authorization
  if (!authorization) return undefined

  return {
    authorization,
  }
}

const enumerateRequestedDates = (
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
) => {
  const start = new Date(`${startDate}T${startTime}`)
  const end = new Date(`${endDate}T${endTime}`)

  if (startDate === endDate) {
    return [start.toISOString(), end.toISOString()]
  }

  const dates: string[] = []
  const cursor = new Date(`${startDate}T00:00:00`)
  const endDay = new Date(`${endDate}T00:00:00`)

  while (cursor.getTime() <= endDay.getTime()) {
    const currentDayTime = cursor.getTime()
    if (currentDayTime === new Date(`${startDate}T00:00:00`).getTime()) {
      dates.push(start.toISOString())
    } else if (currentDayTime === endDay.getTime()) {
      dates.push(end.toISOString())
    } else {
      dates.push(new Date(cursor).toISOString())
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

const refreshFeed = async () => {
  if (feedHydrated.value) {
    isLoadingFeed.value = false
  } else {
    isLoadingFeed.value = true
  }

  feedError.value = null

  try {
    const headers = await getAuthHeaders()
    feedViewerKey.value = user.value?.id ?? "anonymous"

    if (headers) {
      const { fetch: fetchAuthUser } = useAuthUser()
      const authUser = await fetchAuthUser()
      currentDbUserId.value = authUser?.id ?? ""
    } else {
      currentDbUserId.value = ""
    }

    const [requestResponse, notificationResponse, offerableItemResponse] = await withPerfTimer(
      "community-feed",
      feedViewerKey.value,
      () =>
        Promise.all([
          $fetch<ApiCommunityRequest[]>("/api/item-requests", {
            query: { includeCancelledOffers: true },
            ...(headers ? { headers } : {}),
          }),
          headers
            ? $fetch<ApiCommunityNotification[]>("/api/request-offers/notifications", { headers })
            : Promise.resolve([]),
          headers
            ? $fetch<ApiOfferableItem[]>("/api/request-offers/items", { headers })
            : Promise.resolve([]),
        ]),
      {
        detail: "refreshFeed",
      },
    )

    requests.value = requestResponse.map(normalizeRequest)
    notifications.value = notificationResponse.map(normalizeNotification)
    offerableItems.value = offerableItemResponse.map(normalizeOfferableItem)
    feedLastLoadedAt.value = Date.now()
  } catch (error) {
    console.error("Failed to load community feed", error)
    feedError.value = "Unable to load the live community feed right now."
  } finally {
    isLoadingFeed.value = false
    feedHydrated.value = true
  }
}

const selectedRequestForOffer = computed(() => {
  return requests.value.find((request) => request.id === activeOfferRequestId.value) ?? null
})

const existingOfferForCurrentUser = computed(() => {
  return (
    selectedRequestForOffer.value?.offers.find(
      (offer) => offer.lender.userId === currentDbUserId.value,
    ) ?? null
  )
})

const currentUserNotifications = computed(() => {
  return [...notifications.value].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  )
})

const userActivity = computed<UserActivity>(() => {
  if (!currentDbUserId.value) {
    return { postsMade: 0, offersSent: 0, offersReceived: 0 }
  }

  const myRequests = requests.value.filter(
    (request) => request.borrower.userId === currentDbUserId.value,
  )
  const offersSent = requests.value.reduce((count, request) => {
    return (
      count + request.offers.filter((offer) => offer.lender.userId === currentDbUserId.value).length
    )
  }, 0)
  const offersReceived = myRequests.reduce((count, request) => count + request.offersCount, 0)

  return {
    postsMade: myRequests.length,
    offersSent,
    offersReceived,
  }
})

const trendingItems = computed<TrendingRequest[]>(() => {
  return [...requests.value]
    .sort((left, right) => {
      if (right.offersCount !== left.offersCount) return right.offersCount - left.offersCount
      return right.createdAt.getTime() - left.createdAt.getTime()
    })
    .slice(0, 5)
    .map((request) => ({
      id: request.id,
      title: request.itemNeeded,
      offersCount: request.offersCount,
    }))
})

const sortedRequests = computed(() => {
  let filteredRequests = [...requests.value]

  if (activeFilter.value === "Open") {
    filteredRequests = filteredRequests.filter((request) => request.status === "OPEN")
  }

  if (activeFilter.value === "My Requests") {
    filteredRequests = filteredRequests.filter(
      (request) => request.borrower.userId === currentDbUserId.value,
    )
  }

  if (activeFilter.value === "Most Offers") {
    return filteredRequests.sort((left, right) => {
      if (right.offersCount !== left.offersCount) return right.offersCount - left.offersCount
      return right.createdAt.getTime() - left.createdAt.getTime()
    })
  }

  return filteredRequests.sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  )
})

const ensureAuthenticatedHeaders = async () => {
  const headers = await getAuthHeaders()

  if (!headers) {
    feedError.value = "You need to sign in before using request and offer actions."
    return null
  }

  return headers
}

const handleCreateRequest = async (payload: CommunityRequestComposerInput) => {
  const headers = await getAuthHeaders()
  if (!headers) {
    requestComposerError.value = "You need to sign in before posting a request."
    return
  }

  isCreatingRequest.value = true
  feedError.value = null
  requestComposerError.value = null

  try {
    await $fetch("/api/item-requests", {
      method: "POST",
      headers,
      body: {
        itemNeeded: payload.itemNeeded,
        referenceImageUrl: payload.referenceImageUrl ?? null,
        requestedDates: enumerateRequestedDates(
          payload.startDate,
          payload.startTime,
          payload.endDate,
          payload.endTime,
        ),
        priceRange: [payload.minimumPrice, payload.maximumPrice],
        description: payload.description,
        status: "OPEN",
      },
    })

    activeFilter.value = "Newest"
    await refreshFeed()
    feedMainRef.value?.scrollTo({ top: 0, behavior: "smooth" })
  } catch (error) {
    console.error("Failed to create item request", error)
    requestComposerError.value = extractApiErrorMessage(
      error,
      "Unable to post your request right now.",
    )
  } finally {
    isCreatingRequest.value = false
  }
}

const openOfferComposer = (requestId: number) => {
  const request = requests.value.find((entry) => entry.id === requestId)

  if (!request) return
  if (!currentDbUserId.value) {
    feedError.value = "You need to sign in before sending an offer."
    return
  }
  if (request.borrower.userId === currentDbUserId.value || request.status !== "OPEN") return

  offerComposerError.value = null
  preferredOfferItemId.value = null
  activeOfferRequestId.value = requestId
  isOfferComposerOpen.value = true
}

const handleOfferComposerVisibility = (isVisible: boolean) => {
  isOfferComposerOpen.value = isVisible

  if (!isVisible) {
    activeOfferRequestId.value = null
    preferredOfferItemId.value = null
    offerComposerError.value = null
  }
}

const openNewItemComposer = () => {
  newItemComposerError.value = null
  isNewItemComposerOpen.value = true
}

const closeNewItemComposer = () => {
  if (isSubmittingNewItem.value) return
  newItemComposerError.value = null
  isNewItemComposerOpen.value = false
}

const handleCreateOfferableItem = async (data: Record<string, unknown>) => {
  isSubmittingNewItem.value = true
  newItemComposerError.value = null

  try {
    const createdListing = await createListing(data)
    preferredOfferItemId.value = createdListing.numericId
    await refreshFeed()
    isNewItemComposerOpen.value = false
  } catch (error: unknown) {
    const fetchError = error as {
      data?: { statusMessage?: string; error?: { message?: string } }
      statusMessage?: string
      message?: string
    }

    newItemComposerError.value =
      fetchError.data?.error?.message ??
      fetchError.data?.statusMessage ??
      fetchError.statusMessage ??
      fetchError.message ??
      "Unable to create this listing right now."
  } finally {
    isSubmittingNewItem.value = false
  }
}

const submitOffer = async (offerInput: CommunityOfferFormInput) => {
  const request = selectedRequestForOffer.value
  const headers = await getAuthHeaders()
  if (!headers) {
    offerComposerError.value = "You need to sign in before sending an offer."
    return
  }
  if (!request) return

  isSubmittingOffer.value = true
  feedError.value = null
  offerComposerError.value = null

  try {
    if (existingOfferForCurrentUser.value) {
      await $fetch(`/api/request-offers/${existingOfferForCurrentUser.value.id}`, {
        method: "PATCH",
        headers,
        body: offerInput,
      })
    } else {
      await $fetch("/api/request-offers", {
        method: "POST",
        headers,
        body: {
          requestID: request.id,
          ...offerInput,
          status: "PENDING",
        },
      })
    }

    await refreshFeed()
    handleOfferComposerVisibility(false)
  } catch (error) {
    console.error("Failed to submit offer", error)
    offerComposerError.value = extractApiErrorMessage(error, "Unable to save this offer right now.")
  } finally {
    isSubmittingOffer.value = false
  }
}

const cancelOffer = async (offerId: number) => {
  const headers = await ensureAuthenticatedHeaders()
  if (!headers) return

  isSubmittingOffer.value = true
  feedError.value = null
  offerComposerError.value = null

  try {
    await $fetch(`/api/request-offers/${offerId}`, {
      method: "PATCH",
      headers,
      body: {
        status: "CANCELLED",
      },
    })

    await refreshFeed()
    handleOfferComposerVisibility(false)
  } catch (error) {
    console.error("Failed to cancel offer", error)
    offerComposerError.value = extractApiErrorMessage(
      error,
      "Unable to cancel this offer right now.",
    )
  } finally {
    isSubmittingOffer.value = false
  }
}

const handleUpdateRequestStatus = async (payload: {
  requestId: number
  status: CommunityRequestStatus
}) => {
  const headers = await ensureAuthenticatedHeaders()
  if (!headers) return

  feedError.value = null

  try {
    await $fetch(`/api/item-requests/${payload.requestId}`, {
      method: "PATCH",
      headers,
      body: {
        status: payload.status,
      },
    })

    await refreshFeed()
  } catch (error) {
    console.error("Failed to update request status", error)
    feedError.value = "Unable to update this request right now."
  }
}

const handleDeleteRequest = async (requestId: number) => {
  const headers = await ensureAuthenticatedHeaders()
  if (!headers) return

  feedError.value = null

  try {
    await $fetch(`/api/item-requests/${requestId}`, {
      method: "DELETE",
      headers,
    })

    await refreshFeed()
  } catch (error) {
    console.error("Failed to delete request", error)
    feedError.value = "Unable to delete this request right now."
  }
}

const handleUpdateOfferStatus = async (payload: {
  offerId: number
  requestId: number
  status: CommunityOfferStatus
}) => {
  const headers = await ensureAuthenticatedHeaders()
  if (!headers) return

  feedError.value = null

  try {
    await $fetch(`/api/request-offers/${payload.offerId}`, {
      method: "PATCH",
      headers,
      body: {
        status: payload.status,
      },
    })

    if (payload.status === "ACCEPTED") {
      const request = requests.value.find((entry) => entry.id === payload.requestId)

      if (request) {
        const remainingPendingOffers = request.offers.filter(
          (offer) => offer.id !== payload.offerId && offer.status === "PENDING",
        )

        await Promise.all(
          remainingPendingOffers.map((offer) =>
            $fetch(`/api/request-offers/${offer.id}`, {
              method: "PATCH",
              headers,
              body: {
                status: "DECLINED",
              },
            }),
          ),
        )
      }

      await $fetch(`/api/item-requests/${payload.requestId}`, {
        method: "PATCH",
        headers,
        body: {
          status: "FULFILLED",
        },
      })
    }

    await refreshFeed()
  } catch (error) {
    console.error("Failed to update offer status", error)
    feedError.value = "Unable to update this offer right now."
  }
}

const markNotificationRead = async (notificationId: string | number) => {
  if (typeof notificationId !== "number") {
    return
  }

  const headers = await ensureAuthenticatedHeaders()
  if (!headers) return

  try {
    await $fetch(`/api/request-offers/notifications/${notificationId}`, {
      method: "PATCH",
      headers,
    })

    notifications.value = notifications.value.map((notification) =>
      notification.id === notificationId ? { ...notification, read: true } : notification,
    )
  } catch (error) {
    console.error("Failed to mark notification as read", error)
  }
}

const markAllNotificationsRead = async () => {
  const headers = await ensureAuthenticatedHeaders()
  if (!headers) return

  try {
    await $fetch("/api/request-offers/notifications/read-all", {
      method: "POST",
      headers,
    })

    notifications.value = notifications.value.map((notification) => ({
      ...notification,
      read: true,
    }))
  } catch (error) {
    console.error("Failed to mark notifications as read", error)
  }
}

onMounted(() => {
  const currentViewerKey = user.value?.id ?? "anonymous"
  const isViewerCacheMatch = feedViewerKey.value === currentViewerKey
  const isCachedFeedFresh =
    feedHydrated.value &&
    isViewerCacheMatch &&
    feedLastLoadedAt.value !== null &&
    Date.now() - feedLastLoadedAt.value < COMMUNITY_FEED_CACHE_TTL_MS

  if (isCachedFeedFresh) {
    recordPerfEvent("community-feed", currentViewerKey, "cache-hit")
    isLoadingFeed.value = false
    return
  }

  if (feedHydrated.value && isViewerCacheMatch) {
    recordPerfEvent("community-feed", currentViewerKey, "background-refresh")
    isLoadingFeed.value = false
    void refreshFeed()
    return
  }

  recordPerfEvent("community-feed", currentViewerKey, "cache-miss")

  void refreshFeed()
})

watch(
  () => user.value?.id,
  (nextUserId, previousUserId) => {
    if (!feedHydrated.value) return
    if (nextUserId === previousUserId) return
    void refreshFeed()
  },
)

watch(currentDbUserId, (userId) => {
  if (!userId && activeFilter.value === "My Requests") {
    activeFilter.value = "Newest"
  }
})
</script>

<style scoped>
.custom-main-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-main-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-main-scrollbar::-webkit-scrollbar-thumb {
  background: theme("colors.noble-black / 10%");
  border-radius: 20px;
}
.custom-main-scrollbar::-webkit-scrollbar-thumb:hover {
  background: theme("colors.noble-black / 20%");
}
.custom-main-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: theme("colors.noble-black / 10%") transparent;
}
.container {
  scrollbar-gutter: stable;
}

.offer-modal-enter-active,
.offer-modal-leave-active {
  transition: opacity 0.22s ease;
}

.offer-modal-enter-active > div,
.offer-modal-leave-active > div {
  transition:
    transform 0.22s ease,
    opacity 0.22s ease;
}

.offer-modal-enter-from,
.offer-modal-leave-to {
  opacity: 0;
}

.offer-modal-enter-from > div,
.offer-modal-leave-to > div {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
</style>
