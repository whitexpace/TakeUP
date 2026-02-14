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

      <div class="section three">
        <div class="container">
          <h2>What are you looking for?</h2>
          <SearchBar />
          <div class="stats-container"> 
            <StatCard2 class="statcard" value="6" label="Borrowed Today" />
            <StatCard2 class="statcard" value="4.9" label="Average Rating" />
            <StatCard2 class="statcard" value="67" label="Active Items" />
          </div>  
        </div>
      </div>

      <div class="section four">
        <div class="header">
          <h2>BROWSE CATEGORIES</h2>
          <div class="actions" href="">
            View Categories
          </div>
        </div>
        <div class="description">
          Find Exactly what you need across popular categories
        </div>
        <div class="category-panel">
            <CategoryCard text="Audio Visual" />
            <CategoryCard text="Sports & Outdoors" />
            <CategoryCard text="Tools & Equipment" />
            <CategoryCard text="Books & Stationery" />
            <CategoryCard text="Clothing & Accessories" />
            <CategoryCard text="Hobbies & Crafts" />
        </div>
      </div>  

      <div class="section five">
        <div class="header">
          <h2>POPULAR ON CAMPUS</h2>
          <div class="actions" href="">
            View All Items
          </div>
        </div>
        <div class="description">
          Most borrowed items this week
        </div>
        <div class="items-panel">
          <ItemCard />
          <ItemCard />
          <ItemCard />
          <ItemCard />
          <ItemCard />
          <ItemCard />
        </div>        
      </div>
      
      <div class="section six">
        <div class="container">
          <div class="title">
            READY TO START SHARING?
          </div>
          <div class="description">
            Join hundreds of UP Cebu students already borrowing and leanding on campus.
          </div>
          <div class="actions">
            <BorrowNowButton />
            <LendItemButton />
          </div>
        </div>
      </div>
    </div>

    <footer>
      <div class="container">
        <p>2026 &copy; TakeUP. Made with love for the UP Cebu Community.</p>
      </div>
    </footer>
  </main>
</template>

<script setup lang="ts"></script>
