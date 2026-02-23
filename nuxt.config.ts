// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@nuxt/eslint", "@nuxtjs/tailwindcss"],
  typescript: { strict: true },
  runtimeConfig: {
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    jwtSecret: process.env.JWT_SECRET,
    public: {
      googleClientId: process.env.NUXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
    },
  },
  css: ["~/assets/css/main.css"],
})
