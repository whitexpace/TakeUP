<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const images = [
  { src: '/images/landing-pic.jpg', position: 'object-[50%_50%]' },
  { src: '/images/landing-pic1.jpg', position: 'object-[50%_35%]' },
  { src: '/images/landing-pic2.jpg', position: 'object-[50%_65%]' },
  { src: '/images/landing-pic3.jpg', position: 'object-[50%_50%]' }
]

const currentImageIndex = ref(0)
let slideshowInterval: NodeJS.Timeout | null = null

onMounted(() => {
  slideshowInterval = setInterval(() => {
    currentImageIndex.value = (currentImageIndex.value + 1) % images.length
  }, 5000) // Change image every 5 seconds
})

onUnmounted(() => {
  if (slideshowInterval) clearInterval(slideshowInterval)
})
</script>

<template>
  <main class="min-h-screen font-sans">
    <!-- Header -->
    <div class="fixed top-0 left-0 w-full h-[77px] box-border bg-white border-b border-cinnamon-ice flex items-center justify-between z-[1000] px-4 lg:px-[60px] 2xl:px-[168px]">
      <div class="flex items-center h-full">
        <div class="text-blue-estate font-rewon text-[22px] lg:text-[28px] leading-none">
          <img src="/images/logo.svg" alt="TakeUP Logo" class="cursor-pointer hover:cursor-pointer" />
        </div>
      </div>
      <div class="flex items-center gap-3 h-full">
        <img src="/images/login-button.svg" alt="Login button" class="w-6 h-6 block cursor-pointer hover:cursor-pointer" />
        <div class="text-noble-black text-base font-normal leading-none cursor-pointer hover:cursor-pointer">Sign in</div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="px-4 lg:px-[60px] 2xl:px-[168px]">
      
      <!-- Section One -->
      <div class="flex flex-col items-center pt-[160px] gap-12 lg:flex-row lg:items-start lg:justify-between lg:pt-[200px] lg:gap-0">
        
        <!-- Left Column -->
        <div class="w-full flex flex-col items-center text-center lg:max-w-[50%] lg:items-start lg:text-left 2xl:max-w-[calc(100%-480px)]">
          <h2 class="text-noble-black font-rewon m-0 mb-4 leading-[1.1] text-[28px] sm:text-[34px] md:text-[42px] lg:text-[48px] xl:text-[55px] lg:mb-4">
            SHARE WHAT YOU <span class="text-burning-orange">HAVE</span>.<br />GET WHAT YOU
            <span class="text-blue-estate">NEED</span>.
          </h2>
          <p class="text-noble-black opacity-80 font-geist m-0 mb-8 leading-[1.45] text-base md:text-xl lg:text-2xl lg:mb-8">
            Borrow essential gear for free or rent items for your projects within a trusted campus
            network.
          </p>
          <div class="flex flex-wrap justify-center gap-4 lg:justify-start">
            <StatCard1 class="mb-4 lg:mr-4 lg:mb-0" value="1,500+" label="Items" />
            <StatCard1 class="mb-4 lg:mr-4 lg:mb-0" value="500+" label="Iskos" />
            <StatCard1 class="mb-4 lg:mr-4 lg:mb-0" value="4.9" label="Average Rating" />
          </div>
        </div>

        <!-- Right Column -->
        <div class="w-full flex flex-col items-center lg:w-fit lg:items-end">
          <div class="bg-white shadow-[6px_8px_50px_rgba(0,0,0,0.15)] rounded-[30px] w-full max-w-[450px] flex flex-col p-6 lg:p-10">
            <h3 class="font-geist font-bold text-[30px] text-noble-black m-0 mb-4">Get started today.</h3>
            <p class="font-geist font-light text-[17px] text-noble-black m-0 mb-8 text-left">Sign in with your UP mail to join the community.</p>
            <button class="bg-burning-orange rounded-[10px] border-none w-full h-[52px] flex items-center justify-center gap-3 cursor-pointer mb-4 text-white font-geist font-medium text-base hover:opacity-90">
              <img src="/images/google-icon.svg" alt="Google" class="w-6 h-6 block" />
              <span>Sign in using your UP mail</span>
            </button>
            <p class="font-geist font-light text-[15px] text-noble-black m-0 text-center">
              Only accounts ending with <span class="font-semibold">up.edu.ph</span> are accepted
            </p>
          </div>
          <div class="mt-6 flex flex-wrap justify-center w-full max-w-[450px] gap-6">
            <FeatureItem text="Verified UP Students only" />
            <FeatureItem text="Secure transactions" />
            <FeatureItem text="Campus-based meetups" />
          </div>
        </div>

      </div>

      <!-- Section Two -->
      <div class="flex flex-col lg:flex-row items-center gap-12 py-20 lg:py-32">
        <!-- Left: Image Slideshow with Floating Badges -->
        <div class="relative w-full lg:w-1/2">
          <div class="relative w-full h-auto rounded-[30px] shadow-lg overflow-hidden">
             <!-- Ghost image to maintain aspect ratio/height -->
             <img src="/images/landing-pic.jpg" alt="" class="w-full h-auto invisible opacity-0 pointer-events-none relative z-0" />
             
             <!-- Slideshow Images -->
             <img v-for="(img, index) in images" 
                  :key="img.src" 
                  :src="img.src" 
                  alt="Campus Sharing" 
                  class="absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-[2000ms] ease-in-out"
                  :class="[index === currentImageIndex ? 'opacity-100 z-10' : 'opacity-0 z-0', img.position]"
             />
          </div>
          
          <!-- Top-Right Badge -->
          <div class="absolute -top-6 -right-4 md:-right-8 bg-cream border border-cinnamon-ice rounded-full px-6 py-3 shadow-md z-20">
            <span class="font-geist text-[20px] text-noble-black font-normal whitespace-nowrap">500+ Iskos</span>
          </div>

          <!-- Bottom-Left Badge -->
          <div class="absolute -bottom-6 -left-4 md:-left-8 bg-blue-estate rounded-full px-6 py-3 shadow-md z-20">
            <span class="font-geist text-[20px] text-cream font-normal whitespace-nowrap">1,500+ Items</span>
          </div>
        </div>

        <!-- Right Content -->
        <div class="w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left">
          <div class="font-rewon text-noble-black m-0 mb-6 leading-[1.1] uppercase text-[28px] sm:text-[34px] md:text-[42px] lg:text-[48px] xl:text-[55px]">
            BORROW <span class="text-burning-orange">LOCALLY</span>. LEND <span class="text-blue-estate">SAFELY</span>. SAVE <span class="text-burning-orange">MONEY</span>.
          </div>
          <p class="text-noble-black opacity-80 font-geist m-0 mb-10 leading-[1.45] text-base md:text-xl lg:text-2xl">
            No “neighbors” — just students. Our campus-exclusive platform connects you with
            verified UP students who have what you need or want what you have.
          </p>
          <div class="flex flex-col sm:flex-row gap-4">
             <BorrowNowButton />
             <LendItemButton />
          </div>
        </div>
      </div>

      <!-- Section Three -->
      <div class="py-20 lg:py-32 w-full flex justify-center px-4 lg:px-0">
        <div class="bg-white shadow-[6px_8px_50px_rgba(0,0,0,0.15)] rounded-[30px] p-8 lg:p-[60px] w-full max-w-[900px] flex flex-col items-center">
          <h2 class="font-geist font-bold text-[30px] text-noble-black m-0 mb-8 text-center">What are you looking for?</h2>
          <div class="w-full flex justify-center mb-6">
            <SearchBar />
          </div>
          <div class="w-full max-w-[760px] grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6"> 
            <StatCard2 value="6" label="Borrowed Today" />
            <StatCard2 value="4.9" label="Average Rating" />
            <StatCard2 value="67" label="Active Items" />
          </div>  
        </div>
      </div>

      <!-- Section Four -->
      <div class="py-20 lg:py-32">
        <div class="flex justify-between items-center mb-4 lg:mb-6">
          <h2 class="font-rewon text-noble-black m-0 p-0 leading-none uppercase text-[28px] sm:text-[34px] md:text-[42px] lg:text-[48px] xl:text-[55px]">
            BROWSE CATEGORIES
          </h2>
          <a href="#" class="text-burning-orange font-geist font-medium text-lg hover:underline leading-none">
            View Categories
          </a>
        </div>
        <p class="text-noble-black opacity-80 font-geist m-0 mb-10 leading-[1.45] text-base md:text-xl lg:text-2xl">
          Find exactly what you need across popular categories
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[1px] bg-cinnamon-ice rounded-[30px] overflow-hidden shadow-[6px_8px_50px_rgba(0,0,0,0.15)]">
          <!-- Item 1: Books & Academics -->
          <div class="bg-white p-6 flex flex-row items-center justify-between h-full hover:bg-cream transition-colors cursor-pointer group">
             <div class="w-[80px] h-[80px] flex items-center justify-center shrink-0">
               <img src="/images/categories/book.png" alt="Books" class="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-300">
             </div>
             <div class="text-right flex flex-col items-end">
               <div class="font-geist font-medium text-2xl text-noble-black leading-tight mb-1">Books &<br>Academics</div>
               <div class="font-geist font-normal text-xl text-noble-black opacity-70">342 items</div>
             </div>
          </div>
          <!-- Item 2: Electronics -->
          <div class="bg-white p-6 flex flex-row items-center justify-between h-full hover:bg-cream transition-colors cursor-pointer group">
             <div class="w-[80px] h-[80px] flex items-center justify-center shrink-0">
               <img src="/images/categories/phone.png" alt="Electronics" class="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-300">
             </div>
             <div class="text-right flex flex-col items-end">
               <div class="font-geist font-medium text-2xl text-noble-black leading-tight mb-1">Electronics</div>
               <div class="font-geist font-normal text-xl text-noble-black opacity-70">256 items</div>
             </div>
          </div>
          <!-- Item 3: Arts & Craft Supplies -->
          <div class="bg-white p-6 flex flex-row items-center justify-between h-full hover:bg-cream transition-colors cursor-pointer group">
             <div class="w-[80px] h-[80px] flex items-center justify-center shrink-0">
               <img src="/images/categories/palette.png" alt="Arts" class="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-300">
             </div>
             <div class="text-right flex flex-col items-end">
               <div class="font-geist font-medium text-2xl text-noble-black leading-tight mb-1">Arts & Craft<br>Supplies</div>
               <div class="font-geist font-normal text-xl text-noble-black opacity-70">189 items</div>
             </div>
          </div>
          <!-- Item 4: Event & Party -->
          <div class="bg-white p-6 flex flex-row items-center justify-between h-full hover:bg-cream transition-colors cursor-pointer group">
             <div class="w-[80px] h-[80px] flex items-center justify-center shrink-0">
               <img src="/images/categories/disco-ball.png" alt="Party" class="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-300">
             </div>
             <div class="text-right flex flex-col items-end">
               <div class="font-geist font-medium text-2xl text-noble-black leading-tight mb-1">Event &<br>Party</div>
               <div class="font-geist font-normal text-xl text-noble-black opacity-70">167 items</div>
             </div>
          </div>
          <!-- Item 5: Sports Equipment -->
          <div class="bg-white p-6 flex flex-row items-center justify-between h-full hover:bg-cream transition-colors cursor-pointer group">
             <div class="w-[95px] h-[95px] flex items-center justify-center shrink-0">
               <img src="/images/categories/ball.png" alt="Sports" class="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-300">
             </div>
             <div class="text-right flex flex-col items-end">
               <div class="font-geist font-medium text-2xl text-noble-black leading-tight mb-1">Sports<br>Equipment</div>
               <div class="font-geist font-normal text-xl text-noble-black opacity-70">145 items</div>
             </div>
          </div>
          <!-- Item 6: Dorm Essentials -->
          <div class="bg-white p-6 flex flex-row items-center justify-between h-full hover:bg-cream transition-colors cursor-pointer group">
             <div class="w-[95px] h-[95px] flex items-center justify-center shrink-0">
               <img src="/images/categories/lamp.png" alt="Dorm" class="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-300">
             </div>
             <div class="text-right flex flex-col items-end">
               <div class="font-geist font-medium text-2xl text-noble-black leading-tight mb-1">Dorm<br>Essentials</div>
               <div class="font-geist font-normal text-xl text-noble-black opacity-70">198 items</div>
             </div>
          </div>
          <!-- Item 7: Photography -->
          <div class="bg-white p-6 flex flex-row items-center justify-between h-full hover:bg-cream transition-colors cursor-pointer group">
             <div class="w-[95px] h-[95px] flex items-center justify-center shrink-0">
               <img src="/images/categories/camera.png" alt="Photo" class="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-300">
             </div>
             <div class="text-right flex flex-col items-end">
               <div class="font-geist font-medium text-2xl text-noble-black leading-tight mb-1">Photography</div>
               <div class="font-geist font-normal text-xl text-noble-black opacity-70">87 items</div>
             </div>
          </div>
          <!-- Item 8: Music & Audio -->
          <div class="bg-white p-6 flex flex-row items-center justify-between h-full hover:bg-cream transition-colors cursor-pointer group">
             <div class="w-[95px] h-[95px] flex items-center justify-center shrink-0">
               <img src="/images/categories/headphones.png" alt="Music" class="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-300">
             </div>
             <div class="text-right flex flex-col items-end">
               <div class="font-geist font-medium text-2xl text-noble-black leading-tight mb-1">Music &<br>Audio</div>
               <div class="font-geist font-normal text-xl text-noble-black opacity-70">116 items</div>
             </div>
          </div>
        </div>
      </div>  

      <!-- Section Five -->
      <div class="py-20 lg:py-32">
        <div class="flex justify-between items-center mb-4 lg:mb-6">
          <h2 class="font-rewon text-noble-black m-0 p-0 leading-none uppercase text-[28px] sm:text-[34px] md:text-[42px] lg:text-[48px] xl:text-[55px]">
            POPULAR ON CAMPUS
          </h2>
          <a href="#" class="text-burning-orange font-geist font-medium text-lg hover:underline leading-none">
            View All Items
          </a>
        </div>
        <p class="text-noble-black opacity-80 font-geist m-0 mb-10 leading-[1.45] text-base md:text-xl lg:text-2xl">
          Most borrowed items this week
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <ItemCard 
            type="Rent"
            image="/images/popular/macbook.jpg"
            category="Electronics"
            name="Macbook Air 13&quot; M1"
            rating="4.9"
            reviews="67"
            price="300"
            owner="Paolo F."
          />
          <ItemCard 
            type="Borrow"
            image="/images/popular/scical.jpg"
            category="Electronics"
            name="Casio FX-991EX ClassWiz"
            rating="4.8"
            reviews="8"
            owner="Dave S."
          />
          <ItemCard 
            type="Rent"
            image="/images/popular/camera.jpg"
            category="Photography"
            name="Sony A7 IV Camera Kit"
            rating="5.0"
            reviews="35"
            price="500"
            owner="Issa S."
          />
          <ItemCard 
            type="Rent"
            image="/images/popular/dress.jpg"
            category="Attire"
            name="Long Green Dress"
            rating="4.8"
            reviews="27"
            price="100"
            owner="Issa S."
          />
        </div>        
      </div>
      
      <!-- Section Six -->
      <div class="w-full bg-[linear-gradient(90deg,#202124_0%,#272d4e_51%,#3b4883_95%)] py-20 lg:py-32 flex flex-col items-center text-center px-4 mt-20 lg:mt-32 rounded-[30px] overflow-hidden">
        <div class="max-w-[1200px] flex flex-col items-center">
          <h2 class="font-rewon text-[34px] sm:text-[42px] md:text-[50px] text-cream leading-tight mb-6 uppercase">
            READY TO START SHARING?
          </h2>
          <p class="font-geist font-medium text-lg md:text-2xl text-cream mb-12 max-w-[800px] opacity-90">
            Join hundreds of UP Cebu students already borrowing and lending on campus.
          </p>
          <div class="flex flex-col sm:flex-row gap-6">
            <BorrowNowButton />
            <LendItemButton />
          </div>
        </div>
      </div>
    </div>

    <footer class="w-full mt-20 lg:mt-32 border-t border-cinnamon-ice border-[1px] py-6 flex items-center justify-center bg-cream">
      <div class="flex items-center justify-center gap-1 font-geist font-semibold text-xs text-noble-black opacity-60">
        2026 &copy; TakeUP. Made with 
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#eb4335" xmlns="http://www.w3.org/2000/svg" class="inline-block mx-0.5">
           <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg> 
        for the UP Cebu Community.
      </div>
    </footer>
  </main>
</template>

<script setup lang="ts"></script>

<style scoped>
.page {
  padding: 2rem;
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    sans-serif;
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
