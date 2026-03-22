<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import type { TransactionListItem } from "../../../composables/use-transactions"

definePageMeta({
  layout: "account",
  middleware: "account-auth",
})

const route = useRoute()
const transactionId = route.params.id as string
const orderId = computed(() => transactionId.slice(0, 16).toUpperCase())

const user = useSupabaseUser()
const transaction = ref<TransactionListItem | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const isReturned = ref(false)

const userRole = computed(() => {
  if (!transaction.value || !user.value) return "BORROWER"
  return transaction.value.lenderId === user.value.id ? "LENDER" : "BORROWER"
})

const fetchTransaction = async () => {
  isLoading.value = true
  try {
    const response = await $fetch<{ transactions: TransactionListItem[] }>("/api/transactions", {
      query: { limit: 100 },
    })

    const found = response.transactions.find((t) => t.id === transactionId)
    if (found) {
      transaction.value = found
    } else {
      error.value = "Transaction not found."
    }
  } catch {
    error.value = "Unable to load transaction details."
  } finally {
    isLoading.value = false
  }
}
onMounted(() => {
  fetchTransaction()
})

const formatDate = (date: Date | string) =>
  new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

const formatDateTime = (date: Date | string) => {
  const d = new Date(date)
  const formattedDate = formatDate(d)
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
  return `${formattedDate} at ${time}`
}

const computeDuration = (startDate: Date | string, endDate: Date | string): string => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

  if (totalDays <= 0) return "1 day"
  if (totalDays === 1) return "1 day"
  if (totalDays < 7) return `${totalDays} days`

  const weeks = Math.floor(totalDays / 7)
  const remainingDays = totalDays % 7

  if (remainingDays === 0) return weeks === 1 ? "1 week" : `${weeks} weeks`

  const weekPart = weeks === 1 ? "1 week" : `${weeks} weeks`
  const dayPart = remainingDays === 1 ? "1 day" : `${remainingDays} days`
  return `${weekPart} and ${dayPart}`
}

// Mock timeline - as requested, this remains mock for now
const timeline = computed(() => [
  {
    label: "Order Placed",
    description: "You placed this order",
    date: formatDate(transaction.value?.createdAt || new Date()),
    status: "completed",
  },
  {
    label: "Payment Confirmed",
    description: `Payment of ${formatPeso(transaction.value?.totalAmount || 0)} received`,
    date: formatDate(transaction.value?.createdAt || new Date()),
    status: "completed",
  },
  {
    label: "Item Ready",
    description: "Lender prepared the item for pickup",
    date: "Oct 4, 2026",
    status: "completed",
  },
  {
    label: "Picked Up",
    description: "Item picked up at designated location",
    date: "Oct 5, 2026",
    status: "completed",
  },
  {
    label: "In Use",
    description: "Rental period started",
    date: formatDate(transaction.value?.startDate || new Date()),
    status: isReturned.value ? "completed" : "current",
  },
  {
    label: "Return Item",
    description: isReturned.value
      ? "Item returned successfully"
      : "Return by the end of rental period",
    date: formatDate(transaction.value?.endDate || new Date()),
    status: isReturned.value ? "current" : "upcoming",
  },
  {
    label: "Completed",
    description: "Deposit refunded after inspection",
    date: "--",
    status: "upcoming",
  },
])

const isReturnModalOpen = ref(false)
const isSuccessModalOpen = ref(false)
const isSubmittingReturn = ref(false)

const handleReturn = () => {
  isReturnModalOpen.value = true
}

const confirmReturn = async () => {
  isSubmittingReturn.value = true
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 1500))
  isSubmittingReturn.value = false
  isReturnModalOpen.value = false
  isReturned.value = true
  isSuccessModalOpen.value = true
}

const copyOrderId = () => {
  navigator.clipboard.writeText(transactionId)
}

const formatPeso = (value: number) =>
  `₱${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(value)}`
</script>

<template>
  <div class="font-geist pb-20">
    <!-- Header with Back Button -->
    <NuxtLink
      to="/account/transactions"
      class="flex items-center gap-2 text-noble-black hover:text-burning-orange transition-colors mb-6 group"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="transition-transform group-hover:-translate-x-1"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      <span class="text-lg font-medium">Back to My Transactions</span>
    </NuxtLink>

    <div v-if="isLoading" class="flex flex-col gap-6 animate-pulse">
      <div class="h-10 w-48 bg-cream rounded-xl"></div>
      <div class="h-6 w-96 bg-cream rounded-xl"></div>
      <div class="h-64 bg-cream rounded-3xl"></div>
    </div>

    <div v-else-if="error" class="text-center py-20">
      <p class="text-noble-black/60 mb-4">{{ error }}</p>
      <NuxtLink to="/account/transactions" class="text-burning-orange font-bold"
        >Return to Transactions</NuxtLink
      >
    </div>

    <div v-else-if="transaction">
      <!-- Page Title -->
      <h1 class="text-[25px] font-bold text-noble-black mb-2">Order Details</h1>

      <!-- Order Info Bar -->
      <div class="flex items-center justify-between mb-8">
        <div class="flex items-center gap-3 text-[15px] text-noble-black/80">
          <div class="flex items-center gap-2">
            <span class="font-normal uppercase tracking-wide">ORDER ID. {{ orderId }}</span>
            <button
              class="text-stone-400 hover:text-noble-black transition-colors"
              @click="copyOrderId"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
            </button>
          </div>
          <div class="w-px h-4 bg-stone-300"></div>
          <span class="font-normal">Placed on {{ formatDateTime(transaction.createdAt) }}</span>
        </div>

        <TransactionStatusBadge
          :status="isReturned ? 'RETURNED' : transaction.status"
          :role="userRole"
        />
      </div>

      <!-- Main Content Grid -->
      <div class="space-y-6">
        <!-- Section 1: Item Details -->
        <section class="bg-cream border border-cinnamon-ice rounded-3xl p-6">
          <h2 class="text-lg font-bold text-noble-black mb-4">Item Details</h2>
          <div class="flex gap-6">
            <img
              v-if="transaction.item.thumbnailImage"
              :src="transaction.item.thumbnailImage"
              :alt="transaction.item.name"
              class="w-32 h-32 object-cover rounded-2xl shrink-0"
            />
            <div
              v-else
              class="w-32 h-32 bg-cinnamon-ice/40 rounded-2xl shrink-0 flex items-center justify-center"
            >
              <svg
                class="w-12 h-12 text-cinnamon-ice"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div class="flex flex-col justify-center gap-1">
              <h3 class="text-xl font-bold text-noble-black">{{ transaction.item.name }}</h3>
              <p class="text-sm text-noble-black/70 line-clamp-2 max-w-xl">
                Ready for pick-up. Coordination with lender recommended for smooth handover.
              </p>
              <div class="flex items-center gap-2 mt-2 text-sm font-medium text-noble-black/80">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
                {{ formatDate(transaction.startDate) }} - {{ formatDate(transaction.endDate) }}
              </div>
            </div>
          </div>
        </section>

        <!-- Section 2: Order Timeline -->
        <section class="bg-cream border border-cinnamon-ice rounded-3xl p-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg font-bold text-noble-black">Order Timeline</h2>
            <!-- Return Action Button -->
            <button
              v-if="!isReturned"
              class="bg-burning-orange text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-estate transition-colors"
              @click="handleReturn"
            >
              Return Item
            </button>
          </div>
          <div class="space-y-0 ml-2">
            <div
              v-for="(step, index) in timeline"
              :key="index"
              class="relative flex gap-6 pb-8 last:pb-0"
            >
              <!-- Timeline Line -->
              <div
                v-if="index !== timeline.length - 1"
                class="absolute left-[11px] top-6 bottom-0 w-0.5 bg-cinnamon-ice/30"
              ></div>

              <!-- Timeline Icon/Circle -->
              <div class="relative z-10 mt-1">
                <div
                  v-if="step.status === 'completed'"
                  class="w-6 h-6 rounded-full bg-blue-estate flex items-center justify-center"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    stroke-width="4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div
                  v-else-if="step.status === 'current'"
                  class="w-6 h-6 rounded-full bg-burning-orange flex items-center justify-center"
                >
                  <div
                    class="w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center"
                  >
                    <div class="w-1 h-1 rounded-full bg-white"></div>
                  </div>
                </div>
                <div
                  v-else
                  class="w-6 h-6 rounded-full bg-cinnamon-ice flex items-center justify-center"
                >
                  <div class="w-1.5 h-1.5 rounded-full bg-burning-orange"></div>
                </div>
              </div>

              <!-- Step Content -->
              <div class="flex-1 flex justify-between items-start">
                <div>
                  <h4
                    class="font-bold text-noble-black"
                    :class="{ 'text-noble-black/40': step.status === 'upcoming' }"
                  >
                    {{ step.label }}
                  </h4>
                  <p class="text-sm text-noble-black/60">{{ step.description }}</p>
                </div>
                <span class="text-sm text-noble-black/40">{{ step.date }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Section 3: Payment Summary -->
        <section class="bg-cream border border-cinnamon-ice rounded-3xl p-6">
          <h2 class="text-lg font-bold text-noble-black mb-4">Payment Summary</h2>
          <div class="space-y-3 mb-6">
            <div class="flex justify-between items-center text-noble-black/80">
              <span
                >Rental Fee ({{
                  computeDuration(transaction.startDate, transaction.endDate)
                }})</span
              >
              <span class="font-bold">{{ formatPeso(transaction.totalAmount) }}</span>
            </div>
            <div class="flex justify-between items-center pt-3 border-t border-cinnamon-ice/30">
              <span class="text-lg font-bold text-noble-black">Total Paid</span>
              <span class="text-2xl font-bold text-burning-orange">{{
                formatPeso(transaction.totalAmount)
              }}</span>
            </div>
          </div>

          <!-- TakeUP Guarantee Box -->
          <div class="bg-blue-estate rounded-2xl p-4 flex gap-4 items-start text-white">
            <div class="p-2 rounded-xl border border-white/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h4 class="font-bold">TakeUP Guarantee</h4>
              <p class="text-xs text-white/80 leading-relaxed mt-0.5">
                Your deposit is held securely and will be refunded after successful item return and
                inspection
              </p>
            </div>
          </div>
        </section>

        <!-- Section 4: Lender Information -->
        <section class="bg-cream border border-cinnamon-ice rounded-3xl p-6">
          <h2 class="text-lg font-bold text-noble-black mb-4">Lender Information</h2>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <!-- Avatar -->
              <UserAvatar
                :user-name="`${transaction.lender.user.firstName} ${transaction.lender.user.lastName}`"
                size="lg"
              />
              <div>
                <div class="flex items-center gap-1.5">
                  <h3 class="font-bold text-noble-black">
                    {{ transaction.lender.user.firstName }} {{ transaction.lender.user.lastName }}
                  </h3>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="#34A853"
                    stroke="white"
                    stroke-width="1.5"
                  >
                    <path
                      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    />
                  </svg>
                </div>
                <div class="flex items-center gap-3 mt-1 text-sm">
                  <div class="flex items-center gap-1 text-burning-orange font-bold">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <polygon
                        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                      />
                    </svg>
                    4.9
                  </div>
                  <span class="text-noble-black/40">(124 bookings)</span>
                </div>
              </div>
            </div>
            <button
              class="w-10 h-10 shrink-0 rounded-full bg-blue-estate flex items-center justify-center hover:opacity-90 transition-opacity shadow-sm"
            >
              <svg
                class="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
                  stroke="white"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
        </section>

        <!-- File Dispute Button -->
        <button
          class="w-full flex items-center justify-center gap-2 bg-cinnabar-red text-white font-bold py-4 hover:bg-cinnabar-red/90 rounded-2xl transition-colors mt-4"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" x2="12" y1="9" y2="13" />
            <line x1="12" x2="12.01" y1="17" y2="17" />
          </svg>
          File Dispute
        </button>
      </div>
    </div>

    <!-- Return Confirmation UI (Modal) -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isReturnModalOpen"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm"
          @click="isReturnModalOpen = false"
        ></div>

        <!-- Modal -->
        <div
          class="relative bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-300"
        >
          <div class="text-center">
            <div
              class="w-20 h-20 bg-burning-orange/10 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ff7124"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m15 10-4 4 6 6" />
                <path d="M4 18V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v7" />
                <path d="M11 22a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
              </svg>
            </div>
            <h3 class="text-2xl font-bold text-noble-black mb-2">Confirm Return</h3>
            <p class="text-noble-black/60 mb-8 leading-relaxed">
              Are you sure you want to mark this item as returned? Make sure you have coordinated
              with the lender for the handover.
            </p>

            <div class="flex flex-col gap-3">
              <button
                :disabled="isSubmittingReturn"
                class="w-full bg-burning-orange text-white py-4 rounded-2xl font-bold hover:bg-blue-estate transition-colors flex items-center justify-center"
                @click="confirmReturn"
              >
                <span v-if="isSubmittingReturn" class="animate-spin mr-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                </span>
                {{ isSubmittingReturn ? "Processing..." : "Yes, I've returned it" }}
              </button>
              <button
                class="w-full bg-cream text-noble-black py-4 rounded-2xl font-bold hover:bg-pale-cashmere transition-colors"
                @click="isReturnModalOpen = false"
              >
                Not yet
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Success Modal -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isSuccessModalOpen"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-noble-black/60 backdrop-blur-sm"
          @click="isSuccessModalOpen = false"
        ></div>

        <!-- Modal -->
        <div
          class="relative bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-300"
        >
          <div class="text-center">
            <div
              class="w-20 h-20 bg-success-green/10 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#34A853"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 class="text-2xl font-bold text-noble-black mb-2">Success!</h3>
            <p class="text-noble-black/60 mb-8 leading-relaxed">
              Your return request has been submitted. The lender will be notified to confirm the
              receipt of the item.
            </p>

            <button
              class="w-full bg-blue-estate text-white py-4 rounded-2xl font-bold hover:bg-indigo-900 transition-colors"
              @click="isSuccessModalOpen = false"
            >
              Great, thanks!
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.custom-time-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-time-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-time-scrollbar::-webkit-scrollbar-thumb {
  background: #dbbba7;
  border-radius: 10px;
}
</style>
