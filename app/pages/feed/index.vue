<template>
  <div class="flex flex-col h-screen font-geist bg-white overflow-hidden">
    <Header
      :notifications="currentUserNotifications"
      @mark-notification-read="markNotificationRead"
      @mark-all-notifications-read="markAllNotificationsRead"
    />

    <main ref="feedMainRef" class="flex-1 overflow-y-auto custom-main-scrollbar bg-white">
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
            <div class="flex flex-col gap-1">
              <h1 class="font-rewon text-[42px] text-noble-black leading-tight">Community Feed</h1>
              <p class="font-geist font-normal text-[18px] text-noble-black/60">
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

            <div class="flex flex-wrap items-center gap-3">
              <span
                class="rounded-full border border-blue-estate/10 bg-blue-estate/5 px-6 py-2 text-[14px] font-bold text-blue-estate"
              >
                Active requests
              </span>
              <span
                class="rounded-full border border-cinnamon-ice/30 bg-cream px-6 py-2 text-[14px] font-bold text-noble-black/60"
              >
                Newest first
              </span>
            </div>

            <div v-if="isLoading" class="flex flex-col gap-6">
              <div
                v-for="placeholder in 3"
                :key="placeholder"
                class="animate-pulse rounded-[24px] border border-cinnamon-ice/20 bg-cream p-6"
              >
                <div class="h-4 w-28 rounded bg-white/80" />
                <div class="mt-4 h-8 w-2/3 rounded bg-white/80" />
                <div class="mt-4 h-4 w-full rounded bg-white/80" />
                <div class="mt-2 h-4 w-5/6 rounded bg-white/80" />
                <div class="mt-6 grid gap-3 sm:grid-cols-3">
                  <div v-for="metric in 3" :key="metric" class="h-20 rounded-[18px] bg-white/80" />
                </div>
              </div>
            </div>

            <div
              v-else-if="errorMessage"
              class="rounded-[24px] border border-red-200 bg-red-50 p-6 text-red-700"
            >
              <p class="text-[16px] font-semibold">Unable to load requests</p>
              <p class="mt-2 text-[14px]">{{ errorMessage }}</p>
              <button
                class="mt-4 rounded-full bg-noble-black px-5 py-2 text-[14px] font-semibold text-white"
                @click="refresh"
              >
                Try again
              </button>
            </div>

            <div
              v-if="isLoadingFeed"
              class="rounded-[32px] border border-cinnamon-ice/20 bg-cream px-8 py-16 text-center text-[15px] text-noble-black/50"
            >
              Loading live community requests...
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
          </section>

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
      :existing-offer="existingOfferForCurrentUser"
      :is-submitting="isSubmittingOffer"
      :server-error="offerComposerError"
      @update:model-value="handleOfferComposerVisibility"
      @submit="submitOffer"
      @cancel-offer="cancelOffer"
    />
  </div>
</template>

<script setup lang="ts">
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

definePageMeta({ layout: false })

type ApiCommunityMember = {
  profileId: number
  userId: string
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
}

type ApiCommunityRequest = {
  id: number
  borrowerID: number
  itemNeeded: string
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

const supabase = useSupabaseClient()
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

const filters = ["Newest", "Most Offers", "Open", "My Requests"] as const
const activeFilter = ref<(typeof filters)[number]>("Newest")

const requests = ref<CommunityRequest[]>([])
const notifications = ref<CommunityOfferNotification[]>([])
const offerableItems = ref<CommunityOfferableItem[]>([])
const currentDbUserId = ref("")
const isLoadingFeed = ref(true)
const isCreatingRequest = ref(false)
const isSubmittingOffer = ref(false)
const feedError = ref<string | null>(null)
const requestComposerError = ref<string | null>(null)
const offerComposerError = ref<string | null>(null)
const isOfferComposerOpen = ref(false)
const activeOfferRequestId = ref<number | null>(null)
const feedHydrated = ref(false)

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

const normalizeMember = (member: ApiCommunityMember): CommunityMember => ({
  profileId: Number(member.profileId),
  userId: member.userId,
  name: member.name,
  avatar: member.avatar || "",
})

const normalizeOffer = (offer: ApiCommunityOffer): CommunityOffer => ({
  id: Number(offer.id),
  lenderID: Number(offer.lenderID),
  requestID: Number(offer.requestID),
  itemID: Number(offer.itemID),
  itemName: offer.itemName,
  rentalFee: Number(offer.rentalFee),
  availability: Boolean(offer.availability),
  condition: offer.condition as CommunityOffer["condition"],
  rentalTerms: offer.rentalTerms ?? "",
  status: offer.status as CommunityOfferStatus,
  borrowerReadAt: toDate(offer.borrowerReadAt),
  createdAt: toDate(offer.createdAt) ?? new Date(),
  updatedAt: toDate(offer.updatedAt) ?? new Date(),
  lender: normalizeMember(offer.lender),
})

const normalizeRequest = (request: ApiCommunityRequest): CommunityRequest => ({
  id: Number(request.id),
  borrowerID: Number(request.borrowerID),
  itemNeeded: request.itemNeeded,
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
})

const normalizeNotification = (
  notification: ApiCommunityNotification,
): CommunityOfferNotification => ({
  id: Number(notification.id),
  requestId: Number(notification.requestId),
  requestTitle: notification.requestTitle,
  recipientId: Number(notification.recipientId),
  actorName: notification.actorName,
  itemName: notification.itemName,
  fee: Number(notification.fee),
  createdAt: toDate(notification.createdAt) ?? new Date(),
  read: Boolean(notification.read),
})

const normalizeOfferableItem = (item: ApiOfferableItem): CommunityOfferableItem => ({
  id: item.id,
  numericId: Number(item.numericId),
  name: item.name,
  condition: item.condition as CommunityOfferableItem["condition"],
  rentalFee: Number(item.rentalFee),
  freeToBorrow: Boolean(item.freeToBorrow),
  status: item.status,
  rateOption: item.rateOption,
  createdAt: toDate(item.createdAt) ?? new Date(),
})

const getAccessToken = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session?.access_token
}

const getAuthHeaders = async () => {
  const accessToken = await getAccessToken()
  if (!accessToken) return undefined

  return {
    authorization: `Bearer ${accessToken}`,
  }
}

const enumerateRequestedDates = (startDate: string, endDate: string) => {
  const dates: string[] = []
  const cursor = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)

  while (cursor.getTime() <= end.getTime()) {
    dates.push(new Date(cursor).toISOString())
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

    if (headers) {
      try {
        const authResponse = await $fetch<{ user: { id: string } }>("/api/auth/me", { headers })
        currentDbUserId.value = authResponse.user.id
      } catch {
        currentDbUserId.value = ""
      }
    } else {
      currentDbUserId.value = ""
    }

    const [requestResponse, notificationResponse, offerableItemResponse] = await Promise.all([
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
    ])

    requests.value = requestResponse.map(normalizeRequest)
    notifications.value = notificationResponse.map(normalizeNotification)
    offerableItems.value = offerableItemResponse.map(normalizeOfferableItem)
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
        requestedDates: enumerateRequestedDates(payload.startDate, payload.endDate),
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
  activeOfferRequestId.value = requestId
  isOfferComposerOpen.value = true
}

const handleOfferComposerVisibility = (isVisible: boolean) => {
  isOfferComposerOpen.value = isVisible

  if (!isVisible) {
    activeOfferRequestId.value = null
    offerComposerError.value = null
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

const markNotificationRead = async (notificationId: number) => {
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
</style>
