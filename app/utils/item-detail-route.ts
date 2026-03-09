const ITEM_ID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const slugifyItemName = (name: string) => {
  return name
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export const buildItemDetailSlug = (item: { id: string; name: string }) => {
  const slug = slugifyItemName(item.name)
  return slug ? `${slug}--${item.id}` : item.id
}

export const buildItemDetailPath = (item: { id: string; name: string }) => {
  return `/items/${buildItemDetailSlug(item)}`
}

export const extractItemIdFromSlug = (slug: string) => {
  const match = slug.match(ITEM_ID_PATTERN)
  return match ? match[0] : null
}
