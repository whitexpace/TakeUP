import type { ListedItem } from "../types/item-listing"

const normalizeSearchText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const tokenizeSearch = (value: string) => normalizeSearchText(value).split(/\s+/).filter(Boolean)

const buildSearchFields = (item: ListedItem) => {
  const text = normalizeSearchText(
    [
      item.name,
      item.description ?? "",
      item.condition,
      item.ownerName,
      ...item.categories,
      ...item.tags,
    ].join(" "),
  )

  return {
    name: normalizeSearchText(item.name),
    owner: normalizeSearchText(item.ownerName),
    condition: normalizeSearchText(item.condition),
    categories: item.categories.map(normalizeSearchText),
    tags: item.tags.map(normalizeSearchText),
    text,
  }
}

const getItemSearchScore = (item: ListedItem, query: string) => {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) {
    return 0
  }

  const tokens = tokenizeSearch(query)
  const fields = buildSearchFields(item)

  let score = 0

  if (fields.name === normalizedQuery) score += 120
  else if (fields.name.startsWith(normalizedQuery)) score += 90
  else if (fields.name.includes(normalizedQuery)) score += 70

  if (fields.owner === normalizedQuery) score += 80
  else if (fields.owner.startsWith(normalizedQuery)) score += 50
  else if (fields.owner.includes(normalizedQuery)) score += 35

  if (fields.condition.includes(normalizedQuery)) score += 25

  for (const category of fields.categories) {
    if (category === normalizedQuery) score += 45
    else if (category.startsWith(normalizedQuery)) score += 30
    else if (category.includes(normalizedQuery)) score += 20
  }

  for (const tag of fields.tags) {
    if (tag === normalizedQuery) score += 40
    else if (tag.startsWith(normalizedQuery)) score += 28
    else if (tag.includes(normalizedQuery)) score += 18
  }

  const allTokensMatch = tokens.every((token) => fields.text.includes(token))
  if (allTokensMatch) {
    score += tokens.length * 12
  }

  return score
}

export const filterListedItemsBySearch = (items: ListedItem[], query: string) => {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) {
    return items
  }

  return items
    .map((item, index) => ({
      item,
      index,
      score: getItemSearchScore(item, normalizedQuery),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return left.index - right.index
    })
    .map((entry) => entry.item)
}
