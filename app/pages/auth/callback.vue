<script setup lang="ts">
const errorMessage = ref("")
const supabase = useSupabaseClient()

onMounted(async () => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const email = session?.user?.email?.toLowerCase() ?? ""
    if (!session || !email) {
      errorMessage.value = "Google Sign-In failed. No Supabase session was created."
      return
    }

    if (!email.endsWith("@up.edu.ph")) {
      await supabase.auth.signOut()
      errorMessage.value = "Only up.edu.ph email addresses are allowed."
      return
    }

    await navigateTo("/")
  } catch (error) {
    errorMessage.value =
      (error as { message?: string })?.message || "Google Sign-In failed. Please try again."
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
