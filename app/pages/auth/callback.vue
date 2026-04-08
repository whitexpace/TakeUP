<script setup lang="ts">
const errorMessage = ref("")
const supabase = useSupabaseClient()
const route = useRoute()

onMounted(async () => {
  try {
    const oauthError =
      (typeof route.query.error_description === "string" && route.query.error_description) ||
      (typeof route.query.error === "string" && route.query.error) ||
      ""

    if (oauthError) {
      await navigateTo(`/?error=${encodeURIComponent(oauthError)}`)
      return
    }

    const code = typeof route.query.code === "string" ? route.query.code : ""
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        throw error
      }
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const email = session?.user?.email?.toLowerCase() ?? ""
    if (!session || !email) {
      const msg = "Google Sign-In failed. No Supabase session was created."
      await navigateTo(`/?error=${encodeURIComponent(msg)}`)
      return
    }

    if (!email.endsWith("@up.edu.ph")) {
      await supabase.auth.signOut()
      const msg = "Only up.edu.ph email addresses are allowed."
      await navigateTo(`/?error=${encodeURIComponent(msg)}&status=blocked_domain`)
      return
    }

    // Bridge Supabase session → custom JWT so account/listing APIs work
    await $fetch("/api/auth/supabase-session", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).catch(() => undefined)

    await navigateTo("/dashboard")
  } catch (error) {
    const msg =
      (error as { message?: string })?.message || "Google Sign-In failed. Please try again."
    await navigateTo(`/?error=${encodeURIComponent(msg)}`)
  }
})
</script>

<template>
  <main class="min-h-screen flex items-center justify-center px-6">
    <div class="max-w-lg text-center">
      <p v-if="!errorMessage" class="font-geist text-xl text-noble-black">Signing you in...</p>
      <div v-else>
        <p class="font-geist text-xl text-cinnabar-red mb-3">{{ errorMessage }}</p>
        <NuxtLink to="/" class="font-geist text-burning-orange underline">Back to home</NuxtLink>
      </div>
    </div>
  </main>
</template>
