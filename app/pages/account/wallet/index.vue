<script setup lang="ts">
import { useWallet } from "~/composables/use-wallet"
import { ref } from "vue"

definePageMeta({
  layout: "account",
  middleware: "account-auth",
})

const {
  transactions,
  isBalanceVisible,
  linkedAccounts,
  toggleBalanceVisibility,
  topUpPseudo,
  formattedBalance,
  maskedBalance,
} = useWallet()

const showTopUpModal = ref(false)
const topUpAmountDisplay = ref("")
const isSubmitting = ref(false)

const handleAmountInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  // Remove any non-numeric characters except for one decimal point
  let val = target.value.replace(/[^0-9.]/g, "")
  const parts = val.split(".")
  if (parts.length > 2) {
    val = parts[0] + "." + parts.slice(1).join("")
  }
  topUpAmountDisplay.value = val
}

const handleTopUp = async () => {
  const amount = parseFloat(topUpAmountDisplay.value)
  if (isNaN(amount) || amount <= 0) return

  isSubmitting.value = true
  try {
    await topUpPseudo(amount)
    showTopUpModal.value = false
    topUpAmountDisplay.value = ""
  } finally {
    isSubmitting.value = false
  }
}

const formatDate = (date: string | Date) => {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}
</script>

<template>
  <div class="space-y-8 font-geist pb-12">
    <!-- Header -->
    <div>
      <h1 class="text-neutral-800 text-xl sm:text-2xl font-bold">My Wallet</h1>
      <p class="text-neutral-600 text-base sm:text-lg tracking-wide mt-1">
        Manage your TakeUP wallet balance and linked accounts
      </p>
    </div>

    <!-- Wallet Card -->
    <div
      class="rounded-[32px] p-10 text-white relative overflow-hidden shadow-2xl min-h-[280px] flex flex-col justify-between"
      style="background: linear-gradient(135deg, #3b4883 0%, #272d4e 100%)"
    >
      <!-- Card Top: Brand -->
      <div class="flex justify-end items-start relative z-10">
        <div class="text-right">
          <h3 class="text-2xl font-black italic tracking-tighter font-rewon opacity-90">TakeUP</h3>
          <p class="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60 -mt-1">
            Digital Wallet
          </p>
        </div>
      </div>

      <!-- Card Middle: Balance -->
      <div class="relative z-10 py-4">
        <p class="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">
          Available Balance
        </p>
        <div class="flex items-center gap-4">
          <h2 class="text-4xl sm:text-5xl font-bold font-geist tracking-tight">
            {{ isBalanceVisible ? formattedBalance : maskedBalance }}
          </h2>
          <button
            class="p-2 hover:bg-white/10 rounded-full transition-colors"
            title="Toggle Balance Visibility"
            @click="toggleBalanceVisibility"
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

      <!-- Card Bottom: Actions & Footer -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-6 relative z-10">
        <div class="text-[10px] font-mono opacity-50 tracking-widest uppercase">
          TakeUP Member since 2026
        </div>
        <div class="flex items-center gap-3">
          <button
            class="px-8 py-3 bg-white text-blue-estate font-bold rounded-2xl hover:bg-white/90 transition-all shadow-lg active:scale-95"
            @click="showTopUpModal = true"
          >
            Top Up
          </button>
          <button
            class="px-8 py-3 bg-white/10 text-white border border-white/20 font-bold rounded-2xl hover:bg-white/20 transition-all active:scale-95 backdrop-blur-sm"
          >
            Withdraw
          </button>
        </div>
      </div>

      <!-- Decorative abstract shapes -->
      <div class="absolute -right-20 -top-20 w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>
      <div
        class="absolute -left-10 -bottom-10 w-40 h-40 bg-blue-400/10 rounded-full blur-2xl"
      ></div>
      <div
        class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"
      ></div>
    </div>

    <!-- Protection Message -->
    <div class="flex items-start gap-3 px-2 py-1">
      <div class="mt-1 text-burning-orange">
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
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </div>
      <div class="space-y-0.5">
        <h3 class="text-sm font-bold text-neutral-800/80">Your funds are protected.</h3>
        <p class="text-xs text-neutral-500 max-w-2xl leading-relaxed">
          All transactions are secured and monitored. Funds are held safely until transactions are
          completed.
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Linked Accounts -->
      <div
        class="bg-cream rounded-[32px] border border-cinnamon-ice p-8 space-y-8 flex flex-col h-full"
      >
        <div>
          <h3 class="text-2xl font-bold text-neutral-800 font-geist">Linked Accounts</h3>
          <p class="text-neutral-600 text-base mt-1">Manage your payment methods</p>
        </div>

        <div class="space-y-4 flex-1">
          <div
            v-for="account in linkedAccounts"
            :key="account.id"
            class="flex items-center justify-between p-5 bg-white rounded-3xl border border-neutral-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
          >
            <div class="flex items-center gap-4">
              <div
                class="w-14 h-14 rounded-2xl bg-neutral-50 flex items-center justify-center p-2.5 border border-neutral-100"
              >
                <div
                  v-if="account.type === 'GCASH'"
                  class="w-full h-full flex flex-col items-center justify-center"
                >
                  <span class="text-[10px] font-black text-blue-estate">G</span>
                  <span class="text-[10px] font-black text-blue-estate -mt-2">CASH</span>
                </div>
                <div
                  v-else-if="account.type === 'MAYA'"
                  class="text-[10px] font-black text-success-green"
                >
                  MAYA
                </div>
                <div v-else class="text-[10px] font-bold text-neutral-400">{{ account.type }}</div>
              </div>
              <div>
                <p class="font-bold text-neutral-800 text-lg leading-none capitalize">
                  {{ account.type.toLowerCase() }}
                </p>
                <p class="text-sm text-neutral-500 mt-1 font-medium">{{ account.accountNumber }}</p>
              </div>
            </div>
            <button
              class="p-2 text-neutral-300 hover:text-neutral-500 hover:bg-neutral-50 rounded-xl transition-all"
            >
              <svg
                width="24"
                height="24"
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
          class="w-full py-4 bg-burning-orange text-white rounded-3xl font-bold hover:bg-burning-orange/90 transition-all shadow-lg shadow-burning-orange/10 flex items-center justify-center gap-3 text-lg active:scale-[0.98]"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Payment Method
        </button>
      </div>

      <!-- Recent Transactions -->
      <div
        class="bg-cream rounded-[32px] border border-cinnamon-ice p-8 space-y-8 flex flex-col h-full"
      >
        <div>
          <h3 class="text-2xl font-bold text-neutral-800 font-geist">Recent Activity</h3>
          <p class="text-neutral-600 text-base mt-1">Track your money flow</p>
        </div>

        <div class="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          <div
            v-for="tx in transactions"
            :key="tx.id"
            class="flex items-center justify-between py-3 border-b border-cinnamon-ice/30 last:border-0"
          >
            <div class="flex items-center gap-4">
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                :class="
                  tx.direction === 'CREDIT'
                    ? 'bg-success-green/10 text-success-green'
                    : 'bg-neutral-100 text-neutral-400'
                "
              >
                <svg
                  v-if="tx.direction === 'CREDIT'"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
                <svg
                  v-else
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
              </div>
              <div>
                <p class="font-bold text-neutral-800">
                  {{
                    tx.type === "TOP_UP"
                      ? "Top Up"
                      : tx.type === "REFUND"
                        ? "Refund"
                        : tx.type === "EARNING"
                          ? "Earnings"
                          : "Payment"
                  }}
                </p>
                <p class="text-xs text-neutral-500">{{ formatDate(tx.createdAt) }}</p>
              </div>
            </div>
            <div class="text-right">
              <p
                class="font-bold"
                :class="tx.direction === 'CREDIT' ? 'text-success-green' : 'text-neutral-800'"
              >
                {{ tx.direction === "CREDIT" ? "+" : "-" }} ₱{{
                  Number(tx.amount.toString()).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })
                }}
              </p>
              <p class="text-[10px] text-neutral-400 font-mono">{{ tx.referenceCode }}</p>
            </div>
          </div>

          <div v-if="transactions.length === 0" class="text-center py-8 text-neutral-400">
            No transactions yet.
          </div>
        </div>
      </div>
    </div>

    <!-- Top Up Modal (Pseudo) -->
    <Teleport to="body">
      <div
        v-if="showTopUpModal"
        class="fixed inset-0 z-[2000] flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
          @click="showTopUpModal = false"
        ></div>

        <div
          class="bg-white rounded-[32px] w-full max-w-md p-8 relative z-10 shadow-2xl animate-in fade-in zoom-in duration-300"
        >
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-2xl font-bold text-neutral-800 font-geist">Top Up Wallet</h3>
            <button class="text-neutral-400 hover:text-neutral-600" @click="showTopUpModal = false">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div class="bg-blue-estate/5 p-4 rounded-2xl mb-6 flex items-start gap-3">
            <svg
              class="text-blue-estate mt-0.5"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <p class="text-sm text-blue-estate/80 leading-relaxed">
              This is a <strong>pseudo top-up</strong> for demo purposes. No real money will be
              charged.
            </p>
          </div>

          <div class="space-y-4">
            <div class="space-y-2">
              <label class="text-sm font-bold text-neutral-700 ml-1">Amount (PHP)</label>
              <div class="relative">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold"
                  >₱</span
                >
                <input
                  v-model="topUpAmountDisplay"
                  type="text"
                  inputmode="decimal"
                  placeholder="0.00"
                  class="w-full pl-8 pr-4 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-blue-estate/20 focus:border-blue-estate outline-none transition-all font-bold text-lg"
                  autofocus
                  @input="handleAmountInput"
                />
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="amount in [500, 1000, 2000]"
                :key="amount"
                class="py-2 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-50 active:scale-95 transition-all"
                @click="topUpAmountDisplay = amount.toString()"
              >
                +{{ amount }}
              </button>
            </div>

            <button
              :disabled="isSubmitting || !topUpAmountDisplay || parseFloat(topUpAmountDisplay) <= 0"
              class="w-full py-4 bg-blue-estate text-white font-bold rounded-2xl hover:bg-blue-estate/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 mt-4"
              @click="handleTopUp"
            >
              <svg
                v-if="isSubmitting"
                class="animate-spin"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
              >
                <path
                  d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                />
              </svg>
              {{ isSubmitting ? "Processing..." : "Confirm Top Up" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #d1d5db;
}

/* Animations */
.animate-in {
  animation: fadeIn 0.3s ease-out;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
