<template>
  <div class="stat-card">
    <div class="panel">
      <div class="value">1,500+</div>
      <div class="stat">Items</div>
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  display: inline-block;
  width: fit-content;
  height: 82px;
}

.panel {
  box-sizing: border-box;
  background: #fff;
  border: 1px solid #dbbba7;
  border-radius: 14.5px;
  padding: 18px;
}

.value {
  margin: 0;
  font-family: 'Rewon', 'Geist', sans-serif;
  font-size: 32px;
  font-weight: bold;
  line-height: 1;
  color: #3b4883;
}

.stat {
  margin: 9px 0 0;
  font-family: 'Geist', sans-serif;
  font-size: 16px;
  font-weight: bold;
  line-height: 1;
  color: rgba(32, 33, 36, 0.6);
}
</style>
