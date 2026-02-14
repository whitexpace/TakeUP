// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@nuxtjs/supabase", "@nuxt/eslint", "@nuxtjs/tailwindcss"],
  css: ["./app/assets/css/main.css"],
  typescript: { strict: true },
  supabase: {
    redirectOptions: {
      login: "/login",
      callback: "/confirm",
      exclude: ["/", "/about", "/account"],
    },
  },
  css: ["~/assets/css/main.css"],
})
