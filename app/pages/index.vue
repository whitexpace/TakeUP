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

      <div class="content">
      <div class="section one">
        <div class="left">
          <h1 class="slogan">SHARE WHAT YOU <span class="highlight orange">HAVE</span><br>GET WHAT YOU <span class="highlight blue">NEED</span></h1>
          <p class="description">Borrow essential gear for free or rent items for your projects within a trusted campus network.</p>
          <div class="stats">
            <StatCard />
            <StatCard />
            <StatCard />
          </div>
        </div>
        <div class="right">
          <div>Login component</div>
          <div>
            <p>Verified UP Students only</p>  
            <p>Secure transactions</p>
            <p>Campus-based meetups</p>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
</script>

<style scoped>
.page {
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
  padding: 0 168px 0 168px;
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

.left-img:hover {
  cursor: pointer;
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

.right img:hover {
  cursor: pointer;
}

.sign-in {
  color: #202124;
  font-size: 16px;
  font-weight: 400;
  line-height: 1;
}

.sign-in:hover {
  cursor: pointer;
}

.content {
  padding: 0 168px 0 168px;
  margin-top: 48px;
}

.section.one {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section.one .left {
  max-width: 50%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.section.one .right {
  max-width: 50%;
  justify-content: flex-start;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}



@media (max-width: 768px) {
  .header, .content {
    padding: 0 16px;
  }

  .left > div {
    font-size: 22px;
  }
}

</style>
