<script setup lang="ts">
import type { inferRouterProxyClient } from "@trpc/client"
import type { AppRouter } from "~~/server/trpc/routers"
import { buildItemDetailPath } from "~~/app/utils/item-detail-route"

type TrpcClient = inferRouterProxyClient<AppRouter>
type UserDetailResponse = Awaited<ReturnType<TrpcClient["admin"]["users"]["detail"]["query"]>>
type UserListingsResponse = Awaited<ReturnType<TrpcClient["admin"]["users"]["listings"]["query"]>>
type UserTransactionsResponse = Awaited<
  ReturnType<TrpcClient["admin"]["users"]["transactions"]["query"]>
>
type UserDetailTab = "listings" | "transactions"
definePageMeta({
  layout: "admin",
  middleware: "admin-auth",
})

const route = useRoute()
const router = useRouter()
const { $trpc } = useNuxtApp() as unknown as { $trpc: TrpcClient }
const userId = route.params.id as string
const initialTab = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab

const activeTab = ref<UserDetailTab>(initialTab === "transactions" ? "transactions" : "listings")
const showBanModal = ref(false)
const isLoadingAction = ref(false)
const banConfirmation = ref(false)

// Pagination state
const listingsPage = ref(0)
const transactionsPage = ref(0)
const pageSizeListings = 9
const pageSizeTransactions = 10
const allListings = ref<UserListingsResponse["items"]>([])
const allTransactions = ref<UserTransactionsResponse["transactions"]>([])

const {
  data: userDetail,
  pending: loadingDetail,
  refresh: refreshDetail,
} = await useAsyncData<UserDetailResponse>(
  () => `admin:user:${userId}`,
  () => $trpc.admin.users.detail.query({ userId }),
  { server: false },
)

const {
  data: listingsMetadata,
  pending: loadingListings,
  refresh: refreshListings,
} = await useAsyncData(
  () => `admin:user:${userId}:listings:${listingsPage.value}`,
  async () => {
    const res = await $trpc.admin.users.listings.query({
      userId,
      skip: listingsPage.value * pageSizeListings,
      take: pageSizeListings,
    })
    if (listingsPage.value === 0) allListings.value = res.items
    else allListings.value = [...allListings.value, ...res.items]
    return res
  },
  { server: false },
)

const {
  data: transactionsMetadata,
  pending: loadingTransactions,
  refresh: refreshTransactions,
} = await useAsyncData(
  () => `admin:user:${userId}:transactions:${transactionsPage.value}`,
  async () => {
    const res = await $trpc.admin.users.transactions.query({
      userId,
      skip: transactionsPage.value * pageSizeTransactions,
      take: pageSizeTransactions,
    })
    if (transactionsPage.value === 0) allTransactions.value = res.transactions
    else allTransactions.value = [...allTransactions.value, ...res.transactions]
    return res
  },
  { server: false },
)

const user = computed(() => userDetail.value)
const listings = computed(() => allListings.value)
const totalListings = computed(() => listingsMetadata.value?.totalCount ?? 0)
const transactions = computed(() => allTransactions.value)
const totalTransactions = computed(() => transactionsMetadata.value?.totalCount ?? 0)

const hasMoreListings = computed(() => listings.value.length < totalListings.value)
const hasMoreTransactions = computed(() => transactions.value.length < totalTransactions.value)

const loadMoreListings = () => {
  if (!loadingListings.value && hasMoreListings.value) {
    listingsPage.value++
    void refreshListings()
  }
}

const loadMoreTransactions = () => {
  if (!loadingTransactions.value && hasMoreTransactions.value) {
    transactionsPage.value++
    void refreshTransactions()
  }
}

const moneyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
})

const formatCurrency = (amount: unknown) => moneyFormatter.format(Number(amount ?? 0))

const formatDateTime = (value: Date | string) =>
  new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  })

const getTransactionRole = (transaction: {
  borrowerId: string | null
  lenderId: string | null
}) => {
  if (transaction.borrowerId === userId) return "Borrower"
  if (transaction.lenderId === userId) return "Lender"
  return "Participant"
}

const getTransactionStatusColor = (status: string) => {
  if (["COMPLETED", "PAID"].includes(status)) return "bg-green-100 text-green-700"
  if (["PENDING", "CONFIRMED", "ONGOING"].includes(status)) return "bg-blue-100 text-blue-700"
  if (["IN_DISPUTE", "APPEALED"].includes(status)) return "bg-yellow-100 text-yellow-700"
  if (["CANCELLED", "REJECTED", "REFUNDED"].includes(status)) return "bg-red-100 text-red-700"
  return "bg-gray-100 text-gray-700"
}

const getListingStatusColor = (status: string) => {
  if (["AVAILABLE", "ACTIVE"].includes(status)) return "bg-green-100 text-green-700"
  if (["RESERVED", "RENTED", "UNAVAILABLE"].includes(status)) return "bg-blue-100 text-blue-700"
  if (["PENDING", "UNDER_REVIEW"].includes(status)) return "bg-yellow-100 text-yellow-700"
  if (["REMOVED", "DELISTED", "BANNED", "REJECTED"].includes(status)) {
    return "bg-red-100 text-red-700"
  }
  return "bg-gray-100 text-gray-700"
}

const setActiveTab = (tab: UserDetailTab) => {
  activeTab.value = tab
  void router.replace({
    query: {
      ...route.query,
      tab: tab === "listings" ? undefined : tab,
    },
  })
}

const performBanUser = async () => {
  if (!banConfirmation.value) return
  isLoadingAction.value = true
  try {
    await $trpc.admin.actions.banUser.mutate({ userId, reason: "Banned by admin" })
    showBanModal.value = false
    await refreshDetail()
  } finally {
    isLoadingAction.value = false
  }
}
</script>

<template>
  <div class="font-geist space-y-10">
    <!-- Slim Back Navigation -->
    <button
      class="text-noble-black/30 hover:text-burning-orange transition-all w-fit"
      @click="router.back()"
    >
      <Icon name="ph:caret-left" class="w-6 h-6" />
    </button>

    <div v-if="loadingDetail" class="space-y-10 animate-pulse">
      <div class="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div class="flex items-center gap-6">
          <div class="h-20 w-20 rounded-2xl bg-noble-black/10"></div>
          <div class="space-y-3">
            <div class="h-8 w-48 bg-noble-black/20 rounded"></div>
            <div class="flex gap-2">
              <div class="h-4 w-24 bg-noble-black/10 rounded"></div>
              <div class="h-4 w-12 bg-noble-black/10 rounded"></div>
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <div class="h-14 w-24 rounded-2xl bg-noble-black/10"></div>
          <div class="h-14 w-24 rounded-2xl bg-noble-black/10"></div>
        </div>
      </div>
      <div class="h-16 w-1/3 bg-noble-black/10 rounded-2xl"></div>
      <div class="h-96 w-full bg-noble-black/5 rounded-[32px]"></div>
    </div>

    <div v-else-if="!user" class="flex flex-col items-center justify-center py-20 text-center">
      <div
        class="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100"
      >
        <Icon name="ph:user-minus-fill" class="h-10 w-10 text-cinnabar-red" />
      </div>
      <p class="text-[20px] font-black text-noble-black italic tracking-tight">Record Terminated</p>
      <p class="mt-2 text-[15px] font-medium text-noble-black/40">
        This account identifier could not be resolved.
      </p>
    </div>

    <template v-else>
      <!-- Refactored Header: Side-by-Side Lighter Components -->
      <div class="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <!-- Left Side: Compact Profile Strip -->
        <div class="flex items-center gap-6">
          <UserAvatar
            :user-name="`${user.firstName} ${user.lastName}`"
            :avatar-url="user.avatarUrl"
            size="lg"
            class="!w-20 !h-20 border-[3px] border-white shadow-md rounded-2xl"
          />
          <div class="space-y-2">
            <div class="space-y-1">
              <h1 class="font-montravia text-[32px] font-medium text-noble-black leading-none">
                {{ user.firstName }} {{ user.lastName }}
              </h1>
              <div class="w-8 h-0.5 bg-burning-orange"></div>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <p class="text-[14px] font-bold text-noble-black/60 tracking-tight">
                @{{ user.username }}
              </p>
              <div class="flex items-center gap-2">
                <span
                  class="px-2.5 py-0.5 rounded-full bg-noble-black text-white text-[9px] font-black tracking-widest uppercase"
                >
                  {{ user.accountType }}
                </span>
                <span
                  v-if="user.status === 'ACTIVE'"
                  class="px-2.5 py-0.5 rounded-full bg-success-green/10 text-success-green text-[9px] font-black tracking-widest uppercase"
                >
                  ACTIVE
                </span>
                <span
                  v-else
                  class="px-2.5 py-0.5 rounded-full bg-red-50 text-cinnabar-red text-[9px] font-black tracking-widest uppercase"
                >
                  {{ user.status }}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-4 text-noble-black/40 text-[13px] font-medium">
              <div v-if="user.location" class="flex items-center gap-1">
                <Icon name="ph:map-pin" class="w-3.5 h-3.5" />
                {{ user.location }}
              </div>
              <div class="flex items-center gap-1">
                <Icon name="ph:envelope-simple" class="w-3.5 h-3.5" />
                {{ user.email }}
              </div>
            </div>
          </div>
        </div>

        <!-- Right Side: Compact Action Panel -->
        <div class="flex flex-col items-end gap-4 min-w-[280px]">
          <div class="flex gap-2">
            <!-- Lender Rating Chip -->
            <div
              class="px-4 py-2.5 rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col items-center group/tooltip relative"
            >
              <span
                class="text-[8px] font-black text-noble-black/30 uppercase tracking-widest mb-0.5"
                >Lender</span
              >
              <div class="flex items-center gap-1.5">
                <span class="text-[15px] font-black text-noble-black">{{
                  user.lender?.lenderRating?.toFixed(1) ?? "0.0"
                }}</span>
                <Icon name="ph:star-fill" class="w-3.5 h-3.5 text-burning-orange" />
              </div>
              <div class="custom-tooltip">
                Lender Reputation
                <div class="tooltip-arrow"></div>
              </div>
            </div>
            <!-- Borrower Rating Chip -->
            <div
              class="px-4 py-2.5 rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col items-center group/tooltip relative"
            >
              <span
                class="text-[8px] font-black text-noble-black/30 uppercase tracking-widest mb-0.5"
                >Borrower</span
              >
              <div class="flex items-center gap-1.5">
                <span class="text-[15px] font-black text-noble-black">{{
                  user.borrower?.borrowerRating?.toFixed(1) ?? "0.0"
                }}</span>
                <Icon name="ph:star-fill" class="w-3.5 h-3.5 text-wahoo" />
              </div>
              <div class="custom-tooltip">
                Borrower Reputation
                <div class="tooltip-arrow"></div>
              </div>
            </div>
          </div>

          <button
            v-if="user.status !== 'BANNED'"
            class="h-10 px-6 rounded-xl border-2 border-cinnabar-red/20 text-cinnabar-red text-[11px] font-black uppercase tracking-widest transition-all hover:bg-cinnabar-red hover:text-white active:scale-95"
            @click="showBanModal = true"
          >
            Ban Account
          </button>
        </div>
      </div>

      <!-- Lighter Horizontal Stat Strip -->
      <section
        class="bg-white border border-cinnamon-ice/15 rounded-2xl shadow-sm overflow-hidden w-fit"
      >
        <div class="flex items-center divide-x divide-gray-100">
          <div class="px-8 py-4 text-center">
            <p class="text-[20px] font-black text-noble-black leading-none mb-1.5">
              {{ totalListings }}
            </p>
            <p class="text-[9px] font-bold uppercase tracking-widest text-noble-black/25">
              Listed Items
            </p>
          </div>
          <div class="px-8 py-4 text-center">
            <p class="text-[20px] font-black text-noble-black leading-none mb-1.5">
              {{ totalTransactions }}
            </p>
            <p class="text-[9px] font-bold uppercase tracking-widest text-noble-black/25">
              Transactions
            </p>
          </div>
          <div class="px-8 py-4 text-center">
            <p class="text-[20px] font-black text-burning-orange leading-none mb-1.5">
              {{ user.points }}
            </p>
            <p class="text-[9px] font-bold uppercase tracking-widest text-noble-black/25">
              Loyalty Points
            </p>
          </div>
        </div>
      </section>

      <!-- Tabbed Navigation -->
      <div class="space-y-8">
        <div class="flex gap-8 border-b border-gray-100 px-2 overflow-x-auto hide-scrollbar">
          <button
            v-for="tab in ['listings', 'transactions'] as UserDetailTab[]"
            :key="tab"
            class="relative py-4 text-[15px] font-bold transition-all group whitespace-nowrap"
            :class="activeTab === tab ? 'text-burning-orange' : 'text-gray-400 hover:text-gray-600'"
            @click="setActiveTab(tab)"
          >
            <div class="flex items-center gap-2">
              {{ tab === "listings" ? "Listings" : "Transactions" }}
              <span
                class="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold transition-colors"
                :class="
                  activeTab === tab ? 'bg-burning-orange text-white' : 'bg-gray-100 text-gray-500'
                "
              >
                {{ tab === "listings" ? totalListings : totalTransactions }}
              </span>
            </div>
            <div
              v-if="activeTab === tab"
              class="absolute bottom-0 left-0 right-0 h-0.5 bg-burning-orange rounded-full"
            />
          </button>
        </div>

        <!-- Tab Content -->
        <div class="min-h-[400px]">
          <div
            v-if="activeTab === 'listings'"
            class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <!-- Big Container for Listings -->
            <div
              class="bg-white rounded-[32px] border border-cinnamon-ice/20 shadow-[0_8px_30px_rgba(0,0,0,0.02)] overflow-hidden"
            >
              <div class="p-8 border-b border-gray-50 flex items-center justify-between">
                <div class="border-l-[3px] border-burning-orange pl-4">
                  <h2 class="text-[20px] font-semibold text-noble-black tracking-tight">
                    Active Inventory
                  </h2>
                  <p class="mt-0.5 text-[13px] font-light text-noble-black/50">
                    Marketplace listings managed by this user.
                  </p>
                </div>
              </div>

              <div class="p-8 max-h-[700px] overflow-y-auto custom-admin-main-scrollbar">
                <div
                  v-if="loadingListings && listings.length === 0"
                  class="grid gap-6 md:grid-cols-3"
                >
                  <div
                    v-for="i in 3"
                    :key="i"
                    class="h-64 animate-pulse rounded-[32px] bg-gray-50 border border-gray-100"
                  ></div>
                </div>

                <div
                  v-else-if="listings.length === 0"
                  class="flex flex-col items-center justify-center py-20 text-center"
                >
                  <Icon name="ph:package" class="h-12 w-12 text-noble-black/10 mb-4" />
                  <p class="text-[16px] font-bold text-noble-black/30 uppercase tracking-widest">
                    No inventory detected
                  </p>
                </div>

                <div v-else class="space-y-10">
                  <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    <NuxtLink
                      v-for="listing in listings"
                      :key="listing.id"
                      :to="{
                        path: buildItemDetailPath({ id: listing.id, name: listing.name }),
                        query: { from: 'admin-user-listings', adminUserId: userId },
                      }"
                      class="group rounded-[24px] border border-transparent bg-white p-5 shadow-[0_2px_15px_rgba(0,0,0,0.02)] transition-all duration-300 hover:border-cinnamon-ice/20 hover:shadow-lg"
                    >
                      <div class="flex items-start justify-between mb-4">
                        <div class="min-w-0">
                          <h3
                            class="truncate text-[16px] font-bold text-noble-black group-hover:text-burning-orange transition-colors"
                          >
                            {{ listing.name }}
                          </h3>
                          <p class="mt-0.5 text-[10px] font-black text-noble-black/20 font-mono">
                            REF: {{ listing.id?.split("-")[0]?.toUpperCase() ?? "N/A" }}
                          </p>
                        </div>
                        <span
                          class="shrink-0 rounded-full px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest shadow-sm"
                          :class="getListingStatusColor(listing.status)"
                        >
                          {{ listing.status }}
                        </span>
                      </div>

                      <div class="grid grid-cols-2 gap-3">
                        <div class="p-2.5 rounded-xl bg-gray-50 border border-gray-100/50">
                          <p
                            class="text-[8px] font-black uppercase tracking-widest text-noble-black/25"
                          >
                            Rate
                          </p>
                          <p class="text-[13px] font-black text-noble-black">
                            {{ formatCurrency(listing.rentalFee) }}
                          </p>
                        </div>
                        <div class="p-2.5 rounded-xl bg-gray-50 border border-gray-100/50">
                          <p
                            class="text-[8px] font-black uppercase tracking-widest text-noble-black/25"
                          >
                            Metric
                          </p>
                          <div class="flex items-center gap-1">
                            <span class="text-[13px] font-black text-noble-black">{{
                              listing.rating?.toFixed(1) ?? "0.0"
                            }}</span>
                            <Icon name="ph:star-fill" class="w-3 h-3 text-burning-orange" />
                          </div>
                        </div>
                      </div>

                      <div
                        class="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between"
                      >
                        <span class="text-[10px] font-bold text-noble-black/30"
                          >Listed {{ formatDateTime(listing.createdAt) }}</span
                        >
                        <Icon
                          name="ph:arrow-right"
                          class="w-3.5 h-3.5 text-noble-black/20 group-hover:text-burning-orange transition-all"
                        />
                      </div>
                    </NuxtLink>
                  </div>

                  <!-- Plain Load More -->
                  <div v-if="hasMoreListings" class="pb-6 text-center">
                    <button
                      :disabled="loadingListings"
                      class="text-[12px] font-black uppercase tracking-[2px] text-noble-black/20 hover:text-burning-orange transition-all disabled:opacity-50"
                      @click="loadMoreListings"
                    >
                      <span
                        v-if="loadingListings"
                        class="flex items-center gap-2 mx-auto justify-center"
                      >
                        <Icon name="ph:circle-notch" class="animate-spin w-4 h-4" />
                        Loading...
                      </span>
                      <span v-else>Load More Items</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            v-else-if="activeTab === 'transactions'"
            class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <!-- Big Container for Transactions -->
            <div
              class="bg-white rounded-[32px] border border-cinnamon-ice/20 shadow-[0_8px_30px_rgba(0,0,0,0.02)] overflow-hidden"
            >
              <div class="p-8 border-b border-gray-50 flex items-center justify-between">
                <div class="border-l-[3px] border-burning-orange pl-4">
                  <h2 class="text-[20px] font-semibold text-noble-black tracking-tight">
                    Activity Flow
                  </h2>
                  <p class="mt-0.5 text-[13px] font-light text-noble-black/50">
                    Transactional engagement and status history.
                  </p>
                </div>
              </div>

              <div class="max-h-[700px] overflow-y-auto custom-admin-main-scrollbar">
                <div v-if="loadingTransactions && transactions.length === 0" class="p-8 space-y-4">
                  <div
                    v-for="i in 4"
                    :key="i"
                    class="h-20 animate-pulse rounded-[24px] bg-gray-50 border border-gray-100"
                  ></div>
                </div>

                <div
                  v-else-if="transactions.length === 0"
                  class="flex flex-col items-center justify-center py-20 text-center"
                >
                  <Icon name="ph:arrows-left-right" class="h-12 w-12 text-noble-black/10 mb-4" />
                  <p class="text-[16px] font-bold text-noble-black/30 uppercase tracking-widest">
                    No activity detected
                  </p>
                </div>

                <div v-else>
                  <table class="w-full">
                    <thead class="sticky top-0 z-10">
                      <tr class="bg-gray-50 border-b border-gray-100">
                        <th
                          class="px-8 py-5 text-left text-[11px] font-black uppercase tracking-[2px] text-noble-black/30"
                        >
                          Item
                        </th>
                        <th
                          class="px-8 py-5 text-left text-[11px] font-black uppercase tracking-[2px] text-noble-black/30"
                        >
                          Role
                        </th>
                        <th
                          class="px-8 py-5 text-left text-[11px] font-black uppercase tracking-[2px] text-noble-black/30"
                        >
                          Status
                        </th>
                        <th
                          class="px-8 py-5 text-left text-[11px] font-black uppercase tracking-[2px] text-noble-black/30"
                        >
                          Amount
                        </th>
                        <th
                          class="px-8 py-5 text-right text-[11px] font-black uppercase tracking-[2px] text-noble-black/30"
                        >
                          Timestamp
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-50">
                      <tr
                        v-for="transaction in transactions"
                        :key="transaction.id"
                        class="group h-[80px] transition-all hover:bg-cream/40"
                      >
                        <td class="px-8 py-4">
                          <p class="text-[15px] font-black text-noble-black truncate max-w-[200px]">
                            {{ transaction.item?.name ?? "Terminated Object" }}
                          </p>
                          <p class="text-[11px] font-black text-noble-black/20 font-mono">
                            {{ transaction.id?.split("-")[0]?.toUpperCase() ?? "N/A" }}
                          </p>
                        </td>
                        <td class="px-8 py-4">
                          <span
                            class="inline-flex items-center px-3 py-1 rounded-full bg-noble-black/5 text-noble-black text-[10px] font-black tracking-widest uppercase"
                          >
                            {{ getTransactionRole(transaction) }}
                          </span>
                        </td>
                        <td class="px-8 py-4">
                          <span
                            class="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm"
                            :class="getTransactionStatusColor(transaction.status)"
                          >
                            {{ transaction.status }}
                          </span>
                        </td>
                        <td class="px-8 py-4 text-[15px] font-black text-noble-black">
                          {{ formatCurrency(transaction.totalAmount) }}
                        </td>
                        <td class="px-8 py-4 text-right text-[13px] font-bold text-noble-black/40">
                          {{ formatDateTime(transaction.createdAt) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <!-- Plain Load More -->
                  <div v-if="hasMoreTransactions" class="p-8 border-t border-gray-50 text-center">
                    <button
                      :disabled="loadingTransactions"
                      class="text-[12px] font-black uppercase tracking-[2px] text-noble-black/20 hover:text-burning-orange transition-all disabled:opacity-50"
                      @click="loadMoreTransactions"
                    >
                      <span
                        v-if="loadingTransactions"
                        class="flex items-center gap-2 mx-auto justify-center"
                      >
                        <Icon name="ph:circle-notch" class="animate-spin w-4 h-4" />
                        Loading...
                      </span>
                      <span v-else>Load More Records</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Ban Modal Polish -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showBanModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            class="absolute inset-0 bg-noble-black/90 backdrop-blur-xl"
            @click="showBanModal = false"
          ></div>
          <div
            class="relative w-full max-w-lg rounded-[40px] bg-white shadow-2xl p-10 border border-cinnabar-red/10"
          >
            <h3
              class="text-[28px] font-black text-cinnabar-red tracking-tighter leading-none mb-4 italic"
            >
              Confirm Revocation
            </h3>
            <p class="text-[15px] font-medium text-noble-black/40 leading-relaxed mb-8">
              This action will permanently terminate system access for
              <span class="text-noble-black font-black underline"
                >{{ user?.firstName }} {{ user?.lastName }}</span
              >.
            </p>

            <label
              class="flex items-center gap-4 p-6 rounded-[24px] bg-red-50/50 border border-red-100 cursor-pointer group mb-10"
            >
              <input
                v-model="banConfirmation"
                type="checkbox"
                class="h-6 w-6 rounded-[8px] border-red-200 text-cinnabar-red focus:ring-cinnabar-red transition-all"
              />
              <span
                class="text-[14px] font-black text-cinnabar-red/70 group-hover:text-cinnabar-red transition-colors"
                >I acknowledge the absolute finality of this decision.</span
              >
            </label>

            <div class="flex gap-4">
              <button
                class="flex-1 h-14 rounded-[18px] bg-gray-50 text-noble-black/60 text-[14px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all"
                @click="showBanModal = false"
              >
                Abort
              </button>
              <button
                :disabled="!banConfirmation || isLoadingAction"
                class="flex-2 h-14 px-8 rounded-[18px] bg-cinnabar-red text-white text-[14px] font-black uppercase tracking-widest shadow-xl shadow-cinnabar-red/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30"
                @click="performBanUser"
              >
                <span v-if="isLoadingAction" class="flex items-center gap-2">
                  <Icon name="ph:circle-notch" class="animate-spin w-4 h-4" />
                  Executing...
                </span>
                <span v-else>Execute Revocation</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* Custom Tooltip Styling */
.custom-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-8px);
  background-color: theme("colors.cream");
  color: theme("colors.noble-black");
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid theme("colors.cinnamon-ice / 30%");
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease,
    visibility 0.2s;
  z-index: 1200;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.tooltip-arrow {
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid theme("colors.cinnamon-ice / 30%");
}

.tooltip-arrow::after {
  content: "";
  position: absolute;
  bottom: 1px;
  left: -5px;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid theme("colors.cream");
}

.group\/tooltip:hover .custom-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(-12px);
}
</style>
