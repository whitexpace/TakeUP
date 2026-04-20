<script setup lang="ts">
import { formatBoostDateTime, getRemainingBoostTime } from "../../../utils/rewards"

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

const {
  data: summary,
  pending: summaryPending,
  error: summaryError,
  refresh: refreshSummary,
} = await useAsyncData("rewards:summary", () => $fetch<RewardsSummary>("/api/rewards"))

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

      return {
        ...boost,
        remainingLabel: boost.remainingTime?.trim() || timing.label,
        isExpired: boost.boostStatus !== "ACTIVE" || timing.expired,
      }
    })
    .filter((boost) => !boost.isExpired),
)

onMounted(() => {
  now.value = Date.now()
  countdownInterval = window.setInterval(() => {
    now.value = Date.now()
  }, 60_000)
})

onBeforeUnmount(() => {
  if (countdownInterval) {
    clearInterval(countdownInterval)
  }
})
</script>

<template>
  <div class="space-y-6 font-geist">
    <section class="space-y-6">
      <div>
        <h1 class="text-[25px] font-bold text-neutral-800">My Rewards</h1>
        <p class="mt-2 text-[18px] text-neutral-800/80">
          Quality reviews earn you reward points you can redeem for perks.
        </p>
      </div>

      <div
        class="rounded-[24px] border border-cinnamon-ice bg-cream p-5 shadow-[0_10px_30px_rgba(39,45,78,0.06)] sm:p-7"
      >
        <div
          v-if="summaryPending && !summary"
          class="h-40 animate-pulse rounded-[18px] border border-cinnamon-ice/70 bg-white"
        />

        <div v-else-if="summaryError" class="rounded-[18px] border border-red-200 bg-white p-5">
          <p class="text-base font-semibold text-neutral-800">Unable to load your points.</p>
          <p class="mt-2 text-sm text-neutral-800/60">
            Try again to view your current rewards balance.
          </p>
          <button
            type="button"
            class="mt-4 inline-flex rounded-[10px] bg-burning-orange px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-burning-orange/90"
            @click="refreshSummary()"
          >
            Retry
          </button>
        </div>

        <div v-else class="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-center">
          <div class="flex justify-center lg:justify-end">
            <div class="flex items-center pl-4 pr-1 lg:pl-14 lg:pr-0">
              <div class="min-w-[170px] text-center lg:min-w-[210px]">
                <p class="text-[32px] font-extrabold leading-none text-burning-orange">
                  {{ (summary?.availablePoints ?? 0).toLocaleString("en-US") }}
                </p>
                <p class="mt-2 text-[30px] font-medium leading-none text-neutral-800/80">Points</p>
              </div>
              <div class="ml-6 hidden h-36 w-px bg-[#D6D6D6] lg:block" />
            </div>
          </div>

          <div>
            <p class="mb-3 text-[20px] font-bold text-neutral-800">Earn More!</p>
            <div class="space-y-3">
              <NuxtLink
                to="/dashboard"
                class="flex items-center justify-between gap-4 rounded-[18px] border border-cinnamon-ice/70 bg-white px-5 py-4 transition-colors hover:border-burning-orange/35 hover:bg-burning-orange/[0.03]"
              >
                <div>
                  <p class="text-2xl font-extrabold text-burning-orange sm:text-[28px]">
                    Borrow Items
                  </p>
                  <p class="mt-1 text-sm leading-6 text-neutral-800/60 sm:text-[15px]">
                    Complete borrowing activity to steadily build points for future boosts.
                  </p>
                </div>
                <span
                  class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-burning-orange/10 text-[28px] font-medium leading-none text-[#FF9124]"
                  >→</span
                >
              </NuxtLink>

              <NuxtLink
                to="/account/transactions"
                class="flex items-center justify-between gap-4 rounded-[18px] border border-cinnamon-ice/70 bg-white px-5 py-4 transition-colors hover:border-burning-orange/35 hover:bg-burning-orange/[0.03]"
              >
                <div>
                  <p class="text-2xl font-extrabold text-burning-orange sm:text-[28px]">
                    Review Transactions
                  </p>
                  <p class="mt-1 text-sm leading-6 text-neutral-800/60 sm:text-[15px]">
                    Leave timely reviews after completed transactions to earn extra points.
                  </p>
                </div>
                <span
                  class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-burning-orange/10 text-[28px] font-medium leading-none text-[#FF9124]"
                  >→</span
                >
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>

      <div class="grid gap-6 xl:grid-cols-2">
        <article
          class="rounded-[20px] border border-cinnamon-ice bg-cream p-5 shadow-[0_10px_30px_rgba(39,45,78,0.06)]"
        >
          <h2 class="text-[20px] font-bold text-neutral-800">Redeem Points for Rewards!</h2>
          <p class="mt-2 text-sm leading-6 text-neutral-800/65 sm:text-[15px]">
            Keep these as lightweight preview rewards for now while the full redemption flow is
            still being built.
          </p>

          <div class="mt-5 grid gap-4 sm:grid-cols-2">
            <div
              class="rounded-[18px] border border-cinnamon-ice/70 bg-white p-4 shadow-[0_6px_18px_rgba(39,45,78,0.04)]"
            >
              <div class="flex min-h-[72px] items-center justify-center text-blue-estate">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M7 4h10a2 2 0 012 2v2H5V6a2 2 0 012-2z" />
                  <path d="M5 8h14v4a2 2 0 01-2 2H7a2 2 0 01-2-2V8z" />
                  <path d="M8 14h8v4a2 2 0 01-2 2h-4a2 2 0 01-2-2v-4z" />
                </svg>
              </div>
              <p class="mt-1 text-[13px] font-semibold text-neutral-800">5% Discount Coupon</p>
              <p class="mt-1 text-[15px] font-semibold text-burning-orange">200 pts</p>
              <button
                type="button"
                class="mt-4 inline-flex w-full items-center justify-center rounded-[10px] bg-burning-orange px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-burning-orange/90"
              >
                Claim
              </button>
            </div>

            <div
              class="rounded-[18px] border border-cinnamon-ice/70 bg-white p-4 shadow-[0_6px_18px_rgba(39,45,78,0.04)]"
            >
              <div class="flex min-h-[72px] items-center justify-center text-blue-estate">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 3v18" />
                  <path d="M17 7c0-2-1.8-3-4-3H9v8h5c2.2 0 4 1 4 3s-1.8 3-4 3H7" />
                </svg>
              </div>
              <p class="mt-1 text-[13px] font-semibold text-neutral-800">₱50 Wallet Credit</p>
              <p class="mt-1 text-[15px] font-semibold text-burning-orange">600 pts</p>
              <button
                type="button"
                class="mt-4 inline-flex w-full items-center justify-center rounded-[10px] bg-burning-orange px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-burning-orange/90"
              >
                Claim
              </button>
            </div>
          </div>
        </article>

        <article
          class="rounded-[20px] border border-cinnamon-ice bg-cream p-5 shadow-[0_10px_30px_rgba(39,45,78,0.06)]"
        >
          <h2 class="text-[20px] font-bold text-neutral-800">Boost your Listing!</h2>
          <p class="mt-2 max-w-[344px] text-[18px] leading-7 text-neutral-800/80">
            Boost an item listing to increase its visibility!
          </p>

          <div class="mt-5 grid gap-4 sm:grid-cols-2">
            <div
              class="rounded-[18px] border border-cinnamon-ice/70 bg-white p-4 shadow-[0_6px_18px_rgba(39,45,78,0.04)]"
            >
              <p class="text-[15px] font-bold text-neutral-800">Point Cost</p>
              <p class="mt-1 text-[20px] font-semibold text-burning-orange">
                {{ BOOST_CONFIG.pointsCost }} pts
              </p>
            </div>

            <div
              class="rounded-[18px] border border-cinnamon-ice/70 bg-white p-4 shadow-[0_6px_18px_rgba(39,45,78,0.04)]"
            >
              <p class="text-[15px] font-bold text-neutral-800">Duration</p>
              <p class="mt-1 text-[20px] font-semibold text-neutral-800">
                {{ BOOST_CONFIG.durationHours }} hours
              </p>
            </div>
          </div>

          <NuxtLink
            :to="{ path: '/account/listings', query: { boost: 'true' } }"
            class="mt-5 inline-flex w-full items-center justify-center rounded-[10px] bg-burning-orange px-5 py-3 text-[28px] font-bold leading-none text-white transition-colors hover:bg-burning-orange/90"
          >
            Boost Now!
          </NuxtLink>
        </article>
      </div>
    </section>

    <section class="rounded-[24px] border border-cinnamon-ice bg-cream p-5 sm:p-6">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-lg font-semibold text-neutral-800 sm:text-xl">Active Boosted Listings</h2>
          <p class="mt-1 text-sm leading-6 text-neutral-800/65 sm:text-base">
            Track which listings are currently boosted and how long they have before returning to
            normal priority.
          </p>
        </div>

        <button
          v-if="boostsError"
          type="button"
          class="inline-flex w-fit rounded-full border border-burning-orange px-4 py-2 text-sm font-medium text-burning-orange transition-colors hover:bg-burning-orange hover:text-white"
          @click="refreshBoosts()"
        >
          Retry
        </button>
      </div>

      <div v-if="boostsPending && !activeBoostsResponse" class="mt-5 grid gap-4 lg:grid-cols-2">
        <div
          v-for="index in 2"
          :key="index"
          class="h-40 animate-pulse rounded-[22px] border border-cinnamon-ice/70 bg-white"
        />
      </div>

      <div
        v-else-if="boostsError"
        class="mt-5 rounded-[22px] border border-red-200 bg-white p-5 text-sm text-neutral-800/70"
      >
        We couldn't load your active boosts right now. Your points and listings are still safe.
      </div>

      <div
        v-else-if="activeBoosts.length === 0"
        class="mt-5 rounded-[22px] border border-dashed border-cinnamon-ice/80 bg-white px-5 py-10 text-center sm:px-8"
      >
        <div
          class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-burning-orange/10 text-burning-orange"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M12 3l2.6 5.26L20 9.27l-4 3.9.94 5.45L12 15.9l-4.94 2.72L8 13.17l-4-3.9 5.4-1.01L12 3z"
            />
          </svg>
        </div>
        <h3 class="mt-4 text-lg font-semibold text-neutral-800">No active boosted listings</h3>
        <p class="mt-2 text-sm leading-6 text-neutral-800/60 sm:text-base">
          Use your points to boost one of your listings and increase its visibility.
        </p>
        <NuxtLink
          :to="{ path: '/account/listings', query: { boost: 'true' } }"
          class="mt-5 inline-flex rounded-full bg-burning-orange px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-burning-orange/90"
        >
          Go to My Listings
        </NuxtLink>
      </div>

      <div v-else class="mt-5 grid gap-4 lg:grid-cols-2">
        <article
          v-for="boost in activeBoosts"
          :key="boost.id"
          class="overflow-hidden rounded-[22px] border border-cinnamon-ice/70 bg-white"
        >
          <div class="flex flex-col sm:flex-row">
            <div class="h-40 bg-cream sm:h-auto sm:w-40 sm:min-w-40">
              <img
                v-if="boost.itemImage"
                :src="boost.itemImage"
                :alt="boost.itemName"
                class="h-full w-full object-cover"
              />
              <div
                v-else
                class="flex h-full min-h-40 items-center justify-center px-6 text-center text-sm font-medium text-neutral-800/45"
              >
                No image uploaded
              </div>
            </div>

            <div class="flex flex-1 flex-col p-5">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="text-lg font-semibold text-neutral-800">{{ boost.itemName }}</p>
                  <p class="mt-1 text-sm text-emerald-700">Boost Active</p>
                </div>

                <div
                  class="rounded-full bg-burning-orange/10 px-3 py-1 text-sm font-semibold text-burning-orange"
                >
                  {{ boost.remainingLabel }}
                </div>
              </div>

              <div class="mt-4 grid gap-3 text-sm text-neutral-800/60">
                <div class="rounded-[18px] bg-cream px-4 py-3">
                  <p class="font-medium text-neutral-800">Boost window</p>
                  <p class="mt-1">
                    {{ formatBoostDateTime(boost.boostStartedAt) }} to
                    {{ formatBoostDateTime(boost.boostExpiresAt) }}
                  </p>
                </div>

                <div class="rounded-[18px] border border-cinnamon-ice/70 px-4 py-3">
                  This listing will return to normal priority automatically after the timer runs
                  out.
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
