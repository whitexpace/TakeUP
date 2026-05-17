<script setup lang="ts">
import { computed, onMounted, ref, reactive } from "vue"
import type { AuthMeUser } from "~/composables/use-auth-user"

definePageMeta({
  layout: "account",
  middleware: "account-auth",
})

type UsernameAvailabilityResponse = {
  username: string
  available: boolean
}

type DeactivationBlocker = {
  code: "ACTIVE_RENTAL" | "FUTURE_CONFIRMED_BOOKING" | "OPEN_DISPUTE"
  message: string
  count: number
}

type DeactivationEligibilityResponse = {
  allowed: boolean
  blockers: DeactivationBlocker[]
}

type AccountDeletionReason = {
  code:
    | "ACTIVE_TRANSACTIONS"
    | "PENDING_OR_UPCOMING_BOOKINGS"
    | "ACTIVE_DISPUTES"
    | "REMAINING_PAYOUT_BALANCE"
    | "UNSETTLED_PAYMENTS_OR_FEES"
    | "ACCOUNT_RESTRICTION"
  title: string
  message: string
  nextStep: string
  details?: Array<{
    title: string
    subtitle?: string
  }>
}

type AccountDeletionEligibilityResponse = {
  eligible: boolean
  reasons: AccountDeletionReason[]
}

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid"

const usernameRegex = /^(?=.{3,30}$)[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/

const user = useSupabaseUser()
const supabase = useSupabaseClient()
const runtimeConfig = useRuntimeConfig()
const avatarBucket = runtimeConfig.public.userAvatarBucket

const {
  authUser: cachedAuthUser,
  hasFreshCache: hasFreshAuthUserCache,
  fetch: fetchAuthUser,
  refresh: refreshAuthUser,
} = useAuthUser()

// Provide a compatible shape for existing template refs (authData.value?.user.X → authData.value?.user.X)
const authData = computed(() => (cachedAuthUser.value ? { user: cachedAuthUser.value } : null))
const refreshAuthData = refreshAuthUser
const isAuthDataPending = ref(true)
const isHydrated = ref(false)

onMounted(async () => {
  isHydrated.value = true
  if (!hasFreshAuthUserCache.value && !cachedAuthUser.value) {
    await fetchAuthUser()
  }
  isAuthDataPending.value = false
})

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== "object" || value === null) return null
  return value as Record<string, unknown>
}

const asNonEmptyString = (val: unknown) =>
  typeof val === "string" && val.trim() ? val.trim() : null

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
  if (!source) return null
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
  return fullName || null
}

const getAvatarFromSource = (source: Record<string, unknown> | null) => {
  if (!source) return null
  return (
    asNonEmptyString(source.picture) ||
    asNonEmptyString(source.avatar_url) ||
    asNonEmptyString(source.photo_url) ||
    asNonEmptyString(source.profile_image) ||
    asNonEmptyString(source.image) ||
    asNonEmptyString(source.avatarUrl)
  )
}

const buildDbFullName = (payload: AuthMeUser | undefined) => {
  if (!payload) return null
  const first = (payload.firstName || "").trim()
  const last = (payload.lastName || "").trim()

  const parts = [first, payload.middleName, last].filter(Boolean)
  return parts.length > 0 ? parts.join(" ") : null
}

const profileDetails = computed(() => {
  const authUser = user.value
  const authUserRecord = asRecord(authUser)
  const metadataSources = [
    asRecord(authUserRecord?.user_metadata),
    asRecord(authUserRecord?.app_metadata),
    ...getIdentityMetadata(authUser),
  ]

  // 1. Try DB name first (Highest priority for local edits)
  let fullName = buildDbFullName(authData.value?.user)

  // 2. Try direct metadata fields if DB name is missing
  if (!fullName) {
    const meta = authUserRecord?.user_metadata as Record<string, unknown> | undefined
    fullName = asNonEmptyString(meta?.full_name) || asNonEmptyString(meta?.name)
  }

  // 3. Try identity data if still missing
  if (!fullName) {
    for (const source of metadataSources) {
      const name = buildNameFromSource(source)
      if (name) {
        fullName = name
        break
      }
    }
  }

  fullName = fullName || asNonEmptyString(authUserRecord?.email)?.split("@")[0] || "User"

  let avatarUrl = asNonEmptyString(authData.value?.user.avatarUrl)
  if (!avatarUrl) {
    avatarUrl = metadataSources.map(getAvatarFromSource).find(Boolean) || null
  }

  const email = asNonEmptyString(authUserRecord?.email) || "No email available"
  const location = asNonEmptyString(authData.value?.user.location) || "Not set"
  const username = asNonEmptyString(authData.value?.user.username) || "Not set"
  const pronouns = asNonEmptyString(authData.value?.user.pronouns) || ""
  const bio = asNonEmptyString(authData.value?.user.bio) || ""
  const memberSince = formatMonthYear(parseDate(authData.value?.user.createdAt))

  const isVerified =
    Boolean(authUserRecord?.email_confirmed_at) ||
    Boolean(authUserRecord?.confirmed_at) ||
    email.endsWith("@up.edu.ph") ||
    email.endsWith("@gmail.com")

  return {
    fullName,
    avatarUrl,
    email,
    location,
    username,
    pronouns,
    bio,
    memberSince,
    isVerified,
  }
})

const profileInitial = computed(() => {
  const trimmedName = profileDetails.value.fullName.trim()
  return trimmedName ? trimmedName.charAt(0).toUpperCase() : "U"
})

const _emailNotificationsEnabled = ref(true)
const showEditProfileModal = ref(false)
const showDeleteAccountModal = ref(false)
const showDeactivateAccountModal = ref(false)
const isDeletingAccount = ref(false)

const profileForm = reactive({
  name: "",
  username: "",
  location: "",
  pronouns: "",
  bio: "",
})

const currentAvatarFile = ref<File | null>(null)
const currentAvatarPreview = ref<string | null>(null)
const avatarInputRef = ref<HTMLInputElement | null>(null)
const avatarUploadError = ref<string | null>(null)

const usernameStatus = ref<UsernameStatus>("idle")
const isSavingProfile = ref(false)
const profileSaveError = ref<string | null>(null)

const openEditProfileModal = () => {
  const u = authData.value?.user
  if (u) {
    const currentFullName = buildDbFullName(u) || profileDetails.value.fullName
    profileForm.name =
      currentFullName === "User" || currentFullName === "Loading..." ? "" : currentFullName
    profileForm.username = u.username === "Not set" || u.username === "UP User" ? "" : u.username
    profileForm.location = u.location === "Not set" ? "" : u.location || ""
    profileForm.pronouns = u.pronouns || ""
    profileForm.bio = u.bio || ""
    currentAvatarPreview.value = profileDetails.value.avatarUrl
    currentAvatarFile.value = null
  }
  showEditProfileModal.value = true
}

const closeEditProfileModal = () => {
  showEditProfileModal.value = false
  currentAvatarFile.value = null
  currentAvatarPreview.value = null
  profileSaveError.value = null
  avatarUploadError.value = null
  usernameStatus.value = "idle"
}

const triggerAvatarUpload = () => {
  avatarInputRef.value?.click()
}

const handleAvatarSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (file.size > 2 * 1024 * 1024) {
    avatarUploadError.value = "Image must be smaller than 2MB"
    return
  }

  avatarUploadError.value = null
  currentAvatarFile.value = file
  currentAvatarPreview.value = URL.createObjectURL(file)
}

const usernameHelperText = computed(() => {
  if (usernameStatus.value === "checking") return "Checking availability..."
  if (usernameStatus.value === "available") return "Username is available"
  if (usernameStatus.value === "taken") return "Username is already taken"
  if (usernameStatus.value === "invalid") return "Invalid username format"
  return ""
})

watch(
  () => profileForm.username,
  (newVal) => {
    if (!newVal || newVal === authData.value?.user.username) {
      usernameStatus.value = "idle"
      return
    }

    if (!usernameRegex.test(newVal)) {
      usernameStatus.value = "invalid"
      return
    }

    void debouncedCheckUsername(newVal)
  },
)

let usernameCheckTimeout: NodeJS.Timeout | null = null
const debouncedCheckUsername = (username: string) => {
  if (usernameCheckTimeout) clearTimeout(usernameCheckTimeout)
  usernameStatus.value = "checking"
  usernameCheckTimeout = setTimeout(() => {
    void checkUsernameAvailability(username)
  }, 500)
}

const checkUsernameAvailability = async (username: string) => {
  try {
    const { available } = await $fetch<UsernameAvailabilityResponse>(
      `/api/account/username-availability?username=${username}`,
    )
    usernameStatus.value = available ? "available" : "taken"
  } catch {
    usernameStatus.value = "idle"
  }
}

const canSaveProfile = computed(() => {
  if (isSavingProfile.value) return false
  if (
    usernameStatus.value === "checking" ||
    usernameStatus.value === "taken" ||
    usernameStatus.value === "invalid"
  ) {
    return false
  }
  if (!profileForm.name.trim()) return false
  if (!profileForm.username.trim()) return false
  return true
})

const saveProfile = async () => {
  if (!canSaveProfile.value) return
  isSavingProfile.value = true
  profileSaveError.value = null

  try {
    let avatarUrl = authData.value?.user.avatarUrl || null

    if (currentAvatarFile.value) {
      const fileExt = currentAvatarFile.value.name.split(".").pop()
      const fileName = `${authData.value?.user.id}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from(avatarBucket)
        .upload(filePath, currentAvatarFile.value)

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from(avatarBucket).getPublicUrl(filePath)
      avatarUrl = publicUrl
    }

    // IMPORTANT: Send empty strings instead of null for Zod string validation
    const payload = {
      name: profileForm.name.trim(),
      username: profileForm.username.trim().toLowerCase(),
      location: profileForm.location.trim(),
      pronouns: profileForm.pronouns.trim(),
      bio: profileForm.bio.trim(),
      avatarUrl,
    }

    await $fetch("/api/account/profile", {
      method: "PATCH",
      body: payload,
    })

    await refreshAuthData()
    showEditProfileModal.value = false
  } catch (error: unknown) {
    console.error("Detailed Profile Update Error:", error)
    profileSaveError.value = getEnhancedErrorMessage(error)
  } finally {
    isSavingProfile.value = false
  }
}

function getEnhancedErrorMessage(error: unknown): string {
  // Extract Zod validation errors if present
  const fetchError = error as {
    data?: { data?: Record<string, { _errors: string[] }>; statusMessage?: string }
    message?: string
  }
  const data = fetchError?.data?.data || fetchError?.data
  if (data) {
    const zodErrors = data as Record<string, { _errors: string[] }>
    if (typeof zodErrors === "object" && zodErrors !== null) {
      const firstField = Object.keys(zodErrors)[0]
      if (firstField && zodErrors[firstField]?._errors) {
        const fieldName = firstField.charAt(0).toUpperCase() + firstField.slice(1)
        return `${fieldName}: ${zodErrors[firstField]._errors[0]}`
      }
    }
  }

  if (fetchError?.data?.statusMessage) return fetchError.data.statusMessage
  if (fetchError?.message) return fetchError.message
  return "Invalid input. Please check your details."
}

const {
  data: deactivationEligibility,
  refresh: loadDeactivationEligibility,
  pending: isLoadingDeactivationEligibility,
} = useLazyAsyncData(
  "account:deactivation-check",
  () => $fetch<DeactivationEligibilityResponse>("/api/account/deactivation-eligibility"),
  {
    server: false,
    immediate: false,
  },
)

const deactivateAccountError = ref<string | null>(null)
const isDeactivatingAccount = ref(false)

const canDeactivateAccount = computed(() => {
  return deactivationEligibility.value?.allowed && !isDeactivatingAccount.value
})

const openDeactivateAccountModal = async () => {
  deactivateAccountError.value = null
  showDeactivateAccountModal.value = true
  await loadDeactivationEligibility()
}

const closeDeactivateAccountModal = () => {
  if (isDeactivatingAccount.value) return
  showDeactivateAccountModal.value = false
}

const deactivateAccount = async () => {
  if (!canDeactivateAccount.value) return
  isDeactivatingAccount.value = true
  deactivateAccountError.value = null

  try {
    await $fetch("/api/account/deactivate", { method: "POST" })
    await supabase.auth.signOut()
    await navigateTo("/?deactivated=1", { replace: true })
  } catch (error: unknown) {
    deactivateAccountError.value = getErrorMessage(error, "Failed to deactivate account.")
  } finally {
    isDeactivatingAccount.value = false
  }
}

const {
  data: deletionEligibility,
  refresh: loadDeletionEligibility,
  pending: _isDeletionPending,
} = useLazyAsyncData(
  "account:deletion-check",
  () => $fetch<AccountDeletionEligibilityResponse>("/api/account/deletion"),
  {
    server: false,
    immediate: false,
  },
)

const deleteConfirmationText = ref("")
const deleteAccountError = ref<string | null>(null)

const canDeleteAccount = computed(() => {
  return (
    deletionEligibility.value?.eligible &&
    deleteConfirmationText.value === "DELETE" &&
    !isDeletingAccount.value
  )
})

const openDeleteAccountModal = async () => {
  deleteAccountError.value = null
  deleteConfirmationText.value = ""
  showDeleteAccountModal.value = true
  await loadDeletionEligibility()
}

const closeDeleteAccountModal = () => {
  if (isDeletingAccount.value) return
  showDeleteAccountModal.value = false
}

const deleteAccount = async () => {
  if (!canDeleteAccount.value) return
  isDeletingAccount.value = true
  deleteAccountError.value = null

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const accessToken = session?.access_token

    if (!accessToken) throw new Error("No active session found")

    await $fetch("/api/account/deletion", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {
        confirmation: deleteConfirmationText.value.trim(),
      },
    })

    await supabase.auth.signOut()
    await navigateTo("/?accountDeleted=1", { replace: true })
  } catch (error: unknown) {
    const eligibilityPayload = getDeletionEligibilityPayload(error)

    if (eligibilityPayload) {
      deletionEligibility.value = eligibilityPayload
    } else {
      await loadDeletionEligibility()
    }

    deleteAccountError.value = getErrorMessage(
      error,
      "We could not delete your account right now. Please try again.",
    )
  } finally {
    isDeletingAccount.value = false
  }
}

function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d
}

function formatMonthYear(date: Date | null): string | null {
  if (!date) return null
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date)
}

function getErrorMessage(error: unknown, defaultMsg: string): string {
  const fetchError = error as { data?: { error?: { message?: string } }; message?: string }
  if (fetchError?.data?.error?.message) return fetchError.data.error.message
  if (fetchError?.message) return fetchError.message
  return defaultMsg
}

function getDeletionEligibilityPayload(error: unknown): AccountDeletionEligibilityResponse | null {
  const fetchError = error as { data?: AccountDeletionEligibilityResponse }
  if (fetchError?.data?.eligible !== undefined && Array.isArray(fetchError?.data?.reasons)) {
    return fetchError.data
  }
  return null
}
</script>

<template>
  <PersonalAccountPageSkeleton v-if="!isHydrated || isAuthDataPending" />

  <div v-else class="mx-auto max-w-[1100px] space-y-6 pb-10 font-geist lg:px-16 xl:px-24">
    <!-- Main Content Area -->
    <template v-if="authData">
      <section class="space-y-3">
        <div class="space-y-2">
          <h1 class="font-montravia text-[36px] font-medium text-noble-black">
            Account Information
          </h1>
          <div class="w-10 h-0.5 bg-burning-orange"></div>
        </div>
        <p class="text-[16px] font-light text-noble-black/50">
          Manage your personal details and account settings.
        </p>
      </section>

      <!-- Profile Card -->
      <section
        class="overflow-hidden rounded-[24px] border border-cinnamon-ice/20 bg-cream shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
      >
        <div
          class="relative px-5 py-5 bg-gradient-to-br from-cream/95 to-cream/80 backdrop-blur-md border-b border-cinnamon-ice/10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="border-l-[3px] border-burning-orange pl-4">
            <h2 class="text-[20px] font-semibold text-noble-black">Profile</h2>
            <p class="mt-0.5 text-[13px] font-light text-noble-black/50">
              Your personal information and profile picture
            </p>
          </div>
          <button
            type="button"
            class="inline-flex h-10 items-center justify-center rounded-[12px] bg-burning-orange px-6 text-[14px] font-semibold text-white transition hover:brightness-95 shadow-sm shadow-burning-orange/20"
            @click="openEditProfileModal"
          >
            Edit Profile
          </button>
        </div>

        <div class="px-5 py-6 sm:px-6">
          <div class="flex min-w-0 items-center gap-5 sm:gap-8">
            <div class="relative group shrink-0">
              <div class="relative w-[72px] h-[72px] flex items-center justify-center rounded-full">
                <svg class="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 72 72">
                  <circle
                    cx="36"
                    cy="36"
                    r="35"
                    fill="none"
                    stroke="currentColor"
                    class="text-cinnamon-ice"
                    stroke-width="2.5"
                    stroke-dasharray="73.3 146.6"
                    stroke-linecap="round"
                  />
                  <circle
                    cx="36"
                    cy="36"
                    r="35"
                    fill="none"
                    stroke="currentColor"
                    class="text-burning-orange"
                    stroke-width="2.5"
                    stroke-dasharray="73.3 146.6"
                    stroke-dashoffset="-73.3"
                    stroke-linecap="round"
                  />
                  <circle
                    cx="36"
                    cy="36"
                    r="35"
                    fill="none"
                    stroke="currentColor"
                    class="text-blue-estate"
                    stroke-width="2.5"
                    stroke-dasharray="73.3 146.6"
                    stroke-dashoffset="-146.6"
                    stroke-linecap="round"
                  />
                </svg>
                <div
                  class="w-[64px] h-[64px] rounded-full overflow-hidden shadow-sm transition-transform duration-300 group-hover:scale-105 z-10"
                >
                  <img
                    v-if="profileDetails.avatarUrl"
                    :src="profileDetails.avatarUrl"
                    :alt="profileDetails.fullName"
                    class="h-full w-full object-cover"
                    referrerpolicy="no-referrer"
                  />
                  <div
                    v-else
                    class="w-full h-full flex items-center justify-center text-white font-bold text-2xl bg-burning-orange"
                  >
                    {{ profileInitial }}
                  </div>
                </div>
              </div>
            </div>
            <div class="min-w-0 flex-1 pt-1">
              <h3 class="truncate text-[22px] font-semibold text-noble-black">
                {{ profileDetails.fullName }}
              </h3>
              <div
                class="mt-3 flex flex-wrap items-center gap-x-2 text-[14px] font-medium text-noble-black/45"
              >
                <span class="truncate">{{ profileDetails.email }}</span>
                <span class="select-none text-noble-black/20">·</span>
                <span class="truncate">{{ profileDetails.location }}</span>
                <span class="select-none text-noble-black/20">·</span>
                <span>Joined {{ profileDetails.memberSince ?? "N/A" }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Danger Zone Card -->
      <section
        class="rounded-[24px] border border-cinnamon-ice/20 bg-cream px-5 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300 sm:px-6 sm:py-6"
      >
        <div class="border-l-[3px] border-burning-orange pl-4">
          <h2 class="text-[20px] font-semibold text-noble-black">Danger Zone</h2>
          <p class="text-[13px] font-light text-noble-black/50">
            Irreversible actions related to your account security and data.
          </p>
        </div>
        <div class="mt-8 space-y-4 border-t border-cinnamon-ice/10 pt-6">
          <div
            class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white/40 rounded-[20px] p-5 border border-cinnamon-ice/5 transition-all duration-300 hover:bg-white/60"
          >
            <div class="max-w-md space-y-1">
              <h3 class="text-[16px] font-medium text-noble-black">Deactivate Account</h3>
              <p class="text-[13px] font-light text-noble-black/50">
                Hide your profile and listings until you sign in again. Your data remains safe.
              </p>
            </div>
            <button
              type="button"
              class="h-10 px-6 rounded-[12px] border-2 border-cinnabar-red text-cinnabar-red text-[13px] font-semibold hover:bg-cinnabar-red hover:text-white transition-all duration-300"
              @click="openDeactivateAccountModal"
            >
              Deactivate
            </button>
          </div>
          <div
            class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white/40 rounded-[20px] p-5 border border-cinnamon-ice/5 transition-all duration-300 hover:bg-white/60"
          >
            <div class="max-w-md space-y-1">
              <h3 class="text-[16px] font-medium text-noble-black">Delete Account</h3>
              <p class="text-[13px] font-light text-noble-black/50">
                Permanently erase your account, active listings, and all personal data from TakeUP.
              </p>
            </div>
            <button
              type="button"
              class="h-10 px-6 rounded-[12px] bg-cinnabar-red text-white text-[13px] font-semibold shadow-sm shadow-cinnabar-red/20 hover:brightness-110 transition-all duration-300"
              @click="openDeleteAccountModal"
            >
              Delete
            </button>
          </div>
        </div>
      </section>

      <!-- Modals -->
      <Teleport to="body">
        <!-- Edit Profile Modal -->
        <div
          v-if="showEditProfileModal"
          class="fixed inset-0 z-[1300] flex items-center justify-center p-4 font-geist"
        >
          <div
            class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm"
            @click="closeEditProfileModal"
          />
          <div
            class="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-[20px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.15)] overflow-hidden"
          >
            <!-- Header -->
            <div class="px-6 pt-8 pb-4 flex items-start justify-between gap-4 shrink-0">
              <div>
                <h2 class="text-[24px] font-semibold text-noble-black">Edit Profile</h2>
                <p class="mt-1 text-[13px] font-light text-noble-black/50">
                  Update your public account details.
                </p>
              </div>
              <button
                type="button"
                class="flex h-10 w-10 items-center justify-center rounded-full text-noble-black transition hover:bg-gray-100"
                @click="closeEditProfileModal"
              >
                <Icon name="ph:x" class="w-[18px] h-[18px]" />
              </button>
            </div>

            <!-- Scrollable Content -->
            <div class="flex-1 overflow-y-auto custom-modal-scrollbar px-6">
              <div class="flex flex-col items-center gap-2 py-6">
                <div class="relative group cursor-pointer" @click="triggerAvatarUpload">
                  <div
                    class="relative w-[96px] h-[96px] flex items-center justify-center rounded-full"
                  >
                    <svg class="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 96 96">
                      <circle
                        cx="48"
                        cy="48"
                        r="46.5"
                        fill="none"
                        stroke="currentColor"
                        class="text-cinnamon-ice"
                        stroke-width="3"
                        stroke-dasharray="97.4 194.8"
                        stroke-linecap="round"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r="46.5"
                        fill="none"
                        stroke="currentColor"
                        class="text-burning-orange"
                        stroke-width="3"
                        stroke-dasharray="97.4 194.8"
                        stroke-dashoffset="-97.4"
                        stroke-linecap="round"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r="46.5"
                        fill="none"
                        stroke="currentColor"
                        class="text-blue-estate"
                        stroke-width="3"
                        stroke-dasharray="97.4 194.8"
                        stroke-dashoffset="-194.8"
                        stroke-linecap="round"
                      />
                    </svg>
                    <div
                      class="w-[86px] h-[86px] rounded-full overflow-hidden shadow-sm relative z-10"
                    >
                      <img
                        v-if="currentAvatarPreview"
                        :src="currentAvatarPreview"
                        :alt="profileForm.name"
                        class="h-full w-full object-cover"
                        referrerpolicy="no-referrer"
                      />
                      <div
                        v-else
                        class="w-full h-full flex items-center justify-center text-white font-bold text-3xl bg-burning-orange"
                      >
                        {{ profileInitial }}
                      </div>
                      <div
                        class="absolute inset-0 bg-noble-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      >
                        <Icon name="ph:camera" class="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div
                      class="absolute bottom-1 right-1 w-7 h-7 bg-burning-orange rounded-full flex items-center justify-center shadow-md z-20 transition-transform duration-300 group-hover:scale-110"
                    >
                      <Icon name="ph:pencil-simple" class="w-3 h-3 text-white" />
                    </div>
                  </div>
                </div>
                <input
                  ref="avatarInputRef"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="handleAvatarSelect"
                />
                <p
                  v-if="avatarUploadError"
                  class="mt-2 text-center text-sm text-cinnabar-red font-medium"
                >
                  {{ avatarUploadError }}
                </p>
              </div>

              <div class="w-full h-[1px] bg-cinnamon-ice/10 mb-8"></div>

              <div class="space-y-5 pb-8">
                <!-- Inputs -->
                <div class="relative group">
                  <div
                    class="absolute left-4 top-[18px] text-noble-black/40 group-focus-within:text-burning-orange transition-colors duration-300"
                  >
                    <Icon name="ph:user" class="w-[18px] h-[18px]" />
                  </div>
                  <input
                    id="edit-profile-name"
                    v-model="profileForm.name"
                    type="text"
                    placeholder=" "
                    class="peer w-full pl-12 pr-4 pt-6 pb-2 border-[1.5px] border-gray-200 rounded-[10px] bg-white focus:border-burning-orange focus:shadow-[0_0_0_3px_rgba(232,101,10,0.1)] outline-none text-[15px] text-noble-black transition-all duration-300"
                  />
                  <label
                    for="edit-profile-name"
                    class="absolute left-12 top-4 text-noble-black/40 text-[15px] transition-all duration-300 pointer-events-none peer-placeholder-shown:top-4 peer-placeholder-shown:text-[15px] peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-burning-orange peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[11px]"
                    >Full Name</label
                  >
                </div>

                <div class="space-y-1.5">
                  <div class="relative group">
                    <div
                      class="flex w-full border-[1.5px] border-gray-200 rounded-[10px] bg-white focus-within:border-burning-orange focus-within:shadow-[0_0_0_3px_rgba(232,101,10,0.1)] transition-all duration-300 h-[58px]"
                    >
                      <div
                        class="absolute left-4 top-[18px] text-noble-black/40 group-focus-within:text-burning-orange transition-colors duration-300 z-10"
                      >
                        <Icon name="ph:at" class="w-[18px] h-[18px]" />
                      </div>
                      <div class="flex-1 relative">
                        <input
                          id="edit-profile-username"
                          v-model="profileForm.username"
                          type="text"
                          placeholder=" "
                          autocapitalize="off"
                          autocomplete="off"
                          spellcheck="false"
                          class="peer w-full pl-12 pr-10 pt-6 pb-2 bg-transparent outline-none text-[15px] text-noble-black h-full transition-all duration-300"
                        />
                        <label
                          for="edit-profile-username"
                          class="absolute left-12 top-4 text-noble-black/40 text-[15px] transition-all duration-300 pointer-events-none peer-placeholder-shown:top-4 peer-placeholder-shown:text-[15px] peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-burning-orange peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[11px]"
                          >Username</label
                        >
                        <div
                          v-if="usernameStatus === 'available'"
                          class="absolute right-3 top-1/2 -translate-y-1/2 mt-2 text-success-green"
                        >
                          <Icon name="ph:check" class="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <p
                    v-if="
                      usernameStatus === 'taken' ||
                      usernameStatus === 'invalid' ||
                      usernameStatus === 'checking'
                    "
                    class="text-[12px] ml-1"
                    :class="
                      usernameStatus === 'taken' || usernameStatus === 'invalid'
                        ? 'text-cinnabar-red font-medium'
                        : 'text-noble-black/45'
                    "
                  >
                    {{ usernameHelperText }}
                  </p>
                </div>

                <div class="relative group">
                  <div
                    class="absolute left-4 top-[18px] text-noble-black/40 group-focus-within:text-burning-orange transition-colors duration-300"
                  >
                    <Icon name="ph:map-pin" class="w-[18px] h-[18px]" />
                  </div>
                  <input
                    id="edit-profile-location"
                    v-model="profileForm.location"
                    type="text"
                    placeholder=" "
                    class="peer w-full pl-12 pr-4 pt-6 pb-2 border-[1.5px] border-gray-200 rounded-[10px] bg-white focus:border-burning-orange focus:shadow-[0_0_0_3px_rgba(232,101,10,0.1)] outline-none text-[15px] text-noble-black transition-all duration-300"
                  />
                  <label
                    for="edit-profile-location"
                    class="absolute left-12 top-4 text-noble-black/40 text-[15px] transition-all duration-300 pointer-events-none peer-placeholder-shown:top-4 peer-placeholder-shown:text-[15px] peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-burning-orange peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[11px]"
                    >Location</label
                  >
                </div>

                <div class="relative group">
                  <div
                    class="absolute left-4 top-[18px] text-noble-black/40 group-focus-within:text-burning-orange transition-colors duration-300"
                  >
                    <Icon name="ph:smiley" class="w-[18px] h-[18px]" />
                  </div>
                  <input
                    id="edit-profile-pronouns"
                    v-model="profileForm.pronouns"
                    type="text"
                    placeholder=" "
                    class="peer w-full pl-12 pr-4 pt-6 pb-2 border-[1.5px] border-gray-200 rounded-[10px] bg-white focus:border-burning-orange focus:shadow-[0_0_0_3px_rgba(232,101,10,0.1)] outline-none text-[15px] text-noble-black transition-all duration-300"
                  />
                  <label
                    for="edit-profile-pronouns"
                    class="absolute left-12 top-4 text-noble-black/40 text-[15px] transition-all duration-300 pointer-events-none peer-placeholder-shown:top-4 peer-placeholder-shown:text-[15px] peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-burning-orange peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[11px]"
                    >Pronouns</label
                  >
                </div>

                <div class="relative group">
                  <div
                    class="absolute left-4 top-[18px] text-noble-black/40 group-focus-within:text-burning-orange transition-colors duration-300"
                  >
                    <Icon name="ph:pencil-simple" class="w-[18px] h-[18px]" />
                  </div>
                  <textarea
                    id="edit-profile-bio"
                    v-model="profileForm.bio"
                    rows="3"
                    maxlength="200"
                    placeholder=" "
                    class="peer w-full pl-12 pr-4 pt-7 pb-2 border-[1.5px] border-gray-200 rounded-[10px] bg-white focus:border-burning-orange focus:shadow-[0_0_0_3px_rgba(232,101,10,0.1)] outline-none text-[15px] text-noble-black transition-all duration-300 resize-none h-28"
                  />
                  <label
                    for="edit-profile-bio"
                    class="absolute left-12 top-5 text-noble-black/40 text-[15px] transition-all duration-300 pointer-events-none peer-placeholder-shown:top-5 peer-placeholder-shown:text-[15px] peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-burning-orange peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[11px]"
                    >Bio</label
                  >
                  <div
                    class="absolute right-4 bottom-2 text-[11px] text-noble-black/30 font-medium"
                  >
                    {{ profileForm.bio.length }}/200
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div
              class="px-6 py-5 border-t border-cinnamon-ice/10 bg-white flex flex-col shrink-0 gap-3"
            >
              <p v-if="profileSaveError" class="text-sm text-cinnabar-red font-medium text-center">
                {{ profileSaveError }}
              </p>
              <div class="flex gap-3 w-full">
                <button
                  type="button"
                  class="flex-1 h-12 items-center justify-center rounded-[10px] border-[1.5px] border-burning-orange bg-white text-[15px] font-semibold text-burning-orange transition-all duration-200 hover:bg-burning-orange/5"
                  @click="closeEditProfileModal"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="flex-1 h-12 items-center justify-center rounded-[10px] bg-gradient-to-br from-burning-orange to-orange-500 text-[15px] font-semibold text-white transition-all duration-300 shadow-lg shadow-burning-orange/35 hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  :disabled="!canSaveProfile"
                  @click="saveProfile"
                >
                  {{ isSavingProfile ? "Saving..." : "Save Changes" }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Deactivate Modal -->
        <div
          v-if="showDeactivateAccountModal"
          class="fixed inset-0 z-[1300] flex items-center justify-center p-4 font-geist"
        >
          <div
            class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm"
            @click="closeDeactivateAccountModal"
          />
          <div
            class="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-[20px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.15)] overflow-hidden"
          >
            <!-- Header -->
            <div class="px-6 pt-8 pb-4 flex items-start justify-between gap-4 shrink-0">
              <div>
                <h2 class="text-[24px] font-semibold text-noble-black">Deactivate Account</h2>
                <p class="mt-1 text-[13px] font-light text-noble-black/50">
                  Temporarily hide your profile and listings.
                </p>
              </div>
              <button
                type="button"
                class="flex h-10 w-10 items-center justify-center rounded-full text-noble-black transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="isDeactivatingAccount"
                @click="closeDeactivateAccountModal"
              >
                <Icon name="ph:x" class="w-[18px] h-[18px]" />
              </button>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto custom-modal-scrollbar px-6">
              <div class="py-6">
                <!-- Eligibility Banner -->
                <div
                  v-if="isLoadingDeactivationEligibility"
                  class="rounded-[14px] border-[1.5px] border-cinnamon-ice/20 bg-cream p-5 text-[14px] font-medium text-noble-black/60 flex items-center gap-2"
                >
                  <Icon name="ph:circle-notch" class="w-4 h-4 animate-spin" />
                  Checking eligibility...
                </div>

                <div
                  v-else-if="deactivationEligibility?.blockers.length"
                  class="rounded-[14px] border-[1.5px] border-cinnabar-red/20 bg-cinnabar-red/5 p-5"
                >
                  <h3 class="text-[15px] font-semibold text-cinnabar-red">
                    Deactivation is blocked
                  </h3>
                  <ul class="mt-4 space-y-4">
                    <li
                      v-for="blocker in deactivationEligibility.blockers"
                      :key="blocker.code"
                      class="text-[13px] font-medium text-noble-black/80 flex items-start gap-3"
                    >
                      <Icon
                        name="ph:warning-circle"
                        class="w-[18px] h-[18px] text-cinnabar-red shrink-0 mt-0.5"
                      />
                      <span class="leading-relaxed">{{ blocker.message }}</span>
                    </li>
                  </ul>
                </div>

                <div
                  v-else-if="deactivationEligibility?.allowed"
                  class="rounded-[14px] border border-cinnamon-ice/20 bg-cream p-5"
                >
                  <div class="flex items-center gap-3 text-success-green">
                    <Icon name="ph:check" class="w-5 h-5" />
                    <h3 class="text-[16px] font-bold">Account ready to deactivate</h3>
                  </div>
                  <p class="mt-2 text-[13px] font-medium text-noble-black/50 leading-relaxed">
                    All checks passed. You can reactivate your account at any time by signing back
                    in. Click the button below to proceed.
                  </p>
                </div>

                <div
                  v-else
                  class="rounded-[14px] border border-cinnamon-ice/20 bg-cream p-5 text-[14px] font-medium text-noble-black/60"
                >
                  Unable to check eligibility at this time. Please try again later.
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div
              class="px-6 py-5 border-t border-cinnamon-ice/10 bg-white flex flex-col shrink-0 gap-3"
            >
              <p
                v-if="deactivateAccountError"
                class="text-sm text-cinnabar-red font-medium text-center"
              >
                {{ deactivateAccountError }}
              </p>
              <div class="flex gap-3 w-full">
                <button
                  type="button"
                  class="flex-1 h-12 items-center justify-center rounded-[10px] border-[1.5px] border-cinnabar-red bg-white text-[15px] font-semibold text-cinnabar-red transition-all duration-200 hover:bg-cinnabar-red/5 disabled:opacity-50"
                  :disabled="isDeactivatingAccount"
                  @click="closeDeactivateAccountModal"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="flex-1 h-12 items-center justify-center rounded-[10px] bg-cinnabar-red text-[15px] font-semibold text-white transition-all duration-300 shadow-lg shadow-cinnabar-red/20 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!canDeactivateAccount"
                  @click="deactivateAccount"
                >
                  {{ isDeactivatingAccount ? "Deactivating..." : "Deactivate" }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Delete Modal -->
        <div
          v-if="showDeleteAccountModal"
          class="fixed inset-0 z-[1300] flex items-center justify-center p-4 font-geist"
        >
          <div
            class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm"
            @click="closeDeleteAccountModal"
          />
          <div
            class="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-[20px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.15)] overflow-hidden"
          >
            <!-- Header -->
            <div class="px-6 pt-8 pb-4 flex items-start justify-between gap-4 shrink-0">
              <div>
                <h2 class="text-[24px] font-semibold text-noble-black">Delete Account</h2>
                <p class="mt-1 text-[13px] font-light text-noble-black/50">
                  This action is permanent and cannot be undone.
                </p>
              </div>
              <button
                type="button"
                class="flex h-10 w-10 items-center justify-center rounded-full text-noble-black transition hover:bg-gray-100"
                @click="closeDeleteAccountModal"
              >
                <Icon name="ph:x" class="w-[18px] h-[18px]" />
              </button>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto custom-modal-scrollbar px-6">
              <div class="py-6 space-y-6">
                <div
                  class="rounded-[16px] border border-cinnabar-red/10 bg-cinnabar-red/[0.03] p-5"
                >
                  <div class="flex items-start gap-3 text-cinnabar-red">
                    <Icon name="ph:info" class="w-[18px] h-[18px] shrink-0 mt-0.5" />
                    <p class="text-[13px] font-bold leading-relaxed">
                      Required financial and transaction records are retained in an anonymized form
                      for compliance.
                    </p>
                  </div>
                </div>

                <div class="space-y-4">
                  <div class="relative group">
                    <div
                      class="absolute left-4 top-[18px] text-noble-black/40 group-focus-within:text-cinnabar-red transition-colors duration-300"
                    >
                      <Icon name="ph:check" class="w-[18px] h-[18px]" />
                    </div>
                    <input
                      id="delete-confirmation"
                      v-model="deleteConfirmationText"
                      type="text"
                      placeholder=" "
                      class="peer w-full pl-12 pr-4 pt-6 pb-2 border-[1.5px] border-gray-200 rounded-[10px] bg-white focus:border-cinnabar-red focus:shadow-[0_0_0_3px_rgba(220,38,38,0.1)] outline-none text-[15px] font-bold text-noble-black transition-all duration-300 uppercase"
                    />
                    <label
                      for="delete-confirmation"
                      class="absolute left-12 top-4 text-noble-black/40 text-[15px] transition-all duration-300 pointer-events-none peer-placeholder-shown:top-4 peer-placeholder-shown:text-[15px] peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-cinnabar-red peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[11px]"
                    >
                      Type <span class="font-bold">DELETE</span> to confirm
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div
              class="px-6 py-5 border-t border-cinnamon-ice/10 bg-white flex flex-col shrink-0 gap-3"
            >
              <p
                v-if="deleteAccountError"
                class="text-sm text-cinnabar-red font-medium text-center"
              >
                {{ deleteAccountError }}
              </p>
              <div class="flex gap-3 w-full">
                <button
                  type="button"
                  class="flex-1 h-12 items-center justify-center rounded-[10px] border-[1.5px] border-cinnabar-red bg-white text-[15px] font-semibold text-cinnabar-red transition-all duration-200 hover:bg-cinnabar-red/5"
                  @click="closeDeleteAccountModal"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="flex-1 h-12 items-center justify-center rounded-[10px] bg-cinnabar-red text-[15px] font-semibold text-white transition-all duration-300 shadow-lg shadow-cinnabar-red/20 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!canDeleteAccount"
                  @click="deleteAccount"
                >
                  {{ isDeletingAccount ? "Deleting..." : "Permanently Delete" }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Teleport>
    </template>
  </div>
</template>
