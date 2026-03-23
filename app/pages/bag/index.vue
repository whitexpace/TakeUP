<script setup lang="ts">
import { computed, onMounted } from "vue"
import Header from "../../components/Header.vue"
import { useBag, type BagItem } from "../../composables/use-bag"

definePageMeta({
  auth: true,
})

const { bagItems, isLoading, errorMessage, loadBag, removeFromBag } = useBag()

onMounted(() => {
  void loadBag({ force: true })
})

const createDateLabel = (value: string | Date) =>
  new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

const createTimeLabel = (value: string | Date) =>
  new Date(value).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  })

const getDurationUnits = (item: BagItem) => {
  const start = new Date(item.startAt)
  const end = new Date(item.endAt)
  const diffHours = Math.max(0.5, (end.getTime() - start.getTime()) / (1000 * 60 * 60))

  return item.priceUnit === "hour"
    ? Math.max(1, Math.ceil(diffHours))
    : Math.max(1, Math.ceil(diffHours / 24))
}

const getItemTotal = (item: BagItem) => {
  if (item.listingType === "Borrow") return 0
  return item.price * getDurationUnits(item)
}

const formatPesoAmount = (value: number) =>
  `₱${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(value)}`

const totalAmount = computed(() => bagItems.value.reduce((sum, item) => sum + getItemTotal(item), 0))

const removeItem = async (id: string) => {
  try {
    await removeFromBag(id)
  } catch {
    // Keep the page stable and rely on shared state for any follow-up recovery.
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#fcfaf6]">
    <Header />

    <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div class="mb-8 flex items-end justify-between gap-4">
        <div>
          <p class="font-geist text-sm uppercase tracking-[0.2em] text-burning-orange">Bag</p>
          <h1 class="mt-2 font-geist text-3xl font-bold text-noble-black">
            Your saved booking drafts
          </h1>
          <p class="mt-2 max-w-2xl font-geist text-sm text-noble-black/60">
            Items added here stay in your bag after refresh so you can come back and book them later.
          </p>
        </div>
        <div class="rounded-2xl border border-cinnamon-ice bg-white px-4 py-3 text-right shadow-sm">
          <p class="font-geist text-xs uppercase tracking-[0.18em] text-noble-black/40">Total</p>
          <p class="font-geist text-2xl font-bold text-burning-orange">
            {{ formatPesoAmount(totalAmount) }}
          </p>
        </div>
      </div>

      <div
        v-if="errorMessage"
        class="mb-6 rounded-2xl border border-cinnabar-red/20 bg-cinnabar-red/5 px-4 py-3 font-geist text-sm text-cinnabar-red"
      >
        {{ errorMessage }}
      </div>

      <div
        v-if="isLoading && bagItems.length === 0"
        class="rounded-3xl border border-cinnamon-ice bg-white px-6 py-12 text-center shadow-sm"
      >
        <p class="font-geist text-base text-noble-black/70">Loading your bag…</p>
      </div>

      <div
        v-else-if="bagItems.length === 0"
        class="rounded-3xl border border-dashed border-cinnamon-ice bg-white px-6 py-12 text-center shadow-sm"
      >
        <h2 class="font-geist text-xl font-semibold text-noble-black">Your bag is empty</h2>
        <p class="mt-2 font-geist text-sm text-noble-black/60">
          Add an item from its detail page to keep the booking draft here.
        </p>
        <NuxtLink
          to="/dashboard"
          class="mt-5 inline-flex items-center rounded-full bg-burning-orange px-5 py-2.5 font-geist text-sm font-semibold text-white transition hover:bg-blue-estate"
        >
          Browse items
        </NuxtLink>
      </div>

      <div v-else class="grid gap-4">
        <article
          v-for="bagItem in bagItems"
          :id="bagItem.id"
          :key="bagItem.id"
          class="grid gap-4 rounded-3xl border border-cinnamon-ice bg-white p-5 shadow-sm md:grid-cols-[140px_minmax(0,1fr)_auto]"
        >
          <img
            :src="bagItem.image || '/images/logo.svg'"
            :alt="bagItem.name"
            class="h-32 w-full rounded-2xl bg-cream object-cover md:h-full md:w-[140px]"
          />

          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="inline-flex rounded-full px-3 py-1 font-geist text-xs font-semibold"
                :class="
                  bagItem.listingType === 'Borrow'
                    ? 'bg-blue-estate text-white'
                    : 'bg-cinnamon-ice text-noble-black'
                "
              >
                {{ bagItem.listingType }}
              </span>
              <span class="font-geist text-xs uppercase tracking-[0.18em] text-noble-black/40">
                by {{ bagItem.lenderName }}
              </span>
            </div>

            <h2 class="mt-3 truncate font-geist text-xl font-semibold text-noble-black">
              {{ bagItem.name }}
            </h2>

            <div class="mt-4 grid gap-3 text-sm text-noble-black/70 sm:grid-cols-2">
              <div>
                <p class="font-geist text-[11px] uppercase tracking-[0.16em] text-noble-black/40">Start</p>
                <p class="mt-1 font-geist font-medium text-noble-black">
                  {{ createDateLabel(bagItem.startAt) }} · {{ createTimeLabel(bagItem.startAt) }}
                </p>
              </div>
              <div>
                <p class="font-geist text-[11px] uppercase tracking-[0.16em] text-noble-black/40">End</p>
                <p class="mt-1 font-geist font-medium text-noble-black">
                  {{ createDateLabel(bagItem.endAt) }} · {{ createTimeLabel(bagItem.endAt) }}
                </p>
              </div>
            </div>
          </div>

          <div class="flex flex-col items-start gap-3 md:items-end">
            <div class="text-left md:text-right">
              <p class="font-geist text-xs uppercase tracking-[0.18em] text-noble-black/40">Estimate</p>
              <p class="mt-1 font-geist text-2xl font-bold text-burning-orange">
                {{ bagItem.listingType === "Borrow" ? "Free" : formatPesoAmount(getItemTotal(bagItem)) }}
              </p>
              <p class="font-geist text-xs text-noble-black/50">
                {{ getDurationUnits(bagItem) }} {{ bagItem.priceUnit
                }}{{ getDurationUnits(bagItem) > 1 ? "s" : "" }}
              </p>
            </div>

            <button
              class="rounded-full border border-cinnamon-ice px-4 py-2 font-geist text-sm font-medium text-noble-black transition hover:border-cinnabar-red hover:text-cinnabar-red"
              @click="removeItem(bagItem.id)"
            >
              Remove
            </button>
          </div>
        </article>
      </div>
    </main>
  </div>
</template>
