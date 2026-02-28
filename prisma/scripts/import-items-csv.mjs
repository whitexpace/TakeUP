import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const DEFAULT_INPUT = resolve("prisma/data/items.sample.csv")

function parseArgs(argv) {
  const out = { input: DEFAULT_INPUT, limit: null }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === "--input" && argv[i + 1]) {
      out.input = resolve(argv[i + 1])
      i += 1
    } else if (token === "--limit" && argv[i + 1]) {
      const value = Number(argv[i + 1])
      if (Number.isInteger(value) && value > 0) {
        out.limit = value
      }
      i += 1
    }
  }
  return out
}

function parseCsv(content) {
  const rows = []
  let field = ""
  let row = []
  let quoted = false

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]
    const next = content[i + 1]

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
      continue
    }

    if (char === ",") {
      row.push(field)
      field = ""
      continue
    }

    if (char === "\n") {
      row.push(field.replace(/\r$/, ""))
      rows.push(row)
      row = []
      field = ""
      continue
    }

    field += char
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""))
    rows.push(row)
  }

  if (rows.length === 0) return []
  const [header, ...dataRows] = rows
  return dataRows
    .filter((dataRow) => dataRow.some((value) => value.trim() !== ""))
    .map((dataRow) =>
      Object.fromEntries(header.map((key, index) => [key, dataRow[index] ?? ""])),
    )
}

function parseIntOrNull(value) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

function parseBooleanOrDefault(value, fallback = false) {
  if (!value) return fallback
  return value.trim().toLowerCase() === "true"
}

function parseJsonArray(value, fallback = []) {
  if (!value) return fallback
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function parseAvailability(value) {
  const raw = parseJsonArray(value, [])
  return raw
    .map((entry) => ({
      startDate: new Date(entry.startDate),
      endDate: new Date(entry.endDate),
      status: entry.status,
    }))
    .filter(
      (entry) =>
        entry.startDate instanceof Date &&
        !Number.isNaN(entry.startDate.getTime()) &&
        entry.endDate instanceof Date &&
        !Number.isNaN(entry.endDate.getTime()) &&
        typeof entry.status === "string",
    )
}

async function assertEnumsAndRefs(row, lenderIds, borrowerIds) {
  const validCondition = ["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"]
  const validStatus = ["AVAILABLE", "RENTED", "DEACTIVATED", "DELETED"]
  const validRate = ["PER_HOUR", "PER_DAY"]
  const validCategory = [
    "ELECTRONICS",
    "BOOKS",
    "CLOTHING",
    "TOOLS",
    "HOME_APPLIANCES",
    "SPORTS_OUTDOORS",
    "MUSIC_AUDIO",
    "TOYS_GAMES",
    "FURNITURE",
    "VEHICLES_ACCESSORIES",
    "HEALTH_BEAUTY",
    "SCHOOL_SUPPLIES",
    "PET_SUPPLIES",
    "OTHER",
  ]

  if (!validCondition.includes(row.condition)) {
    throw new Error(`Invalid condition: ${row.condition}`)
  }
  if (!validStatus.includes(row.status)) {
    throw new Error(`Invalid status: ${row.status}`)
  }
  if (!validRate.includes(row.rateOption)) {
    throw new Error(`Invalid rate option: ${row.rateOption}`)
  }

  const categories = parseJsonArray(row.categories, [])
  for (const category of categories) {
    if (!validCategory.includes(category)) {
      throw new Error(`Invalid category: ${category}`)
    }
  }

  if (row.lenderId && !lenderIds.has(row.lenderId)) {
    throw new Error(`Unknown lenderId: ${row.lenderId}`)
  }
  if (row.borrowerId && !borrowerIds.has(row.borrowerId)) {
    throw new Error(`Unknown borrowerId: ${row.borrowerId}`)
  }
}

async function main() {
  const { input, limit } = parseArgs(process.argv.slice(2))
  const csv = await readFile(input, "utf8")
  const allRows = parseCsv(csv)
  const rows = limit ? allRows.slice(0, limit) : allRows

  const [lenders, borrowers] = await Promise.all([
    prisma.lender.findMany({ select: { userId: true }, orderBy: { userId: "asc" } }),
    prisma.borrower.findMany({ select: { userId: true }, orderBy: { userId: "asc" } }),
  ])

  if (lenders.length === 0) {
    throw new Error("Cannot import items: no lenders found. Create at least one lender first.")
  }

  const lenderIds = lenders.map((entry) => entry.userId)
  const lenderSet = new Set(lenderIds)
  const borrowerSet = new Set(borrowers.map((entry) => entry.userId))
  let inserted = 0

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    await assertEnumsAndRefs(row, lenderSet, borrowerSet)

    const lenderId = row.lenderId || lenderIds[index % lenderIds.length]
    const borrowerId = row.borrowerId || null
    const tags = parseJsonArray(row.tags, [])
      .map((tag) => String(tag).trim().toLowerCase())
      .filter(Boolean)
    const categories = parseJsonArray(row.categories, []).filter(Boolean)
    const photos = parseJsonArray(row.photos, []).filter(Boolean)
    const availability = parseAvailability(row.availability)

    await prisma.item.create({
      data: {
        name: row.name,
        description: row.description || null,
        condition: row.condition,
        status: row.status,
        rateOption: row.rateOption,
        rentalFee: parseIntOrNull(row.rentalFee) ?? 0,
        replacementCost: parseIntOrNull(row.replacementCost),
        freeToBorrow: parseBooleanOrDefault(row.freeToBorrow, false),
        whatItemOffers: row.whatItemOffers || null,
        whatIsIncluded: row.whatIsIncluded || null,
        knownIssues: row.knownIssues || null,
        usageLimitations: row.usageLimitations || null,
        thumbnailImage: row.thumbnailImage || null,
        photos,
        isTrending: parseBooleanOrDefault(row.isTrending, false),
        viewCount: parseIntOrNull(row.viewCount) ?? 0,
        bookingCount: parseIntOrNull(row.bookingCount) ?? 0,
        likeCount: parseIntOrNull(row.likeCount) ?? 0,
        lenderId,
        borrowerId,
        categories: {
          create: categories.map((category) => ({ category })),
        },
        tags: {
          create: tags.map((name) => ({
            tag: {
              connectOrCreate: {
                where: { name },
                create: { name },
              },
            },
          })),
        },
        availability: {
          create: availability.map((entry) => ({
            startDate: entry.startDate,
            endDate: entry.endDate,
            status: entry.status,
          })),
        },
      },
    })

    inserted += 1
  }

  console.log(`Imported ${inserted} items from ${input}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
