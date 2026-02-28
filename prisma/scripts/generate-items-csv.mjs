import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

const ITEM_CONDITIONS = ["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"]
const ITEM_STATUSES = ["AVAILABLE", "AVAILABLE", "AVAILABLE", "RENTED", "DEACTIVATED"]
const RATE_OPTIONS = ["PER_HOUR", "PER_DAY"]
const ITEM_CATEGORIES = [
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
const ITEM_NAMES = [
  "Cordless Drill",
  "Digital Camera",
  "Camping Tent",
  "Acoustic Guitar",
  "Mountain Bike",
  "Projector",
  "Study Lamp",
  "Microwave Oven",
  "Toolbox Set",
  "Portable Speaker",
  "Office Chair",
  "Graphic Tablet",
  "Soldering Kit",
  "Stand Mixer",
  "Power Bank",
  "Sewing Machine",
  "Whiteboard Stand",
  "Wireless Microphone",
  "Badminton Racket Set",
  "Pressure Washer",
]
const TAG_POOL = [
  "campus",
  "student-friendly",
  "weekend-use",
  "clean",
  "portable",
  "battery",
  "home",
  "events",
  "project",
  "tools",
  "electronics",
  "sports",
  "audio",
  "kitchen",
  "study",
]
const CSV_HEADERS = [
  "name",
  "description",
  "condition",
  "status",
  "rateOption",
  "rentalFee",
  "replacementCost",
  "freeToBorrow",
  "whatItemOffers",
  "whatIsIncluded",
  "knownIssues",
  "usageLimitations",
  "thumbnailImage",
  "photos",
  "categories",
  "tags",
  "isTrending",
  "viewCount",
  "bookingCount",
  "likeCount",
  "lenderId",
  "borrowerId",
  "availability",
]

const DEFAULT_OUTPUT = resolve("prisma/data/items.sample.csv")
const DEFAULT_COUNT = 100

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickOne(items) {
  return items[randomInt(0, items.length - 1)]
}

function pickMany(items, count) {
  const copy = [...items]
  const out = []
  while (copy.length > 0 && out.length < count) {
    out.push(copy.splice(randomInt(0, copy.length - 1), 1)[0])
  }
  return out
}

function boolToString(value) {
  return value ? "true" : "false"
}

function csvEscape(value) {
  if (value === null || value === undefined) return ""
  const text = String(value)
  if (text.includes('"') || text.includes(",") || text.includes("\n") || text.includes("\r")) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

function buildAvailability(baseDate) {
  const firstStart = new Date(baseDate.getTime())
  const firstEnd = new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000)
  const secondStart = new Date(baseDate.getTime() + 5 * 24 * 60 * 60 * 1000)
  const secondEnd = new Date(baseDate.getTime() + 9 * 24 * 60 * 60 * 1000)
  return [
    {
      startDate: firstStart.toISOString(),
      endDate: firstEnd.toISOString(),
      status: "AVAILABLE",
    },
    {
      startDate: secondStart.toISOString(),
      endDate: secondEnd.toISOString(),
      status: "AVAILABLE",
    },
  ]
}

function buildRow(index) {
  const nameRoot = pickOne(ITEM_NAMES)
  const name = `${nameRoot} #${String(index + 1).padStart(3, "0")}`
  const condition = pickOne(ITEM_CONDITIONS)
  const status = pickOne(ITEM_STATUSES)
  const rateOption = pickOne(RATE_OPTIONS)
  const freeToBorrow = Math.random() < 0.2
  const rentalFee = freeToBorrow ? 0 : randomInt(20, 350)
  const replacementCost = randomInt(900, 12500)
  const categoryCount = randomInt(1, 3)
  const categories = pickMany(ITEM_CATEGORIES, categoryCount)
  const tags = pickMany(TAG_POOL, randomInt(2, 4))
  const views = randomInt(0, 2500)
  const bookings = randomInt(0, 80)
  const likes = randomInt(0, 150)
  const trending = views > 900 || likes > 60
  const imageSeed = index + 1
  const thumbnailImage = `https://picsum.photos/seed/item-${imageSeed}/640/480`
  const photos = [
    thumbnailImage,
    `https://picsum.photos/seed/item-${imageSeed}-a/1024/768`,
    `https://picsum.photos/seed/item-${imageSeed}-b/1024/768`,
  ]
  const dateOffsetDays = randomInt(1, 45)
  const now = new Date()
  const start = new Date(now.getTime() + dateOffsetDays * 24 * 60 * 60 * 1000)

  return {
    name,
    description: `${nameRoot} in ${condition.toLowerCase().replaceAll("_", " ")} condition.`,
    condition,
    status,
    rateOption,
    rentalFee: String(rentalFee),
    replacementCost: String(replacementCost),
    freeToBorrow: boolToString(freeToBorrow),
    whatItemOffers: "Reliable performance for school or home tasks.",
    whatIsIncluded: "Main unit, charger/accessory kit, and carrying case.",
    knownIssues: Math.random() < 0.28 ? "Minor cosmetic scratches." : "",
    usageLimitations: "Return cleaned and on time; indoor use preferred.",
    thumbnailImage,
    photos: JSON.stringify(photos),
    categories: JSON.stringify(categories),
    tags: JSON.stringify(tags),
    isTrending: boolToString(trending),
    viewCount: String(views),
    bookingCount: String(bookings),
    likeCount: String(likes),
    lenderId: "",
    borrowerId: "",
    availability: JSON.stringify(buildAvailability(start)),
  }
}

function parseArgs(argv) {
  const out = {
    output: DEFAULT_OUTPUT,
    count: DEFAULT_COUNT,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === "--output" && argv[i + 1]) {
      out.output = resolve(argv[i + 1])
      i += 1
    } else if (token === "--count" && argv[i + 1]) {
      const value = Number(argv[i + 1])
      if (Number.isInteger(value) && value > 0) {
        out.count = value
      }
      i += 1
    }
  }

  return out
}

async function main() {
  const { output, count } = parseArgs(process.argv.slice(2))
  const rows = Array.from({ length: count }, (_, index) => buildRow(index))
  const lines = [
    CSV_HEADERS.map(csvEscape).join(","),
    ...rows.map((row) => CSV_HEADERS.map((header) => csvEscape(row[header])).join(",")),
  ]
  const csv = `${lines.join("\n")}\n`

  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, csv, "utf8")

  console.log(`Generated ${count} sample items at ${output}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
