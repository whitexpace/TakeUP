<template>
  <div class="stat-card">
    <div class="panel">
        <div class="stat">{{ label }}</div>
      <div class="value">{{ value }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  value: string
  label: string
}>()
</script>

<style scoped>
.stat-card {
  display: inline-block;
  width: fit-content;
  height: 82px;
}

.panel {
  box-sizing: border-box;
  background: #F9F3EC;
  border-radius: 16px;
  padding: 18px;
}

.value {
  margin: 0;
  font-family: 'Geist', sans-serif;
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
  color: var(--color-blue-estate);
}

.stat {
  margin: 9px 0 0;
  font-family: 'Geist', sans-serif;
  font-size: 16px;
  font-weight: 500;
  line-height: 1;
  color: var(--color-noble-black);
  opacity: 0.6;
}
</style>
