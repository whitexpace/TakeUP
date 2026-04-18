import { ref, computed, onMounted } from "vue"
import type { Wallet, WalletTransaction, LinkedAccount } from "~/types/wallet"

export const useWallet = () => {
  const wallet = ref<Wallet>({
    id: "w-1",
    balance: 0,
    currency: "PHP",
    status: "ACTIVE",
  })

  const transactions = ref<WalletTransaction[]>([])
  const isBalanceVisible = ref(true)
  const isLoading = ref(false)

  const linkedAccounts = ref<LinkedAccount[]>([
    { id: "la-1", type: "GCASH", accountName: "John Doe", accountNumber: "0912****567" },
    { id: "la-2", type: "LANDBANK", accountName: "John Doe", accountNumber: "1234********5678" },
    { id: "la-3", type: "MAYA", accountName: "John Doe", accountNumber: "0912****567" },
  ])

  // Persistent storage in localStorage for demo purposes
  const loadFromStorage = () => {
    const storedWallet = localStorage.getItem("takeup_wallet")
    const storedTransactions = localStorage.getItem("takeup_transactions")

    if (storedWallet) {
      wallet.value = JSON.parse(storedWallet)
    } else {
      // Default initial balance
      wallet.value.balance = 2500.0
      saveToStorage()
    }

    if (storedTransactions) {
      transactions.value = JSON.parse(storedTransactions)
    } else {
      // Mock some initial transactions
      transactions.value = [
        {
          id: "t-1",
          type: "TOP_UP",
          method: "PSEUDO",
          amount: 2500.0,
          balanceBefore: 0,
          balanceAfter: 2500.0,
          referenceCode: "WTX-20260417-0001",
          status: "SUCCESS",
          createdAt: new Date().toISOString(),
        },
      ]
      saveToStorage()
    }
  }

  const saveToStorage = () => {
    localStorage.setItem("takeup_wallet", JSON.stringify(wallet.value))
    localStorage.setItem("takeup_transactions", JSON.stringify(transactions.value))
  }

  onMounted(() => {
    loadFromStorage()
  })

  const toggleBalanceVisibility = () => {
    isBalanceVisible.value = !isBalanceVisible.value
  }

  const topUpPseudo = async (amount: number) => {
    isLoading.value = true
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800))

    const balanceBefore = wallet.value.balance
    const balanceAfter = balanceBefore + amount

    const newTransaction: WalletTransaction = {
      id: `t-${Date.now()}`,
      type: "TOP_UP",
      method: "PSEUDO",
      amount,
      balanceBefore,
      balanceAfter,
      referenceCode: `WTX-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(
        Math.random() * 10000,
      )
        .toString()
        .padStart(4, "0")}`,
      status: "SUCCESS",
      createdAt: new Date().toISOString(),
    }

    wallet.value.balance = balanceAfter
    transactions.value.unshift(newTransaction)
    saveToStorage()

    isLoading.value = false
    return { wallet: wallet.value, transaction: newTransaction }
  }

  const formattedBalance = computed(() => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(wallet.value.balance)
  })

  const maskedBalance = computed(() => {
    return "₱ ****.**"
  })

  return {
    wallet,
    transactions,
    isBalanceVisible,
    isLoading,
    linkedAccounts,
    toggleBalanceVisibility,
    topUpPseudo,
    formattedBalance,
    maskedBalance,
  }
}
