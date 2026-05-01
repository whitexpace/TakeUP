<script setup lang="ts">
import type { inferRouterProxyClient } from "@trpc/client"
import type { AppRouter } from "~~/server/trpc/routers"

type TrpcClient = inferRouterProxyClient<AppRouter>
type UsersListResponse = Awaited<ReturnType<TrpcClient["admin"]["users"]["list"]["query"]>>

const router = useRouter()
const { $trpc } = useNuxtApp() as unknown as { $trpc: TrpcClient }

const searchQuery = ref("")
const selectedRole = ref<"LENDER" | "BORROWER" | "ADMIN" | undefined>(undefined)
const selectedStatus = ref<
  "ACTIVE" | "SUSPENDED" | "BANNED" | "PENDING" | "DEACTIVATED" | undefined
>(undefined)
const currentPage = ref(0)
const pageSize = 20

const statusOptions = [
  { value: "ACTIVE", label: "Active", color: "bg-green-100 text-green-700" },
  { value: "SUSPENDED", label: "Suspended", color: "bg-yellow-100 text-yellow-700" },
  { value: "BANNED", label: "Banned", color: "bg-red-100 text-red-700" },
  { value: "PENDING", label: "Pending", color: "bg-blue-100 text-blue-700" },
  { value: "DEACTIVATED", label: "Deactivated", color: "bg-gray-100 text-gray-700" },
]

definePageMeta({
  layout: "admin",
  middleware: "admin-auth",
})

const getStatusColor = (status: string) => {
  return statusOptions.find((s) => s.value === status)?.color ?? "bg-gray-100 text-gray-700"
}

const { data, pending, error } = await useAsyncData<UsersListResponse>(
  () =>
    `admin:users:${searchQuery.value}:${selectedRole.value}:${selectedStatus.value}:${currentPage.value}`,
  () =>
    $trpc.admin.users.list.query({
      search: searchQuery.value || undefined,
      role: selectedRole.value,
      status: selectedStatus.value,
      skip: currentPage.value * pageSize,
      take: pageSize,
    }),
  {
    server: false,
    watch: [searchQuery, selectedRole, selectedStatus, currentPage],
  },
)

const users = computed(() => data.value?.users ?? [])
const totalCount = computed(() => data.value?.totalCount ?? 0)
const pageInfo = computed(() => data.value?.pageInfo)
const totalPages = computed(() => Math.ceil(totalCount.value / pageSize))
const startIndex = computed(() => (totalCount.value === 0 ? 0 : currentPage.value * pageSize + 1))
const endIndex = computed(() => Math.min((currentPage.value + 1) * pageSize, totalCount.value))

const handleSearch = (query: string) => {
  searchQuery.value = query
  currentPage.value = 0
}

const handleRoleFilter = (role: string | undefined) => {
  selectedRole.value = role as "LENDER" | "BORROWER" | "ADMIN" | undefined
  currentPage.value = 0
}

const handleStatusFilter = (status: string | undefined) => {
  selectedStatus.value = status as
    | "ACTIVE"
    | "SUSPENDED"
    | "BANNED"
    | "PENDING"
    | "DEACTIVATED"
    | undefined
  currentPage.value = 0
}

const viewUserProfile = (userId: string) => {
  void router.push(`/admin/users/${userId}`)
}

const clearFilters = () => {
  searchQuery.value = ""
  selectedRole.value = undefined
  selectedStatus.value = undefined
  currentPage.value = 0
}
</script>

<template>
  <div class="flex flex-col gap-8 p-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-noble-black">User Management</h1>
        <p class="mt-1 text-sm text-gray-600">
          Manage user accounts, roles, and permissions across the platform
        </p>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="bg-white rounded-lg border border-cinnamon-ice p-6 space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <!-- Search Input -->
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-noble-black mb-2">Search Users</label>
          <div class="relative">
            <input
              type="text"
              :value="searchQuery"
              class="w-full px-4 py-2 border border-cinnamon-ice rounded-lg focus:outline-none focus:ring-2 focus:ring-burning-orange"
              placeholder="Name, email, or username..."
              @input="handleSearch(($event.target as HTMLInputElement).value)"
            />
            <svg
              class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        <!-- Role Filter -->
        <div>
          <label class="block text-sm font-medium text-noble-black mb-2">Role</label>
          <select
            :value="selectedRole"
            class="w-full px-4 py-2 border border-cinnamon-ice rounded-lg focus:outline-none focus:ring-2 focus:ring-burning-orange bg-white"
            @change="handleRoleFilter(($event.target as HTMLSelectElement).value || undefined)"
          >
            <option value="">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="LENDER">Lender</option>
            <option value="BORROWER">Borrower</option>
          </select>
        </div>

        <!-- Status Filter -->
        <div>
          <label class="block text-sm font-medium text-noble-black mb-2">Status</label>
          <select
            :value="selectedStatus"
            class="w-full px-4 py-2 border border-cinnamon-ice rounded-lg focus:outline-none focus:ring-2 focus:ring-burning-orange bg-white"
            @change="handleStatusFilter(($event.target as HTMLSelectElement).value || undefined)"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="BANNED">Banned</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="PENDING">Pending</option>
            <option value="DEACTIVATED">Deactivated</option>
          </select>
        </div>
      </div>

      <!-- Clear Filters Button -->
      <div class="flex justify-end">
        <button
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          @click="clearFilters"
        >
          Clear Filters
        </button>
      </div>
    </div>

    <!-- Users Table -->
    <ClientOnly>
      <template #fallback>
        <div class="bg-white rounded-lg border border-cinnamon-ice overflow-hidden">
          <div class="p-8 text-center">
            <div class="inline-block animate-spin">
              <svg
                class="w-6 h-6 text-burning-orange"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
          </div>
        </div>
      </template>

      <div class="bg-white rounded-lg border border-cinnamon-ice overflow-hidden">
        <div v-if="pending" class="p-8 text-center">
          <div class="inline-block animate-spin">
            <svg
              class="w-6 h-6 text-burning-orange"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
        </div>

        <div v-else-if="error" class="p-8 text-center text-red-600">
          <p class="font-medium">Unable to load users.</p>
          <p class="text-sm text-gray-500">{{ error.message }}</p>
        </div>

        <div v-else-if="users.length === 0" class="p-8 text-center text-gray-500">
          <svg
            class="mx-auto w-12 h-12 text-gray-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4.354a4 4 0 110 5.292M15 21H3.914a.5.5 0 01-.5-.5V5.5a.5.5 0 01.5-.5h16.172a.5.5 0 01.5.5v10"
            />
          </svg>
          <p>No users found. Try adjusting your filters.</p>
        </div>

        <table v-else class="w-full">
          <thead class="bg-gray-50 border-b border-cinnamon-ice">
            <tr>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
              >
                User
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
              >
                Email
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
              >
                Role
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
              >
                Status
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
              >
                Rating
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
              >
                Joined
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-cinnamon-ice">
            <tr
              v-for="user in users"
              :key="user.id"
              class="user-row group cursor-pointer transition-all duration-200 hover:bg-orange-50 hover:shadow-md hover:border-burning-orange/30"
              @click="viewUserProfile(user.id)"
            >
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-full bg-gradient-to-br from-burning-orange to-cinnabar-red flex items-center justify-center text-white text-sm font-semibold group-hover:scale-110 transition-transform duration-200"
                  >
                    {{ user.firstName.charAt(0) }}{{ user.lastName.charAt(0) }}
                  </div>
                  <div>
                    <p class="text-sm font-medium text-noble-black group-hover:text-burning-orange transition-colors duration-200">
                      {{ user.firstName }} {{ user.lastName }}
                    </p>
                    <p class="text-xs text-gray-500">@{{ user.username }}</p>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 group-hover:text-noble-black transition-colors duration-200">{{ user.email }}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  :class="[
                    'px-3 py-1 rounded-full text-xs font-medium',
                    user.accountType === 'ADMIN'
                      ? 'bg-purple-100 text-purple-700'
                      : user.accountType === 'LENDER'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700',
                  ]"
                >
                  {{ user.accountType }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  :class="[
                    'px-3 py-1 rounded-full text-xs font-medium',
                    getStatusColor(user.status),
                  ]"
                >
                  {{ user.status }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                <div class="flex gap-2 text-xs">
                  <span v-if="user.lenderRating > 0" class="text-blue-600 font-medium">
                    📦 {{ user.lenderRating.toFixed(1) }}
                  </span>
                  <span v-if="user.borrowerRating > 0" class="text-green-600 font-medium">
                    👤 {{ user.borrowerRating.toFixed(1) }}
                  </span>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 group-hover:text-noble-black transition-colors duration-200">
                {{ new Date(user.createdAt).toLocaleDateString() }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ClientOnly>

    <!-- Pagination -->
    <div class="flex items-center justify-between">
      <p class="text-sm text-gray-600">
        Showing {{ startIndex }} to {{ endIndex }} of {{ totalCount }} users
      </p>

      <div class="flex gap-2">
        <button
          :disabled="currentPage === 0"
          class="px-4 py-2 text-sm font-medium border border-cinnamon-ice rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          @click="currentPage = Math.max(0, currentPage - 1)"
        >
          Previous
        </button>

        <div class="flex items-center gap-1">
          <button
            v-for="page in Math.min(5, totalPages)"
            :key="page"
            :class="[
              'px-3 py-2 text-sm font-medium rounded-lg border transition-colors',
              currentPage === page - 1
                ? 'bg-burning-orange text-white border-burning-orange'
                : 'border-cinnamon-ice hover:bg-gray-50',
            ]"
            @click="currentPage = page - 1"
          >
            {{ page }}
          </button>
        </div>

        <button
          :disabled="!pageInfo?.hasMore"
          class="px-4 py-2 text-sm font-medium border border-cinnamon-ice rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          @click="currentPage = Math.min(totalPages - 1, currentPage + 1)"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>
