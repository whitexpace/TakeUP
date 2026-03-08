import type { ItemCardViewModel, ListedItem } from "../types/item-listing"

export const FALLBACK_ITEM_IMAGES = [
  "/images/popular/macbook.jpg",
  "/images/popular/scical.jpg",
  "/images/popular/camera.jpg",
  "/images/popular/dress.jpg",
]

type ItemCardMapOptions = {
  fallbackImages?: string[]
  trendingItemIds?: Set<string>
}

const formatCategory = (category: string | undefined) => {
  if (!category) return "General"
  return category
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export const mapListedItemToCard = (
  item: ListedItem,
  index: number,
  options: ItemCardMapOptions = {},
): ItemCardViewModel => {
  const fallbackImages = options.fallbackImages ?? FALLBACK_ITEM_IMAGES
  const image =
    item.thumbnailImage ?? item.photos[0] ?? fallbackImages[index % fallbackImages.length]!
  const isTrending = options.trendingItemIds?.has(item.id) ?? false

  return {
    id: item.id,
    type: item.freeToBorrow ? "Borrow" : "Rent",
    isTrending,
    image,
    category: formatCategory(item.categories[0]),
    name: item.name,
    rating: item.rating.toFixed(1),
    reviews: item.bookingCount,
    price: item.freeToBorrow ? undefined : item.rentalFee,
    owner: item.lenderId,
  }
}

export const mapListedItemsToCards = (items: ListedItem[], options: ItemCardMapOptions = {}) => {
  return items.map((item, index) => mapListedItemToCard(item, index, options))
}
