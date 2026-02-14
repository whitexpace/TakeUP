<template>
  <form class="w-full max-w-[760px] min-h-[68px] flex items-center gap-3 px-5 py-[10px] pl-[20px] pr-[12px] border border-cinnamon-ice rounded-[18px] bg-white" role="search" @submit.prevent="onSubmit">
    <img class="w-6 h-6 opacity-70" src="/images/search-icon.svg" alt="" aria-hidden="true" />
    <input
      v-model="query"
      class="flex-1 min-w-0 border-none outline-none text-[#1f1f1f] font-geist text-[18px] leading-[1.2] placeholder-[#6b7280] bg-transparent"
      type="search"
      placeholder="Search for items, categories, or keywords"
      autocomplete="off"
      @keydown.enter.prevent="onSubmit"
    />
    <button class="h-[46px] border-none rounded-[12px] px-5 bg-burning-orange text-white font-geist text-base font-semibold cursor-pointer" type="submit">Search</button>
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
