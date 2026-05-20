<script setup lang="ts">
import { computed, ref, watch } from "vue"
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
    isActivityLoading?: boolean
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
    withdrawNotice?: string
    gradient?: string
    isSystemWallet?: boolean
    balance?: number
    onToggleBalance: () => void
    onTopUp?: (amount: number) => Promise<unknown>
    onWithdraw?: (amount: number) => Promise<unknown>
  }>(),
  {
    linkedAccounts: () => [],
    isActivityLoading: false,
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
    withdrawNotice:
      "This is a pseudo withdrawal for demo purposes. No real money will be transferred.",
    gradient: "linear-gradient(135deg, #1a2340 0%, #2d3f6b 50%, #1e3a5f 100%)",
    isSystemWallet: false,
    balance: 0,
    onTopUp: undefined,
    onWithdraw: undefined,
  },
)

const TRANSACTION_PAGE_SIZE = 10

const showTopUpModal = ref(false)
const topUpAmountDisplay = ref("")
const showWithdrawModal = ref(false)
const withdrawAmountDisplay = ref("")
const isSubmitting = ref(false)
const transactionPage = ref(1)

const topUpAmount = computed(() => {
  const val = parseFloat(topUpAmountDisplay.value)
  return Number.isNaN(val) ? 0 : val
})

const withdrawAmount = computed(() => {
  const val = parseFloat(withdrawAmountDisplay.value)
  return Number.isNaN(val) ? 0 : val
})

const isTopUpInvalid = computed(() => {
  return topUpAmountDisplay.value.trim() !== "" && topUpAmount.value <= 0
})

const isWithdrawInvalid = computed(() => {
  return withdrawAmountDisplay.value.trim() !== "" && withdrawAmount.value <= 0
})

const isWithdrawExceedsBalance = computed(() => {
  return withdrawAmount.value > props.balance
})

const gridClass = computed(() => (props.showLinkedAccounts ? "lg:grid-cols-2" : "lg:grid-cols-1"))
const transactionPageCount = computed(() =>
  Math.max(1, Math.ceil(props.transactions.length / TRANSACTION_PAGE_SIZE)),
)
const transactionPageStart = computed(() => (transactionPage.value - 1) * TRANSACTION_PAGE_SIZE)
const transactionPageEnd = computed(() =>
  Math.min(transactionPageStart.value + TRANSACTION_PAGE_SIZE, props.transactions.length),
)
const visibleTransactions = computed(() =>
  props.transactions.slice(transactionPageStart.value, transactionPageEnd.value),
)
const transactionRangeLabel = computed(() =>
  props.transactions.length === 0
    ? ""
    : `${transactionPageStart.value + 1}-${transactionPageEnd.value} of ${props.transactions.length}`,
)
const hasPreviousTransactionPage = computed(() => transactionPage.value > 1)
const hasNextTransactionPage = computed(() => transactionPage.value < transactionPageCount.value)

const setTransactionPage = (page: number) => {
  transactionPage.value = Math.min(Math.max(1, page), transactionPageCount.value)
}

watch(
  () => props.transactions.length,
  () => {
    setTransactionPage(transactionPage.value)
  },
)

const handleAmountInput = (event: Event, type: "topup" | "withdraw" = "topup") => {
  const target = event.target as HTMLInputElement
  let value = target.value.replace(/[^0-9.]/g, "")
  const parts = value.split(".")
  if (parts.length > 2) {
    value = `${parts[0]}.${parts.slice(1).join("")}`
  }
  if (type === "topup") {
    topUpAmountDisplay.value = value
  } else {
    withdrawAmountDisplay.value = value
  }
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

const handleWithdraw = async () => {
  if (!props.onWithdraw) {
    return
  }

  const amount = parseFloat(withdrawAmountDisplay.value)
  if (Number.isNaN(amount) || amount <= 0) {
    return
  }

  isSubmitting.value = true
  try {
    await props.onWithdraw(amount)
    showWithdrawModal.value = false
    withdrawAmountDisplay.value = ""
  } catch (error: unknown) {
    // Basic error handling for UI (e.g., insufficient funds)
    const err = error as { data?: { message?: string } }
    alert(err?.data?.message || "Withdrawal failed. Please check your balance.")
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
      return "Withdrawal"
    default:
      return "Payment"
  }
}
</script>

<template>
  <div class="space-y-6 font-geist">
    <section class="space-y-3">
      <div class="space-y-2">
        <h1 class="font-geist text-[36px] font-medium text-noble-black tracking-tight">
          {{ title }}
        </h1>
        <div class="w-10 h-0.5 bg-burning-orange"></div>
      </div>
      <p class="text-[16px] font-light text-noble-black/50">
        {{ subtitle }}
      </p>
    </section>

    <!-- Centered Card Container -->
    <div class="flex justify-center w-full">
      <!-- Premium Wallet Card -->
      <div
        class="rounded-[24px] p-8 text-white relative overflow-hidden shadow-2xl min-h-[180px] sm:min-h-[210px] w-full max-w-[540px] flex flex-col justify-between aspect-[1.586/1] max-h-[320px]"
        :style="{ background: gradient }"
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
            <h3
              v-if="isSystemWallet"
              class="text-[10px] font-bold uppercase tracking-[3px] text-white/40"
            >
              TAKEUP READ ONLY
            </h3>
            <h3 v-else class="text-[10px] font-bold uppercase tracking-[4px] opacity-70">
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
            <div class="flex items-center gap-2">
              <button
                class="flex h-10 w-10 items-center justify-center hover:bg-white/10 rounded-full transition-colors shrink-0"
                title="Toggle Balance Visibility"
                @click="onToggleBalance"
              >
                <Icon v-if="isBalanceVisible" name="ph:eye" class="w-6 h-6 shrink-0" />
                <Icon v-else name="ph:eye-slash" class="w-6 h-6 shrink-0" />
              </button>
              <Icon v-if="isSystemWallet" name="ph:lock-simple" class="w-5 h-5 text-white/40" />
            </div>
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
              @click="showWithdrawModal = true"
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
      <div
        v-if="isSystemWallet"
        class="flex items-center gap-3 rounded-[10px] border border-blue-200 bg-blue-50 px-4 py-3 w-full max-w-[760px]"
      >
        <div class="text-blue-700 shrink-0">
          <Icon name="ph:shield-check" class="w-[18px] h-[18px]" />
        </div>
        <p class="text-[13px] leading-relaxed">
          <span class="font-bold text-blue-900">{{ protectionTitle }}</span>
          <span class="mx-2 text-blue-300 select-none">·</span>
          <span class="text-blue-500">{{ protectionMessage }}</span>
        </p>
      </div>

      <div v-else class="inline-flex items-start sm:items-center gap-3 max-w-full">
        <div class="text-burning-orange shrink-0 mt-0.5 sm:mt-0">
          <Icon name="ph:shield-check" class="w-[18px] h-[18px]" />
        </div>
        <p class="text-[13px] font-light text-noble-black/50 leading-relaxed">
          <span class="font-semibold text-noble-black">{{ protectionTitle }}</span>
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
          <h3 class="text-[20px] font-semibold text-noble-black font-geist">Linked Accounts</h3>
          <p class="mt-0.5 text-[13px] font-light text-noble-black/50">
            Manage your payment methods
          </p>
        </div>
        <div class="space-y-4 flex-1">
          <div
            v-for="account in linkedAccounts"
            :key="account.id"
            class="group flex items-center justify-between p-4 bg-white rounded-[14px] border border-neutral-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-300 hover:shadow-md"
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
              class="flex h-9 w-9 items-center justify-center text-noble-black/30 hover:text-noble-black hover:bg-neutral-50 rounded-lg transition-all"
            >
              <Icon name="ph:dots-three-vertical" class="w-5 h-5 shrink-0" />
            </button>
          </div>
        </div>
        <button
          class="w-full py-4 border-2 border-dashed border-burning-orange/30 text-burning-orange rounded-[14px] font-bold hover:bg-burning-orange/5 hover:border-burning-orange transition-all flex items-center justify-center gap-3 text-[16px] active:scale-[0.98]"
        >
          <Icon name="ph:plus" class="w-5 h-5" />
          Add Payment Method
        </button>
      </div>

      <!-- Recent Activity / Commission Activity -->
      <div
        class="rounded-[24px] p-8 space-y-8 flex flex-col h-full shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
        :class="
          isSystemWallet
            ? 'bg-white border border-gray-100 rounded-[16px]'
            : 'bg-cream border border-cinnamon-ice/20'
        "
      >
        <div class="border-l-[3px] border-burning-orange pl-4">
          <h3 class="text-[20px] font-semibold text-noble-black font-geist">{{ activityTitle }}</h3>
          <p class="mt-0.5 text-[13px] font-light text-noble-black/50">{{ activitySubtitle }}</p>
        </div>

        <div v-if="isActivityLoading" class="flex-1 space-y-0">
          <div
            v-for="index in 4"
            :key="index"
            class="flex items-center justify-between py-4 border-b border-neutral-100 last:border-0"
          >
            <div class="flex items-center gap-4 min-w-0 flex-1">
              <div class="w-10 h-10 rounded-full bg-neutral-200/70 animate-pulse shrink-0"></div>
              <div class="min-w-0 flex-1 space-y-2">
                <div class="h-3.5 w-28 rounded bg-neutral-200/70 animate-pulse"></div>
                <div class="h-3 w-36 rounded bg-neutral-200/50 animate-pulse"></div>
              </div>
            </div>
            <div class="h-4 w-20 rounded bg-neutral-200/70 animate-pulse"></div>
          </div>
        </div>

        <div
          v-else-if="transactions.length === 0"
          class="flex-1 flex flex-col items-center justify-center py-12 text-center"
        >
          <div class="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Icon name="ph:currency-circle-dollar" class="w-6 h-6 text-gray-400" />
          </div>
          <p class="text-[15px] font-semibold text-gray-400">
            {{ isSystemWallet ? "No commission activity yet" : "No transactions yet" }}
          </p>
          <p v-if="isSystemWallet" class="mt-1 text-[13px] text-gray-400 max-w-[280px]">
            Commission is collected automatically from completed wallet transactions.
          </p>
        </div>

        <div v-else class="flex-1 overflow-x-auto">
          <table v-if="isSystemWallet" class="w-full text-left">
            <thead>
              <tr class="border-b border-gray-50 bg-gray-50/50">
                <th
                  class="px-4 py-3 text-[11px] font-medium uppercase tracking-[1px] text-gray-400"
                >
                  Date
                </th>
                <th
                  class="px-4 py-3 text-[11px] font-medium uppercase tracking-[1px] text-gray-400"
                >
                  Transaction ID
                </th>
                <th
                  class="px-4 py-3 text-[11px] font-medium uppercase tracking-[1px] text-gray-400"
                >
                  Source
                </th>
                <th
                  class="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[1px] text-gray-400"
                >
                  Amount
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr
                v-for="tx in visibleTransactions"
                :key="tx.id"
                class="h-[56px] hover:bg-gray-50/50 transition-colors"
              >
                <td class="px-4 py-2 text-[13px] text-gray-500">{{ formatDate(tx.createdAt) }}</td>
                <td class="px-4 py-2 font-mono text-[12px] text-gray-400">
                  {{ tx.referenceCode }}
                </td>
                <td class="px-4 py-2 text-[14px] font-medium text-gray-900">
                  {{ getTransactionLabel(tx) }}
                </td>
                <td class="px-4 py-2 text-right text-[15px] font-bold text-success-green">
                  +₱{{
                    Number(tx.amount.toString()).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })
                  }}
                </td>
              </tr>
            </tbody>
          </table>

          <div v-else class="space-y-0 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            <div
              v-for="tx in visibleTransactions"
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
                  <Icon
                    v-if="tx.direction === 'CREDIT'"
                    name="ph:arrow-up-right"
                    class="w-[18px] h-[18px]"
                  />
                  <Icon v-else name="ph:arrow-down-left" class="w-[18px] h-[18px]" />
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
          </div>

          <div
            v-if="transactions.length > TRANSACTION_PAGE_SIZE"
            class="mt-5 flex flex-col gap-3 border-t border-noble-black/5 pt-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p class="text-[12px] font-medium text-noble-black/40">
              Showing {{ transactionRangeLabel }}
            </p>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="h-8 w-8 rounded-lg border border-cinnamon-ice/20 text-noble-black/50 transition-colors hover:border-burning-orange hover:text-burning-orange disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-cinnamon-ice/20 disabled:hover:text-noble-black/50"
                :disabled="!hasPreviousTransactionPage"
                aria-label="Previous transaction page"
                @click="setTransactionPage(transactionPage - 1)"
              >
                <Icon name="ph:caret-left" class="mx-auto h-4 w-4" />
              </button>
              <span class="text-[12px] font-semibold text-noble-black/50">
                {{ transactionPage }} / {{ transactionPageCount }}
              </span>
              <button
                type="button"
                class="h-8 w-8 rounded-lg border border-cinnamon-ice/20 text-noble-black/50 transition-colors hover:border-burning-orange hover:text-burning-orange disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-cinnamon-ice/20 disabled:hover:text-noble-black/50"
                :disabled="!hasNextTransactionPage"
                aria-label="Next transaction page"
                @click="setTransactionPage(transactionPage + 1)"
              >
                <Icon name="ph:caret-right" class="mx-auto h-4 w-4" />
              </button>
            </div>
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
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-noble-black transition hover:bg-gray-100"
              @click="showTopUpModal = false"
            >
              <Icon name="ph:x" class="w-5 h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto custom-modal-scrollbar px-6">
            <div class="py-6">
              <div class="bg-burning-orange/5 p-4 rounded-[16px] mb-8 flex items-start gap-3">
                <Icon
                  name="ph:info"
                  class="text-burning-orange mt-0.5 shrink-0 w-[18px] h-[18px]"
                />
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
                    :class="{
                      'border-cinnabar-red focus:border-cinnabar-red focus:shadow-[0_0_0_3px_rgba(224,53,49,0.1)]':
                        isTopUpInvalid,
                    }"
                    @input="handleAmountInput($event, 'topup')"
                  />
                  <label
                    for="top-up-amount"
                    class="absolute left-12 top-[18px] text-noble-black/40 text-[15px] transition-all duration-300 pointer-events-none peer-placeholder-shown:top-[18px] peer-placeholder-shown:text-[15px] peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-burning-orange peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[11px]"
                    :class="{ 'peer-focus:text-cinnabar-red': isTopUpInvalid }"
                    >Enter Amount (PHP)</label
                  >
                </div>

                <div v-if="isTopUpInvalid" class="flex items-center gap-1.5 text-cinnabar-red mt-1">
                  <Icon name="ph:warning-circle" class="w-4 h-4" />
                  <p class="text-[12px] font-medium">Please enter an amount greater than 0.</p>
                </div>

                <!-- Quick Select -->
                <div class="grid grid-cols-3 gap-3">
                  <button
                    v-for="amount in [500, 1000, 2000]"
                    :key="amount"
                    type="button"
                    class="py-3 rounded-[12px] bg-white border border-gray-100 font-bold text-noble-black/60 shadow-sm transition-all hover:border-burning-orange/30 hover:bg-burning-orange/[0.02] hover:text-burning-orange active:scale-[0.98]"
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
              :disabled="isSubmitting || !topUpAmountDisplay || isTopUpInvalid"
              @click="handleTopUp"
            >
              {{ isSubmitting ? "Processing..." : "Confirm Top Up" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Withdraw Modal -->
    <Teleport to="body">
      <div
        v-if="allowWithdraw && showWithdrawModal"
        class="fixed inset-0 z-[2000] flex items-center justify-center p-4 font-geist"
      >
        <div
          class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm"
          @click="showWithdrawModal = false"
        ></div>
        <div
          class="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-[20px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.15)] overflow-hidden"
        >
          <!-- Header -->
          <div class="px-6 pt-8 pb-4 flex items-start justify-between gap-4 shrink-0">
            <div>
              <h2 class="text-[24px] font-bold text-noble-black">Withdraw Funds</h2>
              <p class="mt-1 text-[13px] font-medium text-noble-black/40">
                Transfer money from your TakeUP balance.
              </p>
            </div>
            <button
              type="button"
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-noble-black transition hover:bg-gray-100"
              @click="showWithdrawModal = false"
            >
              <Icon name="ph:x" class="w-5 h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto custom-modal-scrollbar px-6">
            <div class="py-6">
              <div class="bg-blue-estate/[0.03] p-4 rounded-[16px] mb-8 flex items-start gap-3">
                <Icon name="ph:info" class="text-blue-estate mt-0.5 shrink-0 w-[18px] h-[18px]" />
                <div class="space-y-1">
                  <p class="text-[13px] font-bold text-blue-estate/80 leading-relaxed">
                    {{ withdrawNotice }}
                  </p>
                  <p class="text-[12px] font-medium text-noble-black/40">
                    Available balance:
                    <span class="text-noble-black font-bold">{{ formattedBalance }}</span>
                  </p>
                </div>
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
                    id="withdraw-amount"
                    v-model="withdrawAmountDisplay"
                    type="text"
                    inputmode="decimal"
                    placeholder=" "
                    class="peer w-full pl-12 pr-4 pt-6 pb-2 border-[1.5px] border-gray-200 rounded-[10px] bg-white focus:border-burning-orange focus:shadow-[0_0_0_3px_rgba(232,101,10,0.1)] outline-none text-[18px] font-bold text-noble-black transition-all duration-300"
                    :class="{
                      'border-cinnabar-red focus:border-cinnabar-red focus:shadow-[0_0_0_3px_rgba(224,53,49,0.1)]':
                        isWithdrawInvalid || isWithdrawExceedsBalance,
                    }"
                    @input="handleAmountInput($event, 'withdraw')"
                  />
                  <label
                    for="withdraw-amount"
                    class="absolute left-12 top-[18px] text-noble-black/40 text-[15px] transition-all duration-300 pointer-events-none peer-placeholder-shown:top-[18px] peer-placeholder-shown:text-[15px] peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-burning-orange peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[11px]"
                    :class="{
                      'peer-focus:text-cinnabar-red': isWithdrawInvalid || isWithdrawExceedsBalance,
                    }"
                    >Enter Amount (PHP)</label
                  >
                </div>

                <div
                  v-if="isWithdrawInvalid"
                  class="flex items-center gap-1.5 text-cinnabar-red mt-1"
                >
                  <Icon name="ph:warning-circle" class="w-4 h-4" />
                  <p class="text-[12px] font-medium">Please enter an amount greater than 0.</p>
                </div>

                <div
                  v-else-if="isWithdrawExceedsBalance"
                  class="flex items-center gap-1.5 text-cinnabar-red mt-1"
                >
                  <Icon name="ph:warning-circle" class="w-4 h-4" />
                  <p class="text-[12px] font-medium">Amount exceeds your available balance.</p>
                </div>

                <!-- Quick Select -->
                <div class="grid grid-cols-3 gap-3">
                  <button
                    v-for="amount in [500, 1000, 2000]"
                    :key="amount"
                    type="button"
                    class="py-3 rounded-[12px] bg-white border border-gray-100 font-bold text-noble-black/60 shadow-sm transition-all hover:border-burning-orange/30 hover:bg-burning-orange/[0.02] hover:text-burning-orange active:scale-[0.98]"
                    @click="withdrawAmountDisplay = amount.toString()"
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
              @click="showWithdrawModal = false"
            >
              Cancel
            </button>
            <button
              type="button"
              class="flex-1 h-12 items-center justify-center rounded-[10px] bg-gradient-to-br from-burning-orange to-orange-500 text-[15px] font-bold text-white transition-all duration-300 shadow-lg shadow-burning-orange/35 hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              :disabled="
                isSubmitting ||
                !withdrawAmountDisplay ||
                isWithdrawInvalid ||
                isWithdrawExceedsBalance
              "
              @click="handleWithdraw"
            >
              {{ isSubmitting ? "Processing..." : "Confirm Withdrawal" }}
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
</style>
