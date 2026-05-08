<script setup lang="ts">
import { getRemainingBoostTime } from "../../../utils/rewards"

definePageMeta({
  layout: "account",
  middleware: "account-auth",
})

type RewardsSummary = {
  availablePoints: number
}

type ActiveBoost = {
  id: string
  itemId: string
  itemName: string
  itemImage?: string | null
  boostStatus: "ACTIVE" | "EXPIRED"
  boostStartedAt: string | Date
  boostExpiresAt: string | Date
  remainingTime?: string | null
}

const BOOST_CONFIG = {
  pointsCost: 50,
  durationHours: 24,
}

const now = ref(Date.now())
let countdownInterval: number | null = null
const showRewardPopup = ref(false)
let rewardPopupTimeout: ReturnType<typeof setTimeout> | null = null
const REVIEW_REWARD_POPUP_STORAGE_KEY = "takeup:review-reward-popup"

const { data: summary } = await useAsyncData("rewards:summary", () =>
  $fetch<RewardsSummary>("/api/rewards"),
)

const {
  data: activeBoostsResponse,
  pending: boostsPending,
  error: boostsError,
  refresh: refreshBoosts,
} = await useAsyncData("rewards:active-boosts", () =>
  $fetch<ActiveBoost[]>("/api/rewards/boosts/active"),
)

const activeBoosts = computed(() =>
  (activeBoostsResponse.value ?? [])
    .map((boost) => {
      const timing = getRemainingBoostTime(boost.boostExpiresAt, new Date(now.value))

      // Calculate percentage for progress bar (remaining / 24 hours)
      const expiration = new Date(boost.boostExpiresAt).getTime()
      const start = new Date(boost.boostStartedAt).getTime()
      const totalDuration = expiration - start
      const remaining = Math.max(0, expiration - now.value)
      const progress = Math.min(100, (remaining / totalDuration) * 100)

      return {
        ...boost,
        remainingLabel: boost.remainingTime?.trim() || timing.label,
        isExpired: boost.boostStatus !== "ACTIVE" || timing.expired,
        progress,
      }
    })
    .filter((boost) => !boost.isExpired),
)

// Progress toward next milestone (arbitrary 1000 pts milestone for the ring demo)
const NEXT_MILESTONE = 1000
const milestoneProgress = computed(() => {
  const current = summary.value?.availablePoints ?? 0
  return Math.min(100, (current / NEXT_MILESTONE) * 100)
})

const earnActions = [
  {
    id: "borrow",
    title: "Borrow Items",
    desc: "Complete borrowing activity to steadily build points.",
    pts: "+10 pts",
    link: "/dashboard",
    icon: "ph:package-light",
  },
  {
    id: "review",
    title: "Review Transactions",
    desc: "Leave timely reviews after completed transactions.",
    pts: "+5 pts",
    link: "/account/transactions",
    icon: "ph:note-pencil-light",
  },
]

const redemptions = [
  {
    title: "5% Discount Coupon",
    cost: 200,
    icon: "ph:ticket-light",
  },
  {
    title: "₱50 Wallet Credit",
    cost: 600,
    icon: "ph:wallet-light",
  },
]

const canAfford = (cost: number) => (summary.value?.availablePoints ?? 0) >= cost

const triggerRewardPopup = () => {
  if (rewardPopupTimeout) {
    clearTimeout(rewardPopupTimeout)
  }

  showRewardPopup.value = true
  rewardPopupTimeout = setTimeout(() => {
    showRewardPopup.value = false
    rewardPopupTimeout = null
  }, 1800)
}

onMounted(() => {
  now.value = Date.now()
  countdownInterval = window.setInterval(() => {
    now.value = Date.now()
  }, 60_000)

  if (window.sessionStorage.getItem(REVIEW_REWARD_POPUP_STORAGE_KEY) === "1") {
    window.sessionStorage.removeItem(REVIEW_REWARD_POPUP_STORAGE_KEY)
    triggerRewardPopup()
  }
})

onBeforeUnmount(() => {
  if (countdownInterval) {
    clearInterval(countdownInterval)
  }

  if (rewardPopupTimeout) {
    clearTimeout(rewardPopupTimeout)
  }
})

const formatDateTime = (value: string | Date) => {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}
</script>

<template>
  <div class="mx-auto max-w-[1180px] font-geist pb-20 lg:px-16 xl:px-24 text-noble-black">
    <header class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between mb-8">
      <section class="space-y-3">
        <div class="flex items-center gap-4">
          <div class="space-y-2">
            <h1 class="text-[28px] font-semibold text-noble-black leading-tight">My Rewards</h1>
            <div class="w-10 h-0.5 bg-burning-orange"></div>
          </div>
          <div
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-burning-orange/5 border border-burning-orange/20 mt-1"
          >
            <span class="text-[13px] font-bold text-burning-orange tracking-tight"
              >{{ (summary?.availablePoints ?? 0).toLocaleString() }} pts</span
            >
          </div>
        </div>
        <p class="text-[16px] font-medium text-noble-black/50">
          Quality reviews earn you reward points you can redeem for perks.
        </p>
      </section>
    </header>

    <!-- Points Hero Banner (Cream Style) -->
    <section
      class="relative w-full overflow-hidden rounded-[32px] border border-cinnamon-ice/20 bg-cream p-8 sm:p-12 mb-12 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
    >
      <!-- Radial Glow Decoration -->
      <div
        class="absolute -top-24 -right-24 w-64 h-64 bg-burning-orange/5 blur-[80px] rounded-full"
      ></div>

      <div class="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-10">
        <div class="text-center sm:text-left">
          <p class="text-[12px] font-black uppercase tracking-[0.2em] text-noble-black/40 mb-2">
            Your Points Balance
          </p>
          <div class="flex items-baseline justify-center sm:justify-start gap-4">
            <h2
              class="text-[64px] sm:text-[72px] font-black text-blue-estate leading-none tracking-tighter"
            >
              {{ (summary?.availablePoints ?? 0).toLocaleString() }}
            </h2>
          </div>
          <p class="text-[14px] font-semibold text-noble-black/50 mt-2">
            points available to spend
          </p>
        </div>

        <!-- Progress Ring -->
        <div class="relative flex items-center justify-center">
          <svg class="w-32 h-32 transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="58"
              stroke="currentColor"
              stroke-width="8"
              fill="transparent"
              class="text-noble-black/5"
            />
            <circle
              cx="64"
              cy="64"
              r="58"
              stroke="currentColor"
              stroke-width="8"
              fill="transparent"
              stroke-dasharray="364.4"
              :stroke-dashoffset="364.4 - (364.4 * milestoneProgress) / 100"
              stroke-linecap="round"
              class="text-burning-orange transition-all duration-1000 ease-out"
            />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <p class="text-[10px] font-black uppercase tracking-widest text-noble-black/30 mb-0.5">
              Next Goal
            </p>
            <p class="text-[15px] font-bold text-noble-black">{{ NEXT_MILESTONE }}</p>
          </div>
        </div>
      </div>
    </section>

    <div class="space-y-10">
      <!-- Section 1: How to Earn -->
      <section
        class="rounded-[24px] border border-cinnamon-ice/20 bg-cream p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
      >
        <div class="border-l-[3px] border-burning-orange pl-4 mb-8">
          <h2 class="text-[20px] font-bold text-noble-black">How to Earn</h2>
          <p class="text-[13px] font-medium text-noble-black/50">
            Ways to build your points balance
          </p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <NuxtLink
            v-for="action in earnActions"
            :key="action.id"
            :to="action.link"
            class="group flex flex-col gap-5 rounded-[20px] border border-cinnamon-ice/20 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-noble-black/5 hover:border-burning-orange/20"
          >
            <div class="flex items-center justify-between">
              <div
                class="w-10 h-10 rounded-full bg-burning-orange/[0.05] flex items-center justify-center text-burning-orange group-hover:bg-burning-orange group-hover:text-white transition-colors duration-300"
              >
                <Icon :name="action.icon" class="w-5 h-5" />
              </div>
              <Icon
                name="ph:arrow-right-light"
                class="w-5 h-5 text-noble-black/20 group-hover:text-burning-orange group-hover:translate-x-1 transition-all"
              />
            </div>
            <div>
              <h3 class="text-[15px] font-bold text-noble-black mb-1">{{ action.title }}</h3>
              <p class="text-[13px] font-medium text-noble-black/40 leading-relaxed">
                {{ action.desc }}
              </p>
            </div>
            <div class="mt-auto">
              <span
                class="inline-flex items-center px-3 py-1 rounded-full bg-burning-orange/5 text-burning-orange text-[12px] font-bold border border-burning-orange/10"
              >
                {{ action.pts }}
              </span>
            </div>
          </NuxtLink>
        </div>
      </section>

      <!-- Section 2: Spend Your Points -->
      <section
        class="rounded-[24px] border border-cinnamon-ice/20 bg-cream p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
      >
        <div class="border-l-[3px] border-burning-orange pl-4 mb-8">
          <h2 class="text-[20px] font-bold text-noble-black">Spend Your Points</h2>
          <p class="text-[13px] font-medium text-noble-black/50">
            Redeem your points for exclusive perks or listing visibility
          </p>
        </div>

        <div class="grid gap-6 xl:grid-cols-2 items-stretch">
          <!-- Redeem Perks -->
          <div class="flex flex-col">
            <div
              class="space-y-0 border border-cinnamon-ice/20 bg-white rounded-[20px] overflow-hidden h-full"
            >
              <div v-for="(reward, idx) in redemptions" :key="reward.title">
                <div class="flex items-center justify-between p-5">
                  <div class="flex items-center gap-4">
                    <div
                      class="w-11 h-11 rounded-[12px] bg-noble-black/5 flex items-center justify-center text-blue-estate"
                    >
                      <Icon :name="reward.icon" class="w-6 h-6" />
                    </div>
                    <div>
                      <p class="text-[14px] font-bold text-noble-black leading-tight">
                        {{ reward.title }}
                      </p>
                      <p class="text-[12px] font-bold text-burning-orange mt-1">
                        {{ reward.cost }} pts
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    class="h-8 px-5 rounded-full text-[13px] font-bold transition-all"
                    :class="
                      canAfford(reward.cost)
                        ? 'bg-burning-orange text-white hover:brightness-110 active:scale-95'
                        : 'bg-noble-black/5 text-noble-black/30 cursor-not-allowed flex items-center gap-1.5'
                    "
                    :disabled="!canAfford(reward.cost)"
                  >
                    <Icon
                      v-if="!canAfford(reward.cost)"
                      name="ph:lock-simple-light"
                      class="w-3.5 h-3.5"
                    />
                    {{ canAfford(reward.cost) ? "Claim" : "Locked" }}
                  </button>
                </div>
                <div
                  v-if="idx !== redemptions.length - 1"
                  class="h-[1px] bg-noble-black/5 mx-5"
                ></div>
              </div>
              <div class="mt-auto bg-noble-black/[0.02] px-5 py-3 border-t border-noble-black/5">
                <p
                  class="text-[11px] font-bold text-noble-black/30 uppercase tracking-widest text-center"
                >
                  Available balance: {{ summary?.availablePoints ?? 0 }} pts
                </p>
              </div>
            </div>
          </div>

          <!-- Boost Now -->
          <div
            class="rounded-[20px] border border-cinnamon-ice/20 bg-white p-6 flex flex-col shadow-sm"
          >
            <h3 class="text-[16px] font-bold text-noble-black mb-1">Boost a Listing</h3>
            <p class="text-[13px] font-medium text-noble-black/40 mb-6">
              Increase visibility for 24 hours.
            </p>

            <div class="grid grid-cols-2 gap-3 mb-8">
              <div class="bg-cream rounded-[12px] p-4 border border-cinnamon-ice/10 shadow-sm">
                <p class="text-[11px] font-bold uppercase tracking-widest text-noble-black/40 mb-1">
                  Cost
                </p>
                <p class="text-[16px] font-black text-burning-orange">
                  {{ BOOST_CONFIG.pointsCost }} pts
                </p>
              </div>
              <div class="bg-cream rounded-[12px] p-4 border border-cinnamon-ice/10 shadow-sm">
                <p class="text-[11px] font-bold uppercase tracking-widest text-noble-black/40 mb-1">
                  Time
                </p>
                <p class="text-[16px] font-black text-noble-black">
                  {{ BOOST_CONFIG.durationHours }}h
                </p>
              </div>
            </div>

            <NuxtLink
              :to="{ path: '/account/listings', query: { boost: 'true' } }"
              class="mt-auto h-11 inline-flex items-center justify-center rounded-[12px] bg-burning-orange px-8 text-[15px] font-extrabold text-white shadow-lg shadow-burning-orange/20 transition-all hover:scale-[1.02] active:scale-95"
            >
              Boost Now!
            </NuxtLink>
            <p class="text-[11px] font-medium text-noble-black/30 mt-4 text-center">
              Appears at the top of search results
            </p>
          </div>
        </div>
      </section>

      <!-- Section 3: Active Boosts -->
      <section
        class="rounded-[24px] border border-cinnamon-ice/20 bg-cream p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
      >
        <div class="flex items-center justify-between mb-8">
          <div class="border-l-[3px] border-burning-orange pl-4">
            <h2 class="text-[20px] font-bold text-noble-black">Active Boosts</h2>
            <p class="text-[13px] font-medium text-noble-black/50">Currently promoted listings</p>
          </div>

          <button
            v-if="boostsError"
            type="button"
            class="inline-flex h-8 items-center px-4 rounded-full border border-burning-orange text-[12px] font-bold text-burning-orange transition-all hover:bg-burning-orange hover:text-white"
            @click="refreshBoosts()"
          >
            Retry
          </button>
        </div>

        <!-- Loading -->
        <div v-if="boostsPending && !activeBoostsResponse" class="grid gap-4 sm:grid-cols-2">
          <div
            v-for="i in 2"
            :key="i"
            class="h-24 animate-pulse rounded-[20px] bg-cream border border-cinnamon-ice/10"
          />
        </div>

        <!-- Empty State -->
        <div
          v-else-if="activeBoosts.length === 0"
          class="flex flex-col items-center justify-center py-12 rounded-[24px] border border-dashed border-cinnamon-ice/30 bg-white"
        >
          <div
            class="w-14 h-14 rounded-full bg-noble-black/5 flex items-center justify-center text-noble-black/10 mb-4"
          >
            <Icon name="ph:rocket-launch-light" class="w-8 h-8" />
          </div>
          <p class="text-[15px] font-bold text-noble-black/40">No active boosts</p>
          <p
            class="text-[13px] font-medium text-noble-black/40 mt-1 mb-6 text-center max-w-[280px]"
          >
            Spend 50 points to boost a listing and increase its visibility.
          </p>
          <NuxtLink
            to="/account/listings"
            class="text-[14px] font-bold text-burning-orange hover:translate-x-1 transition-transform inline-flex items-center gap-1.5"
          >
            Boost a Listing →
          </NuxtLink>
        </div>

        <!-- Boost List -->
        <div v-else class="grid gap-4 sm:grid-cols-2">
          <article
            v-for="boost in activeBoosts"
            :key="boost.id"
            class="group relative overflow-hidden rounded-[20px] border border-cinnamon-ice/20 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-burning-orange/20"
          >
            <div class="flex items-start gap-4">
              <img
                v-if="boost.itemImage"
                :src="boost.itemImage"
                class="w-14 h-14 rounded-[10px] object-cover border border-noble-black/5"
              />
              <div
                v-else
                class="w-14 h-14 rounded-[10px] bg-noble-black/5 flex items-center justify-center text-[10px] font-bold text-noble-black/20"
              >
                NO IMG
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <h4 class="text-[14px] font-bold text-noble-black truncate">
                    {{ boost.itemName }}
                  </h4>
                  <div
                    class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success-green/[0.08] text-success-green border border-success-green/20"
                  >
                    <span class="w-1 h-1 rounded-full bg-success-green animate-pulse"></span>
                    <span class="text-[10px] font-bold uppercase tracking-wider">Live</span>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 text-[12px] font-medium text-noble-black/40">
                  <Icon name="ph:clock-light" class="w-3.5 h-3.5" />
                  <span
                    >{{ formatDateTime(boost.boostStartedAt) }} →
                    {{ formatDateTime(boost.boostExpiresAt) }}</span
                  >
                </div>
              </div>

              <div class="shrink-0 text-right">
                <p class="font-mono text-[14px] font-bold text-burning-orange">
                  {{ boost.remainingLabel }}
                </p>
                <p
                  class="text-[10px] font-bold uppercase tracking-widest text-noble-black/30 mt-0.5"
                >
                  Left
                </p>
              </div>
            </div>

            <!-- Remaining Time Bar -->
            <div class="mt-5 h-[4px] w-full rounded-full bg-noble-black/5 overflow-hidden">
              <div
                class="h-full bg-burning-orange transition-all duration-1000"
                :style="{ width: `${boost.progress}%` }"
              ></div>
            </div>
          </article>
        </div>
      </section>
    </div>

    <Transition
      enter-active-class="transition duration-500 ease-out"
      enter-from-class="opacity-0 scale-75 translate-y-3"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition duration-300 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-90"
    >
      <div
        v-if="showRewardPopup"
        class="pointer-events-none fixed inset-0 z-[140] flex items-center justify-center px-4"
      >
        <div class="rounded-full bg-emerald-500 px-7 py-4 text-center text-white shadow-2xl">
          <p class="text-3xl font-black tracking-tight">+5 points</p>
          <p class="text-sm font-medium text-white/90">Review bonus earned</p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: theme("colors.noble-black / 10%");
  border-radius: 20px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: theme("colors.noble-black / 20%");
}
</style>
