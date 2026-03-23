<template>
  <div class="flex h-screen flex-col overflow-hidden bg-white font-geist">
    <Header />

    <main class="custom-main-scrollbar flex-1 overflow-y-auto bg-white">
      <div class="container mx-auto max-w-[1440px] px-4 py-8 pt-10">
        <div class="flex flex-col gap-10 lg:flex-row">
          <aside class="hidden w-[240px] shrink-0 lg:block xl:w-[280px]">
            <div class="sticky top-6 space-y-4">
              <section class="rounded-[24px] border border-cinnamon-ice/30 bg-cream p-6">
                <p
                  class="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-estate/70"
                >
                  Request Board
                </p>
                <h2 class="mt-3 text-[22px] font-bold leading-tight text-noble-black">
                  Browse active community requests
                </h2>
                <p class="mt-3 text-[14px] leading-relaxed text-noble-black/60">
                  Borrowers can post what they need here, and lenders can browse active requests in
                  one shared board ordered by recency.
                </p>
              </section>

              <section class="rounded-[24px] border border-cinnamon-ice/30 bg-white p-6">
                <p
                  class="text-[11px] font-semibold uppercase tracking-[0.14em] text-noble-black/40"
                >
                  Feed Rules
                </p>
                <ul class="mt-3 space-y-3 text-[14px] leading-relaxed text-noble-black/65">
                  <li>Newest requests appear first.</li>
                  <li>Only active requests are shown.</li>
                  <li>Each card shows dates, budget, and request details.</li>
                </ul>
              </section>
            </div>
          </aside>

          <section class="flex min-w-0 flex-1 flex-col gap-8">
            <div class="flex flex-col gap-1">
              <h1 class="font-rewon text-[42px] leading-tight text-noble-black">Requests</h1>
              <p class="text-[18px] font-normal text-noble-black/60">
                Community item requests, ordered by recency
              </p>
            </div>

            <section class="rounded-[24px] border border-cinnamon-ice/30 bg-cream p-6">
              <div class="flex flex-col gap-6">
                <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p
                      class="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-estate/70"
                    >
                      Post a request
                    </p>
                    <h2 class="mt-2 text-[22px] font-bold text-noble-black">
                      Ask the community for an item
                    </h2>
                    <p class="mt-2 max-w-[560px] text-[14px] leading-relaxed text-noble-black/60">
                      Post what you need, when you need it, and the target budget. Public visitors
                      cannot see your borrower name, and no personal details are exposed on the card.
                    </p>
                  </div>

                  <span
                    class="rounded-full border border-cinnamon-ice/30 bg-white px-4 py-2 text-[12px] font-semibold text-noble-black/60"
                  >
                    Borrowers only
                  </span>
                </div>

                <div v-if="!isSignedIn" class="rounded-[20px] border border-cinnamon-ice/30 bg-white px-5 py-4">
                  <p class="text-[15px] font-semibold text-noble-black">Sign in to post a request</p>
                  <p class="mt-2 text-[14px] leading-relaxed text-noble-black/60">
                    Browsing stays public, but posting requires a signed-in borrower account.
                  </p>
                  <button
                    type="button"
                    class="mt-4 rounded-full bg-burning-orange px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[#ff6a1f]"
                    @click="navigateTo('/')"
                  >
                    Sign in
                  </button>
                </div>

                <div
                  v-else-if="isViewerLoading"
                  class="rounded-[20px] border border-cinnamon-ice/30 bg-white px-5 py-4"
                >
                  <p class="text-[15px] font-semibold text-noble-black">Checking borrower access</p>
                  <p class="mt-2 text-[14px] leading-relaxed text-noble-black/60">
                    One moment while we confirm whether this account can post requests.
                  </p>
                </div>

                <div
                  v-else-if="!isBorrowerAccount"
                  class="rounded-[20px] border border-cinnamon-ice/30 bg-white px-5 py-4"
                >
                  <p class="text-[15px] font-semibold text-noble-black">
                    Only borrower accounts can post requests
                  </p>
                  <p class="mt-2 text-[14px] leading-relaxed text-noble-black/60">
                    You can still browse active requests here, but posting is limited to borrower
                    accounts.
                  </p>
                </div>

                <form v-else class="grid gap-4" @submit.prevent="handleCreateRequest">
                  <p class="text-[12px] font-medium text-noble-black/55">
                    <span class="font-bold text-cinnabar-red" aria-hidden="true">*</span> Required
                    fields
                  </p>

                  <div
                    v-if="submitErrorMessage"
                    class="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700"
                  >
                    {{ submitErrorMessage }}
                  </div>

                  <div class="grid gap-4 md:grid-cols-2">
                    <label class="flex flex-col gap-2">
                      <span class="text-[13px] font-semibold text-noble-black">
                        Item name
                        <span class="ml-1 text-cinnabar-red" aria-hidden="true">*</span>
                      </span>
                      <input
                        v-model="form.itemNeeded"
                        type="text"
                        maxlength="120"
                        required
                        aria-required="true"
                        :aria-invalid="fieldErrors.itemNeeded ? 'true' : 'false'"
                        class="rounded-[18px] border border-cinnamon-ice/40 bg-white px-4 py-3 text-[14px] text-noble-black outline-none transition focus:border-burning-orange"
                        placeholder="Portable projector"
                      />
                      <span v-if="fieldErrors.itemNeeded" class="text-[12px] text-cinnabar-red">
                        {{ fieldErrors.itemNeeded }}
                      </span>
                    </label>

                    <div class="grid gap-4 sm:grid-cols-2">
                      <label class="flex flex-col gap-2">
                        <span class="text-[13px] font-semibold text-noble-black">
                          Start date
                          <span class="ml-1 text-cinnabar-red" aria-hidden="true">*</span>
                        </span>
                        <input
                          v-model="form.requestedFrom"
                          type="date"
                          required
                          aria-required="true"
                          :aria-invalid="fieldErrors.requestedFrom ? 'true' : 'false'"
                          class="rounded-[18px] border border-cinnamon-ice/40 bg-white px-4 py-3 text-[14px] text-noble-black outline-none transition focus:border-burning-orange"
                        />
                        <span
                          v-if="fieldErrors.requestedFrom"
                          class="text-[12px] text-cinnabar-red"
                        >
                          {{ fieldErrors.requestedFrom }}
                        </span>
                      </label>

                      <label class="flex flex-col gap-2">
                        <span class="text-[13px] font-semibold text-noble-black">
                          End date
                          <span class="ml-1 text-cinnabar-red" aria-hidden="true">*</span>
                        </span>
                        <input
                          v-model="form.requestedTo"
                          type="date"
                          required
                          aria-required="true"
                          :aria-invalid="fieldErrors.requestedTo ? 'true' : 'false'"
                          class="rounded-[18px] border border-cinnamon-ice/40 bg-white px-4 py-3 text-[14px] text-noble-black outline-none transition focus:border-burning-orange"
                        />
                        <span v-if="fieldErrors.requestedTo" class="text-[12px] text-cinnabar-red">
                          {{ fieldErrors.requestedTo }}
                        </span>
                      </label>
                    </div>
                  </div>

                  <div class="grid gap-4 md:grid-cols-2">
                    <label class="flex flex-col gap-2">
                      <span class="text-[13px] font-semibold text-noble-black">
                        Minimum target price
                        <span class="ml-1 text-cinnabar-red" aria-hidden="true">*</span>
                      </span>
                      <div class="relative">
                        <span
                          class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-noble-black/55"
                        >
                          ₱
                        </span>
                        <input
                          v-model="form.minTargetPrice"
                          type="number"
                          min="0"
                          inputmode="numeric"
                          required
                          aria-required="true"
                          :aria-invalid="fieldErrors.minTargetPrice ? 'true' : 'false'"
                          class="w-full rounded-[18px] border border-cinnamon-ice/40 bg-white py-3 pl-8 pr-4 text-[14px] text-noble-black outline-none transition focus:border-burning-orange"
                          placeholder="200"
                        />
                      </div>
                      <span
                        v-if="fieldErrors.minTargetPrice"
                        class="text-[12px] text-cinnabar-red"
                      >
                        {{ fieldErrors.minTargetPrice }}
                      </span>
                    </label>

                    <label class="flex flex-col gap-2">
                      <span class="text-[13px] font-semibold text-noble-black">
                        Maximum target price
                        <span class="ml-1 text-cinnabar-red" aria-hidden="true">*</span>
                      </span>
                      <div class="relative">
                        <span
                          class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-noble-black/55"
                        >
                          ₱
                        </span>
                        <input
                          v-model="form.maxTargetPrice"
                          type="number"
                          min="0"
                          inputmode="numeric"
                          required
                          aria-required="true"
                          :aria-invalid="fieldErrors.maxTargetPrice ? 'true' : 'false'"
                          class="w-full rounded-[18px] border border-cinnamon-ice/40 bg-white py-3 pl-8 pr-4 text-[14px] text-noble-black outline-none transition focus:border-burning-orange"
                          placeholder="450"
                        />
                      </div>
                      <span
                        v-if="fieldErrors.maxTargetPrice"
                        class="text-[12px] text-cinnabar-red"
                      >
                        {{ fieldErrors.maxTargetPrice }}
                      </span>
                    </label>
                  </div>

                  <label class="flex flex-col gap-2">
                    <span class="text-[13px] font-semibold text-noble-black">
                      Description
                      <span class="ml-1 text-cinnabar-red" aria-hidden="true">*</span>
                    </span>
                    <textarea
                      v-model="form.description"
                      rows="4"
                      maxlength="2000"
                      required
                      aria-required="true"
                      :aria-invalid="fieldErrors.description ? 'true' : 'false'"
                      class="rounded-[18px] border border-cinnamon-ice/40 bg-white px-4 py-3 text-[14px] text-noble-black outline-none transition focus:border-burning-orange"
                      placeholder="Describe the item, intended use, and any important details lenders should know."
                    />
                    <span v-if="fieldErrors.description" class="text-[12px] text-cinnabar-red">
                      {{ fieldErrors.description }}
                    </span>
                  </label>

                  <div class="flex flex-col gap-3 border-t border-cinnamon-ice/20 pt-2 sm:flex-row sm:items-center sm:justify-between">
                    <p class="text-[13px] leading-relaxed text-noble-black/55">
                      Your request will appear in the active feed immediately and expire automatically
                      after the requested end date passes.
                    </p>
                    <button
                      type="submit"
                      class="rounded-full bg-burning-orange px-8 py-2.5 text-[15px] font-bold text-white transition hover:bg-[#ff6a1f] disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="isSubmitting"
                    >
                      {{ isSubmitting ? "Posting..." : "Post Request" }}
                    </button>
                  </div>
                </form>
              </div>
            </section>

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
                @click="() => refresh()"
              >
                Try again
              </button>
            </div>

            <div v-else-if="posts.length > 0" class="flex flex-col gap-6">
              <RequestFeedCard
                v-for="post in posts"
                :key="post.id"
                :post="post"
                :show-requester-identity="isSignedIn"
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
              <h3 class="mb-2 text-[22px] font-bold text-noble-black">
                No active requests right now
              </h3>
              <p class="max-w-[360px] text-[15px] leading-relaxed text-noble-black/40">
                Check back later for new community requests. Expired requests are removed from the
                active board automatically.
              </p>
            </div>
          </section>

          <aside class="hidden w-[280px] shrink-0 lg:block xl:w-[320px]">
            <div class="sticky top-6 space-y-4">
              <section class="rounded-[24px] border border-cinnamon-ice/30 bg-white p-6">
                <p
                  class="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-estate/70"
                >
                  What each card shows
                </p>
                <ul class="mt-3 space-y-3 text-[14px] leading-relaxed text-noble-black/65">
                  <li>Requested item</li>
                  <li>Requester username for signed-in viewers</li>
                  <li>Requested dates</li>
                  <li>Target price range</li>
                  <li>Description and expiry info</li>
                </ul>
              </section>

              <section class="rounded-[24px] border border-cinnamon-ice/30 bg-cream p-6">
                <p
                  class="text-[11px] font-semibold uppercase tracking-[0.14em] text-noble-black/40"
                >
                  Status
                </p>
                <p class="mt-3 text-[14px] leading-relaxed text-noble-black/65">
                  This feed intentionally shows active requests only. Expired requests are excluded
                  on the backend and won’t appear as active posts.
                </p>
              </section>
            </div>
          </aside>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue"
import RequestFeedCard from "../../components/RequestFeedCard.vue"
import { useRequestFeed } from "../../composables/use-request-feed"
import { createInitialRequestForm } from "../../utils/request-form"

definePageMeta({ layout: false })

const user = useSupabaseUser()
const supabase = useSupabaseClient()
const form = reactive(createInitialRequestForm())
const isSignedIn = computed(() => Boolean(user.value))
const viewerAccountType = ref<"LENDER" | "BORROWER" | "ADMIN" | null>(null)
const isViewerLoading = ref(false)
const isBorrowerAccount = computed(() => viewerAccountType.value === "BORROWER")
const {
  posts,
  isLoading,
  errorMessage,
  isSubmitting,
  submitErrorMessage,
  fieldErrors,
  refresh,
  createPost,
} = useRequestFeed()

const getAccessToken = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session?.access_token ?? null
}

const resetForm = () => {
  Object.assign(form, createInitialRequestForm())
}

const syncViewerState = async () => {
  const accessToken = await getAccessToken()
  await refresh({ accessToken })

  if (!accessToken) {
    viewerAccountType.value = null
    isViewerLoading.value = false
    return
  }

  isViewerLoading.value = true
  try {
    const response = await $fetch<{
      user: {
        accountType: "LENDER" | "BORROWER" | "ADMIN" | null
      }
    }>("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    viewerAccountType.value = response.user.accountType
  } catch {
    viewerAccountType.value = null
  } finally {
    isViewerLoading.value = false
  }
}

const handleCreateRequest = async () => {
  const accessToken = await getAccessToken()
  const result = await createPost(form, { accessToken })

  if (result.success) {
    resetForm()
  }
}

watch(
  () => user.value?.id ?? null,
  () => {
    void syncViewerState()
  },
  { immediate: true },
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
