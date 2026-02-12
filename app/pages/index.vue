<template>
  <main class="page">
    <div class="header">
      <div class="left">
        <img src="/images/logo.svg" alt="TakeUP Logo" href="" class="left-img">
      </div>
        
      <div class="right">
        <img src="/images/login-button.svg" alt="Login button" href="">
        <div class="sign-in">Sign in</div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
const { $trpc } = useNuxtApp()

const { data } = await useAsyncData("health", () => $trpc.health.ping.query())
const status = computed(() => (data.value?.ok ? "API is healthy" : "API not ready"))
</script>

<style scoped>
.page {
  padding: 2rem;
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    sans-serif;
  min-height: 100vh;
}

.header {
  width: 100%;
  height: 77px;
  box-sizing: border-box;
  background-color: #fff;
  border-bottom: 1px solid #dbbba7;
  box-shadow: 0 4px 4px rgba(0, 0, 0, 0.25);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 40px 0 55px;
}

.left {
  display: flex;
  align-items: center;
  height: 100%;
}

.left > div {
  color: #3b4883;
  font-family: 'Rewon', 'Geist', sans-serif;
  font-size: 28px;
  line-height: 1;
}

.right {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 100%;
}

.right img {
  width: 24px;
  height: 24px;
  display: block;
}

.sign-in {
  color: #202124;
  font-size: 16px;
  font-weight: 400;
  line-height: 1;
}

@media (max-width: 768px) {
  .header {
    padding: 0 16px;
  }

  .left > div {
    font-size: 22px;
  }
}

</style>
