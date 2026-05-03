import { ref, computed, onMounted } from "vue"
import type { Wallet, WalletTransaction, LinkedAccount } from "~/types/wallet"

const DEFAULT_LINKED_ACCOUNTS: LinkedAccount[] = [
  { id: "la-1", type: "GCASH", accountName: "John Doe", accountNumber: "0912****567" },
  { id: "la-2", type: "LANDBANK", accountName: "John Doe", accountNumber: "1234********5678" },
  { id: "la-3", type: "MAYA", accountName: "John Doe", accountNumber: "0912****567" },
]

type UseWalletOptions = {
  basePath?: string
  linkedAccounts?: LinkedAccount[]
}

export const useWallet = (options: UseWalletOptions = {}) => {
  const basePath = options.basePath ?? "/api/wallet"
  const wallet = ref<Wallet | null>(null)
  const transactions = ref<WalletTransaction[]>([])
  const isBalanceVisible = ref(true)
  const isLoading = ref(false)
  const isInitialLoading = ref(true)

  const linkedAccounts = ref<LinkedAccount[]>(options.linkedAccounts ?? DEFAULT_LINKED_ACCOUNTS)

  const fetchWallet = async () => {
    try {
      const data = await $fetch<Wallet>(basePath)
      wallet.value = data
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
    } finally {
      isInitialLoading.value = false
    }
  }

  const fetchTransactions = async () => {
    try {
      const data = await $fetch<WalletTransaction[]>(`${basePath}/transactions`, {
        query: { take: 20 },
      })
      transactions.value = data
    } catch (error) {
      console.error("Failed to fetch transactions:", error)
    }
  }

  onMounted(async () => {
    await Promise.all([fetchWallet(), fetchTransactions()])
  })

  const toggleBalanceVisibility = () => {
    isBalanceVisible.value = !isBalanceVisible.value
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
      // Update local state
      wallet.value = result.wallet
      transactions.value.unshift(result.transaction)
      return result
    } catch (error) {
      console.error("Top-up failed:", error)
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
      // Update local state
      wallet.value = result.wallet
      transactions.value.unshift(result.transaction)
      return result
    } catch (error) {
      console.error("Payment failed:", error)
      throw error
    } finally {
      isLoading.value = false
    }
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
    payWithWallet,
    formattedBalance,
    maskedBalance,
    fetchWallet,
    fetchTransactions,
    balance: computed(() => getBalanceValue()),
  }
}
