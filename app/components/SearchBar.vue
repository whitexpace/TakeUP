<template>
  <form class="search-bar" role="search" @submit.prevent="onSubmit">
    <img class="search-icon" src="/images/search-icon.svg" alt="" aria-hidden="true" />
    <input
      v-model="query"
      class="search-input"
      type="search"
      placeholder="Search items, categories, or keywords"
      autocomplete="off"
      @keydown.enter.prevent="onSubmit"
    />
    <button class="search-button" type="submit">Search</button>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  search: [query: string]
}>()

const query = ref('')

function onSubmit() {
  const value = query.value.trim()
  emit('search', value)
}
</script>

<style scoped>
.search-bar {
  width: 100%;
  max-width: 760px;
  min-height: 68px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px 10px 20px;
  border: 1px solid #dbbba7;
  border-radius: 18px;
  background-color: #ffffff;
}

.search-icon {
  width: 24px;
  height: 24px;
  opacity: 0.7;
}

.search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  color: #1f1f1f;
  font-family: "Geist", sans-serif;
  font-size: 18px;
  line-height: 1.2;
}

.search-input::placeholder {
  color: #6b7280;
}

.search-button {
  height: 46px;
  border: none;
  border-radius: 12px;
  padding: 0 20px;
  background-color: #ff7124;
  color: #ffffff;
  font-family: "Geist", sans-serif;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}
</style>
