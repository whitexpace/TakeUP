<template>
  <main class="page">
    <div class="header">
      <div class="left">
        <img src="/images/logo.svg" alt="TakeUP Logo" href="" class="left-img" />
      </div>
      <div class="right">
        <img src="/images/login-button.svg" alt="Login button" href="" />
        <div class="sign-in">Sign in</div>
      </div>
    </div>

    <div class="content">
      <div class="section one">
        <div class="left">
          <h2 class="slogan">
            SHARE WHAT YOU <span class="highlight orange">HAVE</span>.<br />GET WHAT YOU
            <span class="highlight blue">NEED</span>.
          </h2>
          <p class="description">
            Borrow essential gear for free or rent items for your projects within a trusted campus
            network.
          </p>
          <div class="stats">
            <StatCard class="statcard" value="1,500+" label="Items" />
            <StatCard class="statcard" value="500+" label="Iskos" />
            <StatCard class="statcard" value="4.9" label="Average Rating" />
          </div>
        </div>
        <div class="right">
          <div class="login-card">
            <h3 class="login-title">Get started today.</h3>
            <p class="login-subtitle">Sign in with your UP mail to join the community.</p>
            <button class="login-button">
              <img src="/images/google-icon.svg" alt="Google" class="google-icon" />
              <span>Sign in using your UP mail</span>
            </button>
            <p class="login-note">
              Only accounts ending with <span class="semibold">up.edu.ph</span> are accepted
            </p>
          </div>
          <div class="features-list">
            <FeatureItem text="Verified UP Students only" />
            <FeatureItem text="Secure transactions" />
            <FeatureItem text="Campus-based meetups" />
          </div>
        </div>
      </div>

      <div class="section two">
        <div class="left">Image</div>
        <div class="right">
          <div class="slogan">BORROW LOCALLY. LEND SAFELY. SAVE MONEY.</div>
          <div class="description">
            <p>
              No “neighbors” — just students. Our campus-exclusive platform connects you with
              verified UP students who have what you need or want what you have.
            </p>
          </div>
          <div class="actions-container">
             <BorrowNowButton />
             <LendItemButton />
          </div>
        </div>
      </div>

      
    </div>
  </main>
</template>

<script setup lang="ts"></script>

<style scoped>
.page {
  min-height: 100vh;
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    sans-serif;
}

.header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 77px;
  box-sizing: border-box;
  background-color: var(--color-white);
  border-bottom: 1px solid var(--color-cinnamon-ice);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 168px;
  z-index: 1000;
}

.left {
  display: flex;
  align-items: center;
  height: 100%;
}

.left > div {
  color: var(--color-blue-estate);
  font-family: "Rewon", "Geist", sans-serif;
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
  color: var(--color-noble-black);
  font-size: 16px;
  font-weight: 400;
  line-height: 1;
}

.sign-in:hover {
  cursor: pointer;
}

.content {
  padding: 0 168px;
}

.section.one {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-top: 200px;
}

.section.one .left {
  max-width: 50%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.slogan {
  color: var(--color-noble-black);
  font-family: "Rewon", sans-serif;
  font-size: 55px;
  margin: 0;
  margin-bottom: 16px;
}

.description {
  color: var(--color-noble-black);
  opacity: 0.8;
  font-family: "Geist", sans-serif;
  font-size: 24px;
  margin: 0;
  margin-bottom: 32px;
}

.stats {
  flex-wrap: wrap;
}

.highlight.orange {
  color: var(--color-burning-orange);
}

.highlight.blue {
  color: var(--color-blue-estate);
}

.statcard {
  margin-right: 16px;
  margin-bottom: 32px;
}

.section.one .right {
  width: fit-content;
  justify-content: flex-start;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.login-card {
  background-color: var(--color-white);
  box-shadow: 6px 8px 50px rgba(0, 0, 0, 0.15);
  border-radius: 30px;
  padding: 40px;
  width: 100%;
  max-width: 450px;
  display: flex;
  flex-direction: column;
}

.login-title {
  font-family: "Geist", sans-serif;
  font-weight: 700;
  font-size: 30px;
  color: var(--color-noble-black);
  margin: 0 0 16px 0;
}

.login-subtitle {
  font-family: "Geist", sans-serif;
  font-weight: 300;
  font-size: 17px;
  color: var(--color-noble-black);
  margin: 0 0 32px 0;
  text-align: left;
}

.login-button {
  background-color: var(--color-burning-orange);
  border-radius: 10px;
  border: none;
  width: 100%;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  cursor: pointer;
  margin-bottom: 16px;
  color: var(--color-white);
  font-family: "Geist", sans-serif;
  font-weight: 500;
  font-size: 16px;
}

.login-button:hover {
  opacity: 0.9;
}

.google-icon {
  width: 24px;
  height: 24px;
  display: block;
}

.login-note {
  font-family: "Geist", sans-serif;
  font-weight: 300;
  font-size: 15px;
  color: var(--color-noble-black);
  margin: 0;
  text-align: center;
}

.semibold {
  font-weight: 600;
}

.features-list {
  margin-top: 24px;
  display: flex;
  flex-direction: row;
  justify-content: center;
  width: 100%;
  max-width: 450px;
  gap: 24px;
}

@media (max-width: 1440px) {
  .header,
  .content {
    padding-left: 60px;
    padding-right: 60px;
  }

  .section.one {
    padding-top: 160px;
  }

  .slogan {
    font-size: 42px;
  }

  .description {
    font-size: 20px;
  }

  .section.one .left {
    max-width: calc(100% - 480px);
  }

  .section.one .right {
    width: fit-content;
    align-items: center;
  }
}

@media (max-width: 1024px) {
  .header {
    padding: 0 16px;
  }
  .content {
    padding: 0 16px;
  }

  .section.one {
    flex-direction: column;
    align-items: center;
    gap: 48px;
    padding-top: 160px;
  }

  .section.one .left {
    max-width: 100%;
    width: 100%;
    align-items: center;
    text-align: center;
  }

  .section.one .right {
    max-width: 100%;
    width: 100%;
    align-items: center;
  }

  .features-list {
    justify-content: center;
    flex-wrap: wrap;
  }

  .slogan {
    font-size: 48px;
    line-height: 1.1;
    margin-bottom: 12px;
  }

  .description {
    font-size: 20px;
    line-height: 1.45;
    margin-bottom: 20px;
  }

  .stats {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 16px;
  }

  .statcard {
    margin-right: 0;
    margin-bottom: 16px;
  }

  .left > div {
    font-size: 22px;
  }
}

@media (max-width: 768px) {
  .slogan {
    font-size: 34px;
  }
  .description {
    font-size: 16px;
  }
}

@media (max-width: 480px) {
  .login-card {
    padding: 24px;
  }
}

@media (max-width: 420px) {
  .slogan {
    font-size: 28px;
  }
}
</style>
