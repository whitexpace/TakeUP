// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['trpc-nuxt', '@nuxtjs/supabase', '@nuxt/eslint'],
  build: { transpile: ['trpc-nuxt'] },
  typescript: { strict: true },
  supabase: {
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/', '/about'],
    },
  },
})
