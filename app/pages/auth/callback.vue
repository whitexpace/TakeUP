<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue"

const errorMessage = ref("")
const supabase = useSupabaseClient()
const route = useRoute()
const { startLoading, stopLoading } = useAppLoading()
let isCallbackActive = true

onBeforeUnmount(() => {
  isCallbackActive = false
})

const clearClientAuthState = () => {
  const { clear: clearAuthUser } = useAuthUser()
  const { clear: clearBridge } = useSessionBridge()
  const { clear: clearViewerSession } = useViewerSession()

  clearAuthUser()
  clearBridge()
  clearViewerSession()
}

const redirectHomeWithError = async (message: string, extraQuery = "") => {
  errorMessage.value = message
  if (!isCallbackActive) return

  await navigateTo(`/?error=${encodeURIComponent(message)}${extraQuery}`, { replace: true })
}

onMounted(async () => {
  startLoading()
  try {
    const oauthError =
      (typeof route.query.error_description === "string" && route.query.error_description) ||
      (typeof route.query.error === "string" && route.query.error) ||
      ""

    if (oauthError) {
      await redirectHomeWithError(oauthError)
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
      await redirectHomeWithError(msg)
      return
    }

    if (!email.endsWith("@up.edu.ph")) {
      await supabase.auth.signOut()
      clearClientAuthState()
      const msg = "Only up.edu.ph email addresses are allowed."
      await redirectHomeWithError(msg, "&status=blocked_domain")
      return
    }

    // Bridge Supabase session → custom JWT so account/listing APIs work
    const { ensureBridged } = useSessionBridge()
    const bridged = await ensureBridged(session.access_token)
    if (!bridged) {
      await supabase.auth.signOut().catch(() => undefined)
      clearClientAuthState()
      await redirectHomeWithError(
        "Google Sign-In could not establish an app session. Please try again.",
      )
      return
    }

    const { authUser: cachedAuthUser, fetch: fetchAuthUser } = useAuthUser()
    const authUser = cachedAuthUser.value ?? (await fetchAuthUser())
    if (!authUser) {
      await supabase.auth.signOut().catch(() => undefined)
      clearClientAuthState()
      await redirectHomeWithError(
        "Google Sign-In completed, but your TakeUP account could not be loaded. Please try again.",
      )
      return
    }

    await navigateTo(authUser.accountType === "ADMIN" ? "/admin/disputes" : "/dashboard", {
      replace: true,
    })
  } catch (error) {
    const msg =
      (error as { message?: string })?.message || "Google Sign-In failed. Please try again."
    await supabase.auth.signOut().catch(() => undefined)
    clearClientAuthState()
    await redirectHomeWithError(msg)
  } finally {
    stopLoading()
  }
})
</script>

<template>
  <main class="min-h-screen flex items-center justify-center px-6">
    <div v-if="errorMessage" class="max-w-lg text-center">
      <p class="font-geist text-xl text-cinnabar-red mb-3">{{ errorMessage }}</p>
      <NuxtLink to="/" class="font-geist text-burning-orange underline">Back to home</NuxtLink>
    </div>
  </main>
</template>
