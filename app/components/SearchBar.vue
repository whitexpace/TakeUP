<template>
  <form
    class="w-full max-w-[760px] min-h-[68px] flex items-center gap-3 px-5 py-[10px] pl-[20px] pr-[12px] border-[0.5px] border-cinnamon-ice rounded-[20px] bg-cream"
    role="search"
    @submit.prevent="onSubmit"
  >
    <!-- Search Icon (Visible when query is empty) -->
    <svg
      v-if="!query"
      width="24"
      height="24"
      viewBox="0 0 19 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="text-noble-black opacity-70 flex-shrink-0"
    >
      <circle cx="7" cy="7" r="6.25" stroke="currentColor" stroke-width="1" />
      <line
        x1="13.0401"
        y1="10.792"
        x2="17.792"
        y2="13.9599"
        stroke="currentColor"
        stroke-width="1"
        stroke-linecap="round"
      />
    </svg>

    <!-- Clear Icon (Visible when query has text) -->
    <button
      v-else
      type="button"
      class="text-noble-black opacity-70 flex-shrink-0 hover:opacity-100 transition-opacity"
      @click="clearSearch"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M18 6L6 18M6 6L18 18"
          stroke="currentColor"
          stroke-width="1"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <input
      v-model="query"
      class="flex-1 min-w-0 border-none outline-none text-noble-black opacity-70 font-geist text-[18px] leading-[1.2] placeholder-noble-black placeholder-opacity-70 bg-transparent"
      type="search"
      placeholder="Search for items, categories, or keywords"
      autocomplete="off"
      @keydown.enter.prevent="onSubmit"
    />
    <button
      class="h-[46px] border-none rounded-[12px] px-5 bg-burning-orange text-white font-geist text-base font-semibold cursor-pointer hover:opacity-90 transition-opacity"
      type="submit"
    >
      Search
    </button>
  </form>
</template>

<script setup lang="ts">
import { ref } from "vue"

const emit = defineEmits<{
  search: [query: string]
}>()

const query = ref("")

function onSubmit() {
  const value = query.value.trim()
  emit("search", value)
}

function clearSearch() {
  query.value = ""
}
</script>
