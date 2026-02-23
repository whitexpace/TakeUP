<script setup lang="ts">
defineOptions({
  name: "AppHeader",
})
</script>

<template>
  <header class="app-header" />
</template>

<style scoped>
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 77px;
  box-sizing: border-box;
  background-color: var(--color-white);
  border-bottom: 1px solid var(--color-cinnamon-ice);
  z-index: 1000;
}
</style>
