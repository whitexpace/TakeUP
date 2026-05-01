<template>
  <div class="min-h-screen bg-white font-geist pt-16">
    <div v-if="isLoading" class="flex justify-center items-center py-40">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-burning-orange"></div>
    </div>

    <div v-else-if="profileData" class="profile-container">
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
              <p class="hero-handle">@{{ profileData.user.username }}</p>
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
                <div class="hero-rating-label">Lender Rating</div>
              </div>

              <!-- Borrower Rating -->
              <div
                v-if="profileData.user.borrowerRating > 0"
                class="hero-rating-box flex-1 opacity-80"
              >
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
                <div class="hero-rating-label">Borrower Rating</div>
              </div>
            </div>

            <!-- Stats Grid -->
            <div class="hero-stats-grid">
              <div class="hstat">
                <div class="hstat-val">{{ profileData.user.itemsSold }}</div>
                <div class="hstat-label">Items Lent</div>
              </div>
              <div class="hstat">
                <div class="hstat-val orange">{{ profileData.user.activeListings }}</div>
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
      <main class="profile-main">
        <!-- Tab shell -->
        <div class="tab-shell">
          <div class="tab-header">
            <button
              class="tab-btn"
              :class="{ active: activeTab === 'reviews' }"
              @click="activeTab = 'reviews'"
            >
              <svg viewBox="0 0 16 16">
                <path d="M8 1l2 4 4.5.7-3.25 3.15.77 4.5L8 11.25 3.98 13.35l.77-4.5L1.5 5.7 6 5z" />
              </svg>
              Reviews
              <span class="tab-count">{{ profileData.reviews.length }}</span>
            </button>
            <button
              class="tab-btn"
              :class="{ active: activeTab === 'listings' }"
              @click="activeTab = 'listings'"
            >
              <svg viewBox="0 0 16 16">
                <rect x="2" y="2" width="5" height="5" rx="1" />
                <rect x="9" y="2" width="5" height="5" rx="1" />
                <rect x="2" y="9" width="5" height="5" rx="1" />
                <rect x="9" y="9" width="5" height="5" rx="1" />
              </svg>
              Listed Items
              <span class="tab-count">{{ profileData.items.length }}</span>
            </button>
          </div>

          <div class="tab-body">
            <!-- REVIEWS PANEL -->
            <div v-if="activeTab === 'reviews'" class="tab-panel active">
              <!-- Feedback Header -->
              <div
                class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-10 border-b border-cinnamon-ice/20"
              >
                <div>
                  <h3 class="text-2xl font-bold text-wahoo mb-1">Feedback History</h3>
                  <p class="text-noble-black/50 font-medium">
                    {{ profileData.reviews.length }} total reviews
                  </p>
                </div>

                <!-- Clearer Role Note -->
                <div
                  class="flex flex-col gap-4 p-5 bg-white rounded-[25px] border-2 border-cream shadow-sm max-w-md"
                >
                  <div
                    class="flex items-center gap-2 text-[11px] font-black text-wahoo uppercase tracking-[0.12em]"
                  >
                    <div
                      class="w-6 h-6 rounded-full bg-wahoo/5 flex items-center justify-center text-wahoo"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </div>
                    Role Feedback Guide
                  </div>
                  <div class="flex flex-col gap-3">
                    <div class="flex items-start gap-3">
                      <div class="mt-1.5 w-2 h-2 rounded-full bg-blue-estate shrink-0"></div>
                      <p class="text-[12px] leading-snug text-noble-black/70">
                        <span
                          class="font-bold text-blue-estate block mb-0.5 uppercase text-[9px] tracking-wider"
                          >As a Lender</span
                        >
                        Reviews for when this user <strong>lent</strong> their items to others.
                      </p>
                    </div>
                    <div class="flex items-start gap-3">
                      <div class="mt-1.5 w-2 h-2 rounded-full bg-burning-orange shrink-0"></div>
                      <p class="text-[12px] leading-snug text-noble-black/70">
                        <span
                          class="font-bold text-burning-orange block mb-0.5 uppercase text-[9px] tracking-wider"
                          >As a Borrower</span
                        >
                        Reviews for when this user <strong>borrowed</strong> items from others.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="profileData.reviews.length > 0" class="reviews-list">
                <div v-for="review in profileData.reviews" :key="review.id" class="review-card">
                  <div class="review-head">
                    <NuxtLink
                      :to="`/profile/${review.reviewer.username}`"
                      class="reviewer-row group/reviewer"
                    >
                      <UserAvatar
                        :user-name="review.reviewer.name"
                        :avatar-url="review.reviewer.avatarUrl"
                        size="sm"
                        class="rev-avatar group-hover/reviewer:scale-105 transition-transform"
                      />
                      <div>
                        <div
                          class="rev-name group-hover/reviewer:text-burning-orange transition-colors"
                        >
                          {{ review.reviewer.name }}
                        </div>
                        <div class="rev-meta">
                          <div class="rev-stars">
                            <span
                              v-for="i in 5"
                              :key="i"
                              class="star"
                              :class="i <= review.rating ? 'full' : ''"
                              >★</span
                            >
                          </div>
                          <span class="rev-date">{{ formatDate(review.createdAt) }}</span>
                        </div>
                      </div>
                    </NuxtLink>
                    <span class="rev-item-badge">
                      {{
                        review.reviewType === "LENDER_REVIEW"
                          ? "Lender feedback"
                          : "Borrower feedback"
                      }}
                    </span>
                  </div>
                  <p class="review-text">{{ review.text }}</p>
                </div>
              </div>
              <div
                v-else
                class="text-center py-20 bg-cream/30 rounded-3xl border border-dashed border-cinnamon-ice/30"
              >
                <p class="text-noble-black/40 font-medium">No reviews yet.</p>
              </div>
            </div>

            <!-- LISTINGS PANEL -->
            <div v-if="activeTab === 'listings'" class="tab-panel active">
              <div class="listings-header">
                <div class="listings-count">{{ profileData.items.length }} active listings</div>
              </div>
              <div v-if="profileData.items.length > 0" class="items-grid">
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
                class="text-center py-20 bg-cream/30 rounded-3xl border border-dashed border-cinnamon-ice/30"
              >
                <p class="text-noble-black/40 font-medium">No active listings yet.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <div v-else-if="error" class="py-20 text-center">
      <h2 class="font-rewon text-2xl text-noble-black mb-4 uppercase">User Not Found</h2>
      <p class="font-geist text-noble-black/60 mb-8">
        The user you're looking for doesn't exist or has been removed.
      </p>
      <NuxtLink
        to="/dashboard"
        class="bg-burning-orange text-white px-8 py-3 rounded-full font-geist font-bold hover:bg-blue-estate transition-colors"
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

const {
  data: profileData,
  pending: isLoading,
  error,
} = await useAsyncData(`profile-${username}`, () => $fetch<PublicProfile>(`/api/users/${username}`))

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
.profile-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 24px 100px;
  display: flex;
  flex-direction: column;
  gap: 40px;
}

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
  border: 6px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}

.user-text {
  flex: 1;
}

.hero-name {
  font-size: 48px;
  font-weight: 800;
  font-family: "Rewon", sans-serif;
  text-transform: uppercase;
  letter-spacing: -1px;
  line-height: 1;
  margin-bottom: 8px;
}

.hero-handle {
  font-size: 20px;
  color: theme("colors.cream");
  font-weight: 500;
  margin-bottom: 20px;
  opacity: 0.9;
}

.hero-bio {
  font-size: 16px;
  color: #fff;
  font-style: italic;
  max-width: 500px;
  line-height: 1.6;
  opacity: 0.85;
}

.hero-stats-group {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 320px;
}

.hero-rating-box {
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 24px;
  padding: 24px;
  text-align: center;
  backdrop-filter: blur(10px);
}

.hero-rating-val {
  font-size: 56px;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 8px;
  color: #fff;
}

.hero-rating-val span:first-child {
  color: #fff;
}

.rating-max {
  font-size: 24px;
  color: theme("colors.cream");
  opacity: 0.7;
  margin-left: 4px;
}

.hero-stars {
  display: flex;
  justify-content: center;
  gap: 4px;
  margin-bottom: 8px;
}

.hero-stars .star {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.3);
}

.hero-stars .star.full {
  color: #fff;
}

.hero-rating-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: theme("colors.cream");
  font-weight: 700;
  opacity: 0.9;
}

.hero-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  background: rgba(0, 0, 0, 0.05);
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.hstat {
  padding: 16px 12px;
  text-align: center;
  background: transparent;
  transition: background 0.2s;
}

.hstat:not(:last-child) {
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.hstat-val {
  font-size: 24px;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 4px;
  color: #fff;
}

.hstat-val.orange {
  color: #fff;
}

.hstat-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: theme("colors.cream");
  opacity: 0.8;
}

/* MAIN CONTENT */
.profile-main {
  animation: fadeUp 0.45s 0.15s ease both;
}

.tab-shell {
  background: #fff;
  border: 1px solid theme("colors.pale-cashmere");
  border-radius: 30px;
  overflow: hidden;
}
.tab-header {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid theme("colors.pale-cashmere");
  background: theme("colors.cream");
}
.tab-btn {
  flex: 1;
  padding: 24px;
  font-size: 16px;
  font-weight: 700;
  color: #999;
  font-family: "Geist", sans-serif;
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border-bottom: 4px solid transparent;
  margin-bottom: -1px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.tab-btn:hover {
  color: theme("colors.wahoo");
  background: rgba(255, 255, 255, 0.6);
}
.tab-btn.active {
  color: theme("colors.wahoo");
  border-bottom-color: theme("colors.burning-orange");
  background: #fff;
}
.tab-btn svg {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  border-radius: 12px;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 800;
  background: theme("colors.pale-cashmere");
  color: #777;
  transition: all 0.2s;
}
.tab-btn.active .tab-count {
  background: theme("colors.burning-orange");
  color: #fff;
}
.tab-body {
  padding: 40px;
}

/* REVIEWS PANEL */
.reviews-top {
  display: flex;
  align-items: center;
  gap: 40px;
  padding-bottom: 40px;
  border-bottom: 1px solid theme("colors.pale-cashmere");
  margin-bottom: 40px;
}
.rating-big-num {
  font-size: 88px;
  font-weight: 800;
  color: theme("colors.wahoo");
  letter-spacing: -4px;
  line-height: 1;
  flex-shrink: 0;
}
.rating-big-num span {
  color: theme("colors.burning-orange");
}
.rating-summary-right {
  flex: 1;
}
.stars-large {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}
.stars-large .star {
  font-size: 28px;
  color: theme("colors.pale-cashmere");
}
.stars-large .star.full {
  color: theme("colors.burning-orange");
}
.rating-tagline {
  font-size: 18px;
  color: theme("colors.noble-black / 60%");
  font-weight: 500;
}

.reviews-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.review-card {
  border: 1px solid theme("colors.pale-cashmere");
  border-radius: 24px;
  padding: 32px;
  transition: all 0.2s ease;
}
.review-card:hover {
  border-color: theme("colors.cinnamon-ice");
  box-shadow: 0 10px 30px rgba(39, 45, 78, 0.06);
  transform: translateY(-2px);
}
.review-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.reviewer-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.rev-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
}
.rev-name {
  font-size: 16px;
  font-weight: 700;
  color: theme("colors.wahoo");
  margin-bottom: 4px;
}
.rev-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}
.rev-stars {
  display: flex;
  gap: 2px;
}
.rev-stars .star {
  font-size: 14px;
  color: theme("colors.pale-cashmere");
}
.rev-stars .star.full {
  color: theme("colors.burning-orange");
}
.rev-date {
  font-size: 13px;
  color: #bbb;
  font-weight: 500;
}
.rev-item-badge {
  font-size: 12px;
  padding: 6px 16px;
  border-radius: 100px;
  background: theme("colors.cream");
  border: 1px solid theme("colors.cinnamon-ice / 40%");
  color: theme("colors.blue-estate");
  font-weight: 700;
  white-space: nowrap;
}
.review-text {
  font-size: 15px;
  color: #4a4a4a;
  line-height: 1.7;
}

/* LISTINGS PANEL */
.listings-header {
  margin-bottom: 32px;
}
.listings-count {
  font-size: 16px;
  color: #888;
  font-weight: 600;
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* RESPONSIVE */
@media (max-width: 1024px) {
  .items-grid {
    grid-template-columns: repeat(3, 1fr);
  }
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
  .profile-container {
    padding: 24px 16px;
  }
  .profile-hero {
    padding: 32px;
    border-radius: 30px;
  }
  .items-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
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
  .tab-body {
    padding: 24px;
  }
  .reviews-top {
    flex-direction: column;
    text-align: center;
    gap: 20px;
  }
  .rating-big-num {
    font-size: 64px;
  }
  .review-card {
    padding: 20px;
  }
}

@media (max-width: 480px) {
  .items-grid {
    grid-template-columns: 1fr;
  }
}
</style>
