<script setup lang="ts">
definePageMeta({
  layout: "account",
  middleware: "account-auth",
})

type AuthMeResponse = {
  user: {
    id: string
    email: string
    name: string
    username: string
    firstName: string
    middleName: string | null
    lastName: string
    accountType: string | null
    createdAt: string | null
    location: string | null
    avatarUrl: string | null
    bio: string | null
    pronouns: string | null
  }
}

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

type ProfileUpdateResponse = {
  user: {
    id: string
    username: string
    firstName: string
    middleName: string | null
    lastName: string
    location: string | null
    pronouns: string | null
    bio: string | null
    avatarUrl: string | null
  }
}

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid"

const usernameRegex = /^(?=.{3,30}$)[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/

const user = useSupabaseUser()
const supabase = useSupabaseClient()
const runtimeConfig = useRuntimeConfig()
const avatarBucket = runtimeConfig.public.userAvatarBucket

const {
  data: authData,
  refresh: refreshAuthData,
  pending: isAuthDataPending,
} = useAsyncData("account:auth-me", () => $fetch<AuthMeResponse>("/api/auth/me"), {
  server: false, // Only fetch on client after middleware runs
  watch: [user], // Refetch if user changes
})

const isHydrated = ref(false)

onMounted(() => {
  isHydrated.value = true
})

const isInitialPageLoading = computed(
  () => !isHydrated.value || (isAuthDataPending.value && !authData.value),
)

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

const parseDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value !== "string") return null

  const trimmedValue = value.trim()
  if (!trimmedValue) return null

  const parsedDate = new Date(trimmedValue)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

const formatMonthYear = (value: Date | null) => {
  if (!value) return null

  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(value)
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

const buildDbFullName = (payload: AuthMeResponse["user"] | undefined) => {
  if (!payload) return undefined

  const fullName = [payload.firstName, payload.middleName, payload.lastName]
    .map((part) => asNonEmptyString(part))
    .filter(Boolean)
    .join(" ")
    .trim()

  return fullName || undefined
}

const profileDetails = computed(() => {
  const authUser = user.value
  const authUserRecord = asRecord(authUser)
  const metadataSources = [
    asRecord(authUserRecord?.user_metadata),
    asRecord(authUserRecord?.app_metadata),
    ...getIdentityMetadata(authUser),
  ]

  const fullName =
    buildDbFullName(authData.value?.user) ||
    metadataSources.map(buildNameFromSource).find(Boolean) ||
    asNonEmptyString(authUserRecord?.email) ||
    "User"
  const avatarUrl =
    asNonEmptyString(authData.value?.user.avatarUrl) ||
    metadataSources.map(getAvatarFromSource).find(Boolean) ||
    null
  const email = asNonEmptyString(authUserRecord?.email) || "No email available"
  const location =
    asNonEmptyString(authData.value?.user.location) ||
    metadataSources
      .map(
        (source) =>
          asNonEmptyString(source?.location) ||
          asNonEmptyString(source?.address) ||
          asNonEmptyString(source?.city),
      )
      .find(Boolean) ||
    "Location not set"
  const username =
    asNonEmptyString(authData.value?.user.username) ||
    asNonEmptyString(authData.value?.user.name) ||
    ""
  const pronouns = asNonEmptyString(authData.value?.user.pronouns) || ""
  const bio = asNonEmptyString(authData.value?.user.bio) || ""
  const memberSince = formatMonthYear(parseDate(authData.value?.user.createdAt))

  const isVerified =
    Boolean(authUserRecord?.email_confirmed_at) ||
    Boolean(authUserRecord?.confirmed_at) ||
    email.endsWith("@up.edu.ph")

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

const emailNotificationsEnabled = ref(true)
const showEditProfileModal = ref(false)
const showDeactivateAccountModal = ref(false)
const isSavingProfile = ref(false)
const isLoadingDeactivationEligibility = ref(false)
const isDeactivatingAccount = ref(false)
const profileSaveError = ref("")
const deactivateAccountError = ref("")
const deactivationEligibility = ref<DeactivationEligibilityResponse | null>(null)
const avatarUploadError = ref("")
const usernameStatus = ref<UsernameStatus>("idle")
const checkedUsername = ref("")
const initialUsername = ref("")
const avatarInputRef = ref<HTMLInputElement | null>(null)
const pendingAvatarFile = ref<File | null>(null)
const pendingAvatarPreviewUrl = ref<string | null>(null)

const profileForm = reactive({
  name: "",
  username: "",
  location: "",
  pronouns: "",
  bio: "",
  avatarUrl: null as string | null,
})

let usernameCheckTimeout: ReturnType<typeof setTimeout> | null = null

const normalizedUsername = computed(() => profileForm.username.trim().toLowerCase())

const usernameHelperText = computed(() => {
  switch (usernameStatus.value) {
    case "checking":
      return "Checking username availability..."
    case "available":
      return normalizedUsername.value === initialUsername.value
        ? "This is your current username."
        : "Username is available."
    case "taken":
      return "That username is already taken."
    case "invalid":
      return "Use 3-30 lowercase letters, numbers, periods, or underscores."
    default:
      return "Usernames must be 3-30 characters and can include lowercase letters, numbers, periods, and underscores."
  }
})

const currentAvatarPreview = computed(() => pendingAvatarPreviewUrl.value || profileForm.avatarUrl)

const canSaveProfile = computed(() => {
  return (
    !isSavingProfile.value &&
    profileForm.name.trim().length > 0 &&
    normalizedUsername.value.length > 0 &&
    usernameStatus.value !== "checking" &&
    usernameStatus.value !== "taken" &&
    usernameStatus.value !== "invalid"
  )
})

const canDeactivateAccount = computed(
  () =>
    !isLoadingDeactivationEligibility.value &&
    !isDeactivatingAccount.value &&
    Boolean(deactivationEligibility.value?.allowed),
)

const getDeactivationErrorDetails = (error: unknown) => {
  const errorRecord = asRecord(error)
  const responseData = asRecord(errorRecord?.data)
  const nestedData = asRecord(responseData?.data)
  const blockers = nestedData?.blockers
  const eligibility =
    typeof nestedData?.allowed === "boolean" && Array.isArray(blockers)
      ? (nestedData as DeactivationEligibilityResponse)
      : null

  return {
    eligibility,
    message:
      asNonEmptyString(responseData?.statusMessage) ||
      asNonEmptyString(responseData?.message) ||
      asNonEmptyString(errorRecord?.statusMessage) ||
      asNonEmptyString(errorRecord?.message) ||
      "Unable to check account deactivation right now.",
  }
}

const revokePendingAvatarPreview = () => {
  if (!pendingAvatarPreviewUrl.value) return
  URL.revokeObjectURL(pendingAvatarPreviewUrl.value)
  pendingAvatarPreviewUrl.value = null
}

const syncProfileForm = () => {
  profileForm.name = profileDetails.value.fullName
  profileForm.username = profileDetails.value.username
  profileForm.location =
    profileDetails.value.location === "Location not set" ? "" : profileDetails.value.location
  profileForm.pronouns = profileDetails.value.pronouns
  profileForm.bio = profileDetails.value.bio
  profileForm.avatarUrl = profileDetails.value.avatarUrl
  initialUsername.value = profileDetails.value.username
  checkedUsername.value = profileDetails.value.username
  usernameStatus.value = profileDetails.value.username ? "available" : "idle"
  profileSaveError.value = ""
  avatarUploadError.value = ""
  pendingAvatarFile.value = null
  revokePendingAvatarPreview()
}

const openEditProfileModal = () => {
  syncProfileForm()
  showEditProfileModal.value = true
}

const closeEditProfileModal = () => {
  showEditProfileModal.value = false
  profileSaveError.value = ""
  avatarUploadError.value = ""
  pendingAvatarFile.value = null
  revokePendingAvatarPreview()
}

const openDeactivateAccountModal = async () => {
  showDeactivateAccountModal.value = true
  isLoadingDeactivationEligibility.value = true
  deactivateAccountError.value = ""
  deactivationEligibility.value = null

  try {
    deactivationEligibility.value = await $fetch<DeactivationEligibilityResponse>(
      "/api/account/deactivation-eligibility",
    )
  } catch (error) {
    const details = getDeactivationErrorDetails(error)
    deactivationEligibility.value = details.eligibility
    deactivateAccountError.value = details.message
  } finally {
    isLoadingDeactivationEligibility.value = false
  }
}

const closeDeactivateAccountModal = () => {
  if (isDeactivatingAccount.value) return
  showDeactivateAccountModal.value = false
  deactivateAccountError.value = ""
  deactivationEligibility.value = null
}

const deactivateAccount = async () => {
  if (!canDeactivateAccount.value) return

  isDeactivatingAccount.value = true
  deactivateAccountError.value = ""

  try {
    await $fetch("/api/account/deactivate", { method: "POST" })
    await Promise.allSettled([
      supabase.auth.signOut(),
      $fetch("/api/auth/logout", { method: "POST" }),
    ])
    await navigateTo("/")
  } catch (error) {
    const details = getDeactivationErrorDetails(error)
    deactivationEligibility.value = details.eligibility ?? deactivationEligibility.value
    deactivateAccountError.value = details.message
  } finally {
    isDeactivatingAccount.value = false
  }
}

const triggerAvatarUpload = () => {
  avatarInputRef.value?.click()
}

const handleAvatarSelect = (event: Event) => {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0] ?? null
  if (input) input.value = ""
  if (!file) return

  if (!file.type.startsWith("image/")) {
    avatarUploadError.value = "Only image files can be used for your profile photo."
    return
  }

  avatarUploadError.value = ""
  pendingAvatarFile.value = file
  revokePendingAvatarPreview()
  pendingAvatarPreviewUrl.value = URL.createObjectURL(file)
}

const uploadAvatarFile = async (file: File) => {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const accessToken = session?.access_token
  if (!accessToken) {
    throw new Error("You must be signed in to upload a profile photo.")
  }

  const signedUpload = await $fetch<{ token: string; path: string; publicUrl: string }>(
    "/api/account/avatar-upload-url",
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
    .from(avatarBucket)
    .uploadToSignedUrl(signedUpload.path, signedUpload.token, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    })

  if (uploadError) {
    throw new Error(uploadError.message || "Unable to upload your profile photo.")
  }

  return signedUpload.publicUrl
}

const checkUsernameAvailability = async (username: string) => {
  checkedUsername.value = username
  usernameStatus.value = "checking"

  try {
    const response = await $fetch<UsernameAvailabilityResponse>(
      "/api/account/username-availability",
      {
        query: { username },
      },
    )

    if (checkedUsername.value !== username) return
    usernameStatus.value = response.available ? "available" : "taken"
  } catch {
    if (checkedUsername.value !== username) return
    usernameStatus.value = "invalid"
  }
}

watch(
  normalizedUsername,
  (value) => {
    if (!showEditProfileModal.value) return

    if (usernameCheckTimeout) clearTimeout(usernameCheckTimeout)

    if (!value) {
      usernameStatus.value = "idle"
      checkedUsername.value = ""
      return
    }

    if (!usernameRegex.test(value)) {
      usernameStatus.value = "invalid"
      checkedUsername.value = value
      return
    }

    if (value === initialUsername.value) {
      usernameStatus.value = "available"
      checkedUsername.value = value
      return
    }

    usernameCheckTimeout = setTimeout(() => {
      void checkUsernameAvailability(value)
    }, 350)
  },
  { immediate: false },
)

onBeforeUnmount(() => {
  if (usernameCheckTimeout) clearTimeout(usernameCheckTimeout)
  revokePendingAvatarPreview()
})

const saveProfile = async () => {
  if (!canSaveProfile.value) return

  isSavingProfile.value = true
  profileSaveError.value = ""
  avatarUploadError.value = ""

  try {
    let avatarUrl = profileForm.avatarUrl

    if (pendingAvatarFile.value) {
      avatarUrl = await uploadAvatarFile(pendingAvatarFile.value)
    }

    await $fetch<ProfileUpdateResponse>("/api/account/profile", {
      method: "PATCH",
      body: {
        name: profileForm.name.trim(),
        username: normalizedUsername.value,
        location: profileForm.location.trim(),
        pronouns: profileForm.pronouns.trim(),
        bio: profileForm.bio.trim(),
        avatarUrl,
      },
    })

    await refreshAuthData()
    closeEditProfileModal()
  } catch (error) {
    profileSaveError.value =
      error instanceof Error ? error.message : "Unable to save your profile right now."
  } finally {
    isSavingProfile.value = false
  }
}
</script>

<template>
  <div class="space-y-8 pb-10 font-geist lg:px-24 xl:px-32">
    <section v-if="isInitialPageLoading" class="space-y-6 animate-pulse">
      <div class="space-y-2">
        <div class="h-8 w-64 rounded-lg bg-cinnamon-ice/70" />
        <div class="h-5 w-96 max-w-full rounded-lg bg-cinnamon-ice/60" />
      </div>

      <div class="rounded-[20px] border border-cinnamon-ice bg-cream px-6 py-6 sm:px-8">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-2">
            <div class="h-7 w-40 rounded-lg bg-cinnamon-ice/70" />
            <div class="h-4 w-56 rounded-lg bg-cinnamon-ice/60" />
          </div>
          <div class="h-11 w-[137px] rounded-[10px] bg-cinnamon-ice/70" />
        </div>

        <div class="mt-8 flex items-start gap-5">
          <div class="h-16 w-16 rounded-full bg-cinnamon-ice/70" />
          <div class="flex-1 space-y-3">
            <div class="h-6 w-52 rounded-lg bg-cinnamon-ice/70" />
            <div class="h-4 w-64 rounded-lg bg-cinnamon-ice/60" />
            <div class="h-4 w-72 rounded-lg bg-cinnamon-ice/60" />
          </div>
        </div>
      </div>

      <div class="rounded-[20px] border border-cinnamon-ice bg-cream px-6 py-6 sm:px-8">
        <div class="space-y-2">
          <div class="h-7 w-44 rounded-lg bg-cinnamon-ice/70" />
          <div class="h-4 w-64 rounded-lg bg-cinnamon-ice/60" />
        </div>
        <div class="mt-6 h-10 w-24 rounded-full bg-cinnamon-ice/70" />
      </div>
    </section>

    <template v-else>
      <section class="space-y-1">
        <h1 class="text-[25px] font-bold text-noble-black">Account Information</h1>
        <p class="text-[18px] font-normal tracking-[0.54px] text-noble-black">
          Manage your personal details and account settings.
        </p>
      </section>

      <section
        class="min-h-[247px] rounded-[20px] border border-cinnamon-ice bg-cream px-5 py-5 shadow-[0_8px_24px_rgba(32,33,36,0.04)] sm:px-[29px] sm:py-[23px]"
      >
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 class="text-[22px] font-semibold text-noble-black">Profile</h2>
            <p class="mt-[2px] text-[15px] font-normal tracking-[0.45px] text-noble-black/80">
              Your personal information and profile picture
            </p>
          </div>

          <button
            type="button"
            class="inline-flex h-11 w-[137px] items-center justify-center self-start rounded-[10px] bg-burning-orange px-4 text-[15px] font-normal tracking-[0.45px] text-white transition hover:brightness-95"
            @click="openEditProfileModal"
          >
            Edit Profile
          </button>
        </div>

        <div class="mt-8 flex min-w-0 items-start gap-4 sm:mt-[34px] sm:gap-[26px]">
          <div
            class="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-burning-orange text-[35px] font-normal tracking-[1.05px] text-white"
          >
            <img
              v-if="profileDetails.avatarUrl"
              :src="profileDetails.avatarUrl"
              :alt="profileDetails.fullName"
              class="h-full w-full object-cover"
            />
            <span v-else class="-translate-y-px">{{ profileInitial }}</span>
          </div>

          <div class="min-w-0 flex-1 pt-1">
            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-[10px]">
                  <h3 class="truncate text-[20px] font-semibold text-noble-black">
                    {{ profileDetails.fullName }}
                  </h3>
                  <span
                    v-if="profileDetails.isVerified"
                    class="inline-flex h-[21px] items-center rounded-[10px] bg-blue-estate px-[13px] text-[15px] font-normal leading-none text-white"
                  >
                    Verified
                  </span>
                </div>
              </div>
            </div>

            <div
              class="mt-[18px] flex flex-col gap-3 text-[15px] font-normal tracking-[0.45px] text-noble-black/80 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-10 lg:gap-y-3"
            >
              <div class="flex min-w-0 items-center gap-2">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  class="shrink-0"
                >
                  <path
                    d="M4 8L10.86 12.8C11.56 13.29 12.44 13.29 13.14 12.8L20 8M5 19H19C20.1 19 21 18.1 21 17V7C21 5.9 20.1 5 19 5H5C3.9 5 3 5.9 3 7V17C3 18.1 3.9 19 5 19Z"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <span class="truncate">{{ profileDetails.email }}</span>
              </div>

              <div class="flex min-w-0 items-center gap-2">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  class="shrink-0"
                >
                  <path
                    d="M12 13.5C13.66 13.5 15 12.16 15 10.5C15 8.84 13.66 7.5 12 7.5C10.34 7.5 9 8.84 9 10.5C9 12.16 10.34 13.5 12 13.5Z"
                    stroke="currentColor"
                    stroke-width="1.5"
                  />
                  <path
                    d="M19.5 10.5C19.5 16.5 12 21 12 21C12 21 4.5 16.5 4.5 10.5C4.5 6.36 7.86 3 12 3C16.14 3 19.5 6.36 19.5 10.5Z"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <span class="truncate">{{ profileDetails.location }}</span>
              </div>

              <div class="flex min-w-0 items-center gap-2">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  class="shrink-0"
                >
                  <path
                    d="M7 2V5M17 2V5M3.5 9H20.5M5 4H19C20.1 4 21 4.9 21 6V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V6C3 4.9 3.9 4 5 4Z"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <span>Member since {{ profileDetails.memberSince ?? "N/A" }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        class="rounded-[20px] border border-cinnamon-ice bg-cream px-5 py-5 shadow-[0_8px_24px_rgba(32,33,36,0.04)] sm:px-7 sm:py-6"
      >
        <div class="space-y-1">
          <h2 class="text-[22px] font-semibold text-noble-black">Notifications</h2>
          <p class="text-[15px] font-normal tracking-[0.45px] text-noble-black/80">
            Manage how you receive notifications
          </p>
        </div>

        <div class="mt-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-[20px] font-medium text-noble-black/90">Email Notifications</h3>
            <p class="mt-1 text-[15px] font-normal tracking-[0.45px] text-noble-black/80">
              Receive updates about your transactions
            </p>
          </div>

          <div class="flex h-11 w-[137px] shrink-0 items-center justify-center self-center">
            <button
              type="button"
              role="switch"
              :aria-checked="emailNotificationsEnabled"
              class="relative inline-flex h-8 w-16 items-center rounded-full transition-colors duration-200"
              :class="emailNotificationsEnabled ? 'bg-burning-orange' : 'bg-cinnamon-ice'"
              @click="emailNotificationsEnabled = !emailNotificationsEnabled"
            >
              <span class="sr-only">Toggle email notifications</span>
              <span
                class="absolute left-2 text-[10px] font-medium tracking-[0.3px] text-white transition-opacity duration-200"
                :class="emailNotificationsEnabled ? 'opacity-100' : 'opacity-0'"
              >
                ON
              </span>
              <span
                class="absolute right-2 text-[10px] font-medium tracking-[0.3px] text-noble-black transition-opacity duration-200"
                :class="emailNotificationsEnabled ? 'opacity-0' : 'opacity-100'"
              >
                OFF
              </span>
              <span
                class="ml-1 inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200"
                :class="emailNotificationsEnabled ? 'translate-x-[28px]' : 'translate-x-0'"
              />
            </button>
          </div>
        </div>
      </section>

      <section
        class="rounded-[20px] border border-cinnamon-ice bg-cream px-5 py-5 shadow-[0_8px_24px_rgba(32,33,36,0.04)] sm:px-7 sm:py-6"
      >
        <div class="flex items-center gap-3">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class="text-cinnabar-red"
          >
            <path
              d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18C1.65 18.29 1.56 18.62 1.56 18.96C1.56 20.08 2.48 21 3.6 21H20.4C21.52 21 22.44 20.08 22.44 18.96C22.44 18.62 22.35 18.29 22.18 18L13.71 3.86C13.35 3.27 12.7 2.91 12 2.91C11.3 2.91 10.65 3.27 10.29 3.86Z"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <div>
            <h2 class="text-[22px] font-semibold text-cinnabar-red">Danger Zone</h2>
            <p class="mt-1 text-[15px] font-normal tracking-[0.45px] text-noble-black/80">
              Irreversible actions for your account
            </p>
          </div>
        </div>

        <div class="mt-8 space-y-5">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 class="text-[20px] font-medium text-noble-black/90">Deactivate Account</h3>
              <p class="mt-1 text-[15px] font-normal tracking-[0.45px] text-noble-black/80">
                Temporarily disable your account
              </p>
            </div>

            <button
              type="button"
              class="h-11 w-[137px] rounded-[10px] bg-cinnabar-red px-4 text-[15px] font-normal tracking-[0.45px] text-white transition hover:brightness-95"
              @click="openDeactivateAccountModal"
            >
              Deactivate
            </button>
          </div>

          <div class="border-t border-cinnamon-ice" />

          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 class="text-[20px] font-medium text-noble-black/90">Delete Account</h3>
              <p class="mt-1 text-[15px] font-normal tracking-[0.45px] text-noble-black/80">
                Permanently delete your account and all data
              </p>
            </div>

            <button
              type="button"
              class="h-11 w-[137px] rounded-[10px] bg-cinnabar-red px-4 text-[15px] font-normal tracking-[0.45px] text-white transition hover:brightness-95"
            >
              Delete
            </button>
          </div>
        </div>
      </section>

      <Teleport to="body">
        <div
          v-if="showEditProfileModal"
          class="fixed inset-0 z-[1200] flex items-center justify-center p-4 font-geist"
        >
          <div
            class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm"
            @click="closeEditProfileModal"
          />
          <div
            class="relative z-10 w-full max-w-2xl rounded-[28px] border border-cinnamon-ice bg-white p-6 shadow-2xl sm:p-8"
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <h2 class="text-[26px] font-semibold text-noble-black">Edit Profile</h2>
                <p class="mt-1 text-[15px] tracking-[0.45px] text-noble-black/70">
                  Update your public account details.
                </p>
              </div>
              <button
                type="button"
                class="flex h-10 w-10 items-center justify-center rounded-full bg-cream text-noble-black transition hover:bg-pale-cashmere"
                @click="closeEditProfileModal"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>

            <div class="mt-8 flex flex-col items-center gap-4">
              <div
                class="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-burning-orange text-[42px] text-white"
              >
                <img
                  v-if="currentAvatarPreview"
                  :src="currentAvatarPreview"
                  :alt="profileForm.name || profileDetails.fullName"
                  class="h-full w-full object-cover"
                />
                <span v-else>{{ profileInitial }}</span>
              </div>

              <input
                ref="avatarInputRef"
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleAvatarSelect"
              />

              <button
                type="button"
                class="inline-flex h-10 items-center justify-center rounded-[10px] bg-blue-estate px-5 text-[14px] text-white transition hover:brightness-110"
                @click="triggerAvatarUpload"
              >
                Change Profile Photo
              </button>

              <p v-if="avatarUploadError" class="text-center text-sm text-cinnabar-red">
                {{ avatarUploadError }}
              </p>
            </div>

            <div class="mt-8 space-y-5">
              <label class="block space-y-2">
                <span class="text-[15px] font-medium text-noble-black">Name</span>
                <input
                  v-model="profileForm.name"
                  type="text"
                  class="w-full rounded-[14px] border border-cinnamon-ice bg-cream px-4 py-3 text-[15px] text-noble-black outline-none transition focus:border-burning-orange"
                  placeholder="Juan Dela Cruz"
                />
              </label>

              <label class="block space-y-2">
                <span class="text-[15px] font-medium text-noble-black">Username</span>
                <div
                  class="flex items-center rounded-[14px] border border-cinnamon-ice bg-cream px-4 py-3 transition focus-within:border-burning-orange"
                >
                  <span class="mr-2 text-[15px] text-noble-black/60">@</span>
                  <input
                    v-model="profileForm.username"
                    type="text"
                    autocapitalize="off"
                    autocomplete="off"
                    spellcheck="false"
                    class="w-full bg-transparent text-[15px] text-noble-black outline-none"
                    placeholder="juandelacruz"
                  />
                </div>
                <p
                  class="text-[13px]"
                  :class="
                    usernameStatus === 'taken' || usernameStatus === 'invalid'
                      ? 'text-cinnabar-red'
                      : usernameStatus === 'available'
                        ? 'text-success-green'
                        : 'text-noble-black/65'
                  "
                >
                  {{ usernameHelperText }}
                </p>
              </label>

              <label class="block space-y-2">
                <span class="text-[15px] font-medium text-noble-black">Location</span>
                <input
                  v-model="profileForm.location"
                  type="text"
                  class="w-full rounded-[14px] border border-cinnamon-ice bg-cream px-4 py-3 text-[15px] text-noble-black outline-none transition focus:border-burning-orange"
                  placeholder="Buhisan, Cebu City"
                />
              </label>

              <label class="block space-y-2">
                <span class="text-[15px] font-medium text-noble-black">Pronouns</span>
                <input
                  v-model="profileForm.pronouns"
                  type="text"
                  class="w-full rounded-[14px] border border-cinnamon-ice bg-cream px-4 py-3 text-[15px] text-noble-black outline-none transition focus:border-burning-orange"
                  placeholder="she/her, he/him, they/them"
                />
              </label>

              <label class="block space-y-2">
                <span class="text-[15px] font-medium text-noble-black">Bio</span>
                <textarea
                  v-model="profileForm.bio"
                  rows="4"
                  maxlength="200"
                  class="w-full resize-none rounded-[14px] border border-cinnamon-ice bg-cream px-4 py-3 text-[15px] text-noble-black outline-none transition focus:border-burning-orange"
                  placeholder="Tell other users a little bit about yourself."
                />
                <p class="text-right text-[12px] text-noble-black/50">
                  {{ profileForm.bio.length }}/200
                </p>
              </label>
            </div>

            <p v-if="profileSaveError" class="mt-5 text-sm text-cinnabar-red">
              {{ profileSaveError }}
            </p>

            <div class="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                class="inline-flex h-11 items-center justify-center rounded-[10px] border border-cinnamon-ice px-6 text-[15px] text-noble-black transition hover:bg-cream"
                @click="closeEditProfileModal"
              >
                Cancel
              </button>
              <button
                type="button"
                class="inline-flex h-11 items-center justify-center rounded-[10px] bg-burning-orange px-6 text-[15px] text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!canSaveProfile"
                @click="saveProfile"
              >
                {{ isSavingProfile ? "Saving..." : "Save Changes" }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <Teleport to="body">
        <div
          v-if="showDeactivateAccountModal"
          class="fixed inset-0 z-[1200] flex items-center justify-center p-4 font-geist"
        >
          <div
            class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm"
            @click="closeDeactivateAccountModal"
          />
          <div
            class="relative z-10 w-full max-w-xl rounded-[28px] border border-cinnamon-ice bg-white p-6 shadow-2xl sm:p-8"
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-[13px] font-semibold uppercase tracking-[0.2em] text-cinnabar-red">
                  Danger Zone
                </p>
                <h2 class="mt-2 text-[26px] font-semibold text-noble-black">Deactivate account?</h2>
                <p class="mt-2 text-[15px] leading-6 tracking-[0.45px] text-noble-black/70">
                  Your public profile and listings will be hidden. Your history stays saved, and you
                  can reactivate later by signing in again.
                </p>
              </div>
              <button
                type="button"
                class="flex h-10 w-10 items-center justify-center rounded-full bg-cream text-noble-black transition hover:bg-pale-cashmere disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="isDeactivatingAccount"
                @click="closeDeactivateAccountModal"
              >
                <span class="sr-only">Close deactivation dialog</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>

            <div class="mt-7 rounded-[18px] border border-cinnamon-ice bg-cream p-5">
              <p
                v-if="isLoadingDeactivationEligibility"
                class="text-[15px] tracking-[0.45px] text-noble-black/70"
              >
                Checking active rentals, future bookings, and open disputes...
              </p>

              <template v-else-if="deactivationEligibility?.blockers.length">
                <h3 class="text-[17px] font-semibold text-noble-black">Deactivation is blocked</h3>
                <p class="mt-2 text-[14px] leading-6 tracking-[0.42px] text-noble-black/70">
                  Resolve these items first so other users are not left with active obligations.
                </p>
                <ul class="mt-4 space-y-3">
                  <li
                    v-for="blocker in deactivationEligibility.blockers"
                    :key="blocker.code"
                    class="rounded-[14px] border border-cinnabar-red/20 bg-white px-4 py-3 text-[14px] leading-5 text-noble-black/80"
                  >
                    {{ blocker.message }}
                  </li>
                </ul>
              </template>

              <template v-else-if="deactivationEligibility?.allowed">
                <h3 class="text-[17px] font-semibold text-noble-black">Ready to deactivate</h3>
                <p class="mt-2 text-[14px] leading-6 tracking-[0.42px] text-noble-black/70">
                  No active rentals, future confirmed bookings, or open disputes were found.
                </p>
              </template>

              <p v-else class="text-[15px] tracking-[0.45px] text-noble-black/70">
                We could not confirm your eligibility yet. Try again before deactivating.
              </p>
            </div>

            <p v-if="deactivateAccountError" class="mt-5 text-sm text-cinnabar-red">
              {{ deactivateAccountError }}
            </p>

            <div class="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                class="inline-flex h-11 items-center justify-center rounded-[10px] border border-cinnamon-ice px-6 text-[15px] text-noble-black transition hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="isDeactivatingAccount"
                @click="closeDeactivateAccountModal"
              >
                Keep Account Active
              </button>
              <button
                type="button"
                class="inline-flex h-11 items-center justify-center rounded-[10px] bg-cinnabar-red px-6 text-[15px] text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!canDeactivateAccount"
                @click="deactivateAccount"
              >
                {{ isDeactivatingAccount ? "Deactivating..." : "Deactivate Account" }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </template>
  </div>
</template>
