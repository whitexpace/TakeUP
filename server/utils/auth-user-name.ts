export type ProviderNameInput = {
  fullName?: string | null
  givenName?: string | null
  familyName?: string | null
}

export type ParsedAuthName = {
  firstName: string
  middleName: string | null
  lastName: string
  fullName: string
}

export type StoredAuthName = {
  firstName?: string | null
  middleName?: string | null
  lastName?: string | null
}

export const fallbackAuthName: ParsedAuthName = {
  firstName: "UP",
  middleName: null,
  lastName: "User",
  fullName: "UP User",
}

const NAME_FIELD_KEYS = {
  fullName: ["full_name", "name", "display_name"],
  givenName: ["given_name", "first_name"],
  familyName: ["family_name", "last_name"],
} as const

const normalizeName = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const normalized = value.replace(/\s+/g, " ").trim()
  if (!normalized || normalized.includes("@")) return null
  return normalized
}

const splitName = (value: string | null | undefined): string[] =>
  normalizeName(value)?.split(" ").filter(Boolean) ?? []

const sameText = (left: string | null | undefined, right: string | null | undefined) =>
  (left ?? "").trim().toLowerCase() === (right ?? "").trim().toLowerCase()

const endsWithParts = (parts: string[], suffix: string[]) => {
  if (suffix.length === 0 || suffix.length > parts.length) return false
  return suffix.every((part, index) => sameText(parts[parts.length - suffix.length + index], part))
}

const getStringField = (source: unknown, keys: readonly string[]): string | null => {
  if (!source || typeof source !== "object") return null
  const record = source as Record<string, unknown>

  for (const key of keys) {
    const value = normalizeName(record[key])
    if (value) return value
  }

  return null
}

const getObjectField = (source: unknown, key: string): Record<string, unknown> | null => {
  if (!source || typeof source !== "object") return null
  const value = (source as Record<string, unknown>)[key]
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

const getIdentityDataSources = (source: unknown): Record<string, unknown>[] => {
  if (!source || typeof source !== "object") return []
  const identities = (source as Record<string, unknown>).identities
  if (!Array.isArray(identities)) return []

  return identities.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return []
    const identityData = getObjectField(entry, "identity_data")
    return identityData ? [identityData] : []
  })
}

export function parseProviderName(input: ProviderNameInput): ParsedAuthName | null {
  const fullName = normalizeName(input.fullName)
  const givenName = normalizeName(input.givenName)
  const familyName = normalizeName(input.familyName)

  if (givenName && familyName) {
    const givenParts = splitName(givenName)
    const firstName = givenParts[0] ?? givenName
    let middleParts = givenParts.slice(1)

    if (fullName && middleParts.length === 0) {
      const fullParts = splitName(fullName)
      const familyParts = splitName(familyName)
      if (sameText(fullParts[0], firstName) && endsWithParts(fullParts, familyParts)) {
        middleParts = fullParts.slice(1, fullParts.length - familyParts.length)
      }
    }

    const middleName = middleParts.length > 0 ? middleParts.join(" ") : null
    return {
      firstName,
      middleName,
      lastName: familyName,
      fullName: [firstName, middleName, familyName].filter(Boolean).join(" "),
    }
  }

  if (fullName) {
    const parts = splitName(fullName)
    if (parts.length >= 2) {
      const firstName = parts[0] ?? ""
      const lastName = parts[parts.length - 1] ?? ""
      const middleParts = parts.slice(1, -1)
      const middleName = middleParts.length > 0 ? middleParts.join(" ") : null
      return {
        firstName,
        middleName,
        lastName,
        fullName: [firstName, middleName, lastName].filter(Boolean).join(" "),
      }
    }
  }

  return null
}

export function extractSupabaseProviderName(source: unknown): ParsedAuthName | null {
  const userMetadata = getObjectField(source, "user_metadata")
  const rawUserMetadata = getObjectField(source, "raw_user_meta_data")
  const dataSources = [
    userMetadata,
    rawUserMetadata,
    ...getIdentityDataSources(source),
    source && typeof source === "object" ? (source as Record<string, unknown>) : null,
  ].filter((entry): entry is Record<string, unknown> => Boolean(entry))

  const input: ProviderNameInput = {
    fullName: null,
    givenName: null,
    familyName: null,
  }

  for (const data of dataSources) {
    input.fullName ??= getStringField(data, NAME_FIELD_KEYS.fullName)
    input.givenName ??= getStringField(data, NAME_FIELD_KEYS.givenName)
    input.familyName ??= getStringField(data, NAME_FIELD_KEYS.familyName)
  }

  return parseProviderName(input)
}

export function isEmailDerivedPlaceholderName(user: StoredAuthName, email: string): boolean {
  const emailPrefix = email.split("@")[0]?.trim().toLowerCase()
  if (!emailPrefix) return false

  return (
    sameText(user.firstName, emailPrefix) &&
    !normalizeName(user.middleName) &&
    sameText(user.lastName, "User")
  )
}

export function isGenericFallbackName(user: StoredAuthName): boolean {
  return (
    sameText(user.firstName, fallbackAuthName.firstName) &&
    !normalizeName(user.middleName) &&
    sameText(user.lastName, fallbackAuthName.lastName)
  )
}

export function shouldReplaceStoredAuthName(user: StoredAuthName, email: string): boolean {
  return (
    !normalizeName(user.firstName) ||
    !normalizeName(user.lastName) ||
    isEmailDerivedPlaceholderName(user, email) ||
    isGenericFallbackName(user)
  )
}

export function buildAuthNameSyncData(
  providerName: ParsedAuthName | null,
  currentUser: StoredAuthName,
  email: string,
): { firstName: string; middleName: string | null; lastName: string } | null {
  if (!providerName || !shouldReplaceStoredAuthName(currentUser, email)) return null

  const next = {
    firstName: providerName.firstName,
    middleName: providerName.middleName,
    lastName: providerName.lastName,
  }

  if (
    sameText(currentUser.firstName, next.firstName) &&
    sameText(currentUser.middleName, next.middleName) &&
    sameText(currentUser.lastName, next.lastName)
  ) {
    return null
  }

  return next
}
