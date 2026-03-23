import type { inferRouterOutputs } from "@trpc/server"
import { computed, onMounted } from "vue"
import type { AppRouter } from "../../server/trpc/routers"

type RouterOutputs = inferRouterOutputs<AppRouter>
type CartListResponse = RouterOutputs["cart"]["list"]

export type BagItem = CartListResponse["items"][number]

type AddToBagInput = {
  itemId: string
  startAt: Date
  endAt: Date
}

let pendingLoad: Promise<void> | null = null

export const useBag = () => {
  const bagItems = useState<BagItem[]>("bag-items", () => [])
  const isLoading = useState<boolean>("bag-loading", () => false)
  const hasLoaded = useState<boolean>("bag-loaded", () => false)
  const errorMessage = useState<string | null>("bag-error-message", () => null)

  const getAuthHeaders = async () => {
    const supabase = useSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      return undefined
    }

    return {
      Authorization: `Bearer ${session.access_token}`,
    }
  }

  const loadBag = async (options: { force?: boolean } = {}) => {
    if (pendingLoad && !options.force) {
      await pendingLoad
      return
    }

    if (hasLoaded.value && !options.force) {
      return
    }

    pendingLoad = (async () => {
      isLoading.value = true

      try {
        const headers = await getAuthHeaders()
        const result = await $fetch<CartListResponse>("/api/cart", { headers })
        bagItems.value = result.items
        errorMessage.value = null
      } catch (error: unknown) {
        const statusCode = (error as { statusCode?: number })?.statusCode

        if (statusCode === 401) {
          bagItems.value = []
          errorMessage.value = null
          return
        }

        if (statusCode === 403) {
          bagItems.value = []
          errorMessage.value = "Only borrower accounts can use the bag."
          return
        }

        errorMessage.value = "Unable to load your bag right now."
      } finally {
        hasLoaded.value = true
        isLoading.value = false
        pendingLoad = null
      }
    })()

    await pendingLoad
  }

  const addToBag = async (input: AddToBagInput) => {
    const headers = await getAuthHeaders()
    const entry = await $fetch<BagItem>("/api/cart", {
      method: "POST",
      body: {
        itemId: input.itemId,
        startAt: input.startAt.toISOString(),
        endAt: input.endAt.toISOString(),
      },
      headers,
    })

    const existingIndex = bagItems.value.findIndex((item) => item.id === entry.id)
    if (existingIndex === -1) {
      bagItems.value = [entry, ...bagItems.value]
    } else {
      bagItems.value.splice(existingIndex, 1, entry)
    }

    hasLoaded.value = true
    errorMessage.value = null

    return entry
  }

  const removeFromBag = async (id: string) => {
    const headers = await getAuthHeaders()

    await $fetch(`/api/cart/${id}`, {
      method: "DELETE",
      headers,
    })

    bagItems.value = bagItems.value.filter((item) => item.id !== id)
  }

  const hasItemWithWindow = (itemId: string, startAt: Date, endAt: Date) =>
    bagItems.value.some(
      (item) =>
        item.itemId === itemId &&
        new Date(item.startAt).getTime() === startAt.getTime() &&
        new Date(item.endAt).getTime() === endAt.getTime(),
    )

  onMounted(() => {
    void loadBag()
  })

  return {
    bagItems,
    isLoading,
    errorMessage,
    bagCount: computed(() => bagItems.value.length),
    addToBag,
    removeFromBag,
    loadBag,
    hasItemWithWindow,
  }
}
