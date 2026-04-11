<script setup lang="ts">
definePageMeta({
  layout: "account",
  middleware: "account-auth",
})

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

const profileDetails = computed(() => {
  const authUser = user.value
  const authUserRecord = asRecord(authUser)
  const metadataSources = [
    asRecord(authUserRecord?.user_metadata),
    asRecord(authUserRecord?.app_metadata),
    ...getIdentityMetadata(authUser),
  ]

  const fullName =
    metadataSources.map(buildNameFromSource).find(Boolean) ||
    asNonEmptyString(authUserRecord?.email) ||
    "User"
  const avatarUrl = metadataSources.map(getAvatarFromSource).find(Boolean) || null
  const email = asNonEmptyString(authUserRecord?.email) || "No email available"
  const location =
    metadataSources
      .map((source) =>
        asNonEmptyString(source?.location) ||
        asNonEmptyString(source?.address) ||
        asNonEmptyString(source?.city),
      )
      .find(Boolean) || "Location not set"

  const possibleJoinDates = [
    parseDate(authUserRecord?.created_at),
    parseDate(authUserRecord?.createdAt),
    parseDate(authUserRecord?.confirmed_at),
    parseDate(authUserRecord?.email_confirmed_at),
    ...metadataSources.flatMap((source) => [
      parseDate(source?.created_at),
      parseDate(source?.createdAt),
      parseDate(source?.joined_at),
      parseDate(source?.joinedAt),
    ]),
  ]

  const memberSince = formatMonthYear(possibleJoinDates.find(Boolean) ?? null)

  const isVerified =
    Boolean(authUserRecord?.email_confirmed_at) ||
    Boolean(authUserRecord?.confirmed_at) ||
    email.endsWith("@up.edu.ph")

  return {
    fullName,
    avatarUrl,
    email,
    location,
    memberSince,
    isVerified,
  }
})

const profileInitial = computed(() => {
  const trimmedName = profileDetails.value.fullName.trim()
  return trimmedName ? trimmedName.charAt(0).toUpperCase() : "U"
})

const emailNotificationsEnabled = ref(true)
</script>

<template>
  <div class="space-y-8 pb-10 font-geist lg:px-24 xl:px-32">
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
        >
          Edit Profile
        </button>
      </div>

      <div class="mt-8 flex min-w-0 items-start gap-4 sm:mt-[34px] sm:gap-[26px]">
        <div
          class="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-burning-orange text-[35px] font-normal tracking-[1.05px] text-white"
        >
          <span class="-translate-y-px">{{ profileInitial }}</span>
          <div
            class="absolute bottom-0 right-0 flex h-[25px] w-[25px] translate-x-[3px] translate-y-[3px] items-center justify-center rounded-full bg-blue-estate text-white shadow-sm"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 7L9.2 5.4C9.58 4.89 9.77 4.64 10.02 4.49C10.27 4.33 10.58 4.29 11.21 4.2C11.62 4.14 12.04 4.14 12.45 4.2C13.08 4.29 13.39 4.33 13.64 4.49C13.89 4.64 14.08 4.89 14.46 5.4L15.66 7H16.5C18.39 7 19.33 7 19.91 7.59C20.5 8.17 20.5 9.11 20.5 11V14C20.5 15.89 20.5 16.83 19.91 17.41C19.33 18 18.39 18 16.5 18H7.5C5.61 18 4.67 18 4.09 17.41C3.5 16.83 3.5 15.89 3.5 14V11C3.5 9.11 3.5 8.17 4.09 7.59C4.67 7 5.61 7 7.5 7H8Z"
                stroke="currentColor"
                stroke-width="1.5"
              />
              <circle cx="12" cy="12.5" r="3" stroke="currentColor" stroke-width="1.5" />
            </svg>
          </div>
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
                  d="M4 8L10.86 12.8C11.56 13.29 12.44 13.29 13.14 12.8L20 8M5 19H19C20.1 19 21 18.1 21 17V7C21 5.9 20.1 5 19 5H5C3.9 5 3 5.9 3 7V17C3 18.1 3.9 19 5 19Z"
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
  </div>
</template>
