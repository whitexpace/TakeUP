import { ref, computed, onMounted, watch } from "vue"
import type { Wallet, WalletTransaction, LinkedAccount } from "~/types/wallet"
import { useAccountPrefetch } from "./use-account-prefetch"
import { useAuthUser } from "./use-auth-user"
import { useViewerSession } from "./use-viewer-session"

const DEFAULT_LINKED_ACCOUNTS: LinkedAccount[] = [
  { id: "la-1", type: "GCASH", accountName: "John Doe", accountNumber: "0912****567" },
  { id: "la-2", type: "LANDBANK", accountName: "John Doe", accountNumber: "1234********5678" },
  { id: "la-3", type: "MAYA", accountName: "John Doe", accountNumber: "0912****567" },
]

const WALLET_CACHE_TTL_MS = 30_000
const WALLET_TRANSACTION_LIMIT = 20
const ANONYMOUS_VIEWER_KEY = "anonymous"

const pendingWalletRequests = new Map<string, Promise<Wallet | null>>()
const pendingTransactionRequests = new Map<string, Promise<WalletTransaction[]>>()
const pendingWalletPreviewRequests = new Map<string, Promise<WalletPreviewResponse | null>>()
let pendingWalletWarmup: Promise<void> | null = null

type WalletPreviewResponse = {
  wallet: Wallet
  transactions: WalletTransaction[]
  viewerKey?: string | null
}

type UseWalletOptions = {
  basePath?: string
  linkedAccounts?: LinkedAccount[]
  immediate?: boolean
}

export const useWallet = (options: UseWalletOptions = {}) => {
  const basePath = options.basePath ?? "/api/wallet"
  const stateKey = `wallet:${basePath}`
  const wallet = useState<Wallet | null>(`${stateKey}:wallet`, () => null)
  const transactions = useState<WalletTransaction[]>(`${stateKey}:transactions`, () => [])
  const walletViewerKey = useState<string>(`${stateKey}:viewer-key`, () => ANONYMOUS_VIEWER_KEY)
  const walletLastLoadedAt = useState<number | null>(`${stateKey}:wallet-loaded-at`, () => null)
  const transactionsLastLoadedAt = useState<number | null>(
    `${stateKey}:transactions-loaded-at`,
    () => null,
  )
  const isBalanceVisible = ref(true)
  const isLoading = ref(false)
  const isInitialLoading = ref(
    wallet.value === null ||
      walletLastLoadedAt.value === null ||
      transactionsLastLoadedAt.value === null,
  )

  const linkedAccounts = ref<LinkedAccount[]>(options.linkedAccounts ?? DEFAULT_LINKED_ACCOUNTS)
  const user = useSupabaseUser()
  const { authUser, hasFreshCache: hasFreshAuthUserCache, fetch: fetchAuthUser } = useAuthUser()
  const { ensureBridgedSession } = useViewerSession()
  const { warmAccount } = useAccountPrefetch()

  const getAvailableViewerKey = () => authUser.value?.id ?? user.value?.id ?? ANONYMOUS_VIEWER_KEY

  const resolveWalletViewerKey = async () => {
    if (import.meta.server || !user.value) {
      return null
    }

    if (!(await ensureBridgedSession())) {
      return null
    }

    if (!hasFreshAuthUserCache.value && !authUser.value) {
      await fetchAuthUser()
    }

    return authUser.value?.id ?? user.value?.id ?? null
  }

  const isFreshWalletCache = (viewerKey: string | null) =>
    Boolean(
      viewerKey &&
      viewerKey !== ANONYMOUS_VIEWER_KEY &&
      wallet.value &&
      walletViewerKey.value === viewerKey &&
      walletLastLoadedAt.value !== null &&
      Date.now() - walletLastLoadedAt.value < WALLET_CACHE_TTL_MS,
    )

  const isFreshTransactionsCache = (viewerKey: string | null) =>
    Boolean(
      viewerKey &&
      viewerKey !== ANONYMOUS_VIEWER_KEY &&
      walletViewerKey.value === viewerKey &&
      transactionsLastLoadedAt.value !== null &&
      Date.now() - transactionsLastLoadedAt.value < WALLET_CACHE_TTL_MS,
    )

  const setWalletViewerKey = (viewerKey: string | null | undefined) => {
    walletViewerKey.value = viewerKey || ANONYMOUS_VIEWER_KEY
  }

  const getCachedWalletPreview = (): WalletPreviewResponse | null => {
    if (!wallet.value) {
      return null
    }

    return {
      wallet: wallet.value,
      transactions: transactions.value,
      viewerKey: walletViewerKey.value,
    }
  }

  const applyWalletPreview = (preview: WalletPreviewResponse, fallbackViewerKey: string) => {
    const now = Date.now()
    wallet.value = preview.wallet
    transactions.value = preview.transactions.slice(0, WALLET_TRANSACTION_LIMIT)
    setWalletViewerKey(
      preview.viewerKey ??
        preview.wallet.userId ??
        preview.transactions.find((transaction) => transaction.userId)?.userId ??
        fallbackViewerKey,
    )
    walletLastLoadedAt.value = now
    transactionsLastLoadedAt.value = now
  }

  const clearWalletState = () => {
    wallet.value = null
    transactions.value = []
    walletViewerKey.value = ANONYMOUS_VIEWER_KEY
    walletLastLoadedAt.value = null
    transactionsLastLoadedAt.value = null
    isInitialLoading.value = true
  }

  watch(
    () => user.value?.id ?? null,
    (userId) => {
      if (!userId) {
        clearWalletState()
      }
    },
  )

  watch(
    () => authUser.value?.id ?? null,
    (viewerKey) => {
      if (
        viewerKey &&
        walletViewerKey.value !== ANONYMOUS_VIEWER_KEY &&
        walletViewerKey.value !== viewerKey
      ) {
        clearWalletState()
      }
    },
    { immediate: true },
  )

  const fetchWallet = async (options: { force?: boolean } = {}) => {
    const cachedViewerKey = getAvailableViewerKey()
    if (!options.force && isFreshWalletCache(cachedViewerKey)) {
      return wallet.value
    }

    const viewerKey = await resolveWalletViewerKey()
    if (!viewerKey) {
      return wallet.value
    }

    if (!options.force && isFreshWalletCache(viewerKey)) {
      return wallet.value
    }

    const requestKey = `${stateKey}:${viewerKey}:wallet`
    if (!options.force) {
      const pendingRequest = pendingWalletRequests.get(requestKey)
      if (pendingRequest) return pendingRequest
    }

    const request = (async () => {
      try {
        const data = await $fetch<Wallet>(basePath)
        wallet.value = data
        setWalletViewerKey(data.userId ?? viewerKey)
        walletLastLoadedAt.value = Date.now()
        return data
      } catch (error) {
        const err = error as {
          status?: number
          statusCode?: number
          data?: { message?: string }
          message?: string
        }
        console.error(
          "[useWallet:fetchWallet] FAILED status=",
          err?.status ?? err?.statusCode,
          "url=",
          basePath,
        )
        console.error("[useWallet:fetchWallet] server message:", err?.data?.message ?? err?.message)
        console.error("[useWallet:fetchWallet] full error:", error)
        return wallet.value
      } finally {
        pendingWalletRequests.delete(requestKey)
      }
    })()

    pendingWalletRequests.set(requestKey, request)
    return request
  }

  const fetchTransactions = async (options: { force?: boolean } = {}) => {
    const cachedViewerKey = getAvailableViewerKey()
    if (!options.force && isFreshTransactionsCache(cachedViewerKey)) {
      return transactions.value
    }

    const viewerKey = await resolveWalletViewerKey()
    if (!viewerKey) {
      return transactions.value
    }

    if (!options.force && isFreshTransactionsCache(viewerKey)) {
      return transactions.value
    }

    const requestKey = `${stateKey}:${viewerKey}:transactions`
    if (!options.force) {
      const pendingRequest = pendingTransactionRequests.get(requestKey)
      if (pendingRequest) return pendingRequest
    }

    const request = (async () => {
      try {
        const data = await $fetch<WalletTransaction[]>(`${basePath}/transactions`, {
          query: { take: WALLET_TRANSACTION_LIMIT },
        })
        transactions.value = data
        setWalletViewerKey(data.find((transaction) => transaction.userId)?.userId ?? viewerKey)
        transactionsLastLoadedAt.value = Date.now()
        return data
      } catch (error) {
        console.error("Failed to fetch transactions:", error)
        return transactions.value
      } finally {
        pendingTransactionRequests.delete(requestKey)
      }
    })()

    pendingTransactionRequests.set(requestKey, request)
    return request
  }

  const fetchWalletPreview = async (options: { force?: boolean } = {}) => {
    if (basePath !== "/api/wallet") {
      return null
    }

    const cachedViewerKey = getAvailableViewerKey()
    if (
      !options.force &&
      isFreshWalletCache(cachedViewerKey) &&
      isFreshTransactionsCache(cachedViewerKey)
    ) {
      return getCachedWalletPreview()
    }

    const viewerKey = await resolveWalletViewerKey()
    if (!viewerKey) {
      return null
    }

    if (!options.force && isFreshWalletCache(viewerKey) && isFreshTransactionsCache(viewerKey)) {
      return getCachedWalletPreview()
    }

    const requestKey = `${stateKey}:${viewerKey}:preview`
    if (!options.force) {
      const pendingRequest = pendingWalletPreviewRequests.get(requestKey)
      if (pendingRequest) return pendingRequest
    }

    const request = (async () => {
      try {
        const preview = await $fetch<WalletPreviewResponse>(`${basePath}/preview`, {
          query: { take: WALLET_TRANSACTION_LIMIT },
        })
        applyWalletPreview(preview, viewerKey)
        return preview
      } catch (error) {
        console.error("Failed to fetch wallet preview:", error)
        return null
      } finally {
        pendingWalletPreviewRequests.delete(requestKey)
      }
    })()

    pendingWalletPreviewRequests.set(requestKey, request)
    return request
  }

  const loadWalletData = async () => {
    try {
      const preview = await fetchWalletPreview()
      if (!preview) {
        await Promise.all([fetchWallet(), fetchTransactions()])
      }
    } finally {
      isInitialLoading.value = false
    }
  }

  const warmWallet = (targetPath = "/account/wallet") => {
    if (!import.meta.client) return Promise.resolve()

    if (pendingWalletWarmup) {
      return pendingWalletWarmup
    }

    pendingWalletWarmup = (async () => {
      await warmAccount(targetPath)
      const preview = await fetchWalletPreview()
      if (!preview) {
        await Promise.all([fetchWallet(), fetchTransactions()])
      }
    })()
      .catch(() => {})
      .finally(() => {
        pendingWalletWarmup = null
      })

    return pendingWalletWarmup
  }

  if (options.immediate !== false) {
    onMounted(() => {
      void loadWalletData()
    })
  }

  const applyWalletMutation = (result: { wallet: Wallet; transaction: WalletTransaction }) => {
    wallet.value = result.wallet
    setWalletViewerKey(result.wallet.userId ?? result.transaction.userId ?? getAvailableViewerKey())
    walletLastLoadedAt.value = Date.now()
    transactions.value = [
      result.transaction,
      ...transactions.value.filter((transaction) => transaction.id !== result.transaction.id),
    ].slice(0, WALLET_TRANSACTION_LIMIT)
    transactionsLastLoadedAt.value = Date.now()
  }

  const topUpPseudo = async (amount: number) => {
    isLoading.value = true
    try {
      const result = await $fetch<{ wallet: Wallet; transaction: WalletTransaction }>(
        `${basePath}/top-up`,
        {
          method: "POST",
          body: { amount },
        },
      )
      applyWalletMutation(result)
      return result
    } catch (error) {
      console.error("Top-up failed:", error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const withdrawPseudo = async (amount: number) => {
    isLoading.value = true
    try {
      const result = await $fetch<{ wallet: Wallet; transaction: WalletTransaction }>(
        `${basePath}/withdraw`,
        {
          method: "POST",
          body: { amount },
        },
      )
      applyWalletMutation(result)
      return result
    } catch (error) {
      console.error("Withdrawal failed:", error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const payWithWallet = async (
    amount: number,
    relatedEntityType: string,
    relatedEntityId: string,
  ) => {
    isLoading.value = true
    try {
      const result = await $fetch<{ wallet: Wallet; transaction: WalletTransaction }>(
        `${basePath}/pay`,
        {
          method: "POST",
          body: {
            amount,
            relatedEntityType,
            relatedEntityId,
          },
        },
      )
      applyWalletMutation(result)
      return result
    } catch (error) {
      console.error("Payment failed:", error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const toggleBalanceVisibility = () => {
    isBalanceVisible.value = !isBalanceVisible.value
  }

  const getBalanceValue = () => {
    if (!wallet.value) return 0
    const balance = wallet.value.balance
    return typeof balance === "object" && balance !== null
      ? Number(balance.toString())
      : Number(balance)
  }

  const formattedBalance = computed(() => {
    const balanceValue = getBalanceValue()
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(balanceValue)
  })

  const maskedBalance = computed(() => {
    return "₱ ****.**"
  })

  return {
    wallet,
    transactions,
    isBalanceVisible,
    isLoading,
    isInitialLoading,
    linkedAccounts,
    toggleBalanceVisibility,
    topUpPseudo,
    withdrawPseudo,
    payWithWallet,
    formattedBalance,
    maskedBalance,
    fetchWallet,
    fetchTransactions,
    fetchWalletPreview,
    loadWalletData,
    warmWallet,
    clearWalletState,
    balance: computed(() => getBalanceValue()),
  }
}
