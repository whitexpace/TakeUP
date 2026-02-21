<script setup lang="ts">
import type { AuthErrorCode } from "../../../shared/schemas/auth"

type AuthErrorResponse = {
  error?: {
    code?: AuthErrorCode
    message?: string
  }
  data?: {
    error?: {
      code?: AuthErrorCode
      message?: string
    }
  }
  statusMessage?: string
}

const errorMessage = ref("")

function parseHashParams(): URLSearchParams {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash
  return new URLSearchParams(hash)
}

onMounted(async () => {
  try {
    const params = parseHashParams()
    const idToken = params.get("id_token")
    const state = params.get("state")

    const expectedState = sessionStorage.getItem("oauth_state")
    sessionStorage.removeItem("oauth_state")
    sessionStorage.removeItem("oauth_nonce")

    if (!idToken) {
      errorMessage.value = "Google Sign-In failed: missing ID token."
      return
    }

    if (!state || !expectedState || state !== expectedState) {
      errorMessage.value = "Google Sign-In failed: invalid auth state."
      return
    }

    await $fetch("/api/auth/google", {
      method: "POST",
      body: { idToken },
    })

    await navigateTo("/")
  } catch (error) {
    const payload = (error as { data?: AuthErrorResponse; message?: string })?.data
    const authError = payload?.error || payload?.data?.error
    errorMessage.value =
      authError?.message ||
      payload?.statusMessage ||
      (error as { message?: string })?.message ||
      "Google Sign-In failed. Please try again."
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
