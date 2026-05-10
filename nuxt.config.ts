// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@nuxt/eslint", "@nuxtjs/tailwindcss", "@nuxtjs/supabase", "@nuxt/icon"],
  typescript: { strict: true },
  runtimeConfig: {
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    jwtSecret: process.env.JWT_SECRET,
    supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET,
    platformCommissionRatePercent: process.env.PLATFORM_COMMISSION_RATE_PERCENT ?? "5",
    supabaseServiceRoleKey:
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY,
    public: {
      supabase: {
        url: process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
        key: process.env.NUXT_PUBLIC_SUPABASE_KEY || process.env.SUPABASE_KEY,
      },
      chatImageBucket: process.env.NUXT_PUBLIC_SUPABASE_CHAT_IMAGE_BUCKET || "chat-images",
      itemImageBucket: process.env.NUXT_PUBLIC_SUPABASE_ITEM_IMAGE_BUCKET || "item-images",
      userAvatarBucket: process.env.NUXT_PUBLIC_SUPABASE_USER_AVATAR_BUCKET || "user-avatars",
      googleClientId: process.env.NUXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
    },
  },
  supabase: {
    redirectOptions: {
      login: "/",
      callback: "/auth/callback",
      include: ["/dashboard*", "/account*", "/admin*", "/bag*"],
      exclude: ["/"],
    },
  },
  css: ["~/assets/css/main.css"],
})
