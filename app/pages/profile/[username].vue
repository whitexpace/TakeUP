<template>
  <div class="min-h-screen bg-white font-geist pt-16">
    <div v-if="isLoading" class="flex justify-center items-center py-40">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-burning-orange"></div>
    </div>

    <div v-else-if="profileData" class="max-w-[1200px] mx-auto py-6 flex flex-col gap-6">
      <!-- TOP HERO SECTION -->
      <header class="profile-hero shadow-xl">
        <div class="hero-deco-1"></div>
        <div class="hero-deco-2"></div>
        <div class="hero-deco-3"></div>

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
                    :class="i <= Math.round(profileData.user.rating) ? 'full' : ''"
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
                    :class="i <= Math.round(profileData.user.borrowerRating) ? 'full' : ''"
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
                {{ profileData.reviews.length }}
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
            <!-- Left Column: Reviews List -->
            <div class="lg:w-[65%]">
              <div class="flex items-center gap-2 mb-6">
                <h3 class="text-[15px] font-semibold text-gray-700">Feedback History</h3>
                <span class="text-gray-400">·</span>
                <p class="text-[13px] text-gray-400">
                  {{ profileData.reviews.length }} total reviews
                </p>
              </div>

              <!-- Filter Row -->
              <div class="flex flex-wrap gap-2 mb-8">
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
                  v-for="(review, index) in filteredReviews"
                  :key="review.id"
                  class="py-6 flex flex-col gap-4"
                  :class="{ 'border-b border-gray-50': index !== filteredReviews.length - 1 }"
                >
                  <div class="flex items-start justify-between">
                    <NuxtLink
                      :to="`/profile/${review.reviewer.username}`"
                      class="flex items-center gap-3 group"
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
                            class="text-[14px] font-semibold text-gray-900 group-hover:text-burning-orange transition-colors"
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
          <div v-if="activeTab === 'listings'" class="tab-panel active">
            <div class="mb-8">
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
import { ref, computed } from "vue"
import type { PublicProfile } from "~/types/user"

definePageMeta({
  layout: "dashboard",
  hideDashboardSidebar: true,
})

const route = useRoute()
const username = route.params.username as string
const activeTab = ref("reviews")
const reviewFilter = ref("All")

const {
  data: profileData,
  pending: isLoading,
  error,
} = await useAsyncData(`profile-${username}`, () => $fetch<PublicProfile>(`/api/users/${username}`))

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
/* TOP HERO SECTION */
.profile-hero {
  background: theme("colors.burning-orange");
  border-radius: 40px;
  padding: 48px;
  position: relative;
  overflow: hidden;
  color: #fff;
  min-height: 300px;
  display: flex;
  align-items: center;
  animation: fadeUp 0.45s ease both;
}

.hero-deco-1 {
  position: absolute;
  top: -100px;
  right: -50px;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  background: theme("colors.cream / 20%");
  pointer-events: none;
}
.hero-deco-2 {
  position: absolute;
  bottom: -150px;
  left: 10%;
  width: 350px;
  height: 350px;
  border-radius: 50%;
  background: theme("colors.cinnamon-ice / 40%");
  pointer-events: none;
}
.hero-deco-3 {
  position: absolute;
  top: 10%;
  left: -100px;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: theme("colors.noble-black / 5%");
  pointer-events: none;
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
  background: rgba(255, 255, 255, 0.13);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 24px;
  padding: 24px;
  text-align: center;
  backdrop-filter: blur(10px);
}

.hero-rating-val {
  font-size: 48px;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 4px;
  color: #fff;
}

.rating-max {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.6);
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
  color: rgba(255, 255, 255, 0.2);
}

.hero-stars .star.full {
  color: #fff;
}

.hero-rating-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 700;
}

.hero-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  background: rgba(0, 0, 0, 0.18);
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(5px);
}

.hstat {
  padding: 16px 12px;
  text-align: center;
}

.hstat:not(:last-child) {
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.hstat-val {
  font-size: 20px;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 4px;
  color: #fff;
}

.hstat-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(255, 255, 255, 0.6);
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
