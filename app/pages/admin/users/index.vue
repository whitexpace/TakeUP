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
const pageSize = 10
const allUsers = ref<UsersListResponse["users"]>([])

definePageMeta({
  layout: "admin",
  middleware: "admin-auth",
})

const { data, pending, error, refresh } = await useAsyncData<UsersListResponse>(
  () =>
    `admin:users:${searchQuery.value}:${selectedRole.value}:${selectedStatus.value}:${currentPage.value}`,
  async () => {
    const response = await $trpc.admin.users.list.query({
      search: searchQuery.value || undefined,
      role: selectedRole.value,
      status: selectedStatus.value,
      skip: currentPage.value * pageSize,
      take: pageSize,
    })

    if (currentPage.value === 0) {
      allUsers.value = response.users
    } else {
      allUsers.value = [...allUsers.value, ...response.users]
    }

    return response
  },
  {
    server: false,
    watch: [searchQuery, selectedRole, selectedStatus],
  },
)

// Reset when filters change
watch([searchQuery, selectedRole, selectedStatus], () => {
  currentPage.value = 0
})

const users = computed(() => allUsers.value)

const hasMore = computed(() => (data.value?.users.length ?? 0) >= pageSize)

const loadMore = () => {
  if (!pending.value && hasMore.value) {
    currentPage.value++
    void refresh()
  }
}

const handleSearch = (query: string) => {
  searchQuery.value = query
}

const handleRoleFilter = (role: string | undefined) => {
  selectedRole.value = role as "ADMIN" | "USER" | undefined
}

const handleStatusFilter = (status: string | undefined) => {
  selectedStatus.value = status as
    | "ACTIVE"
    | "SUSPENDED"
    | "BANNED"
    | "PENDING"
    | "DEACTIVATED"
    | undefined
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
  <div class="flex flex-col gap-10 font-geist">
    <!-- Elegant Executive Header -->
    <header class="space-y-3">
      <div class="space-y-2">
        <h1 class="font-montravia text-[36px] font-medium text-noble-black">User Management</h1>
        <div class="w-10 h-0.5 bg-burning-orange"></div>
      </div>
      <p class="text-[16px] font-light leading-relaxed text-noble-black/50">
        Manage user accounts, roles, and permissions across the platform.
      </p>
    </header>

    <!-- Refined Search and Filters -->
    <div
      class="flex flex-col lg:flex-row items-center gap-4 bg-white p-5 rounded-[24px] border border-cinnamon-ice/20 shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
    >
      <!-- Search Input -->
      <div class="relative flex-1 w-full">
        <input
          type="text"
          :value="searchQuery"
          class="h-[48px] w-full rounded-[14px] border-[1.5px] border-gray-100 bg-gray-50/50 px-12 text-[14px] font-medium outline-none transition-all focus:border-burning-orange/30 focus:bg-white focus:ring-4 focus:ring-burning-orange/5"
          placeholder="Search by name, email, or username..."
          @input="handleSearch(($event.target as HTMLInputElement).value)"
        />
        <div
          class="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5"
        >
          <button
            v-if="searchQuery"
            class="text-gray-400 hover:text-burning-orange transition-colors flex items-center justify-center"
            @click="searchQuery = ''"
          >
            <Icon name="ph:x" class="w-5 h-5" />
          </button>
          <Icon v-else name="ph:magnifying-glass" class="w-5 h-5 text-gray-400" />
        </div>
      </div>

      <div class="flex items-center gap-3 w-full lg:w-auto">
        <!-- Role Filter -->
        <div class="relative flex-1 lg:min-w-[160px]">
          <select
            :value="selectedRole"
            class="h-[48px] w-full appearance-none rounded-[14px] border-[1.5px] border-gray-100 bg-gray-50/50 px-4 pr-10 text-[14px] font-bold text-noble-black/70 outline-none transition-all focus:border-burning-orange/30 focus:bg-white"
            @change="handleRoleFilter(($event.target as HTMLSelectElement).value || undefined)"
          >
            <option value="">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="USER">User</option>
          </select>
          <Icon
            name="ph:caret-down-bold"
            class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-noble-black/30 pointer-events-none"
          />
        </div>

        <!-- Status Filter -->
        <div class="relative flex-1 lg:min-w-[160px]">
          <select
            :value="selectedStatus"
            class="h-[48px] w-full appearance-none rounded-[14px] border-[1.5px] border-gray-100 bg-gray-50/50 px-4 pr-10 text-[14px] font-bold text-noble-black/70 outline-none transition-all focus:border-burning-orange/30 focus:bg-white"
            @change="handleStatusFilter(($event.target as HTMLSelectElement).value || undefined)"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="BANNED">Banned</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="PENDING">Pending</option>
            <option value="DEACTIVATED">Deactivated</option>
          </select>
          <Icon
            name="ph:caret-down-bold"
            class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-noble-black/30 pointer-events-none"
          />
        </div>

        <!-- Clear Filters Button -->
        <button
          v-if="searchQuery || selectedRole || selectedStatus"
          class="h-[48px] px-6 text-[13px] font-bold text-burning-orange hover:bg-burning-orange/5 rounded-[14px] transition-all"
          @click="clearFilters"
        >
          Reset
        </button>
      </div>
    </div>

    <!-- Users Table Elevated -->
    <ClientOnly>
      <div
        class="overflow-hidden rounded-[32px] border border-cinnamon-ice/20 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
      >
        <div class="p-8 border-b border-gray-50 flex items-center justify-between">
          <div class="border-l-[3px] border-burning-orange pl-4">
            <h2 class="text-[20px] font-semibold text-noble-black tracking-tight">
              User Directory
            </h2>
            <p class="mt-0.5 text-[13px] font-light text-noble-black/50">
              Full registry of platform members and their current status.
            </p>
          </div>
        </div>

        <div v-if="pending && !users.length">
          <TableSkeleton />
        </div>

        <div v-else-if="error" class="p-20 text-center">
          <div
            class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <Icon name="ph:warning-circle" class="h-8 w-8 text-cinnabar-red" />
          </div>
          <p class="text-[18px] font-bold text-noble-black">Sync Failure</p>
          <p class="mt-2 text-[14px] font-medium text-noble-black/40">{{ error.message }}</p>
        </div>

        <div v-else-if="users.length === 0" class="p-20 text-center">
          <div
            class="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <Icon name="ph:users" class="h-10 w-10 text-gray-200" />
          </div>
          <p class="text-[18px] font-bold text-noble-black">No accounts found</p>
          <p class="mt-2 text-[14px] font-medium text-noble-black/40">
            Try adjusting your search or filters.
          </p>
        </div>

        <div v-else class="max-h-[600px] overflow-y-auto custom-admin-main-scrollbar">
          <table class="w-full">
            <thead class="sticky top-0 z-10">
              <tr class="bg-gray-50 border-b border-gray-100">
                <th
                  class="px-8 py-5 text-left text-[11px] font-bold text-noble-black/30 uppercase tracking-[2px]"
                >
                  User
                </th>
                <th
                  class="px-8 py-5 text-left text-[11px] font-bold text-noble-black/30 uppercase tracking-[2px]"
                >
                  Role
                </th>
                <th
                  class="px-8 py-5 text-left text-[11px] font-bold text-noble-black/30 uppercase tracking-[2px]"
                >
                  Status
                </th>
                <th
                  class="px-8 py-5 text-left text-[11px] font-bold text-noble-black/30 uppercase tracking-[2px]"
                >
                  Ratings
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr
                v-for="u in users"
                :key="u.id"
                class="group h-[72px] transition-all duration-300 cursor-pointer"
                :class="[
                  u.id === user?.id
                    ? 'bg-orange-50/20 border-l-[4px] border-l-burning-orange'
                    : 'hover:bg-cream/40 border-l-[4px] border-l-transparent hover:border-l-cinnamon-ice/30',
                ]"
                @click="viewUserProfile(u.id)"
              >
                <td class="px-8 py-2">
                  <div class="flex items-center gap-4">
                    <div
                      class="h-[42px] w-[42px] shrink-0 flex items-center justify-center rounded-full bg-white text-[14px] font-black text-noble-black border border-cinnamon-ice/20 shadow-sm group-hover:scale-110 transition-transform duration-300"
                    >
                      {{ u.firstName.charAt(0) }}{{ u.lastName.charAt(0) }}
                    </div>
                    <div class="flex flex-col min-w-0">
                      <div class="flex items-center gap-2">
                        <span
                          class="text-[15px] font-bold text-noble-black truncate group-hover:text-burning-orange transition-colors"
                        >
                          {{ u.firstName }} {{ u.lastName }}
                        </span>
                        <span
                          v-if="u.id === user?.id"
                          class="px-2 py-0.5 rounded-full bg-burning-orange/10 text-burning-orange text-[9px] font-black tracking-widest uppercase"
                        >
                          Me
                        </span>
                      </div>
                      <span class="text-[12px] text-noble-black/40 font-medium"
                        >@{{ u.username }}</span
                      >
                    </div>
                  </div>
                </td>
                <td class="px-8 py-2">
                  <span
                    v-if="u.accountType === 'ADMIN'"
                    class="inline-flex items-center px-3 py-1 rounded-full bg-noble-black text-white text-[10px] font-black tracking-widest uppercase"
                  >
                    <Icon name="ph:shield-check-fill" class="w-3 h-3 mr-1.5" />
                    ADMIN
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center px-3 py-1 rounded-full bg-noble-black/[0.04] text-noble-black/60 text-[10px] font-black tracking-widest uppercase"
                  >
                    USER
                  </span>
                </td>
                <td class="px-8 py-2">
                  <span
                    v-if="u.status === 'ACTIVE'"
                    class="inline-flex items-center text-[12px] font-bold text-success-green"
                  >
                    <span
                      class="w-1.5 h-1.5 rounded-full bg-success-green mr-2 animate-pulse"
                    ></span>
                    Active
                  </span>
                  <span
                    v-else-if="u.status === 'SUSPENDED'"
                    class="inline-flex items-center text-[12px] font-bold text-amber-500"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2"></span>
                    Suspended
                  </span>
                  <span
                    v-else-if="u.status === 'BANNED'"
                    class="inline-flex items-center text-[12px] font-bold text-cinnabar-red"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-cinnabar-red mr-2"></span>
                    Banned
                  </span>
                  <span v-else class="text-[12px] font-bold text-noble-black/30">
                    {{ u.status }}
                  </span>
                </td>
                <td class="px-8 py-2">
                  <div class="flex items-center gap-4">
                    <div
                      v-if="u.lenderRating > 0"
                      class="relative flex items-center gap-1 text-[13px] font-black text-noble-black group/tooltip"
                    >
                      <Icon name="ph:star-fill" class="text-burning-orange w-3.5 h-3.5" />
                      {{ u.lenderRating.toFixed(1) }}
                      <div class="custom-tooltip">
                        Lender Rating
                        <div class="tooltip-arrow"></div>
                      </div>
                    </div>
                    <div
                      v-if="u.borrowerRating > 0"
                      class="relative flex items-center gap-1 text-[13px] font-black text-noble-black group/tooltip"
                    >
                      <Icon name="ph:star-fill" class="text-wahoo w-3.5 h-3.5" />
                      {{ u.borrowerRating.toFixed(1) }}
                      <div class="custom-tooltip">
                        Borrower Rating
                        <div class="tooltip-arrow"></div>
                      </div>
                    </div>
                    <span
                      v-if="u.lenderRating === 0 && u.borrowerRating === 0"
                      class="text-[12px] font-bold text-noble-black/20"
                      >—</span
                    >
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Minimal Load More -->
          <div v-if="hasMore" class="p-8 border-t border-gray-50 text-center">
            <button
              :disabled="pending"
              class="text-[13px] font-black uppercase tracking-[2px] text-noble-black/30 hover:text-burning-orange transition-colors disabled:opacity-50"
              @click="loadMore"
            >
              <span v-if="pending" class="flex items-center gap-2 mx-auto justify-center">
                <Icon name="ph:circle-notch" class="animate-spin w-4 h-4" />
                Loading...
              </span>
              <span v-else>Load More Users</span>
            </button>
          </div>
        </div>
      </div>
    </ClientOnly>
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
