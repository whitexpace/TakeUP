import { computed, onMounted, watch } from "vue"

export interface BagItem {
  id: string
  name: string
  price: number
  priceUnit: string
  image: string
  startDate: Date | null
  endDate: Date | null
  startTime: string
  endTime: string
}

export const useBag = () => {
  const bagItems = useState<BagItem[]>("bag-items", () => [])

  // Initialize from localStorage on client side
  onMounted(() => {
    const savedBag = localStorage.getItem("takeup-bag")
    if (savedBag) {
      try {
        const parsed = JSON.parse(savedBag) as BagItem[]
        // Convert date strings back to Date objects
        bagItems.value = parsed.map((item) => ({
          ...item,
          startDate: item.startDate ? new Date(item.startDate) : null,
          endDate: item.endDate ? new Date(item.endDate) : null,
        }))
      } catch (e) {
        console.error("Failed to parse bag from localStorage", e)
      }
    }
  })

  // Persist to localStorage whenever bagItems changes
  watch(
    bagItems,
    (newItems) => {
      localStorage.setItem("takeup-bag", JSON.stringify(newItems))
    },
    { deep: true },
  )

  const addToBag = (item: BagItem) => {
    const exists = bagItems.value.some((i) => i.id === item.id)
    if (!exists) {
      bagItems.value.push(item)
    }
  }

  const removeFromBag = (id: string) => {
    const index = bagItems.value.findIndex((item) => item.id === id)
    if (index !== -1) {
      bagItems.value.splice(index, 1)
    }
  }

  const clearBag = () => {
    bagItems.value = []
  }

  const bagCount = computed(() => bagItems.value.length)

  return {
    bagItems,
    addToBag,
    removeFromBag,
    clearBag,
    bagCount,
  }
}
