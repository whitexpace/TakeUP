<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue"

const errorMessage = ref("")
const supabase = useSupabaseClient()
const route = useRoute()
const { startLoading, stopLoading } = useAppLoading()
const OAUTH_SESSION_WAIT_MS = 5_000
let isCallbackActive = true
let cancelSessionWait: (() => void) | null = null

onBeforeUnmount(() => {
  isCallbackActive = false
  cancelSessionWait?.()
  cancelSessionWait = null
})

type SupabaseSession = Awaited<
  ReturnType<ReturnType<typeof useSupabaseClient>["auth"]["getSession"]>
>["data"]["session"]

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

const getCurrentSupabaseSession = async (): Promise<SupabaseSession> => {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session
}

const waitForSupabaseSession = async (): Promise<SupabaseSession> => {
  const currentSession = await getCurrentSupabaseSession()
  if (currentSession) return currentSession

  return await new Promise((resolve) => {
    let isSettled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let subscription: { unsubscribe: () => void } | null = null

    const cleanup = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      subscription?.unsubscribe()
      cancelSessionWait = null
    }

    const finish = (nextSession: SupabaseSession) => {
      if (isSettled) return
      isSettled = true
      cleanup()
      resolve(nextSession)
    }

    const authListener = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession) {
        finish(nextSession)
      }
    })
    subscription = authListener.data.subscription

    cancelSessionWait = () => finish(null)
    timeoutId = setTimeout(() => {
      void getCurrentSupabaseSession()
        .then(finish)
        .catch(() => finish(null))
    }, OAUTH_SESSION_WAIT_MS)
  })
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

    const session = await waitForSupabaseSession()

    const email = session?.user?.email?.toLowerCase() ?? ""
    if (!session || !email) {
      const msg = "Google Sign-In failed. No Supabase session was created."
      await redirectHomeWithError(msg)
      return
    }

    if (!email.endsWith("@up.edu.ph") && !email.endsWith("@gmail.com")) {
      await supabase.auth.signOut()
      clearClientAuthState()
      const msg = "Only up.edu.ph and gmail.com email addresses are allowed."
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
    <div class="max-w-lg text-center">
      <p v-if="!errorMessage" class="font-geist text-xl text-noble-black">Signing you in...</p>
      <div v-else>
        <p class="font-geist text-xl text-cinnabar-red mb-3">{{ errorMessage }}</p>
        <NuxtLink to="/" class="font-geist text-burning-orange underline">Back to home</NuxtLink>
      </div>
    </div>
  </main>
</template>
