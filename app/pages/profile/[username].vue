<template>
  <div class="min-h-screen bg-white font-geist pt-16">
    <div v-if="isLoading" class="flex justify-center items-center py-40">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-burning-orange"></div>
    </div>

    <div v-else-if="profileData" class="max-w-[1200px] mx-auto px-6 py-10 flex flex-col gap-10">
      <!-- TOP HERO SECTION -->
      <header
        class="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-burning-orange via-orange-600 to-orange-700 p-8 md:p-12 shadow-xl"
      >
        <!-- Decorative blobs -->
        <div
          class="absolute -top-24 -right-12 w-96 h-96 rounded-full bg-white/10 blur-3xl pointer-events-none"
        ></div>
        <div
          class="absolute -bottom-32 left-1/4 w-80 h-80 rounded-full bg-cinnamon-ice/30 blur-3xl pointer-events-none"
        ></div>
        <div
          class="absolute top-1/4 -left-20 w-64 h-64 rounded-full bg-noble-black/5 blur-2xl pointer-events-none"
        ></div>

        <div class="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12 pb-16">
          <!-- User Main Info -->
          <div
            class="flex items-center gap-6 md:gap-8 flex-1 w-full text-center md:text-left flex-col md:flex-row"
          >
            <div class="relative">
              <UserAvatar
                :user-name="profileData.user.name"
                :avatar-url="profileData.user.avatarUrl"
                size="lg"
                class="h-32 w-32 md:h-40 md:w-40 rounded-full border-4 border-white shadow-[0_0_0_4px_rgba(255,255,255,0.2)]"
              />
            </div>
            <div class="flex-1">
              <div class="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-1">
                <h1
                  class="text-3xl md:text-5xl font-black text-white uppercase tracking-tight leading-none"
                >
                  {{ profileData.user.name }}
                </h1>
              </div>

              <div
                class="flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1 mb-4"
              >
                <p class="text-lg md:text-xl font-medium text-white/70">
                  @{{ profileData.user.username }}
                </p>
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
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {{ profileData.user.location }}
                </span>
              </div>

              <div
                v-if="profileData.user.bio"
                class="text-sm md:text-[14px] text-white/80 italic leading-relaxed max-w-lg mx-auto md:mx-0"
              >
                "{{ profileData.user.bio }}"
              </div>
            </div>
          </div>

          <!-- Rating cards -->
          <div class="flex gap-4 w-full md:w-auto">
            <!-- Lender Rating -->
            <div
              class="flex-1 md:w-40 rounded-[14px] bg-white/12 border border-white/20 p-5 backdrop-blur-md text-center flex flex-col justify-center"
            >
              <div class="text-[32px] font-bold text-white leading-none mb-1">
                {{ profileData.user.rating.toFixed(1)
                }}<span class="text-base text-white/60 font-normal ml-0.5">/5</span>
              </div>
              <div class="flex justify-center gap-0.5 mb-4">
                <span
                  v-for="i in 5"
                  :key="i"
                  class="text-[13px]"
                  :class="
                    i <= Math.round(profileData.user.rating) ? 'text-amber-300' : 'text-white/20'
                  "
                  >★</span
                >
              </div>
              <div class="text-[10px] font-bold uppercase tracking-[2px] text-white/60">Lender</div>
            </div>

            <!-- Borrower Rating -->
            <div
              v-if="profileData.user.borrowerRating > 0"
              class="flex-1 md:w-40 rounded-[14px] bg-white/12 border border-white/20 p-5 backdrop-blur-md text-center flex flex-col justify-center"
            >
              <div class="text-[32px] font-bold text-white leading-none mb-1">
                {{ profileData.user.borrowerRating.toFixed(1)
                }}<span class="text-base text-white/60 font-normal ml-0.5">/5</span>
              </div>
              <div class="flex justify-center gap-0.5 mb-4">
                <span
                  v-for="i in 5"
                  :key="i"
                  class="text-[13px]"
                  :class="
                    i <= Math.round(profileData.user.borrowerRating)
                      ? 'text-amber-300'
                      : 'text-white/20'
                  "
                  >★</span
                >
              </div>
              <div class="text-[10px] font-bold uppercase tracking-[2px] text-white/60">
                Borrower
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom stats strip -->
        <div
          class="absolute bottom-0 left-0 right-0 bg-black/20 backdrop-blur-sm px-6 md:px-12 py-3.5 flex items-center justify-center md:justify-start gap-8 border-t border-white/10"
        >
          <div class="flex flex-col items-center md:items-start">
            <div class="text-xl md:text-[22px] font-bold text-white leading-none">
              {{ profileData.user.itemsSold }}
            </div>
            <div class="text-[10px] font-bold uppercase tracking-[1.5px] text-white/55 mt-1">
              Items Lent
            </div>
          </div>
          <div class="w-px h-8 bg-white/15 hidden md:block"></div>
          <div class="flex flex-col items-center md:items-start">
            <div class="text-xl md:text-[22px] font-bold text-white leading-none">
              {{ profileData.user.activeListings }}
            </div>
            <div class="text-[10px] font-bold uppercase tracking-[1.5px] text-white/55 mt-1">
              Active Listings
            </div>
          </div>
          <div class="w-px h-8 bg-white/15 hidden md:block"></div>
          <div class="flex flex-col items-center md:items-start">
            <div class="text-xl md:text-[22px] font-bold text-white leading-none">
              {{ yearsOnPlatform }}{{ typeof yearsOnPlatform === "number" ? "yr" : "yr" }}
            </div>
            <div class="text-[10px] font-bold uppercase tracking-[1.5px] text-white/55 mt-1">
              On Platform
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
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    class="text-gray-400"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
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
              class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
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
/* Scoped styles kept minimal as most styling is now utility-based */
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
</style>
