<template>
  <div class="feature-item">
    <div class="check-icon">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="9" r="9" fill="var(--color-burning-orange)"/>
        <path d="M5 9L8 12L13 6" stroke="var(--color-pale-cashmere)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <span class="feature-text">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  text: string
}>()
</script>

<style scoped>
.feature-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.check-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.feature-text {
  font-family: 'Geist', sans-serif;
  font-weight: 300;
  font-size: 12px;
  color: var(--color-noble-black);
  line-height: 1.2;
  white-space: nowrap;
}
</style>
