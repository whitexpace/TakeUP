<template>
  <div class="min-h-screen bg-white font-geist pt-16">
    <ProfileSkeleton v-if="isLoading" />

    <div v-else-if="profileData" class="max-w-[1200px] mx-auto py-6 flex flex-col gap-6">
      <!-- TOP HERO SECTION -->
      <header class="profile-hero shadow-xl group/hero">
        <!-- Layered Background System -->
        <div class="absolute inset-0 z-0 overflow-hidden">
          <!-- Base Gradient Layers -->
          <div class="absolute inset-0 bg-burning-orange"></div>
          <!-- Base Gradient Layers (Scattered & Edge-to-Edge) -->
          <div
            class="absolute inset-0 opacity-60 bg-[radial-gradient(at_0%_20%,theme('colors.orange.300')_0%,transparent_40%),radial-gradient(at_80%_80%,theme('colors.orange.400')_0%,transparent_50%),radial-gradient(at_50%_10%,theme('colors.amber.300')_0%,transparent_35%),radial-gradient(at_0%_100%,theme('colors.orange.400')_0%,transparent_45%),radial-gradient(at_100%_0%,theme('colors.orange.300')_0%,transparent_40%)]"
          ></div>

          <!-- Organic Blobs (Scattered & Overlapping Edges) -->
          <!-- Far Left Edge Blobs -->
          <div
            class="absolute top-[10%] -left-[15%] w-[55%] h-[65%] rounded-full bg-amber-200 opacity-35 blur-[120px] rotate-[-15deg] mix-blend-screen"
          ></div>
          <div
            class="absolute top-[40%] -left-[10%] w-[40%] h-[50%] rounded-full bg-orange-400 opacity-25 blur-[100px] rotate-[10deg] mix-blend-screen"
          ></div>

          <!-- Scattered Distribution -->
          <div
            class="absolute bottom-[5%] right-[10%] w-[50%] h-[60%] rounded-full bg-amber-200 opacity-40 blur-[110px] rotate-[20deg] mix-blend-screen"
          ></div>
          <div
            class="absolute top-[45%] left-[45%] w-[30%] h-[40%] rounded-full bg-orange-300 opacity-20 blur-[90px] rotate-[45deg] mix-blend-screen"
          ></div>
          <div
            class="absolute top-[-10%] right-[30%] w-[40%] h-[50%] rounded-full bg-orange-400 opacity-35 blur-[100px] rotate-[-10deg] mix-blend-screen"
          ></div>
          <div
            class="absolute bottom-[20%] left-[25%] w-[35%] h-[45%] rounded-full bg-orange-400 opacity-30 blur-[80px] rotate-[-25deg] mix-blend-screen"
          ></div>

          <!-- Diagonal Light Rake (Seamless Sheen) -->
          <div
            class="absolute inset-0 bg-[linear-gradient(162deg,rgba(255,255,255,0.08)_0%,transparent_60%)] pointer-events-none mix-blend-overlay"
          ></div>

          <!-- Dot Grid Pattern -->
          <div class="absolute inset-0 opacity-[0.07] pointer-events-none">
            <div
              class="absolute top-0 right-0 w-1/2 h-1/2 bg-[radial-gradient(theme('colors.white')_1px,transparent_1px)] [background-size:20px_20px]"
            ></div>
            <div
              class="absolute bottom-0 left-0 w-1/2 h-1/2 bg-[radial-gradient(theme('colors.white')_1px,transparent_1px)] [background-size:20px_20px]"
            ></div>
          </div>

          <!-- Noise & Inner Vignette -->
          <div class="absolute inset-0 noise-overlay opacity-[0.03] pointer-events-none"></div>
          <div
            class="absolute inset-0 ring-[40px] ring-white/[0.04] blur-2xl pointer-events-none"
          ></div>
        </div>

        <div class="hero-content">
          <!-- User Main Info -->
          <div class="user-info-group">
            <UserAvatar
              :user-name="profileData.user.name"
              :avatar-url="profileData.user.avatarUrl"
              size="lg"
              class="hero-avatar"
            />
            <div class="user-text">
              <h1 class="hero-name">{{ profileData.user.name }}</h1>

              <div
                class="flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1 mb-4"
              >
                <p class="hero-handle">@{{ profileData.user.username }}</p>
                <span
                  v-if="profileData.user.pronouns"
                  class="px-2 py-0.5 rounded-md bg-white/10 text-white/60 text-xs font-bold uppercase tracking-wider"
                >
                  {{ profileData.user.pronouns }}
                </span>
                <span
                  v-if="profileData.user.location"
                  class="flex items-center gap-1 text-white/60 text-sm font-medium"
                >
                  <Icon name="ph:map-pin" class="w-[14px] h-[14px]" />
                  {{ profileData.user.location }}
                </span>
              </div>

              <div v-if="profileData.user.bio" class="hero-bio">"{{ profileData.user.bio }}"</div>
            </div>
          </div>

          <!-- Rating & Stats Section -->
          <div class="hero-stats-group">
            <div class="flex gap-4">
              <!-- Lender Rating -->
              <div class="hero-rating-box flex-1">
                <div class="hero-rating-val">
                  <span>{{ profileData.user.rating.toFixed(1) }}</span>
                  <span class="rating-max">/5</span>
                </div>
                <div class="hero-stars">
                  <span
                    v-for="i in 5"
                    :key="i"
                    class="star"
                    :class="i <= Math.floor(profileData.user.rating) ? 'full' : ''"
                    >★</span
                  >
                </div>
                <div class="hero-rating-label">Lender</div>
              </div>

              <!-- Borrower Rating -->
              <div v-if="profileData.user.borrowerRating > 0" class="hero-rating-box flex-1">
                <div class="hero-rating-val">
                  <span>{{ profileData.user.borrowerRating.toFixed(1) }}</span>
                  <span class="rating-max">/5</span>
                </div>
                <div class="hero-stars">
                  <span
                    v-for="i in 5"
                    :key="i"
                    class="star"
                    :class="i <= Math.floor(profileData.user.borrowerRating) ? 'full' : ''"
                    >★</span
                  >
                </div>
                <div class="hero-rating-label">Borrower</div>
              </div>
            </div>

            <!-- Stats Grid -->
            <div class="hero-stats-grid">
              <div class="hstat">
                <div class="hstat-val">{{ profileData.user.itemsSold }}</div>
                <div class="hstat-label">Items Lent</div>
              </div>
              <div class="hstat">
                <div class="hstat-val">{{ profileData.user.activeListings }}</div>
                <div class="hstat-label">Active Listings</div>
              </div>
              <div class="hstat">
                <div class="hstat-val">{{ yearsOnPlatform }}yr</div>
                <div class="hstat-label">On Platform</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- MAIN CONTENT SECTION -->
      <main>
        <!-- Simplified Tab Bar -->
        <div class="flex items-center gap-8 border-b border-gray-100 mb-8 px-2">
          <button
            class="relative py-4 text-[15px] font-bold transition-all"
            :class="
              activeTab === 'reviews' ? 'text-burning-orange' : 'text-gray-400 hover:text-gray-600'
            "
            @click="activeTab = 'reviews'"
          >
            <div class="flex items-center gap-2">
              Reviews
              <span
                class="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold transition-colors"
                :class="
                  activeTab === 'reviews'
                    ? 'bg-burning-orange text-white'
                    : 'bg-gray-100 text-gray-500'
                "
              >
                {{ profileData.reviewsCount }}
              </span>
            </div>
            <!-- Active Underline -->
            <div
              v-if="activeTab === 'reviews'"
              class="absolute bottom-0 left-0 right-0 h-0.5 bg-burning-orange rounded-full"
            ></div>
          </button>

          <button
            class="relative py-4 text-[15px] font-bold transition-all"
            :class="
              activeTab === 'listings' ? 'text-burning-orange' : 'text-gray-400 hover:text-gray-600'
            "
            @click="activeTab = 'listings'"
          >
            <div class="flex items-center gap-2">
              Listed Items
              <span
                class="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold transition-colors"
                :class="
                  activeTab === 'listings'
                    ? 'bg-burning-orange text-white'
                    : 'bg-gray-100 text-gray-500'
                "
              >
                {{ profileData.items.length }}
              </span>
            </div>
            <!-- Active Underline -->
            <div
              v-if="activeTab === 'listings'"
              class="absolute bottom-0 left-0 right-0 h-0.5 bg-burning-orange rounded-full"
            ></div>
          </button>
        </div>

        <div class="tab-content min-h-[400px]">
          <!-- REVIEWS PANEL -->
          <div v-if="activeTab === 'reviews'" class="flex flex-col lg:flex-row gap-8">
            <!-- Left Column: Reviews List (Scrollable) -->
            <div class="lg:w-[65%] max-h-[800px] overflow-y-auto pr-6 custom-scrollbar">
              <div class="flex items-center gap-2 mb-6">
                <h3 class="text-[15px] font-semibold text-gray-700">Feedback History</h3>
                <span class="text-gray-400">·</span>
                <p class="text-[13px] text-gray-400">
                  {{ profileData.reviewsCount }} total reviews
                </p>
              </div>

              <!-- Filter Row -->
              <div class="flex flex-wrap gap-2 mb-8 sticky top-0 bg-white z-20 py-2">
                <button
                  v-for="filter in ['All', 'As Lender', 'As Borrower']"
                  :key="filter"
                  type="button"
                  class="px-4 py-1.5 rounded-full text-[13px] font-bold transition-all border-[1.5px]"
                  :class="
                    reviewFilter === filter
                      ? 'bg-burning-orange/10 border-burning-orange/30 text-burning-orange'
                      : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                  "
                  @click="reviewFilter = filter"
                >
                  {{ filter }}
                </button>
              </div>

              <div v-if="filteredReviews.length > 0" class="space-y-0">
                <div
                  v-for="(review, index) in visibleReviews"
                  :key="review.id"
                  class="py-6 flex flex-col gap-4"
                  :class="{ 'border-b border-gray-50': index !== visibleReviews.length - 1 }"
                >
                  <div class="flex items-start justify-between">
                    <!-- Link for non-anonymous reviewers -->
                    <NuxtLink
                      v-if="review.reviewer.username"
                      :to="`/profile/${review.reviewer.username}`"
                      class="flex items-center gap-3 group/reviewer"
                    >
                      <UserAvatar
                        :user-name="review.reviewer.name"
                        :avatar-url="review.reviewer.avatarUrl"
                        size="sm"
                        class="h-9 w-9 rounded-full"
                      />
                      <div>
                        <div class="flex items-center gap-2">
                          <span
                            class="text-[14px] font-semibold text-gray-900 group-hover/reviewer:text-burning-orange transition-colors"
                          >
                            {{ review.reviewer.name }}
                          </span>
                          <div class="flex gap-0.5">
                            <span
                              v-for="i in 5"
                              :key="i"
                              class="text-[11px]"
                              :class="i <= review.rating ? 'text-burning-orange' : 'text-gray-200'"
                              >★</span
                            >
                          </div>
                        </div>
                        <span class="text-[12px] text-gray-400">{{
                          formatDate(review.createdAt)
                        }}</span>
                      </div>
                    </NuxtLink>

                    <!-- Static div for anonymous reviewers -->
                    <div v-else class="flex items-center gap-3">
                      <UserAvatar
                        :user-name="review.reviewer.name"
                        :avatar-url="review.reviewer.avatarUrl"
                        size="sm"
                        class="h-9 w-9 rounded-full"
                      />
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="text-[14px] font-semibold text-gray-900">
                            {{ review.reviewer.name }}
                          </span>
                          <div class="flex gap-0.5">
                            <span
                              v-for="i in 5"
                              :key="i"
                              class="text-[11px]"
                              :class="i <= review.rating ? 'text-burning-orange' : 'text-gray-200'"
                              >★</span
                            >
                          </div>
                        </div>
                        <span class="text-[12px] text-gray-400">{{
                          formatDate(review.createdAt)
                        }}</span>
                      </div>
                    </div>

                    <div
                      class="px-3 py-1 rounded-full text-[11px] font-bold"
                      :class="
                        review.reviewType === 'LENDER_REVIEW'
                          ? 'bg-burning-orange/10 text-burning-orange'
                          : 'bg-blue-estate/10 text-blue-estate'
                      "
                    >
                      {{ review.reviewType === "LENDER_REVIEW" ? "Lender" : "Borrower" }} feedback
                    </div>
                  </div>
                  <p class="text-[14px] text-gray-700 leading-relaxed">{{ review.text }}</p>
                </div>

                <div
                  v-if="filteredReviews.length > PROFILE_REVIEW_PAGE_SIZE"
                  class="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p class="text-[12px] font-medium text-gray-400">
                    Showing {{ reviewRangeLabel }}
                  </p>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="h-8 w-8 rounded-lg border border-gray-100 text-gray-400 transition-colors hover:border-burning-orange hover:text-burning-orange disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-100 disabled:hover:text-gray-400"
                      :disabled="!hasPreviousReviewPage"
                      aria-label="Previous reviews"
                      @click="setReviewPage(reviewPage - 1)"
                    >
                      <Icon name="ph:caret-left" class="mx-auto h-4 w-4" />
                    </button>
                    <span class="text-[12px] font-semibold text-gray-400">
                      {{ reviewPage }} / {{ reviewPageCount }}
                    </span>
                    <button
                      type="button"
                      class="h-8 w-8 rounded-lg border border-gray-100 text-gray-400 transition-colors hover:border-burning-orange hover:text-burning-orange disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-100 disabled:hover:text-gray-400"
                      :disabled="!hasNextReviewPage"
                      aria-label="Next reviews"
                      @click="setReviewPage(reviewPage + 1)"
                    >
                      <Icon name="ph:caret-right" class="mx-auto h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div
                v-else
                class="text-center py-20 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200"
              >
                <p class="text-gray-400 font-medium text-sm">No reviews matching your filter.</p>
              </div>
            </div>

            <!-- Right Column: Role Feedback Guide -->
            <div class="lg:w-[35%]">
              <div
                class="sticky top-24 rounded-[14px] border border-gray-100 bg-white p-5 shadow-sm"
              >
                <div class="flex items-center gap-2 text-[13px] font-semibold text-gray-700 mb-4">
                  Role Guide
                </div>
                <div class="space-y-4">
                  <div class="flex items-start gap-3">
                    <div class="mt-1.5 w-2 h-2 rounded-full bg-burning-orange shrink-0"></div>
                    <div class="space-y-0.5">
                      <span
                        class="text-[11px] font-bold text-burning-orange uppercase tracking-wider"
                        >As a Lender</span
                      >
                      <p class="text-[12px] text-gray-500 leading-snug">
                        Reviews for when this user <strong>lent</strong> their items to others.
                      </p>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class="mt-1.5 w-2 h-2 rounded-full bg-blue-estate shrink-0"></div>
                    <div class="space-y-0.5">
                      <span class="text-[11px] font-bold text-blue-estate uppercase tracking-wider"
                        >As a Borrower</span
                      >
                      <p class="text-[12px] text-gray-500 leading-snug">
                        Reviews for when this user <strong>borrowed</strong> items from others.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- LISTINGS PANEL -->
          <div
            v-if="activeTab === 'listings'"
            class="tab-panel active max-h-[800px] overflow-y-auto pr-6 custom-scrollbar"
          >
            <div class="mb-8 sticky top-0 bg-white z-20 py-2">
              <div class="text-[16px] text-gray-500 font-semibold">
                {{ profileData.items.length }} active listings
              </div>
            </div>
            <div
              v-if="profileData.items.length > 0"
              class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
            >
              <ItemCard
                v-for="item in profileData.items"
                :id="item.id"
                :key="item.id"
                :type="item.freeToBorrow ? 'Borrow' : 'Rent'"
                :status="item.status"
                :image="item.image"
                :category="item.category"
                :name="item.name"
                :rating="item.rating"
                :reviews="item.bookingCount"
                :price="item.rentalFee"
                :price-unit="item.rateOption === 'PER_HOUR' ? 'hour' : 'day'"
                :owner="item.ownerName"
                :owner-username="item.lenderUsername || undefined"
              />
            </div>
            <div
              v-else
              class="text-center py-20 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200"
            >
              <p class="text-gray-400 font-medium">No active listings yet.</p>
            </div>
          </div>
        </div>
      </main>
    </div>

    <div v-else-if="error" class="py-20 text-center">
      <h2 class="text-2xl text-noble-black mb-4 uppercase font-bold">User Not Found</h2>
      <p class="text-noble-black/60 mb-8">
        The user you're looking for doesn't exist or has been removed.
      </p>
      <NuxtLink
        to="/dashboard"
        class="inline-flex items-center justify-center bg-burning-orange text-white px-8 py-3 rounded-full font-bold hover:brightness-110 transition-all"
      >
        Go Back to Dashboard
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue"
import {
  getCachedPublicProfile,
  prefetchPublicProfile,
} from "../../composables/use-public-profile-prefetch"

definePageMeta({
  layout: "dashboard",
  hideDashboardSidebar: true,
})

const route = useRoute()
const username = route.params.username as string
const activeTab = ref("reviews")
const reviewFilter = ref("All")
const PROFILE_REVIEW_PAGE_SIZE = 5
const reviewPage = ref(1)

const {
  data: profileData,
  pending: isProfilePending,
  error,
} = useAsyncData(
  `profile-${username}`,
  () => prefetchPublicProfile(username, { reviewsLimit: PROFILE_REVIEW_PAGE_SIZE }),
  {
    default: () => getCachedPublicProfile(username),
    lazy: true,
  },
)
const isLoading = computed(() => isProfilePending.value && !profileData.value)

const filteredReviews = computed(() => {
  if (!profileData.value?.reviews) return []
  let filtered = [...profileData.value.reviews]
  if (reviewFilter.value !== "All") {
    const type = reviewFilter.value === "As Lender" ? "LENDER_REVIEW" : "BORROWER_REVIEW"
    filtered = filtered.filter((r) => r.reviewType === type)
  }
  // Sort by most recent
  return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
})
const reviewPageCount = computed(() =>
  Math.max(1, Math.ceil(filteredReviews.value.length / PROFILE_REVIEW_PAGE_SIZE)),
)
const reviewPageStart = computed(() => (reviewPage.value - 1) * PROFILE_REVIEW_PAGE_SIZE)
const reviewPageEnd = computed(() =>
  Math.min(reviewPageStart.value + PROFILE_REVIEW_PAGE_SIZE, filteredReviews.value.length),
)
const visibleReviews = computed(() =>
  filteredReviews.value.slice(reviewPageStart.value, reviewPageEnd.value),
)
const reviewRangeLabel = computed(() =>
  filteredReviews.value.length === 0
    ? ""
    : `${reviewPageStart.value + 1}-${reviewPageEnd.value} of ${filteredReviews.value.length}`,
)
const hasPreviousReviewPage = computed(() => reviewPage.value > 1)
const hasNextReviewPage = computed(() => reviewPage.value < reviewPageCount.value)

const setReviewPage = (page: number) => {
  reviewPage.value = Math.min(Math.max(1, page), reviewPageCount.value)
}

watch(reviewFilter, () => {
  reviewPage.value = 1
})

watch(
  () => filteredReviews.value.length,
  () => {
    setReviewPage(reviewPage.value)
  },
)

const yearsOnPlatform = computed(() => {
  if (!profileData.value?.user.createdAt) return "< 1"
  const created = new Date(profileData.value.user.createdAt)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - created.getTime())
  const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25)
  return diffYears < 1 ? "< 1" : Math.floor(diffYears)
})

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}
</script>

<style scoped>
/* Custom Premium Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: theme("colors.cinnamon-ice / 20%");
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: theme("colors.cinnamon-ice / 40%");
}

/* TOP HERO SECTION */
.profile-hero {
  border-radius: 40px;
  padding: 48px;
  position: relative;
  overflow: hidden;
  color: #fff;
  min-height: 320px;
  display: flex;
  align-items: center;
  animation: fadeUp 0.45s ease both;
}

.noise-overlay {
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
}

.hero-content {
  position: relative;
  z-index: 10;
  width: 100%;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 48px;
  align-items: center;
}

.user-info-group {
  display: flex;
  align-items: center;
  gap: 32px;
}

.hero-avatar {
  width: 160px;
  height: 160px;
  border: 6px solid #fff;
  flex-shrink: 0;
  border-radius: 50%;
}

.user-text {
  flex: 1;
}

.hero-name {
  font-size: 48px;
  font-weight: 500;
  font-family: "Nv Montravia", serif;
  letter-spacing: -0.5px;
  line-height: 1.1;
  margin-bottom: 8px;
}

.hero-handle {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.hero-bio {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  font-style: italic;
  max-width: 500px;
  line-height: 1.6;
  margin-top: 8px;
}

.hero-stats-group {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 320px;
}

.hero-rating-box {
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 24px;
  padding: 24px;
  text-align: center;
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px -8px rgba(0, 0, 0, 0.1);
}

.hero-rating-val {
  font-size: 48px;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 4px;
  color: #fff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.rating-max {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.7);
  margin-left: 2px;
}

.hero-stars {
  display: flex;
  justify-content: center;
  gap: 4px;
  margin-bottom: 8px;
}

.hero-stars .star {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.25);
}

.hero-stars .star.full {
  color: #fff;
  filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.2));
}

.hero-rating-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.hero-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  background: rgba(255, 255, 255, 0.16);
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px -8px rgba(0, 0, 0, 0.1);
}

.hstat {
  padding: 16px 12px;
  text-align: center;
}

.hstat:not(:last-child) {
  border-right: 1px solid rgba(255, 255, 255, 0.18);
}

.hstat-val {
  font-size: 20px;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 4px;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.hstat-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(255, 255, 255, 0.75);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.tab-content {
  animation: fadeUp 0.45s 0.1s ease both;
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Glass card background utility */
.bg-white\/12 {
  background-color: rgba(255, 255, 255, 0.12);
}

/* RESPONSIVE */
@media (max-width: 1024px) {
  .hero-content {
    grid-template-columns: 1fr;
    gap: 32px;
  }
  .hero-stats-group {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    min-width: 0;
  }
  .hero-rating-box {
    flex: 1;
  }
  .hero-stats-grid {
    flex: 2;
  }
}

@media (max-width: 768px) {
  .profile-hero {
    padding: 32px;
    border-radius: 30px;
  }
  .user-info-group {
    flex-direction: column;
    text-align: center;
    gap: 20px;
  }
  .hero-avatar {
    width: 120px;
    height: 120px;
  }
  .hero-name {
    font-size: 32px;
  }
  .hero-stats-group {
    flex-direction: column;
    width: 100%;
  }
  .hero-stats-grid {
    width: 100%;
  }
}
</style>
