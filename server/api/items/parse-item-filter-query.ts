type ItemFilterQuery = Record<string, unknown>

const parseListParam = (value: unknown) => {
  if (typeof value !== "string") return undefined

  const parts = value.split(",").filter(Boolean)
  return parts.length > 0 ? parts : undefined
}

const parseNumberParam = (value: unknown) => (typeof value === "string" ? Number(value) : undefined)

const parseBooleanParam = (value: unknown) => {
  if (value === "true") return true
  if (value === "false") return false
  return undefined
}

export const parseItemFilterQuery = (query: ItemFilterQuery) => {
  const parsed: Record<string, unknown> = {}

  if (typeof query.search === "string") parsed.search = query.search
  if (typeof query.status === "string") parsed.status = query.status

  const likedOnly = parseBooleanParam(query.likedOnly)
  if (likedOnly !== undefined) parsed.likedOnly = likedOnly

  const categories = parseListParam(query.categories)
  if (categories) parsed.categories = categories

  const conditions = parseListParam(query.conditions)
  if (conditions) parsed.conditions = conditions

  const tags = parseListParam(query.tags)
  if (tags) parsed.tags = tags

  const minPrice = parseNumberParam(query.minPrice)
  if (minPrice !== undefined) parsed.minPrice = minPrice

  const maxPrice = parseNumberParam(query.maxPrice)
  if (maxPrice !== undefined) parsed.maxPrice = maxPrice

  const freeToBorrow = parseBooleanParam(query.freeToBorrow)
  if (freeToBorrow !== undefined) parsed.freeToBorrow = freeToBorrow

  if (typeof query.availableFrom === "string") parsed.availableFrom = query.availableFrom
  if (typeof query.availableTo === "string") parsed.availableTo = query.availableTo

  const minRating = parseNumberParam(query.minRating)
  if (minRating !== undefined) parsed.minRating = minRating

  return parsed
}
