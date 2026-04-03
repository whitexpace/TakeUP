import type { ListedItem } from "../types/item-listing"

const normalizeSearchText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const tokenizeSearch = (value: string) => normalizeSearchText(value).split(/\s+/).filter(Boolean)

const getFieldMatchScore = (
  field: string,
  query: string,
  scores: { exact: number; prefix: number; partial: number },
) => {
  if (!field) {
    return 0
  }

  if (field === query) return scores.exact
  if (field.startsWith(query)) return scores.prefix
  if (field.includes(query)) return scores.partial
  return 0
}

const buildSearchFields = (item: ListedItem) => {
  const lenderFields = [item.ownerName, item.lenderFullName ?? "", item.lenderUsername ?? ""]
    .map(normalizeSearchText)
    .filter(Boolean)
  const detailFields = [
    item.description ?? "",
    item.whatItemOffers ?? "",
    item.whatIsIncluded ?? "",
    item.knownIssues ?? "",
    item.usageLimitations ?? "",
  ]
    .map(normalizeSearchText)
    .filter(Boolean)
  const text = normalizeSearchText(
    [
      item.name,
      item.condition,
      ...lenderFields,
      ...item.categories,
      ...item.tags,
      ...detailFields,
    ].join(" "),
  )

  return {
    name: normalizeSearchText(item.name),
    lenders: lenderFields,
    condition: normalizeSearchText(item.condition),
    categories: item.categories.map(normalizeSearchText),
    tags: item.tags.map(normalizeSearchText),
    details: detailFields,
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

  score += getFieldMatchScore(fields.name, normalizedQuery, {
    exact: 120,
    prefix: 90,
    partial: 70,
  })

  for (const lender of fields.lenders) {
    score += getFieldMatchScore(lender, normalizedQuery, {
      exact: 80,
      prefix: 50,
      partial: 35,
    })
  }

  score += getFieldMatchScore(fields.condition, normalizedQuery, {
    exact: 25,
    prefix: 25,
    partial: 18,
  })

  for (const category of fields.categories) {
    score += getFieldMatchScore(category, normalizedQuery, {
      exact: 45,
      prefix: 30,
      partial: 20,
    })
  }

  for (const tag of fields.tags) {
    score += getFieldMatchScore(tag, normalizedQuery, {
      exact: 40,
      prefix: 28,
      partial: 18,
    })
  }

  for (const detail of fields.details) {
    score += getFieldMatchScore(detail, normalizedQuery, {
      exact: 26,
      prefix: 18,
      partial: 14,
    })
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
