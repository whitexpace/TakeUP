import { useAccountPrefetch } from "../composables/use-account-prefetch"
import { useBookingDetailPrefetch } from "../composables/use-booking-detail-prefetch"
import { usePublicProfilePrefetch } from "../composables/use-public-profile-prefetch"
import { useTransactionHistoryPrefetch } from "../composables/use-transactions"
import { useWallet } from "../composables/use-wallet"

export default defineNuxtPlugin(() => {
  const { warmAccount } = useAccountPrefetch()
  const { warmBookingDetail } = useBookingDetailPrefetch()
  const { warmPublicProfilePath } = usePublicProfilePrefetch()
  const { warmTransactionHistory } = useTransactionHistoryPrefetch()
  const { warmWallet } = useWallet({ immediate: false })

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

    if (url.pathname.startsWith("/account/transactions/")) {
      void warmBookingDetail(url.pathname, { priority: true }).catch(() => {})
      return
    }

    if (url.pathname === "/account/transactions") {
      const role = url.searchParams.get("role") === "LENDER" ? "LENDER" : "BORROWER"
      void warmTransactionHistory(role, {
        targetPath: `${url.pathname}${url.search}`,
        priority: role === "LENDER",
        prefetchNextPage: role === "BORROWER",
      })
      return
    }

    if (url.pathname === "/account/wallet" || url.pathname.startsWith("/account/wallet/")) {
      void warmWallet(url.pathname)
      return
    }

    if (url.pathname === "/account" || url.pathname.startsWith("/account/")) {
      void warmAccount(url.pathname)
      return
    }

    if (url.pathname.startsWith("/profile/")) {
      warmPublicProfilePath(url.pathname)
    }
  }

  document.addEventListener("pointerover", handleInteraction, { passive: true })
  document.addEventListener("focusin", handleInteraction)
})
