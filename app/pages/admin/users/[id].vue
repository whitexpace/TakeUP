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
type UserDetailTab = "profile" | "listings" | "transactions"
definePageMeta({
  layout: "admin",
  middleware: "admin-auth",
})

const route = useRoute()
const router = useRouter()
const { $trpc } = useNuxtApp() as unknown as { $trpc: TrpcClient }
const userId = route.params.id as string
const initialTab = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab

const activeTab = ref<UserDetailTab>(
  initialTab === "listings" || initialTab === "transactions" ? initialTab : "profile",
)
const showBanModal = ref(false)
const isLoadingAction = ref(false)
const banConfirmation = ref(false)

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
  data: listingsData,
  pending: loadingListings,
  error: listingsError,
} = await useAsyncData<UserListingsResponse>(
  () => `admin:user:${userId}:listings`,
  () => $trpc.admin.users.listings.query({ userId, skip: 0, take: 50 }),
  { server: false },
)

const {
  data: transactionsData,
  pending: loadingTransactions,
  error: transactionsError,
} = await useAsyncData<UserTransactionsResponse>(
  () => `admin:user:${userId}:transactions`,
  () => $trpc.admin.users.transactions.query({ userId, skip: 0, take: 50 }),
  { server: false },
)

const user = computed(() => userDetail.value)
const listings = computed(() => listingsData.value?.items ?? [])
const totalListings = computed(() => listingsData.value?.totalCount ?? 0)
const transactions = computed(() => transactionsData.value?.transactions ?? [])
const totalTransactions = computed(() => transactionsData.value?.totalCount ?? 0)

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
      tab: tab === "profile" ? undefined : tab,
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
  <div v-if="loadingDetail" class="p-8 text-center">Loading...</div>
  <div v-else-if="!user" class="p-8 text-center">
    <p class="text-red-600">User not found</p>
  </div>
  <div v-else class="space-y-6">
    <button class="text-burning-orange" @click="router.back()">← Back</button>

    <div
      class="flex flex-col gap-4 rounded-lg border border-cinnamon-ice bg-white p-6 sm:flex-row sm:items-start sm:justify-between"
    >
      <div>
        <h1 class="text-2xl font-bold">{{ user.firstName }} {{ user.lastName }}</h1>
        <p class="text-gray-600">{{ user.email }}</p>
        <p class="mt-2 text-sm text-gray-500">
          Role: {{ user.accountType }} | Status: {{ user.status }}
        </p>
      </div>

      <div class="flex shrink-0 justify-start sm:justify-end">
        <button
          v-if="user.status !== 'BANNED'"
          class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          @click="showBanModal = true"
        >
          Ban User
        </button>
      </div>
    </div>

    <div class="bg-white rounded-lg border border-cinnamon-ice">
      <div class="border-b border-cinnamon-ice px-6">
        <nav class="flex gap-6" aria-label="User detail sections">
          <button
            :class="[
              'border-b-2 px-1 py-4 text-sm font-medium transition-colors',
              activeTab === 'profile'
                ? 'border-burning-orange text-burning-orange'
                : 'border-transparent text-gray-500 hover:text-noble-black',
            ]"
            @click="setActiveTab('profile')"
          >
            Profile
          </button>
          <button
            :class="[
              'border-b-2 px-1 py-4 text-sm font-medium transition-colors',
              activeTab === 'listings'
                ? 'border-burning-orange text-burning-orange'
                : 'border-transparent text-gray-500 hover:text-noble-black',
            ]"
            @click="setActiveTab('listings')"
          >
            Listings
          </button>
          <button
            :class="[
              'border-b-2 px-1 py-4 text-sm font-medium transition-colors',
              activeTab === 'transactions'
                ? 'border-burning-orange text-burning-orange'
                : 'border-transparent text-gray-500 hover:text-noble-black',
            ]"
            @click="setActiveTab('transactions')"
          >
            Transactions
          </button>
        </nav>
      </div>

      <div v-if="activeTab === 'profile'" class="grid gap-4 p-6 md:grid-cols-2">
        <div>
          <p class="text-xs font-medium uppercase tracking-wider text-gray-500">Username</p>
          <p class="mt-1 text-sm text-noble-black">@{{ user.username }}</p>
        </div>
        <div>
          <p class="text-xs font-medium uppercase tracking-wider text-gray-500">Joined</p>
          <p class="mt-1 text-sm text-noble-black">{{ formatDateTime(user.createdAt) }}</p>
        </div>
        <div>
          <p class="text-xs font-medium uppercase tracking-wider text-gray-500">Lender Rating</p>
          <p class="mt-1 text-sm text-noble-black">
            {{ user.lender?.lenderRating?.toFixed(1) ?? "No rating" }}
          </p>
        </div>
        <div>
          <p class="text-xs font-medium uppercase tracking-wider text-gray-500">Borrower Rating</p>
          <p class="mt-1 text-sm text-noble-black">
            {{ user.borrower?.borrowerRating?.toFixed(1) ?? "No rating" }}
          </p>
        </div>
        <div class="md:col-span-2">
          <p class="text-xs font-medium uppercase tracking-wider text-gray-500">Bio</p>
          <p class="mt-1 text-sm text-noble-black">{{ user.bio || "No bio provided." }}</p>
        </div>
      </div>

      <div v-else-if="activeTab === 'listings'" class="p-6">
        <div class="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 class="text-lg font-bold text-noble-black">Listings</h2>
            <p class="text-sm text-gray-600">All items listed by this user</p>
          </div>
          <p class="text-sm text-gray-500">{{ totalListings }} total</p>
        </div>

        <div v-if="loadingListings" class="p-8 text-center text-gray-500">Loading listings...</div>

        <div v-else-if="listingsError" class="p-8 text-center text-red-600">
          <p class="font-medium">Unable to load listings.</p>
          <p class="text-sm text-gray-500">{{ listingsError.message }}</p>
        </div>

        <div v-else-if="listings.length === 0" class="p-8 text-center text-gray-500">
          No listings found for this user.
        </div>

        <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <NuxtLink
            v-for="listing in listings"
            :key="listing.id"
            :to="{
              path: buildItemDetailPath({ id: listing.id, name: listing.name }),
              query: { from: 'admin-user-listings', adminUserId: userId },
            }"
            :aria-label="`View details for ${listing.name}`"
            class="rounded-lg border border-cinnamon-ice bg-white p-4 transition-colors hover:border-burning-orange/40"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h3 class="truncate text-base font-semibold text-noble-black">
                  {{ listing.name }}
                </h3>
                <p class="mt-1 text-xs text-gray-500">{{ listing.id }}</p>
              </div>
              <span
                :class="[
                  'shrink-0 rounded-full px-3 py-1 text-xs font-medium',
                  getListingStatusColor(listing.status),
                ]"
              >
                {{ listing.status }}
              </span>
            </div>

            <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p class="text-xs font-medium uppercase tracking-wider text-gray-500">Condition</p>
                <p class="mt-1 font-medium text-noble-black">{{ listing.condition }}</p>
              </div>
              <div>
                <p class="text-xs font-medium uppercase tracking-wider text-gray-500">Rental Fee</p>
                <p class="mt-1 font-medium text-noble-black">
                  {{ formatCurrency(listing.rentalFee) }}
                </p>
              </div>
              <div>
                <p class="text-xs font-medium uppercase tracking-wider text-gray-500">Rating</p>
                <p class="mt-1 font-medium text-noble-black">
                  {{ listing.rating ? listing.rating.toFixed(1) : "No rating" }}
                </p>
              </div>
              <div>
                <p class="text-xs font-medium uppercase tracking-wider text-gray-500">Activity</p>
                <p class="mt-1 font-medium text-noble-black">
                  {{ listing.bookingCount }} bookings · {{ listing.viewCount }} views
                </p>
              </div>
            </div>

            <p class="mt-4 border-t border-cinnamon-ice pt-3 text-xs text-gray-500">
              Listed {{ formatDateTime(listing.createdAt) }}
            </p>
          </NuxtLink>
        </div>
      </div>

      <div v-else class="p-6">
        <div class="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 class="text-lg font-bold text-noble-black">Transactions</h2>
            <p class="text-sm text-gray-600">All transactions involving this user</p>
          </div>
          <p class="text-sm text-gray-500">{{ totalTransactions }} total</p>
        </div>

        <div v-if="loadingTransactions" class="p-8 text-center text-gray-500">
          Loading transactions...
        </div>

        <div v-else-if="transactionsError" class="p-8 text-center text-red-600">
          <p class="font-medium">Unable to load transactions.</p>
          <p class="text-sm text-gray-500">{{ transactionsError.message }}</p>
        </div>

        <div v-else-if="transactions.length === 0" class="p-8 text-center text-gray-500">
          No transactions found for this user.
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th
                  class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700"
                >
                  Item
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700"
                >
                  Role
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700"
                >
                  Status
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700"
                >
                  Amount
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700"
                >
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-cinnamon-ice">
              <tr
                v-for="transaction in transactions"
                :key="transaction.id"
                class="transition-colors hover:bg-gray-50"
              >
                <td class="px-4 py-4">
                  <p class="text-sm font-medium text-noble-black">
                    {{ transaction.item?.name ?? "Deleted item" }}
                  </p>
                  <p class="text-xs text-gray-500">{{ transaction.id }}</p>
                </td>
                <td class="px-4 py-4">
                  <span class="text-sm font-medium text-noble-black">
                    {{ getTransactionRole(transaction) }}
                  </span>
                </td>
                <td class="px-4 py-4">
                  <span
                    :class="[
                      'rounded-full px-3 py-1 text-xs font-medium',
                      getTransactionStatusColor(transaction.status),
                    ]"
                  >
                    {{ transaction.status }}
                  </span>
                </td>
                <td class="px-4 py-4 text-sm font-medium text-noble-black">
                  {{ formatCurrency(transaction.totalAmount) }}
                </td>
                <td class="px-4 py-4 text-sm text-gray-600">
                  {{ formatDateTime(transaction.createdAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showBanModal"
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          @click="showBanModal = false"
        >
          <div class="bg-white rounded-lg p-6 max-w-sm" @click.stop>
            <h3 class="text-lg font-bold mb-4">Ban User?</h3>
            <div class="mb-4">
              <input id="confirm" v-model="banConfirmation" type="checkbox" />
              <label for="confirm" class="ml-2">I confirm this action</label>
            </div>
            <div class="flex gap-3 justify-end">
              <button class="px-4 py-2 border rounded" @click="showBanModal = false">Cancel</button>
              <button
                :disabled="!banConfirmation"
                class="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
                @click="performBanUser"
              >
                Ban
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
