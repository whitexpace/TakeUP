<script setup lang="ts">
import { computed, ref } from "vue"
import type { LinkedAccount, WalletTransaction } from "~/types/wallet"

const props = withDefaults(
  defineProps<{
    title: string
    subtitle: string
    transactions: WalletTransaction[]
    isBalanceVisible: boolean
    formattedBalance: string
    maskedBalance: string
    linkedAccounts?: LinkedAccount[]
    showLinkedAccounts?: boolean
    allowTopUp?: boolean
    allowWithdraw?: boolean
    activityTitle?: string
    activitySubtitle?: string
    protectionTitle?: string
    protectionMessage?: string
    memberSinceLabel?: string
    readOnlyBadgeLabel?: string | null
    topUpNotice?: string
    onToggleBalance: () => void
    onTopUp?: (amount: number) => Promise<unknown>
  }>(),
  {
    linkedAccounts: () => [],
    showLinkedAccounts: true,
    allowTopUp: true,
    allowWithdraw: true,
    activityTitle: "Recent Activity",
    activitySubtitle: "Track your money flow",
    protectionTitle: "Your funds are protected.",
    protectionMessage:
      "All transactions are secured and monitored. Funds are held safely until transactions are completed.",
    memberSinceLabel: "TakeUP Member since 2026",
    readOnlyBadgeLabel: null,
    topUpNotice: "This is a pseudo top-up for demo purposes. No real money will be charged.",
    onTopUp: undefined,
  },
)

const showTopUpModal = ref(false)
const topUpAmountDisplay = ref("")
const isSubmitting = ref(false)

const gridClass = computed(() => (props.showLinkedAccounts ? "lg:grid-cols-2" : "lg:grid-cols-1"))

const handleAmountInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  let value = target.value.replace(/[^0-9.]/g, "")
  const parts = value.split(".")
  if (parts.length > 2) {
    value = `${parts[0]}.${parts.slice(1).join("")}`
  }
  topUpAmountDisplay.value = value
}

const handleTopUp = async () => {
  if (!props.onTopUp) {
    return
  }

  const amount = parseFloat(topUpAmountDisplay.value)
  if (Number.isNaN(amount) || amount <= 0) {
    return
  }

  isSubmitting.value = true
  try {
    await props.onTopUp(amount)
    showTopUpModal.value = false
    topUpAmountDisplay.value = ""
  } finally {
    isSubmitting.value = false
  }
}

const formatDate = (date: string | Date) =>
  new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))

const getTransactionLabel = (transaction: WalletTransaction) => {
  switch (transaction.type) {
    case "TOP_UP":
      return "Top Up"
    case "REFUND":
      return "Refund"
    case "EARNING":
      return "Earnings"
    case "COMMISSION":
      return "Commission"
    case "ADJUSTMENT":
      return "Adjustment"
    default:
      return "Payment"
  }
}
</script>

<template>
  <div class="space-y-6 font-geist">
    <section class="space-y-3">
      <div class="space-y-2">
        <h1 class="text-[28px] font-semibold text-noble-black">{{ title }}</h1>
        <div class="w-10 h-0.5 bg-burning-orange"></div>
      </div>
      <p class="text-[16px] font-medium text-noble-black/50">
        {{ subtitle }}
      </p>
    </section>

    <!-- Centered Card Container -->
    <div class="flex justify-center w-full">
      <!-- Premium Wallet Card -->
      <div
        class="rounded-[24px] p-8 text-white relative overflow-hidden shadow-2xl min-h-[180px] sm:min-h-[210px] w-full max-w-[540px] flex flex-col justify-between aspect-[1.586/1] max-h-[320px]"
        style="background: linear-gradient(135deg, #1a2340 0%, #2d3f6b 50%, #1e3a5f 100%)"
      >
        <!-- Top Right Glow -->
        <div
          class="absolute -top-10 -right-10 w-64 h-64 bg-[radial-gradient(circle,rgba(232,101,10,0.15),transparent_70%)] pointer-events-none"
        ></div>

        <!-- Geometric Pattern Overlay -->
        <div
          class="absolute inset-0 opacity-[0.04] pointer-events-none"
          style="
            background-image: radial-gradient(#ffffff 1px, transparent 1px);
            background-size: 20px 20px;
          "
        ></div>

        <div class="flex justify-end items-start relative z-10">
          <div class="text-right">
            <h3 class="text-[10px] font-bold uppercase tracking-[4px] opacity-70">
              TakeUP {{ readOnlyBadgeLabel || "Digital Wallet" }}
            </h3>
          </div>
        </div>

        <div class="relative z-10 py-4">
          <p class="text-white/50 text-[10px] font-semibold uppercase tracking-[3px] mb-2">
            Available Balance
          </p>
          <div class="flex items-center gap-4">
            <div class="relative overflow-hidden min-h-[58px] flex items-center">
              <Transition name="fade-slide" mode="out-in">
                <h2
                  :key="isBalanceVisible ? 'visible' : 'hidden'"
                  class="text-4xl sm:text-[48px] font-extrabold font-geist tracking-[-1px] leading-none"
                >
                  {{ isBalanceVisible ? formattedBalance : "••••••" }}
                </h2>
              </Transition>
            </div>
            <button
              class="p-2 hover:bg-white/10 rounded-full transition-colors shrink-0"
              title="Toggle Balance Visibility"
              @click="onToggleBalance"
            >
              <svg
                v-if="isBalanceVisible"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <svg
                v-else
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
                />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            </button>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-6 relative z-10">
          <div class="text-[10px] font-mono opacity-50 tracking-widest uppercase">
            {{ memberSinceLabel }}
          </div>
          <div v-if="allowTopUp || allowWithdraw" class="flex items-center gap-3">
            <button
              v-if="allowTopUp"
              class="px-8 py-3 bg-white text-blue-estate font-bold rounded-2xl hover:bg-white/90 transition-all shadow-lg active:scale-95"
              @click="showTopUpModal = true"
            >
              Top Up
            </button>
            <button
              v-if="allowWithdraw"
              class="px-8 py-2.5 bg-white/10 text-white border-[1.5px] border-white/40 font-semibold rounded-[12px] hover:bg-white/20 transition-all active:scale-95 backdrop-blur-sm"
            >
              Withdraw
            </button>
          </div>
        </div>

        <div class="absolute -right-20 -top-20 w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>
        <div
          class="absolute -left-10 -bottom-10 w-40 h-40 bg-blue-400/10 rounded-full blur-2xl"
        ></div>
        <div
          class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"
        ></div>
      </div>
    </div>

    <!-- Protection Notice -->
    <div class="flex justify-center px-2">
      <div class="inline-flex items-start sm:items-center gap-3 max-w-full">
        <div class="text-burning-orange shrink-0 mt-0.5 sm:mt-0">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <p class="text-[13px] font-medium text-noble-black/70 leading-relaxed">
          <span class="font-bold text-noble-black">{{ protectionTitle }}</span>
          <span class="mx-2 text-noble-black/20 select-none hidden sm:inline">·</span>
          <span class="opacity-90 block sm:inline">{{ protectionMessage }}</span>
        </p>
      </div>
    </div>

    <!-- Grid Content -->
    <div class="grid grid-cols-1 gap-8" :class="gridClass">
      <!-- Linked Accounts -->
      <div
        v-if="showLinkedAccounts"
        class="bg-cream rounded-[24px] border border-cinnamon-ice/20 p-8 space-y-8 flex flex-col h-full shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
      >
        <div class="border-l-[3px] border-burning-orange pl-4">
          <h3 class="text-[20px] font-bold text-noble-black font-geist">Linked Accounts</h3>
          <p class="mt-0.5 text-[13px] font-medium text-noble-black/50">
            Manage your payment methods
          </p>
        </div>
        <div class="space-y-4 flex-1">
          <div
            v-for="account in linkedAccounts"
            :key="account.id"
            class="group flex items-center justify-between p-4 bg-white rounded-[14px] border border-neutral-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-300 hover:shadow-md border-l-[3px] border-l-wahoo"
          >
            <div class="flex items-center gap-4">
              <div class="min-w-0">
                <p class="font-bold text-noble-black text-[16px] leading-tight capitalize">
                  {{ account.type.toLowerCase() }}
                </p>
                <p class="text-[13px] text-noble-black/40 mt-1.5 font-medium truncate">
                  {{ account.accountNumber }}
                </p>
              </div>
            </div>
            <button
              class="p-2 text-noble-black/30 hover:text-noble-black hover:bg-neutral-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </button>
          </div>
        </div>
        <button
          class="w-full py-4 border-2 border-dashed border-burning-orange/30 text-burning-orange rounded-[14px] font-bold hover:bg-burning-orange/5 hover:border-burning-orange transition-all flex items-center justify-center gap-3 text-[16px] active:scale-[0.98]"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Payment Method
        </button>
      </div>

      <!-- Recent Activity -->
      <div
        class="bg-cream rounded-[24px] border border-cinnamon-ice/20 p-8 space-y-8 flex flex-col h-full shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
      >
        <div class="border-l-[3px] border-burning-orange pl-4">
          <h3 class="text-[20px] font-bold text-noble-black font-geist">{{ activityTitle }}</h3>
          <p class="mt-0.5 text-[13px] font-medium text-noble-black/50">{{ activitySubtitle }}</p>
        </div>
        <div class="space-y-0 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          <div
            v-for="tx in transactions"
            :key="tx.id"
            class="flex items-center justify-between py-4 border-b border-neutral-100 last:border-0"
          >
            <div class="flex items-center gap-4">
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                :class="
                  tx.direction === 'CREDIT'
                    ? 'bg-success-green/10 text-success-green'
                    : 'bg-cinnabar-red/10 text-cinnabar-red'
                "
              >
                <svg
                  v-if="tx.direction === 'CREDIT'"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
                <svg
                  v-else
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
              </div>
              <div class="min-w-0">
                <p class="font-semibold text-noble-black text-[15px] leading-tight">
                  {{ getTransactionLabel(tx) }}
                </p>
                <div class="mt-1 flex flex-col gap-0.5">
                  <p class="text-[12px] text-noble-black/40 font-medium">
                    {{ formatDate(tx.createdAt) }}
                  </p>
                  <p class="text-[11px] text-noble-black/30 font-mono tracking-tight">
                    {{ tx.referenceCode }}
                  </p>
                </div>
              </div>
            </div>
            <div class="text-right shrink-0">
              <p
                class="font-bold text-[16px]"
                :class="tx.direction === 'CREDIT' ? 'text-success-green' : 'text-cinnabar-red'"
              >
                {{ tx.direction === "CREDIT" ? "+" : "-" }}₱{{
                  Number(tx.amount.toString()).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })
                }}
              </p>
            </div>
          </div>
          <div v-if="transactions.length === 0" class="text-center py-12">
            <div
              class="w-12 h-12 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-3"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                class="text-noble-black/20"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <p class="text-[14px] text-noble-black/40 font-medium tracking-wide">
              No transactions yet.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Top Up Modal -->
    <Teleport to="body">
      <div
        v-if="allowTopUp && showTopUpModal"
        class="fixed inset-0 z-[2000] flex items-center justify-center p-4 font-geist"
      >
        <div
          class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm"
          @click="showTopUpModal = false"
        ></div>
        <div
          class="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-[20px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.15)] overflow-hidden"
        >
          <!-- Header -->
          <div class="px-6 pt-8 pb-4 flex items-start justify-between gap-4 shrink-0">
            <div>
              <h2 class="text-[24px] font-bold text-noble-black">Top Up Wallet</h2>
              <p class="mt-1 text-[13px] font-medium text-noble-black/40">
                Add funds to your digital balance.
              </p>
            </div>
            <button
              type="button"
              class="flex h-10 w-10 items-center justify-center rounded-full text-noble-black transition hover:bg-gray-100"
              @click="showTopUpModal = false"
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

          <!-- Content -->
          <div class="flex-1 overflow-y-auto custom-modal-scrollbar px-6">
            <div class="py-6">
              <div class="bg-burning-orange/5 p-4 rounded-[16px] mb-8 flex items-start gap-3">
                <svg
                  class="text-burning-orange mt-0.5 shrink-0"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <p class="text-[13px] font-medium text-burning-orange/80 leading-relaxed">
                  {{ topUpNotice }}
                </p>
              </div>

              <div class="space-y-6 pb-8">
                <!-- Amount Input -->
                <div class="relative group">
                  <div
                    class="absolute left-4 top-[18px] text-noble-black/40 group-focus-within:text-burning-orange transition-colors duration-300"
                  >
                    <span class="text-[18px] font-bold">₱</span>
                  </div>
                  <input
                    id="top-up-amount"
                    v-model="topUpAmountDisplay"
                    type="text"
                    inputmode="decimal"
                    placeholder=" "
                    class="peer w-full pl-12 pr-4 pt-6 pb-2 border-[1.5px] border-gray-200 rounded-[10px] bg-white focus:border-burning-orange focus:shadow-[0_0_0_3px_rgba(232,101,10,0.1)] outline-none text-[18px] font-bold text-noble-black transition-all duration-300"
                    @input="handleAmountInput"
                  />
                  <label
                    for="top-up-amount"
                    class="absolute left-12 top-4 text-noble-black/40 text-[15px] transition-all duration-300 pointer-events-none peer-placeholder-shown:top-4 peer-placeholder-shown:text-[15px] peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-burning-orange peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[11px]"
                    >Enter Amount (PHP)</label
                  >
                </div>

                <!-- Quick Select -->
                <div class="grid grid-cols-3 gap-3">
                  <button
                    v-for="amount in [500, 1000, 2000]"
                    :key="amount"
                    type="button"
                    class="py-3 rounded-[10px] bg-cream hover:bg-pale-cashmere/30 border border-cinnamon-ice/20 font-bold text-noble-black/70 transition-all active:scale-[0.98]"
                    @click="topUpAmountDisplay = amount.toString()"
                  >
                    ₱{{ amount.toLocaleString() }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-5 border-t border-cinnamon-ice/10 bg-white flex gap-3 shrink-0">
            <button
              type="button"
              class="flex-1 h-12 items-center justify-center rounded-[10px] border-[1.5px] border-burning-orange bg-white text-[15px] font-bold text-burning-orange transition-all duration-200 hover:bg-burning-orange/5"
              @click="showTopUpModal = false"
            >
              Cancel
            </button>
            <button
              type="button"
              class="flex-1 h-12 items-center justify-center rounded-[10px] bg-gradient-to-br from-burning-orange to-orange-500 text-[15px] font-bold text-white transition-all duration-300 shadow-lg shadow-burning-orange/35 hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              :disabled="isSubmitting || !topUpAmountDisplay"
              @click="handleTopUp"
            >
              {{ isSubmitting ? "Processing..." : "Confirm Top Up" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: theme("colors.cinnamon-ice / 40%");
  border-radius: 20px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: theme("colors.cinnamon-ice / 60%");
}
</style>
