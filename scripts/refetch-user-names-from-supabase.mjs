import { readFileSync } from "node:fs"
import { PrismaClient } from "@prisma/client"
import { createClient } from "@supabase/supabase-js"

const loadDotenv = () => {
  try {
    const contents = readFileSync(".env", "utf8")
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/)
      if (!match) continue
      const [, key, rawValue] = match
      if (!key || process.env[key]) continue
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, "")
    }
  } catch {
    // Environment variables can also be supplied by the shell/host.
  }
}

const normalizeName = (value) => {
  if (typeof value !== "string") return null
  const normalized = value.replace(/\s+/g, " ").trim()
  if (!normalized || normalized.includes("@")) return null
  return normalized
}

const sameText = (left, right) =>
  String(left ?? "")
    .trim()
    .toLowerCase() ===
  String(right ?? "")
    .trim()
    .toLowerCase()

const splitName = (value) => normalizeName(value)?.split(" ").filter(Boolean) ?? []

const endsWithParts = (parts, suffix) =>
  suffix.length > 0 &&
  suffix.length <= parts.length &&
  suffix.every((part, index) => sameText(parts[parts.length - suffix.length + index], part))

const getObjectField = (source, key) => {
  const value = source && typeof source === "object" ? source[key] : null
  return value && typeof value === "object" && !Array.isArray(value) ? value : null
}

const getStringField = (source, keys) => {
  for (const key of keys) {
    const value = normalizeName(source?.[key])
    if (value) return value
  }
  return null
}

const parseProviderName = ({ fullName, givenName, familyName }) => {
  fullName = normalizeName(fullName)
  givenName = normalizeName(givenName)
  familyName = normalizeName(familyName)

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
    return { firstName, middleName, lastName: familyName }
  }

  const parts = splitName(fullName)
  if (parts.length < 2) return null

  return {
    firstName: parts[0],
    middleName: parts.length > 2 ? parts.slice(1, -1).join(" ") : null,
    lastName: parts[parts.length - 1],
  }
}

const extractSupabaseProviderName = (user) => {
  const dataSources = [
    getObjectField(user, "user_metadata"),
    getObjectField(user, "raw_user_meta_data"),
    ...(Array.isArray(user?.identities)
      ? user.identities.map((identity) => getObjectField(identity, "identity_data")).filter(Boolean)
      : []),
    user,
  ].filter(Boolean)

  const input = { fullName: null, givenName: null, familyName: null }

  for (const data of dataSources) {
    input.fullName ??= getStringField(data, ["full_name", "name", "display_name"])
    input.givenName ??= getStringField(data, ["given_name", "first_name"])
    input.familyName ??= getStringField(data, ["family_name", "last_name"])
  }

  return parseProviderName(input)
}

const isPlaceholderName = (dbUser) => {
  const emailPrefix = dbUser.email.split("@")[0]
  return (
    ((sameText(dbUser.firstName, emailPrefix) && !normalizeName(dbUser.middleName)) ||
      (sameText(dbUser.firstName, "UP") && !normalizeName(dbUser.middleName))) &&
    sameText(dbUser.lastName, "User")
  )
}

const listAllSupabaseUsers = async (supabase) => {
  const users = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    users.push(...(data.users ?? []))
    if (!data.users || data.users.length < 1000) break
  }
  return users
}

loadDotenv()

const supabaseUrl = process.env.SUPABASE_URL || process.env.NUXT_PUBLIC_SUPABASE_URL
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY
const force = process.argv.includes("--force")
const dryRun = process.argv.includes("--dry-run")

if (!supabaseUrl || !serviceRoleKey || !process.env.DATABASE_URL) {
  throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and DATABASE_URL are required.")
}

const prisma = new PrismaClient()
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

try {
  const supabaseUsers = await listAllSupabaseUsers(supabase)
  const supabaseByEmail = new Map(
    supabaseUsers
      .map((user) => [String(user.email ?? "").toLowerCase(), user])
      .filter(([email]) => email),
  )

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      middleName: true,
      lastName: true,
    },
    orderBy: { email: "asc" },
  })

  let updated = 0
  let skippedNoProviderName = 0
  let skippedAlreadyNamed = 0

  for (const user of users) {
    if (!force && !isPlaceholderName(user)) {
      skippedAlreadyNamed += 1
      continue
    }

    const providerName = extractSupabaseProviderName(supabaseByEmail.get(user.email.toLowerCase()))
    if (!providerName) {
      skippedNoProviderName += 1
      continue
    }

    if (!dryRun) {
      await prisma.user.update({
        where: { id: user.id },
        data: providerName,
      })
    }
    updated += 1
  }

  process.stdout.write(
    [
      `[refetch-user-names] ${dryRun ? "Would update" : "Updated"} ${updated} user(s).`,
      `[refetch-user-names] Skipped ${skippedAlreadyNamed} already named user(s).`,
      `[refetch-user-names] Skipped ${skippedNoProviderName} user(s) with no provider name metadata.`,
    ].join("\n") + "\n",
  )
} finally {
  await prisma.$disconnect()
}
