import { useAccountPrefetch } from "../composables/use-account-prefetch"
import { usePublicProfilePrefetch } from "../composables/use-public-profile-prefetch"

export default defineNuxtPlugin(() => {
  const { warmAccount } = useAccountPrefetch()
  const { warmPublicProfilePath } = usePublicProfilePrefetch()

  const handleInteraction = (event: Event) => {
    const target = event.target
    if (!(target instanceof Element)) return

    const anchor = target.closest<HTMLAnchorElement>("a[href]")
    if (!anchor) return

    let url: URL
    try {
      url = new URL(anchor.href, window.location.origin)
    } catch {
      return
    }

    if (url.origin !== window.location.origin) return

    if (url.pathname === "/account" || url.pathname.startsWith("/account/")) {
      warmAccount(url.pathname)
      return
    }

    if (url.pathname.startsWith("/profile/")) {
      warmPublicProfilePath(url.pathname)
    }
  }

  document.addEventListener("pointerover", handleInteraction, { passive: true })
  document.addEventListener("focusin", handleInteraction)
})
