<script setup lang="ts">
import type { inferRouterProxyClient } from "@trpc/client"
import type { AppRouter } from "~~/server/trpc/routers"

type TrpcClient = inferRouterProxyClient<AppRouter>
type UsersListResponse = Awaited<ReturnType<TrpcClient["admin"]["users"]["list"]["query"]>>

const router = useRouter()
const { $trpc } = useNuxtApp() as unknown as { $trpc: TrpcClient }

const searchQuery = ref("")
const selectedRole = ref<"ADMIN" | "USER" | undefined>(undefined)
const selectedStatus = ref<
  "ACTIVE" | "SUSPENDED" | "BANNED" | "PENDING" | "DEACTIVATED" | undefined
>(undefined)
const currentPage = ref(0)
const pageSize = 20

definePageMeta({
  layout: "admin",
  middleware: "admin-auth",
})

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
  selectedRole.value = role as "ADMIN" | "USER" | undefined
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

const user = useSupabaseUser()

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
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-[28px] font-bold text-gray-900">User Management</h1>
        <p class="mt-1 text-[15px] text-gray-500">
          Manage user accounts, roles, and permissions across the platform
        </p>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="flex items-center gap-3">
      <!-- Search Input -->
      <div class="relative flex-1">
        <input
          type="text"
          :value="searchQuery"
          class="h-[38px] w-full rounded-[10px] border-[1.5px] border-gray-200 bg-white px-10 text-[14px] outline-none transition-all focus:border-burning-orange/50 focus:ring-4 focus:ring-burning-orange/5"
          placeholder="Search by name, email, or username..."
          @input="handleSearch(($event.target as HTMLInputElement).value)"
        />
        <Icon
          name="ph:magnifying-glass-light"
          class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
        />
      </div>

      <!-- Role Filter -->
      <select
        :value="selectedRole"
        class="h-[38px] min-w-[140px] rounded-[10px] border-[1.5px] border-gray-200 bg-white px-3 text-[14px] outline-none transition-all focus:border-burning-orange/50"
        @change="handleRoleFilter(($event.target as HTMLSelectElement).value || undefined)"
      >
        <option value="">All Roles</option>
        <option value="ADMIN">Admin</option>
        <option value="USER">User</option>
      </select>

      <!-- Status Filter -->
      <select
        :value="selectedStatus"
        class="h-[38px] min-w-[140px] rounded-[10px] border-[1.5px] border-gray-200 bg-white px-3 text-[14px] outline-none transition-all focus:border-burning-orange/50"
        @change="handleStatusFilter(($event.target as HTMLSelectElement).value || undefined)"
      >
        <option value="">All Statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="BANNED">Banned</option>
        <option value="SUSPENDED">Suspended</option>
        <option value="PENDING">Pending</option>
        <option value="DEACTIVATED">Deactivated</option>
      </select>

      <!-- Clear Filters Button -->
      <button
        class="ml-2 text-[13px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
        @click="clearFilters"
      >
        Clear Filters
      </button>
    </div>

    <!-- Users Table -->
    <ClientOnly>
      <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div v-if="pending" class="p-12 text-center">
          <div class="inline-block animate-spin text-burning-orange">
            <Icon name="ph:circle-notch-light" class="h-8 w-8" />
          </div>
        </div>

        <div v-else-if="error" class="p-12 text-center text-red-600">
          <p class="font-medium">Unable to load users.</p>
          <p class="mt-1 text-sm text-gray-500">{{ error.message }}</p>
        </div>

        <div v-else-if="users.length === 0" class="p-12 text-center text-gray-500">
          <Icon name="ph:users-light" class="mx-auto h-12 w-12 text-gray-200 mb-4" />
          <p class="text-[16px] font-semibold text-gray-400">No users found</p>
          <p class="mt-1 text-sm">Try adjusting your search or filters.</p>
        </div>

        <table v-else class="w-full">
          <thead>
            <tr class="bg-gray-50 border-b-2 border-gray-100">
              <th
                class="px-6 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-[1px]"
              >
                User
              </th>
              <th
                class="px-6 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-[1px]"
              >
                Email
              </th>
              <th
                class="px-6 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-[1px]"
              >
                Role
              </th>
              <th
                class="px-6 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-[1px]"
              >
                Status
              </th>
              <th
                class="px-6 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-[1px]"
              >
                Ratings
              </th>
              <th
                class="px-6 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-[1px]"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="u in users"
              :key="u.id"
              class="group h-[56px] transition-colors cursor-pointer"
              :class="[
                u.id === user?.id
                  ? 'bg-orange-50/50 border-l-[3px] border-orange-600'
                  : 'hover:bg-gray-50/50',
                users.indexOf(u) % 2 === 1 && u.id !== user?.id ? 'bg-gray-50/30' : 'bg-white',
              ]"
              @click="viewUserProfile(u.id)"
            >
              <td class="px-6 py-2">
                <div class="flex items-center gap-3">
                  <div
                    class="h-[36px] w-[36px] shrink-0 flex items-center justify-center rounded-full bg-slate-100 text-[13px] font-bold text-slate-600 border border-slate-200"
                  >
                    {{ u.firstName.charAt(0) }}{{ u.lastName.charAt(0) }}
                  </div>
                  <div class="flex flex-col">
                    <div class="flex items-center gap-2">
                      <span class="text-[14px] font-semibold text-gray-900 leading-tight">
                        {{ u.firstName }} {{ u.lastName }}
                      </span>
                      <span
                        v-if="u.id === user?.id"
                        class="px-1.5 py-0.5 rounded-[4px] bg-orange-50 text-orange-600 text-[10px] font-bold border border-orange-100 uppercase"
                      >
                        You
                      </span>
                    </div>
                    <span class="text-[12px] text-gray-400 leading-tight">@{{ u.username }}</span>
                  </div>
                </div>
              </td>
              <td class="px-6 py-2">
                <span class="font-mono text-[13px] text-gray-500">{{ u.email }}</span>
              </td>
              <td class="px-6 py-2">
                <span
                  v-if="u.accountType === 'ADMIN'"
                  class="rounded-full rounded-tr-[11px] bg-violet-100 px-[10px] py-[2px] text-[12px] font-bold text-violet-600"
                >
                  ADMIN
                </span>
                <span
                  v-else-if="u.accountType === 'USER'"
                  class="rounded-full rounded-tr-[11px] bg-blue-100 px-[10px] py-[2px] text-[12px] font-bold text-blue-700"
                >
                  USER
                </span>
                <span
                  v-else
                  class="rounded-full rounded-tr-[11px] bg-gray-100 px-[10px] py-[2px] text-[12px] font-bold text-gray-600"
                >
                  {{ u.accountType }}
                </span>
              </td>
              <td class="px-6 py-2">
                <span
                  v-if="u.status === 'ACTIVE'"
                  class="rounded-full bg-emerald-100 px-[10px] py-[2px] text-[12px] font-bold text-emerald-600"
                >
                  ACTIVE
                </span>
                <span
                  v-else-if="u.status === 'SUSPENDED'"
                  class="rounded-full bg-amber-100 px-[10px] py-[2px] text-[12px] font-bold text-amber-600"
                >
                  SUSPENDED
                </span>
                <span
                  v-else
                  class="rounded-full bg-gray-100 px-[10px] py-[2px] text-[12px] font-bold text-gray-500"
                >
                  {{ u.status }}
                </span>
              </td>
              <td class="px-6 py-2">
                <div class="flex items-center gap-3">
                  <div
                    v-if="u.lenderRating > 0"
                    class="flex items-center gap-1 text-[12px] font-medium text-slate-500"
                  >
                    <span class="text-burning-orange">★</span>
                    {{ u.lenderRating.toFixed(1) }}
                  </div>
                  <div
                    v-if="u.borrowerRating > 0"
                    class="flex items-center gap-1 text-[12px] font-medium text-slate-500"
                  >
                    <span class="text-blue-600">★</span>
                    {{ u.borrowerRating.toFixed(1) }}
                  </div>
                  <span
                    v-if="u.lenderRating === 0 && u.borrowerRating === 0"
                    class="text-[12px] text-gray-400"
                    >—</span
                  >
                </div>
              </td>
              <td class="px-6 py-2 text-right">
                <button
                  class="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-gray-900 transition-all"
                >
                  <Icon name="ph:dots-three-light" class="w-[18px] h-[18px]" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ClientOnly>

    <!-- Pagination -->
    <div class="flex items-center justify-between mt-2">
      <p class="text-[13px] text-gray-400">
        Showing {{ startIndex }} to {{ endIndex }} of {{ totalCount }} users
      </p>

      <div class="flex items-center gap-6">
        <div class="flex items-center gap-2">
          <span class="text-[13px] text-gray-400">Rows per page:</span>
          <select
            class="h-8 rounded-lg border-[1.5px] border-gray-200 bg-white px-2 text-[13px] font-medium outline-none transition-all focus:border-burning-orange/50"
          >
            <option>10</option>
            <option selected>20</option>
            <option>50</option>
          </select>
        </div>

        <div class="flex gap-2">
          <button
            :disabled="currentPage === 0"
            class="flex h-9 items-center gap-2 px-4 text-[13px] font-semibold text-gray-700 border-[1.5px] border-gray-200 rounded-[8px] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            @click="currentPage = Math.max(0, currentPage - 1)"
          >
            Previous
          </button>

          <div class="flex items-center gap-1">
            <button
              v-for="page in Math.min(5, totalPages)"
              :key="page"
              :class="[
                'h-9 w-9 flex items-center justify-center text-[13px] font-bold rounded-full transition-all',
                currentPage === page - 1
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100',
              ]"
              @click="currentPage = page - 1"
            >
              {{ page }}
            </button>
          </div>

          <button
            :disabled="!pageInfo?.hasMore"
            class="flex h-9 items-center gap-2 px-4 text-[13px] font-semibold text-gray-700 border-[1.5px] border-gray-200 rounded-[8px] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            @click="currentPage = Math.min(totalPages - 1, currentPage + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
